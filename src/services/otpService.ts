// src/services/otpService.ts
import { RabbitMQService } from './rabbitmqService';
import { RedisService } from './redisService';

export interface SendOtpResult {
  success: boolean;
  rateLimited?: boolean;
  retryAfterSeconds?: number;
  message?: string;
  code?: string;
}

const OTP_TTL_SECONDS = 10 * 60; // 10 minutes
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60; // 15 minutes
const MAX_OTPS_PER_WINDOW = 3;

export class OtpService {
  /**
   * Check rate limit: Max 3 OTPs in 15 minutes per phone via Redis
   */
  static async checkRateLimit(phone: string): Promise<{ rateLimited: boolean; retryAfterSeconds: number }> {
    const rateKey = `otp:rate:${phone}`;
    const rateCount = await RedisService.get<number>(rateKey) || 0;

    if (rateCount >= MAX_OTPS_PER_WINDOW) {
      const ttl = await RedisService.ttl(rateKey);
      const retryAfterSeconds = Math.max(1, ttl > 0 ? ttl : RATE_LIMIT_WINDOW_SECONDS);
      return { rateLimited: true, retryAfterSeconds };
    }

    return { rateLimited: false, retryAfterSeconds: 0 };
  }

  /**
   * Generate, persist in Redis with TTL, and publish OTP via RabbitMQ
   */
  static async sendOtp(phone: string, type: 'LOGIN' | 'REGISTER' | 'RESEND' = 'LOGIN'): Promise<SendOtpResult> {
    // 1. Rate Limit Check (3 OTPs / 15 mins)
    const rateCheck = await this.checkRateLimit(phone);
    if (rateCheck.rateLimited) {
      console.warn(`[OTP SERVICE] Rate limit hit for ${phone}. Retry after ${rateCheck.retryAfterSeconds}s`);
      return {
        success: false,
        rateLimited: true,
        retryAfterSeconds: rateCheck.retryAfterSeconds,
        message: `Too many OTP requests. Please wait ${rateCheck.retryAfterSeconds} seconds before requesting again.`,
      };
    }

    // 2. Generate OTP (Generate 4-digit code)
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    // 3. Store OTP in Redis with 10-min expiration
    const otpKey = `otp:${phone}`;
    await RedisService.set(otpKey, { code, phone, createdAt: Date.now() }, OTP_TTL_SECONDS);

    // 4. Update Rate Limit Counter in Redis
    const rateKey = `otp:rate:${phone}`;
    const newCount = await RedisService.incr(rateKey);
    if (newCount === 1) {
      await RedisService.expire(rateKey, RATE_LIMIT_WINDOW_SECONDS);
    }

    console.log(`[OTP SERVICE] Generated OTP ${code} for ${phone} in Redis [TTL: ${OTP_TTL_SECONDS}s]`);

    // 5. Publish OTP event to RabbitMQ
    await RabbitMQService.publishOtp(phone, code, type);

    return {
      success: true,
      code,
      message: 'OTP sent successfully',
    };
  }

  /**
   * Verify the OTP code from Redis.
   * Accepts latest generated OTP for phone or fallback "1111".
   */
  static async verifyOtp(phone: string, code: string): Promise<boolean> {
    // Support test fallback "1111"
    if (code === '1111') {
      console.log(`[OTP SERVICE] Verified fallback OTP 1111 for ${phone}`);
      return true;
    }

    const otpKey = `otp:${phone}`;
    const stored = await RedisService.get<{ code: string; phone: string }>(otpKey);

    if (stored && stored.code === code) {
      // Invalidate used OTP from Redis
      await RedisService.del(otpKey);
      console.log(`[OTP SERVICE] Verified OTP ${code} for ${phone} via Redis`);
      return true;
    }

    console.warn(`[OTP SERVICE] Failed to verify OTP ${code} for ${phone}`);
    return false;
  }
}
