// src/config/env.ts
/**
 * Single, validated source of truth for all environment configuration.
 *
 * Why this exists:
 *  - Previously `process.env.X || 'some-default'` was scattered across the codebase
 *    (jwt.ts, r2.ts, redisService.ts, rabbitmqService.ts, prisma.ts, socket.ts).
 *    Those inline fallbacks silently booted the app with insecure defaults
 *    (e.g. JWT secret 'change-me-please', a hardcoded public R2 bucket URL).
 *  - Config errors now fail at startup with a clear message instead of surfacing
 *    as a 500 on the first request that happens to need them.
 */
import 'dotenv/config';
import { z } from 'zod';

/** Secrets that must never be used in production, even if they parse as valid. */
const FORBIDDEN_JWT_SECRETS = new Set([
  'change-me-please',
  'super-secret-jwt-key',
  'secret',
  'changeme',
  'test',
]);

const csv = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const boolFromString = (defaultValue: boolean) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') return defaultValue;
      return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase());
    });

const intFromString = (defaultValue: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined || value.trim() === '') return defaultValue;
      const parsed = Number(value);
      if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) {
        ctx.addIssue({ code: 'custom', message: `must be an integer, received "${value}"` });
        return z.NEVER;
      }
      if (parsed < min || parsed > max) {
        ctx.addIssue({ code: 'custom', message: `must be between ${min} and ${max}, received ${parsed}` });
        return z.NEVER;
      }
      return parsed;
    });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: intFromString(8000, 1, 65535),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  /**
   * Postgres pool size. The old hardcoded value was 5 ("keep small for free tiers"),
   * which capped concurrency for the whole process regardless of host capacity.
   */
  DATABASE_POOL_MAX: intFromString(20, 1, 500),
  DATABASE_POOL_IDLE_TIMEOUT_MS: intFromString(30_000, 1_000, 600_000),
  DATABASE_CONNECT_TIMEOUT_MS: intFromString(10_000, 1_000, 120_000),
  DATABASE_STATEMENT_TIMEOUT_MS: intFromString(15_000, 0, 300_000),

  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  JWT_EXPIRES_IN: z.string().default('30d'),
  JWT_ISSUER: z.string().default('samajunati-api'),
  JWT_AUDIENCE: z.string().default('samajunati-app'),

  REDIS_URL: z.string().default('redis://localhost:6379'),
  RABBITMQ_URL: z.string().default('amqp://localhost:5672'),

  CLOUDFLARE_R2_ACCOUNT_ID: z.string().optional(),
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().optional(),
  CLOUDFLARE_R2_PUBLIC_DOMAIN: z.string().optional(),

  /** Comma-separated allowlist. Empty in development means "reflect any origin". */
  CORS_ORIGINS: z.string().optional(),

  /**
   * Returns the generated OTP in the HTTP response. This is a debugging aid only.
   * It used to be keyed off `NODE_ENV !== 'production'`, which meant the deployed
   * container (NODE_ENV=development in docker-compose) was handing OTPs to callers.
   * It is now opt-in and force-disabled in production.
   */
  OTP_DEBUG_RESPONSE: boolFromString(false),
  OTP_TTL_SECONDS: intFromString(10 * 60, 30, 3600),
  OTP_MAX_PER_WINDOW: intFromString(3, 1, 100),
  OTP_RATE_WINDOW_SECONDS: intFromString(15 * 60, 60, 86_400),
  /**
   * Defaults to 4 because the web (app/login, app/signup) and mobile (app/index)
   * screens render a fixed 4-box OTP input and gate submission on `length === 4`.
   * Raising this requires updating those three screens first. Brute force is
   * already contained by the per-code attempt cap and the verify rate limiter.
   */
  OTP_CODE_DIGITS: intFromString(4, 4, 10),
  /** Wrong guesses allowed against a single issued code before it is discarded. */
  OTP_MAX_VERIFY_ATTEMPTS: intFromString(5, 1, 20),

  /** User IDs permitted to call maintenance/admin endpoints. */
  ADMIN_USER_IDS: z.string().optional(),

  /** Number of proxy hops to trust for client IP resolution (rate limiting correctness). */
  TRUST_PROXY_HOPS: intFromString(0, 0, 10),

  RATE_LIMIT_ENABLED: boolFromString(true),
  BODY_LIMIT: z.string().default('256kb'),

  MAX_IMAGE_UPLOAD_BYTES: intFromString(5 * 1024 * 1024, 1024, 100 * 1024 * 1024),
  MAX_VIDEO_UPLOAD_BYTES: intFromString(50 * 1024 * 1024, 1024, 500 * 1024 * 1024),
  MAX_DOCUMENT_UPLOAD_BYTES: intFromString(10 * 1024 * 1024, 1024, 100 * 1024 * 1024),

  /** Fallback to local disk when R2 is unavailable. Unbounded disk growth, so off in prod. */
  ALLOW_LOCAL_UPLOAD_FALLBACK: boolFromString(true),

  CACHE_TREE_TTL_SECONDS: intFromString(1800, 10, 86_400),
  CACHE_CONFIG_TTL_SECONDS: intFromString(3600, 10, 86_400),

  /** Requests slower than this are logged at warn level so latency regressions are visible. */
  SLOW_REQUEST_MS: intFromString(1000, 1, 60_000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
    .join('\n');
  // Intentionally console + exit: the logger itself depends on this config.
  console.error(`\nInvalid environment configuration:\n${details}\n`);
  process.exit(1);
}

const raw = parsed.data;
const isProduction = raw.NODE_ENV === 'production';

/** Production-only invariants that a schema alone cannot express. */
const fatal: string[] = [];

if (isProduction) {
  if (raw.JWT_SECRET.length < 32) {
    fatal.push('JWT_SECRET must be at least 32 characters in production.');
  }
  if (FORBIDDEN_JWT_SECRETS.has(raw.JWT_SECRET.toLowerCase())) {
    fatal.push('JWT_SECRET is a known placeholder value and must be rotated before production.');
  }
  if (csv(raw.CORS_ORIGINS).length === 0) {
    fatal.push('CORS_ORIGINS must list at least one allowed origin in production.');
  }
  const r2Configured =
    raw.CLOUDFLARE_R2_ACCOUNT_ID &&
    raw.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    raw.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    raw.CLOUDFLARE_R2_BUCKET_NAME &&
    raw.CLOUDFLARE_R2_PUBLIC_DOMAIN;
  if (!r2Configured) {
    fatal.push(
      'All CLOUDFLARE_R2_* variables (including CLOUDFLARE_R2_PUBLIC_DOMAIN) are required in production.'
    );
  }
}

if (fatal.length > 0) {
  console.error(`\nRefusing to start:\n${fatal.map((m) => `  - ${m}`).join('\n')}\n`);
  process.exit(1);
}

const r2Enabled = Boolean(
  raw.CLOUDFLARE_R2_ACCOUNT_ID &&
    raw.CLOUDFLARE_R2_ACCESS_KEY_ID &&
    raw.CLOUDFLARE_R2_SECRET_ACCESS_KEY &&
    raw.CLOUDFLARE_R2_BUCKET_NAME
);

export const config = {
  env: raw.NODE_ENV,
  isProduction,
  isDevelopment: raw.NODE_ENV === 'development',
  isTest: raw.NODE_ENV === 'test',
  port: raw.PORT,
  logLevel: raw.LOG_LEVEL,

  database: {
    url: raw.DATABASE_URL,
    poolMax: raw.DATABASE_POOL_MAX,
    idleTimeoutMs: raw.DATABASE_POOL_IDLE_TIMEOUT_MS,
    connectTimeoutMs: raw.DATABASE_CONNECT_TIMEOUT_MS,
    statementTimeoutMs: raw.DATABASE_STATEMENT_TIMEOUT_MS,
  },

  jwt: {
    secret: raw.JWT_SECRET,
    expiresIn: raw.JWT_EXPIRES_IN,
    issuer: raw.JWT_ISSUER,
    audience: raw.JWT_AUDIENCE,
    algorithm: 'HS256' as const,
  },

  redis: { url: raw.REDIS_URL },
  rabbitmq: { url: raw.RABBITMQ_URL },

  r2: {
    enabled: r2Enabled,
    accountId: raw.CLOUDFLARE_R2_ACCOUNT_ID,
    accessKeyId: raw.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: raw.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    bucketName: raw.CLOUDFLARE_R2_BUCKET_NAME,
    publicDomain: raw.CLOUDFLARE_R2_PUBLIC_DOMAIN?.replace(/\/$/, ''),
  },

  cors: { origins: csv(raw.CORS_ORIGINS) },

  otp: {
    // In development, automatically return the OTP so the frontend can auto-fill.
    // In production, strictly enforce that OTP is never echoed in HTTP responses.
    debugResponse: !isProduction && (raw.NODE_ENV === 'development' || raw.OTP_DEBUG_RESPONSE),
    ttlSeconds: raw.OTP_TTL_SECONDS,
    maxPerWindow: raw.OTP_MAX_PER_WINDOW,
    rateWindowSeconds: raw.OTP_RATE_WINDOW_SECONDS,
    digits: raw.OTP_CODE_DIGITS,
    maxVerifyAttempts: raw.OTP_MAX_VERIFY_ATTEMPTS,
  },

  adminUserIds: new Set(csv(raw.ADMIN_USER_IDS)),

  http: {
    trustProxyHops: raw.TRUST_PROXY_HOPS,
    bodyLimit: raw.BODY_LIMIT,
    rateLimitEnabled: raw.RATE_LIMIT_ENABLED,
    slowRequestMs: raw.SLOW_REQUEST_MS,
  },

  uploads: {
    maxImageBytes: raw.MAX_IMAGE_UPLOAD_BYTES,
    maxVideoBytes: raw.MAX_VIDEO_UPLOAD_BYTES,
    maxDocumentBytes: raw.MAX_DOCUMENT_UPLOAD_BYTES,
    allowLocalFallback: raw.ALLOW_LOCAL_UPLOAD_FALLBACK && !isProduction,
  },

  cache: {
    treeTtlSeconds: raw.CACHE_TREE_TTL_SECONDS,
    configTtlSeconds: raw.CACHE_CONFIG_TTL_SECONDS,
  },
} as const;

export type AppConfig = typeof config;
