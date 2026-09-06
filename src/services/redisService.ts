// src/services/redisService.ts
import Redis, { type RedisOptions } from 'ioredis';
import { config } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('redis');

class RedisServiceClass {
  private client: Redis | null = null;
  private isConnected = false;
  /** Suppresses repeated identical connection-error logs while Redis is down. */
  private lastErrorAt = 0;

  constructor() {
    this.init();
  }

  private init(): void {
    try {
      const options: RedisOptions = {
        retryStrategy: (times) => Math.min(times * 200, 5_000),
        maxRetriesPerRequest: 1,
        /**
         * Fail fast instead of queueing.
         *
         * This was `enableOfflineQueue: true`, which means that while Redis is
         * unreachable every cache read is *queued* and only rejects after the
         * retry budget expires. The cache is on the critical path of the tree
         * endpoints, so a Redis outage turned into multi-second latency on every
         * request rather than a clean miss that falls through to Postgres.
         */
        enableOfflineQueue: false,
        connectTimeout: 5_000,
        enableReadyCheck: true,
        lazyConnect: false,
      };

      this.client = new Redis(config.redis.url, options);

      this.client.on('ready', () => {
        this.isConnected = true;
        log.info('connected');
      });

      this.client.on('error', (err) => {
        this.isConnected = false;
        const now = Date.now();
        // Redis emits 'error' on every reconnect attempt; throttle to once a minute.
        if (now - this.lastErrorAt > 60_000) {
          this.lastErrorAt = now;
          log.warn({ err: err.message }, 'connection error (cache degraded, serving from database)');
        }
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });
    } catch (err) {
      log.error({ err }, 'initialisation failed');
      this.isConnected = false;
    }
  }

  public isAlive(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  public getClient(): Redis | null {
    return this.client;
  }

  /** Only issue commands when the connection is actually usable. */
  private usable(): Redis | null {
    return this.isAlive() ? this.client : null;
  }

  public async get<T>(key: string): Promise<T | null> {
    const client = this.usable();
    if (!client) return null;
    try {
      const data = await client.get(key);
      return data ? (JSON.parse(data) as T) : null;
    } catch (err) {
      log.debug({ err, key }, 'get failed');
      return null;
    }
  }

  /** Batched read. One round-trip instead of N — used by the relation-type registry. */
  public async mget<T>(keys: string[]): Promise<(T | null)[]> {
    const client = this.usable();
    if (!client || keys.length === 0) return keys.map(() => null);
    try {
      const values = await client.mget(...keys);
      return values.map((value) => (value ? (JSON.parse(value) as T) : null));
    } catch (err) {
      log.debug({ err }, 'mget failed');
      return keys.map(() => null);
    }
  }

  public async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const client = this.usable();
    if (!client) return;
    try {
      const serialized = JSON.stringify(value);
      if (ttlSeconds && ttlSeconds > 0) {
        await client.setex(key, ttlSeconds, serialized);
      } else {
        await client.set(key, serialized);
      }
    } catch (err) {
      log.debug({ err, key }, 'set failed');
    }
  }

  /**
   * Sets only if absent, returning whether we won.
   * Used as a single-flight lock so a cache miss on a hot key results in one
   * database rebuild rather than one per concurrent request.
   */
  public async setIfAbsent(key: string, value: unknown, ttlSeconds: number): Promise<boolean> {
    const client = this.usable();
    if (!client) return false;
    try {
      const result = await client.set(key, JSON.stringify(value), 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      log.debug({ err, key }, 'setIfAbsent failed');
      return false;
    }
  }

  public async del(...keys: string[]): Promise<number> {
    const client = this.usable();
    if (!client || keys.length === 0) return 0;
    try {
      return await client.del(...keys);
    } catch (err) {
      log.debug({ err }, 'del failed');
      return 0;
    }
  }

  /**
   * Atomically increments a counter and returns the new value.
   * This is how cache invalidation works now — see CacheService.
   */
  public async incr(key: string): Promise<number> {
    const client = this.usable();
    if (!client) return 0;
    try {
      return await client.incr(key);
    } catch (err) {
      log.debug({ err, key }, 'incr failed');
      return 0;
    }
  }

  /** Increments several counters in one round-trip. */
  public async incrMany(keys: string[]): Promise<void> {
    const client = this.usable();
    if (!client || keys.length === 0) return;
    try {
      const pipeline = client.pipeline();
      for (const key of keys) pipeline.incr(key);
      await pipeline.exec();
    } catch (err) {
      log.debug({ err }, 'incrMany failed');
    }
  }

  public async expire(key: string, seconds: number): Promise<boolean> {
    const client = this.usable();
    if (!client) return false;
    try {
      return (await client.expire(key, seconds)) === 1;
    } catch (err) {
      log.debug({ err, key }, 'expire failed');
      return false;
    }
  }

  public async ttl(key: string): Promise<number> {
    const client = this.usable();
    if (!client) return -2;
    try {
      return await client.ttl(key);
    } catch (err) {
      log.debug({ err, key }, 'ttl failed');
      return -2;
    }
  }

  /**
   * Pattern deletion via SCAN.
   *
   * Deliberately NOT used on request paths any more. SCAN walks the entire
   * keyspace, so calling it on every relation write (as invalidateUserTree did,
   * five patterns per affected user, including the catch-all `tree:*:<id>:*`)
   * costs O(total keys) per write and stalls Redis as data grows.
   * Kept only for administrative cleanup.
   */
  public async delPattern(pattern: string): Promise<number> {
    const client = this.usable();
    if (!client) return 0;
    let count = 0;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 500);
        cursor = next;
        if (keys.length > 0) {
          await client.unlink(...keys);
          count += keys.length;
        }
      } while (cursor !== '0');
      return count;
    } catch (err) {
      log.warn({ err, pattern }, 'delPattern failed');
      return count;
    }
  }

  public async quit(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
    this.client = null;
    this.isConnected = false;
  }
}

export const RedisService = new RedisServiceClass();
