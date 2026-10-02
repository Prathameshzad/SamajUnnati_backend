// src/services/rabbitmqService.ts
import amqp from 'amqplib';
import { config } from '../config/env';
import { createLogger, maskPhone } from '../lib/logger';
import { sendOtpSms } from './smsService';

const log = createLogger('rabbitmq');

const QUEUE_NAME = 'otp_queue';

/**
 * How many times a single OTP message is retried through the queue after a
 * transient SMS-provider failure before we give up on it.
 *
 * Why bounded: a plain nack(requeue=true) puts the message straight back at the
 * head of the queue and is redelivered immediately, so a persistent provider
 * error becomes a tight infinite loop that hammers the gateway and can burn SMS
 * credits. We instead count attempts in a message header and stop after this
 * many. When we give up, the message is dropped (acked) — the code is still in
 * Redis until its TTL, and the user can simply request another OTP, which is
 * what the per-phone rate limiter is there to bound.
 */
const MAX_SMS_RETRIES = 3;

/** Delay before a failed OTP is retried, in milliseconds (per-message TTL). */
const RETRY_DELAY_MS = 5_000;

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

  const ch = await conn.createConfirmChannel();
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

      ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
        // Codes are useless after their TTL; expire them in the queue too.
        expiration: String(config.otp.ttlSeconds * 1000),
      });
      await ch.waitForConfirms();
      log.debug({ phone: maskPhone(phone), type }, 'OTP confirmed by broker');
      return true;
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
        async (msg: any) => {
          if (!msg) return;

          let content: { phone: string; code: string; type?: string };
          try {
            content = JSON.parse(msg.content.toString());
          } catch (err: any) {
            log.error({ err: err.message }, 'malformed message discarded');
            // requeue=false: a message that cannot be parsed will never parse,
            // so requeueing it would spin forever.
            ch.nack(msg, false, false);
            return;
          }

          // Attempt number carried on the message header. First delivery = 1.
          const attempt = Number(msg.properties?.headers?.['x-attempt'] ?? 1);

          // No OTP code in this log line — see publishOtp.
          log.info(
            { phone: maskPhone(content.phone), type: content.type, attempt },
            'dispatching OTP to SMS provider'
          );

          /**
           * Shared failure path: either retry (bounded) or give up.
           *
           * We always ack the current delivery and, when a retry is warranted,
           * re-publish a fresh copy with an incremented counter and a short
           * per-message TTL. This gives real spacing between attempts instead of
           * the instant hot loop a nack(requeue=true) produces, and it caps the
           * total attempts at MAX_SMS_RETRIES.
           */
          const retryOrGiveUp = (reason: string) => {
            if (attempt >= MAX_SMS_RETRIES) {
              log.error(
                { phone: maskPhone(content.phone), type: content.type, attempt, reason },
                'OTP SMS gave up after max retries; user can request a new code'
              );
              ch.ack(msg); // drop it — do not loop forever
              return;
            }

            const nextAttempt = attempt + 1;
            try {
              ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(content)), {
                persistent: true,
                headers: { 'x-attempt': nextAttempt },
                // Spacing between attempts. Still capped by the code's usefulness.
                expiration: String(RETRY_DELAY_MS),
              });
              log.warn(
                { phone: maskPhone(content.phone), type: content.type, attempt, nextAttempt, reason },
                'OTP SMS failed; scheduled retry'
              );
            } catch (republishErr: any) {
              log.error(
                { phone: maskPhone(content.phone), err: republishErr?.message ?? String(republishErr) },
                'failed to schedule OTP retry'
              );
            }
            ch.ack(msg); // original is replaced by the re-published copy
          };

          try {
            // Defense in depth: startup does not register this consumer in
            // development, and smsService independently skips provider delivery
            // if this handler is invoked directly or survives a startup race.
            const result = await sendOtpSms(content.phone, content.code, content.type ?? 'LOGIN');

            if (result.outcome === 'skipped') {
              ch.ack(msg);
              return;
            }

            if (result.ok) {
              ch.ack(msg);
              return;
            }

            // 'disabled' = provider not configured. Retrying cannot fix that, so
            // give up immediately rather than cycling through the retry budget.
            if (result.outcome === 'disabled') {
              log.error(
                { phone: maskPhone(content.phone), type: content.type },
                'OTP SMS not sent: provider disabled; dropping message'
              );
              ch.ack(msg);
              return;
            }

            // Transient provider rejection — bounded retry.
            retryOrGiveUp(`provider outcome=${result.outcome}`);
          } catch (err: any) {
            log.error({ err: err?.message ?? String(err) }, 'OTP dispatch handler error');
            retryOrGiveUp('handler exception');
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
