// src/lib/shutdown.ts
/**
 * Graceful shutdown.
 *
 * Previously there was none. On SIGTERM (every container redeploy, every scale-in
 * event) the process was killed immediately, which means:
 *  - in-flight HTTP requests were severed, so users saw network errors during
 *    every deploy,
 *  - Postgres connections were left for the server to time out rather than being
 *    returned, and
 *  - RabbitMQ messages that had been delivered but not yet acked were lost.
 *
 * This drains work in dependency order and enforces a hard deadline so a hung
 * connection cannot block the shutdown forever.
 */
import type { Server } from 'http';
import { logger } from './logger';

type Closer = { name: string; close: () => Promise<unknown> };

const SHUTDOWN_TIMEOUT_MS = 15_000;

let shuttingDown = false;

export function registerShutdown(server: Server, closers: Closer[]): void {
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info({ signal }, 'shutdown initiated');

    // Hard deadline: exit non-zero if graceful shutdown stalls, so the
    // orchestrator's own kill is not what ends the process.
    const deadline = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    deadline.unref();

    try {
      // 1. Stop accepting new connections, let in-flight requests finish.
      await new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Node 18+: ends idle keep-alive sockets so close() is not held open by them.
        (server as any).closeIdleConnections?.();
      });
      logger.info('http server closed');

      // 2. Tear down dependencies, each isolated so one failure does not block the rest.
      for (const closer of closers) {
        try {
          await closer.close();
          logger.info({ resource: closer.name }, 'closed');
        } catch (err) {
          logger.warn({ err, resource: closer.name }, 'error while closing');
        }
      }

      clearTimeout(deadline);
      logger.info('shutdown complete');
      process.exit(0);
    } catch (err) {
      clearTimeout(deadline);
      logger.error({ err }, 'shutdown failed');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  /**
   * An unhandled rejection leaves the process in an unknown state. Node's default
   * for these is already to crash; logging first means the cause is recoverable
   * from logs instead of vanishing.
   */
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ err: reason }, 'unhandled promise rejection');
    void shutdown('unhandledRejection');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'uncaught exception');
    void shutdown('uncaughtException');
  });
}
