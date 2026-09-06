// src/middleware/requestLogger.ts
/**
 * Request logging, correlation IDs and latency measurement.
 *
 * Replaces this middleware from index.ts:
 *
 *   app.use((req, res, next) => {
 *     console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
 *     next();
 *   });
 *
 * Three problems with the old version:
 *  1. `console.log` is a blocking synchronous write on every request.
 *  2. `req.url` includes the query string, so `?phone=98...` was written to logs.
 *  3. It recorded no status code and no duration, so there was no way to see
 *     which endpoints were slow.
 */
import { randomUUID } from 'crypto';
import pinoHttp from 'pino-http';
import type { RequestHandler } from 'express';
import { logger } from '../lib/logger';
import { config } from '../config/env';

/** Paths excluded from per-request logs to keep probe noise out of the stream. */
const QUIET_PATHS = new Set(['/health', '/health/live', '/health/ready', '/favicon.ico']);

export const requestLogger = pinoHttp({
  logger,

  // Accept an upstream correlation ID if a proxy supplied one, otherwise mint one.
  genReqId: (req, res) => {
    const existing = req.headers['x-request-id'];
    const id = (Array.isArray(existing) ? existing[0] : existing) || randomUUID();
    res.setHeader('x-request-id', id);
    return id;
  },

  // Health checks at trace; 5xx at error; 4xx at warn; everything else info.
  customLogLevel: (req, res, err) => {
    if (QUIET_PATHS.has((req as any).path ?? req.url?.split('?')[0] ?? '')) return 'trace';
    if (err || res.statusCode >= 500) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },

  customSuccessMessage: (req, res) => `${req.method} ${res.statusCode}`,
  customErrorMessage: (req, res) => `${req.method} ${res.statusCode}`,

  // Log only what is needed. Notably: the path *without* the query string,
  // and the parameterised route pattern rather than concrete IDs.
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      path: (req as any).path ?? String(req.url).split('?')[0],
      route: (req.raw as any)?.route?.path,
      // Query keys only, never values — values routinely contain phone numbers.
      queryKeys: Object.keys((req.raw as any)?.query ?? {}),
      userId: (req.raw as any)?.user?.id,
      ip: (req.raw as any)?.ip,
      userAgent: req.headers?.['user-agent'],
    }),
    res: (res) => ({ statusCode: res.statusCode }),
  },

  // The central error handler owns error responses; don't double-log the body here.
  customAttributeKeys: { responseTime: 'durationMs' },
});

/**
 * Flags slow requests and exposes the server-side duration to clients via
 * `Server-Timing`, so browser devtools and the mobile client can attribute
 * latency to the server rather than the network.
 */
export const latencyTracker: RequestHandler = (req, res, next) => {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

    if (durationMs >= config.http.slowRequestMs) {
      (req as any).log?.warn(
        {
          durationMs: Math.round(durationMs),
          thresholdMs: config.http.slowRequestMs,
          method: req.method,
          route: (req as any).route?.path ?? req.path,
          statusCode: res.statusCode,
          userId: (req as any).user?.id,
        },
        'slow request'
      );
    }
  });

  // Must be set before headers flush.
  res.on('close', () => undefined);
  const originalWriteHead = res.writeHead.bind(res);
  res.writeHead = function patchedWriteHead(this: typeof res, ...args: any[]) {
    if (!res.headersSent) {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      try {
        res.setHeader('Server-Timing', `app;dur=${durationMs.toFixed(1)}`);
      } catch {
        // Header already sent or response detached — not worth failing the request.
      }
    }
    return originalWriteHead(...(args as Parameters<typeof originalWriteHead>));
  } as typeof res.writeHead;

  next();
};
