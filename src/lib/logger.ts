// src/lib/logger.ts
/**
 * Structured logging.
 *
 * Replaces ad-hoc `console.log` / `console.error` throughout the codebase.
 *
 * Why it matters for production:
 *  - `console.log` is a *synchronous, blocking* write to stdout. Under load, one
 *    log line per request (the old `[timestamp] GET /url` middleware plus the
 *    per-request log in both API clients) blocks the event loop on every request
 *    and measurably caps throughput.
 *  - pino writes structured NDJSON asynchronously and is level-gated, so
 *    debug-level noise costs nothing when LOG_LEVEL=info.
 *  - The old logs also leaked PII: full URLs with `?phone=...`, OTP codes, and
 *    whole user records. Redaction is now centralised here.
 */
import pino from 'pino';
import { config } from '../config/env';

/**
 * Paths scrubbed from every log record.
 * Add to this list rather than hand-sanitising at call sites.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'jwt',
  'secret',
  'otp',
  'code',
  'phone',
  'whatsapp',
  'email',
  'address',
  'dateOfBirth',
  '*.password',
  '*.token',
  '*.otp',
  '*.phone',
  '*.email',
];

export const logger = pino({
  level: config.logLevel,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  base: { service: 'samajunati-api', env: config.env },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  // Pretty output locally; raw NDJSON in production so log shippers can parse it.
  ...(config.isProduction
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'HH:MM:ss.l', ignore: 'pid,hostname,service,env' },
        },
      }),
});

/** Child logger for a subsystem, e.g. `createLogger('redis')`. */
export const createLogger = (module: string) => logger.child({ module });

/**
 * Masks a phone number for the rare case it must appear in a log line
 * (for example rate-limit diagnostics): 9876543210 -> 98****3210
 */
export const maskPhone = (phone: string | null | undefined): string => {
  if (!phone) return '(none)';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length < 6) return '*'.repeat(digits.length);
  return `${digits.slice(0, 2)}${'*'.repeat(digits.length - 6)}${digits.slice(-4)}`;
};
