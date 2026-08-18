// src/services/treeCacheService.ts
import { RedisService } from './redisService';

const DEFAULT_TREE_TTL = 1800; // 30 minutes

// Bump this version whenever the shape of the cached tree data changes (new fields, etc.)
// This ensures stale Redis entries from before a deploy are never served.
const CACHE_SCHEMA_VERSION = 'v2'; // bumped: added dateOfBirth, bloodGroup, education, occupation to tree nodes

export class TreeCacheService {
  /**
   * Key pattern generators
   */
  private static getFullTreeKey(userId: string, depth: number, lang: string, category?: string): string {
    return `tree:full:${CACHE_SCHEMA_VERSION}:${userId}:${depth}:${lang}:${category || 'ALL'}`;
  }

  private static getGraphChunkKey(userId: string, nodeId: string, radius: number, lang: string): string {
    return `tree:chunk:${userId}:${nodeId}:${radius}:${lang}`;
  }

  private static getRelationCountsKey(userId: string): string {
    return `tree:counts:${userId}`;
  }

  /**
   * Full Tree Cache
   */
  public static async getFullTreeCache(userId: string, depth: number, lang: string, category?: string): Promise<any | null> {
    const key = this.getFullTreeKey(userId, depth, lang, category);
    const cached = await RedisService.get<any>(key);
    if (cached) {
      console.log(`[TREE CACHE HIT] Full tree for user ${userId} [key: ${key}]`);
    }
    return cached;
  }

  public static async setFullTreeCache(
    userId: string,
    depth: number,
    lang: string,
    category: string | undefined,
    data: any,
    ttlSeconds: number = DEFAULT_TREE_TTL
  ): Promise<void> {
    const key = this.getFullTreeKey(userId, depth, lang, category);
    await RedisService.set(key, data, ttlSeconds);
    console.log(`[TREE CACHE SET] Full tree for user ${userId} [TTL: ${ttlSeconds}s]`);
  }

  /**
   * Graph Chunk Cache
   */
  public static async getGraphChunkCache(userId: string, nodeId: string, radius: number, lang: string): Promise<any | null> {
    const key = this.getGraphChunkKey(userId, nodeId, radius, lang);
    return await RedisService.get<any>(key);
  }

  public static async setGraphChunkCache(
    userId: string,
    nodeId: string,
    radius: number,
    lang: string,
    data: any,
    ttlSeconds: number = DEFAULT_TREE_TTL
  ): Promise<void> {
    const key = this.getGraphChunkKey(userId, nodeId, radius, lang);
    await RedisService.set(key, data, ttlSeconds);
  }

  /**
   * Relation Counts Cache
   */
  public static async getRelationCountsCache(userId: string): Promise<any | null> {
    const key = this.getRelationCountsKey(userId);
    return await RedisService.get<any>(key);
  }

  public static async setRelationCountsCache(userId: string, data: any, ttlSeconds: number = DEFAULT_TREE_TTL): Promise<void> {
    const key = this.getRelationCountsKey(userId);
    await RedisService.set(key, data, ttlSeconds);
  }

  /**
   * Invalidate tree cache for a given user (and optional target user) when relations change
   */
  public static async invalidateUserTree(...userIds: (string | null | undefined)[]): Promise<void> {
    const validIds = Array.from(new Set(userIds.filter((id): id is string => typeof id === 'string' && id.length > 0)));
    if (validIds.length === 0) return;

    for (const id of validIds) {
      await RedisService.delPattern(`tree:full:*:${id}:*`);
      await RedisService.delPattern(`tree:full:${id}:*`);
      await RedisService.delPattern(`tree:chunk:*:${id}:*`);
      await RedisService.delPattern(`tree:chunk:${id}:*`);
      await RedisService.del(this.getRelationCountsKey(id));
      console.log(`[TREE CACHE INVALIDATED] Cleared tree cache for user ${id}`);
    }
  }
}
