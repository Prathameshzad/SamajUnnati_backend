// src/services/badgeService.ts
import prisma from '../lib/prisma';
import { BADGE_TIERS, type BadgeTierCode, type BadgeTierConfig } from '../config/gamification';
import { CacheService, CacheScope } from './cacheService';

// Re-exported so existing importers keep working after the move to config/.
export { BADGE_TIERS };
export type { BadgeTierCode, BadgeTierConfig };

export interface UserBadgeInfo {
  tier: BadgeTierCode;
  name: string;
  marathiName: string;
  icon: string;
  color: string;
  gradient: string;
  borderColor: string;
  description: string;
  approvedCount: number;
  familyCount: number;
  friendCount: number;
  nextTier: BadgeTierConfig | null;
  progressPercent: number;
  remainingForNext: number;
  tiers: {
    code: BadgeTierCode;
    name: string;
    min: number;
    max: number | null;
    icon: string;
    color: string;
    isUnlocked: boolean;
    isCurrent: boolean;
  }[];
}

/**
 * Pure tier computation. Logic is byte-for-byte the same as before; only the
 * source of BADGE_TIERS moved.
 */
export function calculateUserBadge(
  approvedCount: number,
  familyCount = 0,
  friendCount = 0
): UserBadgeInfo {
  let currentTier: BadgeTierConfig = BADGE_TIERS[0];

  for (let i = BADGE_TIERS.length - 1; i >= 0; i--) {
    const tier = BADGE_TIERS[i];
    if (approvedCount >= tier.min) {
      currentTier = tier;
      break;
    }
  }

  const currentIndex = BADGE_TIERS.findIndex((tier) => tier.code === currentTier.code);
  const nextTier: BadgeTierConfig | null =
    currentIndex < BADGE_TIERS.length - 1 ? BADGE_TIERS[currentIndex + 1] : null;

  let progressPercent = 100;
  let remainingForNext = 0;

  if (nextTier) {
    const range = nextTier.min - currentTier.min;
    const currentProgress = approvedCount - currentTier.min;
    progressPercent =
      range > 0 ? Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100))) : 100;
    remainingForNext = Math.max(0, nextTier.min - approvedCount);
  }

  const tiersLadder = BADGE_TIERS.map((tier) => ({
    code: tier.code,
    name: tier.name,
    min: tier.min,
    max: tier.max,
    icon: tier.icon,
    color: tier.color,
    isUnlocked: approvedCount >= tier.min,
    isCurrent: tier.code === currentTier.code,
  }));

  return {
    tier: currentTier.code,
    name: currentTier.name,
    marathiName: currentTier.marathiName,
    icon: currentTier.icon,
    color: currentTier.color,
    gradient: currentTier.gradient,
    borderColor: currentTier.borderColor,
    description: currentTier.description,
    approvedCount,
    familyCount,
    friendCount,
    nextTier,
    progressPercent,
    remainingForNext,
    tiers: tiersLadder,
  };
}

/** How long badge counts are cached. Versioned, so relation writes invalidate immediately. */
const BADGE_CACHE_TTL_SECONDS = 300;

/**
 * Counts confirmed connections and derives the badge.
 *
 * Two performance changes, no behaviour change:
 *
 * 1. One `groupBy` instead of two `count` queries. This runs on `getMe`,
 *    `getUserById` and `getRelationCounts`, so it was two extra round-trips on
 *    some of the most frequently called endpoints.
 *
 * 2. The result is cached under the user's cache version. The `OR` across
 *    `fromUserId` / `toUserId` / `createdById` cannot be served by a single index,
 *    so Postgres has to combine three index scans (or fall back to a sequential
 *    scan) on every call. Caching removes that from the hot path, and any
 *    relation write already bumps the user's version, so the count can never be
 *    served stale after a change.
 */
export async function getUserBadgeData(userId: string): Promise<UserBadgeInfo> {
  const version = await CacheService.getVersion(CacheScope.USER, userId);
  const key = `badge:${CacheService.buildTag}:${userId}:${version}`;

  const { value } = await CacheService.getOrSet<UserBadgeInfo>(key, BADGE_CACHE_TTL_SECONDS, async () => {
    const grouped = await prisma.relation.groupBy({
      by: ['category'],
      where: {
        status: 'CONFIRMED',
        deletedAt: null,
        category: { in: ['FAMILY', 'FRIEND'] },
        OR: [{ fromUserId: userId }, { toUserId: userId }, { createdById: userId }],
      },
      _count: { _all: true },
    });

    const familyCount = grouped.find((row) => row.category === 'FAMILY')?._count._all ?? 0;
    const friendCount = grouped.find((row) => row.category === 'FRIEND')?._count._all ?? 0;

    return calculateUserBadge(familyCount + friendCount, familyCount, friendCount);
  });

  return value;
}
