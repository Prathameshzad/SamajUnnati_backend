// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { config } from '../config/env';
import { createLogger } from './logger';

const log = createLogger('prisma');
const { Pool } = pg;

/**
 * Connection pool.
 *
 * The previous configuration was `max: 5` with the comment "keep small to avoid
 * max connection limits on free tiers". That is a hard concurrency ceiling for
 * the entire process: with 5 connections, any 6th concurrent query waits, so
 * throughput is capped regardless of CPU. It is now driven by
 * DATABASE_POOL_MAX (default 20) so it can be sized to the actual database.
 *
 * `statement_timeout` is new and matters under load: without it a single slow
 * or accidentally unbounded query holds a pooled connection indefinitely, and a
 * handful of those starve the pool and take the whole API down.
 */
const poolConfig: pg.PoolConfig = {
  connectionString: config.database.url,
  max: config.database.poolMax,
  idleTimeoutMillis: config.database.idleTimeoutMs,
  connectionTimeoutMillis: config.database.connectTimeoutMs,
  ...(config.database.statementTimeoutMs > 0
    ? {
        statement_timeout: config.database.statementTimeoutMs,
        query_timeout: config.database.statementTimeoutMs,
      }
    : {}),
  application_name: 'samajunati-api',
  keepAlive: true,
};

// Managed Postgres providers terminate non-TLS external connections.
if (/render\.com|neon\.tech|supabase\.co|amazonaws\.com/.test(config.database.url) || process.env.RENDER) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);

// A pool error with no listener is an unhandled 'error' event, which crashes the
// process. Idle clients get dropped by network equipment routinely, so this is
// not a hypothetical.
pool.on('error', (err) => {
  log.error({ err }, 'idle postgres client error');
});

const adapter = new PrismaPg(pool as any);

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    // Route Prisma's own diagnostics into the structured logger instead of stdout.
    log: [
      { emit: 'event', level: 'error' },
      { emit: 'event', level: 'warn' },
    ],
  });

(prisma as any).$on?.('error', (event: { message: string; target?: string }) => {
  log.error({ target: event.target }, event.message);
});
(prisma as any).$on?.('warn', (event: { message: string; target?: string }) => {
  log.warn({ target: event.target }, event.message);
});

// Reuse across hot reloads in development; a fresh client per reload leaks pools.
if (!config.isProduction) {
  globalForPrisma.prisma = prisma;
}

/** Liveness probe used by the health endpoint. */
export const checkDatabase = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (err) {
    log.error({ err }, 'database health check failed');
    return false;
  }
};

export const disconnectPrisma = async (): Promise<void> => {
  await prisma.$disconnect();
  await pool.end().catch((err) => log.warn({ err }, 'pool shutdown error'));
};

export default prisma;
