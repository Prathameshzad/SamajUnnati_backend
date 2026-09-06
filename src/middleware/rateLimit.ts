// src/middleware/rateLimit.ts
/**
 * Tiered rate limiting.
 *
 * Before this, the only limiting anywhere was the OTP counter inside
 * OtpService (3 per 15 min per phone). Everything else was unlimited:
 *  - `POST /api/auth/check-phone` could be used to enumerate which phone
 *    numbers are registered, at any rate.
 *  - `POST /api/upload` (which had no auth at all) could be used to fill the
 *    R2 bucket.
 *  - `GET /api/relations/tree/full` could be hammered to force cache misses
 *    and drive Postgres load.
 *
 * Limits are Redis-backed so they hold across multiple app instances. If Redis
 * is unavailable the limiter degrades to per-process memory rather than failing
 * open entirely.
 */
import { rateLimit, ipKeyGenerator, type Options, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';
import type { RequestHandler, Request } from 'express';
import { AppError } from '../lib/errors';
import { config } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('rate-limit');

/**
 * Dedicated Redis connection for rate limiting, separate from
 * `RedisService`'s cache connection.
 *
 * Why a second connection: `rate-limit-redis`'s `RedisStore` constructor
 * issues `SCRIPT LOAD` commands immediately and unconditionally, with no
 * `.catch()`. Rate limiters are built once at module-load time (see the
 * `export const xLimiter = build(...)` calls below), which runs before Redis
 * has necessarily finished connecting. `RedisService`'s client is
 * deliberately configured with `enableOfflineQueue: false` so a down cache
 * fails fast instead of adding latency to every request — but that same
 * setting makes those eager, unawaited `SCRIPT LOAD` calls throw synchronously
 * as unhandled promise rejections, which is fatal (see lib/shutdown.ts) and
 * crashed the server on every boot before Redis finished connecting.
 *
 * Rate limiting has different tolerance than caching: queuing a handful of
 * commands for the second it takes Redis to connect at startup is fine here,
 * so this connection keeps `enableOfflineQueue: true`.
 */
const rateLimitRedis = new Redis(config.redis.url, {
  retryStrategy: (times) => Math.min(times * 200, 5_000),
  maxRetriesPerRequest: 3,
  enableOfflineQueue: true,
  lazyConnect: false,
});

rateLimitRedis.on('error', (err) => {
  log.warn({ err: err.message }, 'rate-limit redis connection error (falling back to in-memory limiting)');
});

let rateLimitRedisAvailable = true;
rateLimitRedis.on('ready', () => {
  rateLimitRedisAvailable = true;
});
rateLimitRedis.on('end', () => {
  rateLimitRedisAvailable = false;
});

/**
 * A distinct Redis store per limiter so their counters never collide.
 * Returns undefined when the connection has permanently ended, which makes
 * express-rate-limit fall back to its in-memory store.
 */
function makeStore(prefix: string): Store | undefined {
  if (!rateLimitRedisAvailable) return undefined;

  return new RedisStore({
    prefix: `rl:${prefix}:`,
    // rate-limit-redis speaks raw Redis commands; ioredis exposes `call`.
    sendCommand: (...args: string[]) => (rateLimitRedis as any).call(...args),
  }) as unknown as Store;
}

/** Closes the dedicated rate-limit Redis connection. Called during shutdown. */
export const closeRateLimitRedis = async (): Promise<void> => {
  try {
    await rateLimitRedis.quit();
  } catch {
    rateLimitRedis.disconnect();
  }
};

/** Safe IPv6-aware client key. Falls back if the helper is unavailable. */
function ipKey(req: Request): string {
  const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
  try {
    return ipKeyGenerator(ip);
  } catch {
    return ip;
  }
}

/** Authenticated requests are limited per user; anonymous ones per IP. */
function userOrIpKey(req: Request): string {
  const userId = (req as any).user?.id;
  return userId ? `u:${userId}` : `ip:${ipKey(req)}`;
}

/**
 * Limits abuse of phone-number endpoints by the *number being targeted*, not just
 * the caller's IP, so rotating IPs cannot brute-force a single account.
 */
function phoneKey(req: Request): string {
  const raw = (req.body as any)?.phone;
  const digits = typeof raw === 'string' ? raw.replace(/\D/g, '').slice(-10) : '';
  return digits ? `ph:${digits}` : `ip:${ipKey(req)}`;
}

interface LimiterSpec {
  name: string;
  windowMs: number;
  limit: number;
  message: string;
  keyGenerator?: (req: Request) => string;
  /** Successful responses don't consume quota — useful for login-style endpoints. */
  skipSuccessfulRequests?: boolean;
}

function build(spec: LimiterSpec): RequestHandler {
  if (!config.http.rateLimitEnabled) {
    log.warn({ limiter: spec.name }, 'rate limiting disabled by configuration');
    return (_req, _res, next) => next();
  }

  const options: Partial<Options> = {
    windowMs: spec.windowMs,
    limit: spec.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: spec.keyGenerator ?? userOrIpKey,
    skipSuccessfulRequests: spec.skipSuccessfulRequests ?? false,
    store: makeStore(spec.name),
    // Route through the central error handler so the response shape is uniform
    // and the event is logged once, with the request ID attached.
    handler: (req, res, next) => {
      const retryAfterSeconds = Math.ceil(
        ((req as any).rateLimit?.resetTime
          ? ((req as any).rateLimit.resetTime.getTime() - Date.now())
          : spec.windowMs) / 1000
      );
      res.setHeader('Retry-After', String(Math.max(1, retryAfterSeconds)));
      next(
        new AppError('RATE_LIMITED', spec.message, {
          details: { retryAfterSeconds: Math.max(1, retryAfterSeconds), limiter: spec.name },
        })
      );
    },
  };

  return rateLimit(options);
}

/**
 * Phone-number entry points. Deliberately tight: these both send SMS (cost)
 * and reveal whether an account exists (enumeration).
 */
export const authPhoneLimiter = build({
  name: 'auth-phone',
  windowMs: 15 * 60 * 1000,
  limit: 10,
  keyGenerator: phoneKey,
  message: 'Too many attempts for this phone number. Please try again later.',
});

/** Per-IP ceiling on all auth traffic, independent of which number is targeted. */
export const authIpLimiter = build({
  name: 'auth-ip',
  windowMs: 15 * 60 * 1000,
  limit: 60,
  keyGenerator: (req) => `ip:${ipKey(req)}`,
  message: 'Too many authentication attempts from this network. Please try again later.',
});

/** OTP verification: brute-forcing a 4-digit code needs far fewer than 10 tries to be stopped. */
export const otpVerifyLimiter = build({
  name: 'otp-verify',
  windowMs: 15 * 60 * 1000,
  limit: 8,
  keyGenerator: phoneKey,
  skipSuccessfulRequests: true,
  message: 'Too many incorrect codes. Please request a new OTP.',
});

/** Registration is a write that creates rows; keep it modest per IP. */
export const registerLimiter = build({
  name: 'register',
  windowMs: 60 * 60 * 1000,
  limit: 15,
  keyGenerator: (req) => `ip:${ipKey(req)}`,
  message: 'Too many registration attempts. Please try again later.',
});

/** Generous default for authenticated reads so normal browsing is never throttled. */
export const readLimiter = build({
  name: 'read',
  windowMs: 60 * 1000,
  limit: 600,
  message: 'Too many requests. Please slow down.',
});

/** Mutations are cheaper to abuse and more expensive to serve. */
export const writeLimiter = build({
  name: 'write',
  windowMs: 60 * 1000,
  limit: 120,
  message: 'Too many changes in a short period. Please slow down.',
});

/** Uploads consume bandwidth and permanent storage. */
export const uploadLimiter = build({
  name: 'upload',
  windowMs: 60 * 60 * 1000,
  limit: 100,
  message: 'Upload limit reached. Please try again later.',
});

/** Expensive graph/tree reads that can miss cache and hit Postgres hard. */
export const heavyReadLimiter = build({
  name: 'heavy-read',
  windowMs: 60 * 1000,
  limit: 60,
  message: 'Too many tree requests. Please slow down.',
});
