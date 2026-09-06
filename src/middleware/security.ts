// src/middleware/security.ts
/**
 * Transport-level security headers and CORS policy.
 *
 * Before: `app.use(cors())` — which reflects *any* Origin and sets
 * `Access-Control-Allow-Origin: *`. Combined with a bearer token in
 * localStorage that is a workable base for cross-origin abuse, and it meant any
 * website could call the API from a victim's browser. There were also no
 * security headers at all (no nosniff, no frame protection, no HSTS).
 */
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';
import { config } from '../config/env';
import { AppError } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('security');

/**
 * Native mobile apps (Expo/React Native) send no `Origin` header, so a missing
 * origin must be allowed — it cannot be a browser cross-origin request.
 * Browser requests are matched against the explicit allowlist.
 */
function originChecker(): CorsOptions['origin'] {
  const allowed = config.cors.origins;

  if (allowed.length === 0) {
    if (config.isProduction) {
      // Unreachable: env validation already refuses to boot. Belt and braces.
      throw new Error('CORS_ORIGINS must be configured in production');
    }
    log.warn('CORS_ORIGINS is empty — reflecting request origin (development only)');
    return true;
  }

  const allowSet = new Set(allowed.map((o) => o.toLowerCase().replace(/\/$/, '')));

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowSet.has(origin.toLowerCase().replace(/\/$/, ''))) return callback(null, true);
    log.warn({ origin }, 'blocked cross-origin request');
    callback(new AppError('FORBIDDEN', 'Origin not allowed'));
  };
}

export const corsMiddleware: RequestHandler = cors({
  origin: originChecker(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Accept', 'Accept-Language'],
  // Lets clients read the correlation ID and the server-side timing we emit.
  exposedHeaders: ['X-Request-Id', 'Server-Timing', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 86_400,
  optionsSuccessStatus: 204,
});

export const securityHeaders: RequestHandler = helmet({
  // This is a JSON API, not an HTML app. A restrictive CSP prevents any
  // accidentally-served HTML (or an error page) from loading external resources.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },
  // API responses are never framed.
  frameguard: { action: 'deny' },
  // Stops browsers from MIME-sniffing a response into something executable —
  // relevant because user-uploaded files are served from a public bucket.
  noSniff: true,
  referrerPolicy: { policy: 'no-referrer' },
  crossOriginResourcePolicy: { policy: 'same-site' },
  // Only meaningful over HTTPS; harmless otherwise.
  hsts: config.isProduction
    ? { maxAge: 31_536_000, includeSubDomains: true, preload: false }
    : false,
  // Hides the default `X-Powered-By: Express` fingerprint.
  hidePoweredBy: true,
});
