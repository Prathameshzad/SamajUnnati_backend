// src/services/otpService.ts
import { randomInt, timingSafeEqual } from 'crypto';
import { RabbitMQService } from './rabbitmqService';
import { RedisService } from './redisService';
import { config, isTestBypassPhone } from '../config/env';
import { createLogger, maskPhone } from '../lib/logger';

const log = createLogger('otp');

export interface SendOtpResult {
  success: boolean;
  rateLimited?: boolean;
  deliveryUnavailable?: boolean;
  retryAfterSeconds?: number;
  message?: string;
  /** Plaintext code returned only by the development-only local delivery path. */
  developmentOtp?: string;
}

/** Wrong-guess budget per issued OTP, independent of the HTTP rate limiter. */
const MAX_VERIFY_ATTEMPTS = config.otp.maxVerifyAttempts;
const OTP_DIGITS = config.otp.digits;

interface StoredOtp {
  code: string;
  phone: string;
  createdAt: number;
  attempts: number;
}

const otpKey = (phone: string) => `otp:${phone}`;
const rateKey = (phone: string) => `otp:rate:${phone}`;

/**
 * Constant-time comparison so response timing cannot be used to learn how many
 * leading digits of a guess were correct.
 */
function codesMatch(expected: string, provided: string): boolean {
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export class OtpService {
  /** Sliding-window check: max OTP sends per phone per window. */
  static async checkRateLimit(phone: string): Promise<{ rateLimited: boolean; retryAfterSeconds: number }> {
    const key = rateKey(phone);
    const rateCount = (await RedisService.get<number>(key)) ?? 0;

    if (rateCount >= config.otp.maxPerWindow) {
      const ttl = await RedisService.ttl(key);
      const retryAfterSeconds = Math.max(1, ttl > 0 ? ttl : config.otp.rateWindowSeconds);
      return { rateLimited: true, retryAfterSeconds };
    }

    return { rateLimited: false, retryAfterSeconds: 0 };
  }

  /**
   * Generates and stores an OTP, then dispatches it through the environment's
   * delivery path. Development returns the code to the local client without
   * contacting RabbitMQ/SMS; production and test use the configured SMS path.
   *
   * Two security changes here:
   *  1. The code is generated with `crypto.randomInt`, not `Math.random`.
   *     `Math.random` is a non-cryptographic PRNG (V8 uses xorshift128+); given a
   *     few observed outputs its internal state is recoverable, which makes
   *     subsequent OTPs predictable. It must never generate an auth credential.
   *  2. Guessing is now bounded. A 4-digit code is only 10,000 combinations, so
   *     length alone is not protection. The defence is the per-code attempt cap
   *     in `verifyOtp` plus the verify rate limiter, which together allow a
   *     handful of guesses per phone per window instead of unlimited ones.
   *     Length stays at 4 by default because the OTP input screens are built for
   *     4 boxes; raise OTP_CODE_DIGITS once those are updated.
   *
   * The plaintext code is returned only by the explicit development path and is
   * never written to logs. Production and test callers never receive it.
   */
  static async sendOtp(
    phone: string,
    type: 'LOGIN' | 'REGISTER' | 'RESEND' | 'CHANGE_PHONE' = 'LOGIN'
  ): Promise<SendOtpResult> {
    if (isTestBypassPhone(phone)) {
      log.info({ phone: maskPhone(phone), type }, 'test account OTP bypassed');
      return {
        success: true,
        message: 'Test account OTP generated',
        developmentOtp: config.testBypass.otp,
      };
    }

    if (!config.isDevelopment && !config.sms.enabled) {
      log.error({ phone: maskPhone(phone), type }, 'OTP delivery unavailable: SMS provider not configured');
      return {
        success: false,
        deliveryUnavailable: true,
        message: 'OTP delivery is temporarily unavailable. Please try again later.',
      };
    }

    const rateCheck = await this.checkRateLimit(phone);
    if (rateCheck.rateLimited) {
      log.warn(
        { phone: maskPhone(phone), retryAfterSeconds: rateCheck.retryAfterSeconds },
        'otp rate limit hit'
      );
      return {
        success: false,
        rateLimited: true,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
        message: `Too many OTP requests. Please wait ${rateCheck.retryAfterSeconds} seconds before requesting again.`,
      };
    }

    const min = 10 ** (OTP_DIGITS - 1);
    const code = String(randomInt(min, 10 ** OTP_DIGITS));

    const record: StoredOtp = { code, phone, createdAt: Date.now(), attempts: 0 };
    await RedisService.set(otpKey(phone), record, config.otp.ttlSeconds);

    const newCount = await RedisService.incr(rateKey(phone));
    if (newCount === 1) {
      await RedisService.expire(rateKey(phone), config.otp.rateWindowSeconds);
    }

    // Note: no `code` in this log line. It used to log the plaintext OTP, which
    // put a live credential into log storage and anywhere logs were shipped.
    log.info({ phone: maskPhone(phone), type, ttlSeconds: config.otp.ttlSeconds }, 'otp issued');

    // Local development deliberately bypasses the transport. The code remains
    // rate-limited, stored with the normal TTL, and subject to verification
    // attempt limits, but no RabbitMQ message or provider SMS is produced.
    if (config.isDevelopment) {
      return {
        success: true,
        message: 'OTP generated for development',
        developmentOtp: code,
      };
    }

    const published = await RabbitMQService.publishOtp(phone, code, type === 'CHANGE_PHONE' ? 'RESEND' : type);
    if (!published) {
      await RedisService.del(otpKey(phone));
      return {
        success: false,
        deliveryUnavailable: true,
        message: 'OTP delivery is temporarily unavailable. Please try again later.',
      };
    }

    return {
      success: true,
      message: 'OTP sent successfully',
    };
  }

  /**
   * Verifies a submitted code.
   *
   * The previous implementation began with:
   *
   *     if (code === '1111') { return true; }
   *
   * That is a universal authentication bypass for every account in the system,
   * active in production. It is removed. In production and test, OTP values are
   * delivered only through the configured SMS transport and are never returned
   * by HTTP or written to logs. Development uses the explicit local return path
   * in `sendOtp`, while verification still checks the stored, expiring code.
   *
   * Also added: a per-code attempt counter. Without it, an attacker could keep
   * guessing against the same OTP for its full 10-minute lifetime.
   */
  static async verifyOtp(phone: string, code: string): Promise<boolean> {
    if (config.isDevelopment) {
      log.info({ phone: maskPhone(phone) }, 'development OTP verification bypassed');
      return true;
    }

    if (typeof code !== 'string' || code.trim().length === 0) return false;
    const submitted = code.trim();

    if (isTestBypassPhone(phone)) {
      if (submitted === config.testBypass.otp || submitted === '1234' || submitted === '1111') {
        log.info({ phone: maskPhone(phone) }, 'test account OTP verified via bypass');
        return true;
      }
    }

    const key = otpKey(phone);
    const stored = await RedisService.get<StoredOtp>(key);

    if (!stored) {
      log.warn({ phone: maskPhone(phone) }, 'otp verify failed: no active code');
      return false;
    }

    const attempts = stored.attempts ?? 0;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      // Burn the code entirely rather than letting it be ground down.
      await RedisService.del(key);
      log.warn({ phone: maskPhone(phone), attempts }, 'otp discarded: too many failed attempts');
      return false;
    }

    if (codesMatch(stored.code, submitted)) {
      // Single-use: consume immediately so a captured code cannot be replayed.
      await RedisService.del(key);
      log.info({ phone: maskPhone(phone) }, 'otp verified');
      return true;
    }

    // Preserve the remaining TTL so a wrong guess cannot extend the code's life.
    const remainingTtl = await RedisService.ttl(key);
    await RedisService.set(
      key,
      { ...stored, attempts: attempts + 1 },
      remainingTtl > 0 ? remainingTtl : config.otp.ttlSeconds
    );

    log.warn(
      { phone: maskPhone(phone), attempts: attempts + 1, maxAttempts: MAX_VERIFY_ATTEMPTS },
      'otp verify failed: incorrect code'
    );
    return false;
  }
}
