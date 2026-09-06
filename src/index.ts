// src/index.ts
/**
 * Application entrypoint.
 *
 * Middleware order matters and was wrong before. The original file registered a
 * JSON-syntax error handler *between* `express.json()` and the routes:
 *
 *   app.use(express.json());
 *   app.use((err, req, res, next) => { ...JSON syntax check... });   // never reached
 *                                                                    // for route errors
 *   app.use('/api/auth', authRoutes);
 *
 * Error-handling middleware only runs for errors raised by middleware registered
 * *before* it, so that handler could never see an error thrown by a controller.
 * The Multer handler at the bottom did work, but duplicated the logic.
 *
 * There is now a single error handler, registered last.
 */
import express, { type Application, type Request, type Response } from 'express';
import compression from 'compression';
import http from 'http';
import path from 'path';

import { config } from './config/env';
import { logger } from './lib/logger';
import { requestLogger, latencyTracker } from './middleware/requestLogger';
import { corsMiddleware, securityHeaders } from './middleware/security';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { registerShutdown } from './lib/shutdown';

import prisma, { checkDatabase, disconnectPrisma } from './lib/prisma';
import { initSocket, closeSocket } from './lib/socket';
import { RabbitMQService } from './services/rabbitmqService';
import { RedisService } from './services/redisService';
import { warmRelationTypeRegistry } from './services/relationTypeRegistry';
import { closeRateLimitRedis } from './middleware/rateLimit';

import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import relationRoutes from './routes/relationRoutes';
import relationTypeRoutes from './routes/relationTypeRoutes';
import notificationRoutes from './routes/notificationRoutes';
import uploadRoutes from './routes/uploadRoutes';
import friendRoutes from './routes/friendRoutes';
import messageRoutes from './routes/messageRoutes';
import postRoutes from './routes/postRoutes';
import storyRoutes from './routes/storyRoutes';
import followRoutes from './routes/followRoutes';
import matrimonyRoutes from './routes/matrimonyRoutes';
import scoreRoutes from './routes/scoreRoutes';
import configRoutes from './routes/configRoutes';

const app: Application = express();

/**
 * Required for correct client IP resolution behind a proxy. Without it,
 * `req.ip` is the proxy's address, so every request shares one rate-limit
 * bucket. Set to the exact number of trusted hops rather than `true`, because
 * blindly trusting `X-Forwarded-For` lets a client spoof its own IP and bypass
 * per-IP limits entirely.
 */
if (config.http.trustProxyHops > 0) {
  app.set('trust proxy', config.http.trustProxyHops);
}

// Do not advertise the framework.
app.disable('x-powered-by');

/**
 * Weak ETags on JSON responses. Repeat requests for unchanged data get a 304 with
 * no body, which removes the response payload from the wire — the cheapest
 * available bandwidth win on read-heavy endpoints such as
 * /api/relation-types/config.
 */
app.set('etag', 'weak');

app.use(securityHeaders);
app.use(corsMiddleware);
app.use(requestLogger);
app.use(latencyTracker);

/**
 * gzip/brotli for responses above 1KB. The tree and config payloads are large,
 * repetitive JSON and compress by roughly an order of magnitude, which directly
 * reduces both latency and egress cost.
 */
app.use(
  compression({
    threshold: 1024,
    filter: (req, res) => {
      if (req.headers['x-no-compression']) return false;
      return compression.filter(req, res);
    },
  })
);

/**
 * Body size limit. Previously `express.json()` used the 100KB default while
 * multipart uploads were separately capped at 50MB; the limit is now explicit
 * and configurable, and oversized bodies produce a 413 rather than an
 * unhandled `entity.too.large`.
 */
app.use(express.json({ limit: config.http.bodyLimit }));
app.use(express.urlencoded({ extended: false, limit: config.http.bodyLimit }));

/* ── Health probes ────────────────────────────────────────────────────────── */

app.get('/', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'samajunati-api' });
});

/** Liveness: is the process up? Must not touch dependencies. */
app.get('/health/live', (_req: Request, res: Response) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

/**
 * Readiness: can this instance serve traffic?
 *
 * The old `/health` imported Prisma dynamically on every call
 * (`await import('./lib/prisma')`) and ran `SELECT 1`. Kept the DB check, but the
 * import is now static and Redis is reported without failing the probe — Redis
 * being down degrades caching, it does not make the instance unable to serve.
 */
app.get('/health/ready', async (_req: Request, res: Response) => {
  const databaseOk = await checkDatabase();
  const redisOk = RedisService.isAlive();

  res.status(databaseOk ? 200 : 503).json({
    status: databaseOk ? 'ok' : 'error',
    database: databaseOk ? 'connected' : 'unavailable',
    redis: redisOk ? 'connected' : 'unavailable',
    uptime: process.uptime(),
  });
});

// Retained at the original path for existing probes and dashboards.
app.get('/health', async (_req: Request, res: Response) => {
  const databaseOk = await checkDatabase();
  res.status(databaseOk ? 200 : 500).json({
    status: databaseOk ? 'ok' : 'error',
    database: databaseOk ? 'connected' : 'failed',
    redis: RedisService.isAlive() ? 'connected' : 'disconnected/standby',
    uptime: process.uptime(),
  });
});

/* ── Routes ───────────────────────────────────────────────────────────────── */

app.use('/api/config', configRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/relations', relationRoutes);
app.use('/api/relation-types', relationTypeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/stories', storyRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/matrimony', matrimonyRoutes);
app.use('/api/scores', scoreRoutes);

/**
 * Locally-stored media, only reachable when the local-disk fallback is enabled
 * (development). In production, media lives in R2 and this route is not mounted,
 * so the process is not serving files from its own filesystem.
 *
 * The duplicate `/uploads` + `/uploads/media` mounts from the original file are
 * collapsed into one; `dotfiles: 'deny'` and `index: false` prevent directory
 * listing and dotfile access.
 */
if (config.uploads.allowLocalFallback) {
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), {
      index: false,
      dotfiles: 'deny',
      maxAge: '1y',
      fallthrough: false,
    })
  );
}

// 404 for anything unmatched, then the single error handler. Order is required.
app.use(notFoundHandler);
app.use(errorHandler);

/* ── Startup ──────────────────────────────────────────────────────────────── */

const server = http.createServer(app);

/**
 * Node's default `headersTimeout`/`requestTimeout` of 0 means a client can hold a
 * socket open indefinitely without completing a request — a trivial slowloris
 * primitive. These give every request a bounded lifetime.
 */
server.keepAliveTimeout = 65_000;
server.headersTimeout = 66_000;
server.requestTimeout = 120_000;

initSocket(server);

server.listen(config.port, () => {
  logger.info(
    {
      port: config.port,
      env: config.env,
      dbPoolMax: config.database.poolMax,
      rateLimiting: config.http.rateLimitEnabled,
      r2: config.r2.enabled,
    },
    'server listening'
  );

  // Load reference data up front so the first tree request does not pay for it.
  void warmRelationTypeRegistry();

  RabbitMQService.startConsumer().catch((err) => {
    logger.warn({ err }, 'rabbitmq consumer failed to start');
  });
});

registerShutdown(server, [
  { name: 'socket.io', close: () => closeSocket() },
  { name: 'rabbitmq', close: () => RabbitMQService.close() },
  { name: 'redis', close: () => RedisService.quit() },
  { name: 'rate-limit-redis', close: () => closeRateLimitRedis() },
  { name: 'prisma', close: () => disconnectPrisma() },
]);

export { app, prisma };
