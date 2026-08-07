// src/services/rabbitmqService.ts
import amqp from 'amqplib';

const RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://localhost:5672';
const QUEUE_NAME = 'otp_queue';

let connection: any = null;
let channel: any = null;

async function getChannel(): Promise<any> {
  if (channel) return channel;

  try {
    const conn = await amqp.connect(RABBITMQ_URL);
    connection = conn;

    connection.on('error', (err: any) => {
      console.warn('[RabbitMQ Connection Error]', err?.message || err);
      connection = null;
      channel = null;
    });

    connection.on('close', () => {
      console.warn('[RabbitMQ Connection Closed]');
      connection = null;
      channel = null;
    });

    const ch = await connection.createChannel();
    channel = ch;
    await channel.assertQueue(QUEUE_NAME, { durable: true });
    console.log(`[RabbitMQ] Connected and asserted queue "${QUEUE_NAME}"`);
    return channel;
  } catch (err: any) {
    console.warn(`[RabbitMQ Connect Failed] ${err.message}. RabbitMQ feature will fallback gracefully.`);
    connection = null;
    channel = null;
    return null;
  }
}

export class RabbitMQService {
  /**
   * Publish OTP message to RabbitMQ queue
   */
  static async publishOtp(phone: string, code: string, type: 'LOGIN' | 'REGISTER' | 'RESEND' = 'LOGIN'): Promise<boolean> {
    try {
      const ch = await getChannel();
      if (!ch) {
        console.log(`[RabbitMQ Fallback] Could not reach RabbitMQ, logging OTP locally: [${type}] ${phone} => ${code}`);
        return false;
      }

      const payload = {
        phone,
        code,
        type,
        timestamp: new Date().toISOString(),
      };

      const published = ch.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(payload)), {
        persistent: true,
      });

      if (published) {
        console.log(`[RabbitMQ] Successfully queued OTP for ${phone} (Type: ${type})`);
      }
      return published;
    } catch (err: any) {
      console.error('[RabbitMQ Publish Error]', err.message);
      return false;
    }
  }

  /**
   * Start consuming OTP messages from RabbitMQ queue
   */
  static async startConsumer(): Promise<void> {
    try {
      const ch = await getChannel();
      if (!ch) {
        console.warn('[RabbitMQ Consumer] RabbitMQ not reachable yet. Consumer will retry on demand.');
        return;
      }

      await ch.consume(
        QUEUE_NAME,
        (msg: any) => {
          if (msg !== null) {
            try {
              const content = JSON.parse(msg.content.toString());
              console.log(`[RabbitMQ OTP Consumer] 📩 Dispatching OTP ${content.code} to ${content.phone} [Type: ${content.type}]`);
              ch.ack(msg);
            } catch (e: any) {
              console.error('[RabbitMQ Consumer JSON Parse Error]', e.message);
              ch.nack(msg, false, false);
            }
          }
        },
        { noAck: false }
      );
      console.log(`[RabbitMQ Consumer] Worker started listening on "${QUEUE_NAME}"`);
    } catch (err: any) {
      console.warn('[RabbitMQ Consumer Error]', err.message);
    }
  }
}
