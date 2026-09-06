// src/services/cacheService.ts
/**
 * Cache primitives: version-tagged keys, single-flight rebuilds, and a stable
 * per-deploy namespace.
 *
 * Two problems this replaces.
 *
 * 1) Invalidation cost. `TreeCacheService.invalidateUserTree` ran five
 *    `delPattern` calls per affected user, one of them the catch-all
 *    `tree:*:<id>:*`. `delPattern` is a `SCAN` loop, so each call walks the whole
 *    Redis keyspace. Every relation create/approve/reject/update/delete
 *    triggered that for up to four users. Cost grows with total cached keys, and
 *    it blocks other Redis work — precisely backwards for a write path that
 *    should be cheap.
 *
 *    Now: each user has a version counter. Cache keys embed the current version,
 *    so invalidation is a single `INCR`. Stale entries become unreachable
 *    immediately and are reclaimed by their own TTL.
 *
 * 2) Manual schema versioning. `CACHE_SCHEMA_VERSION = 'v5'` had to be
 *    hand-edited whenever a payload shape changed, and forgetting to do so
 *    serves stale-shaped JSON to clients after a deploy.
 *
 *    Now: the namespace is derived from the package version (overridable via
 *    CACHE_BUILD_TAG), so a normal version bump rotates the namespace.
 */
import { RedisService } from './redisService';
import { config } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('cache');

/** Namespace for all keys written by this build. */
const BUILD_TAG: string = (() => {
  if (process.env.CACHE_BUILD_TAG?.trim()) return process.env.CACHE_BUILD_TAG.trim();
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pkg = require('../../package.json') as { version?: string };
    if (pkg.version) return `v${pkg.version}`;
  } catch {
    // Falls through to the default below.
  }
  return 'v0';
})();

/** Version counters live longer than any cached payload so they are never lost first. */
const VERSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** How long a rebuild lock is held. Slightly above worst-case rebuild time. */
const LOCK_TTL_SECONDS = 20;

const versionKey = (scope: string, id: string) => `ver:${scope}:${id}`;

export class CacheService {
  static get buildTag(): string {
    return BUILD_TAG;
  }

  /**
   * Current version for a scoped entity. Missing counters read as 1 rather than
   * being created, so a cold Redis does not need a write on every read.
   */
  static async getVersion(scope: string, id: string): Promise<number> {
    const value = await RedisService.get<number>(versionKey(scope, id));
    return typeof value === 'number' && value > 0 ? value : 1;
  }

  /** Batched version read so building one key set costs one round-trip. */
  static async getVersions(scope: string, ids: string[]): Promise<Map<string, number>> {
    const unique = Array.from(new Set(ids));
    const values = await RedisService.mget<number>(unique.map((id) => versionKey(scope, id)));
    const result = new Map<string, number>();
    unique.forEach((id, index) => {
      const value = values[index];
      result.set(id, typeof value === 'number' && value > 0 ? value : 1);
    });
    return result;
  }

  /**
   * Invalidates everything cached under the given entities in one pipelined
   * round-trip, regardless of how many keys exist for them.
   */
  static async bump(scope: string, ids: (string | null | undefined)[]): Promise<void> {
    const valid = Array.from(
      new Set(ids.filter((id): id is string => typeof id === 'string' && id.length > 0))
    );
    if (valid.length === 0) return;

    const keys = valid.map((id) => versionKey(scope, id));
    await RedisService.incrMany(keys);
    // Refresh TTLs so an active user's counter never expires and silently
    // resurrects previously invalidated payloads.
    await Promise.all(keys.map((key) => RedisService.expire(key, VERSION_TTL_SECONDS)));

    log.debug({ scope, count: valid.length }, 'cache versions bumped');
  }

  /**
   * Read-through cache with single-flight protection.
   *
   * On a miss, exactly one caller acquires the lock and rebuilds; the others
   * briefly wait and re-read. Without this, a popular key expiring causes every
   * in-flight request to run the same expensive query at once (cache stampede) —
   * the failure mode that turns a traffic spike into a database outage.
   */
  static async getOrSet<T>(
    key: string,
    ttlSeconds: number,
    build: () => Promise<T>
  ): Promise<{ value: T; hit: boolean }> {
    const cached = await RedisService.get<T>(key);
    if (cached !== null) return { value: cached, hit: true };

    const lockKey = `lock:${key}`;
    const acquired = await RedisService.setIfAbsent(lockKey, 1, LOCK_TTL_SECONDS);

    if (!acquired) {
      // Another request is rebuilding. Poll briefly for its result.
      for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        const filled = await RedisService.get<T>(key);
        if (filled !== null) return { value: filled, hit: true };
      }
      // Rebuild is taking too long; do the work rather than fail the request.
      return { value: await build(), hit: false };
    }

    try {
      const value = await build();
      await RedisService.set(key, value, ttlSeconds);
      return { value, hit: false };
    } finally {
      await RedisService.del(lockKey);
    }
  }
}

/** Scopes, named so key layout is discoverable in one place. */
export const CacheScope = {
  USER: 'u',
  RELATION_CONFIG: 'rc',
} as const;

/** Convenience wrapper for the common "invalidate these users" call. */
export const invalidateUsers = (...userIds: (string | null | undefined)[]): Promise<void> =>
  CacheService.bump(CacheScope.USER, userIds);

export const cacheTtl = {
  tree: config.cache.treeTtlSeconds,
  config: config.cache.configTtlSeconds,
};
