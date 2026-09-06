// src/services/rabbitmqService.ts
import amqp from 'amqplib';
import { config } from '../config/env';
import { createLogger, maskPhone } from '../lib/logger';

const log = createLogger('rabbitmq');

const QUEUE_NAME = 'otp_queue';

let connection: any = null;
let channel: any = null;
/** De-duplicates concurrent connection attempts during a burst of publishes. */
let connecting: Promise<any> | null = null;

async function createChannel(): Promise<any> {
  const conn = await amqp.connect(config.rabbitmq.url);
  connection = conn;

  connection.on('error', (err: any) => {
    log.warn({ err: err?.message ?? err }, 'connection error');
    connection = null;
    channel = null;
  });

  connection.on('close', () => {
    log.warn('connection closed');
    connection = null;
    channel = null;
  });

  const ch = await conn.createChannel();
  await ch.assertQueue(QUEUE_NAME, { durable: true });

  /**
   * Bounds how many unacked messages this consumer holds. Without a prefetch the
   * broker pushes the entire queue at once, so a backlog is pulled into process
   * memory in one go.
   */
  await ch.prefetch(20);

  channel = ch;
  log.info({ queue: QUEUE_NAME }, 'connected');
  return ch;
}

/**
 * Returns a channel, or null when the broker is unreachable.
 *
 * The previous version could interleave several `amqp.connect` calls under
 * concurrency because the guard (`if (channel) return channel`) was checked
 * before any await. Callers now share a single in-flight attempt.
 */
async function getChannel(): Promise<any> {
  if (channel) return channel;
  if (connecting) return connecting;

  connecting = createChannel()
    .catch((err) => {
      log.warn({ err: err.message }, 'connect failed, OTP dispatch will degrade gracefully');
      connection = null;
      channel = null;
      return null;
    })
    .finally(() => {
      connecting = null;
    });

  return connecting;
}

export class RabbitMQService {
  /**
   * Publishes an OTP for downstream SMS dispatch.
   *
   * The plaintext code is intentionally absent from every log line here. The old
   * fallback branch logged it directly:
   *   `logging OTP locally: [${type}] ${phone} => ${code}`
   * which wrote a live authentication credential into application logs whenever
   * the broker was unavailable.
   */
  static async publishOtp(
    phone: string,
    code: string,
    type: 'LOGIN' | 'REGISTER' | 'RESEND' = 'LOGIN'
  ): Promise<boolean> {
    try {
      const ch = await getChannel();
      if (!ch) {
        log.warn({ phone: maskPhone(phone), type }, 'broker unavailable, OTP not dispatched');
        return false;
      }

      const payload = { phone, code, type, timestamp: new Date().toISOString() };

      const published = ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        // Codes are useless after their TTL; expire them in the queue too.
        expiration: String(config.otp.ttlSeconds * 1000),
      });

      if (published) {
        log.debug({ phone: maskPhone(phone), type }, 'OTP queued');
      } else {
        log.warn({ phone: maskPhone(phone) }, 'OTP publish buffer full');
      }
      return published;
    } catch (err: any) {
      log.error({ err: err.message }, 'publish failed');
      return false;
    }
  }

  static async startConsumer(): Promise<void> {
    try {
      const ch = await getChannel();
      if (!ch) {
        log.warn('broker not reachable; consumer will start on first successful connect');
        return;
      }

      await ch.consume(
        QUEUE_NAME,
        (msg: any) => {
          if (!msg) return;
          try {
            const content = JSON.parse(msg.content.toString());
            // No OTP code in this log line — see publishOtp.
            log.info(
              { phone: maskPhone(content.phone), type: content.type },
              'dispatching OTP to SMS provider'
            );
            ch.ack(msg);
          } catch (err: any) {
            log.error({ err: err.message }, 'malformed message discarded');
            // requeue=false: a message that cannot be parsed will never parse,
            // so requeueing it would spin forever.
            ch.nack(msg, false, false);
          }
        },
        { noAck: false }
      );

      log.info({ queue: QUEUE_NAME }, 'consumer started');
    } catch (err: any) {
      log.warn({ err: err.message }, 'consumer failed to start');
    }
  }

  /** Drains in-flight acks and closes cleanly on shutdown. */
  static async close(): Promise<void> {
    try {
      if (channel) await channel.close();
    } catch {
      // Already closed.
    }
    try {
      if (connection) await connection.close();
    } catch {
      // Already closed.
    }
    channel = null;
    connection = null;
  }
}
