// src/middleware/integrationAuth.ts
/**
 * Auth + CORS for /api/integration, the read-only reporting API consumed by the
 * Ads Management panel.
 *
 * - Auth: a single shared secret (INTEGRATION_API_KEY), sent as
 *   `Authorization: Bearer <key>` or `X-Api-Key: <key>`. The panel's backend
 *   holds the key and calls this API server-to-server, so the key never reaches
 *   a browser. App-user JWTs are NOT accepted here.
 * - CORS: its own strict allowlist (INTEGRATION_ALLOWED_ORIGINS), independent of
 *   the app's CORS_ORIGINS. Requests without an Origin (server-to-server) pass;
 *   browser requests from any other origin are rejected.
 */
import crypto from 'crypto';
import cors from 'cors';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { config } from '../config/env';
import { AppError, unauthenticated } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('integration');

/** Hash first so both buffers are equal length, then compare in constant time. */
const safeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

const normalize = (o: string) => o.toLowerCase().replace(/\/$/, '');
const allowedOrigins = new Set(config.integration.allowedOrigins.map(normalize));

export const integrationCors: RequestHandler = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.has(normalize(origin))) return callback(null, true);
    log.warn({ origin }, 'blocked cross-origin integration request');
    callback(new AppError('FORBIDDEN', 'Origin not allowed'));
  },
  credentials: false,
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'X-Api-Key', 'Content-Type', 'X-Request-Id', 'Accept'],
  exposedHeaders: ['X-Request-Id', 'RateLimit', 'RateLimit-Policy', 'Retry-After'],
  maxAge: 86_400,
  optionsSuccessStatus: 204,
});

export const integrationAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const key = config.integration.apiKey;
  if (!key) {
    next(new AppError('FORBIDDEN', 'Integration API is disabled'));
    return;
  }
  const bearer = /^Bearer[ ]+(.+)$/i.exec((req.headers.authorization ?? '').trim())?.[1]?.trim();
  const header = req.headers['x-api-key'];
  const provided = bearer || (typeof header === 'string' ? header.trim() : '');
  if (!provided || !safeEqual(provided, key)) {
    log.warn({ ip: req.ip, path: req.path }, 'integration request rejected: bad or missing API key');
    next(unauthenticated('Invalid or missing integration API key'));
    return;
  }
  next();
};
