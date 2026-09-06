// src/services/treeCacheService.ts
/**
 * Tree/graph response cache.
 *
 * Public API is unchanged so controllers did not need rewriting, but the
 * implementation now uses version-tagged keys (see CacheService) instead of
 * `SCAN`-based pattern deletion. `invalidateUserTree` went from up to five
 * whole-keyspace scans per affected user to a single pipelined `INCR`.
 *
 * The hand-maintained `CACHE_SCHEMA_VERSION = 'v5'` constant is gone; the
 * namespace now comes from the build tag.
 */
import { CacheService, CacheScope, cacheTtl } from './cacheService';
import { RedisService } from './redisService';
import { createLogger } from '../lib/logger';

const log = createLogger('tree-cache');

export class TreeCacheService {
  private static async fullTreeKey(
    userId: string,
    depth: number,
    lang: string,
    category?: string
  ): Promise<string> {
    const version = await CacheService.getVersion(CacheScope.USER, userId);
    return `tree:full:${CacheService.buildTag}:${userId}:${version}:${depth}:${lang}:${category || 'ALL'}`;
  }

  private static async graphChunkKey(
    userId: string,
    nodeId: string,
    radius: number,
    lang: string
  ): Promise<string> {
    const version = await CacheService.getVersion(CacheScope.USER, userId);
    return `tree:chunk:${CacheService.buildTag}:${userId}:${version}:${nodeId}:${radius}:${lang}`;
  }

  private static async relationCountsKey(userId: string): Promise<string> {
    const version = await CacheService.getVersion(CacheScope.USER, userId);
    return `tree:counts:${CacheService.buildTag}:${userId}:${version}`;
  }

  /* ── Full tree ───────────────────────────────────────────────────────────── */

  public static async getFullTreeCache(
    userId: string,
    depth: number,
    lang: string,
    category?: string
  ): Promise<any | null> {
    const key = await this.fullTreeKey(userId, depth, lang, category);
    return RedisService.get<any>(key);
  }

  public static async setFullTreeCache(
    userId: string,
    depth: number,
    lang: string,
    category: string | undefined,
    data: any,
    ttlSeconds: number = cacheTtl.tree
  ): Promise<void> {
    const key = await this.fullTreeKey(userId, depth, lang, category);
    await RedisService.set(key, data, ttlSeconds);
  }

  /**
   * Read-through variant with stampede protection. Preferred over the
   * get/set pair: when a hot tree key expires, only one request rebuilds it.
   */
  public static async readThroughFullTree<T>(
    userId: string,
    depth: number,
    lang: string,
    category: string | undefined,
    build: () => Promise<T>
  ): Promise<{ value: T; hit: boolean }> {
    const key = await this.fullTreeKey(userId, depth, lang, category);
    return CacheService.getOrSet<T>(key, cacheTtl.tree, build);
  }

  /* ── Graph chunk ─────────────────────────────────────────────────────────── */

  public static async getGraphChunkCache(
    userId: string,
    nodeId: string,
    radius: number,
    lang: string
  ): Promise<any | null> {
    const key = await this.graphChunkKey(userId, nodeId, radius, lang);
    return RedisService.get<any>(key);
  }

  public static async setGraphChunkCache(
    userId: string,
    nodeId: string,
    radius: number,
    lang: string,
    data: any,
    ttlSeconds: number = cacheTtl.tree
  ): Promise<void> {
    const key = await this.graphChunkKey(userId, nodeId, radius, lang);
    await RedisService.set(key, data, ttlSeconds);
  }

  /* ── Relation counts ─────────────────────────────────────────────────────── */

  public static async getRelationCountsCache(userId: string): Promise<any | null> {
    const key = await this.relationCountsKey(userId);
    return RedisService.get<any>(key);
  }

  public static async setRelationCountsCache(
    userId: string,
    data: any,
    ttlSeconds: number = cacheTtl.tree
  ): Promise<void> {
    const key = await this.relationCountsKey(userId);
    await RedisService.set(key, data, ttlSeconds);
  }

  /**
   * Invalidates every cached payload for the given users.
   *
   * Same signature as before, so all existing call sites in relationController
   * and userController keep working — but this is now O(1) per user instead of a
   * keyspace scan.
   */
  public static async invalidateUserTree(...userIds: (string | null | undefined)[]): Promise<void> {
    const valid = Array.from(
      new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0))
    );
    if (valid.length === 0) return;
    await CacheService.bump(CacheScope.USER, valid);
    log.debug({ userCount: valid.length }, 'tree cache invalidated');
  }
}
