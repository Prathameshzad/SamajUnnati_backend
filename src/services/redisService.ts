// src/services/redisService.ts
import Redis, { RedisOptions } from 'ioredis';

class RedisServiceClass {
  private client: Redis | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      const options: RedisOptions = {
        retryStrategy(times) {
          const delay = Math.min(times * 100, 3000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableOfflineQueue: true,
        lazyConnect: false,
      };

      this.client = new Redis(redisUrl, options);

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('[REDIS SERVICE] Connected to Redis server successfully.');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        console.warn(`[REDIS SERVICE WARNING] ${err.message}`);
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('[REDIS SERVICE INIT ERROR]', err.message);
      this.isConnected = false;
    }
  }

  public isAlive(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  public getClient(): Redis | null {
    return this.client;
  }

  /**
   * Fetch item from Redis and parse JSON
   */
  public async get<T>(key: string): Promise<T | null> {
    if (!this.client) return null;
    try {
      const data = await this.client.get(key);
      if (!data) return null;
      return JSON.parse(data) as T;
    } catch (err: any) {
      console.warn(`[REDIS GET ERROR] Key "${key}":`, err.message);
      return null;
    }
  }

  /**
   * Store item in Redis with optional TTL in seconds
   */
  public async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    if (!this.client) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await this.client.setex(key, ttlSeconds, serialized);
      } else {
        await this.client.set(key, serialized);
      }
    } catch (err: any) {
      console.warn(`[REDIS SET ERROR] Key "${key}":`, err.message);
    }
  }

  /**
   * Delete one or more keys
   */
  public async del(...keys: string[]): Promise<number> {
    if (!this.client || keys.length === 0) return 0;
    try {
      return await this.client.del(...keys);
    } catch (err: any) {
      console.warn(`[REDIS DEL ERROR] Keys [${keys.join(', ')}]:`, err.message);
      return 0;
    }
  }

  /**
   * Delete keys matching pattern using sequential SCAN loop to ensure completion
   */
  public async delPattern(pattern: string): Promise<number> {
    if (!this.client) return 0;
    let count = 0;
    try {
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
        cursor = nextCursor;
        if (keys && keys.length > 0) {
          await this.client.unlink(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');
      return count;
    } catch (err: any) {
      console.warn(`[REDIS DEL PATTERN ERROR] Pattern "${pattern}":`, err.message);
      return count;
    }
  }

  /**
   * Increment counter for key
   */
  public async incr(key: string): Promise<number> {
    if (!this.client) return 0;
    try {
      return await this.client.incr(key);
    } catch (err: any) {
      console.warn(`[REDIS INCR ERROR] Key "${key}":`, err.message);
      return 0;
    }
  }

  /**
   * Set key expiration in seconds
   */
  public async expire(key: string, seconds: number): Promise<boolean> {
    if (!this.client) return false;
    try {
      const res = await this.client.expire(key, seconds);
      return res === 1;
    } catch (err: any) {
      console.warn(`[REDIS EXPIRE ERROR] Key "${key}":`, err.message);
      return false;
    }
  }

  /**
   * Get TTL for a key in seconds
   */
  public async ttl(key: string): Promise<number> {
    if (!this.client) return -2;
    try {
      return await this.client.ttl(key);
    } catch (err: any) {
      console.warn(`[REDIS TTL ERROR] Key "${key}":`, err.message);
      return -2;
    }
  }
}

export const RedisService = new RedisServiceClass();
