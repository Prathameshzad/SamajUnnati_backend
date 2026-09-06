// src/services/scoreService.ts
import prisma from '../lib/prisma';
import { emitToUser } from '../lib/socket';
import {
  SCORE_POINTS,
  LEVEL_THRESHOLDS,
  calculateLevel,
  type ScoreReason,
} from '../config/gamification';
import { createLogger } from '../lib/logger';

const log = createLogger('score');

// Re-exported so existing importers (relationController, scoreController) keep
// working now that the values live in config/gamification.ts.
export type { ScoreReason };
export { SCORE_POINTS };

export interface ScoreAwardResult {
  userId: string;
  delta: number;
  reason: ScoreReason;
  total: number;
  level: number;
  leveledUp: boolean;
}

/**
 * Awards points and records an audit event.
 *
 * Behaviour is unchanged. What changed is that the three writes (upsert score,
 * correct the level, insert the event) now run in one transaction. Previously
 * they were independent statements, so a failure between them left a score
 * updated with no matching ScoreEvent — an audit log that silently disagreed
 * with the balance it was meant to explain.
 *
 * Note: `ScoreEvent.userId` is a foreign key to `UserScore.id`, not to `User.id`
 * (see schema.prisma). The original code relied on that; it is preserved.
 */
export async function awardPoints(
  userId: string,
  reason: ScoreReason,
  relationId?: string
): Promise<ScoreAwardResult> {
  const delta = SCORE_POINTS[reason];

  const { total, level, leveledUp } = await prisma.$transaction(async (tx) => {
    const upserted = await tx.userScore.upsert({
      where: { userId },
      create: {
        userId,
        total: Math.max(0, delta),
        level: calculateLevel(Math.max(0, delta)),
      },
      update: {
        total: { increment: delta },
      },
    });

    const newLevel = calculateLevel(upserted.total);
    let didLevelUp = false;

    if (newLevel !== upserted.level) {
      await tx.userScore.update({
        where: { userId },
        data: { level: newLevel },
      });
      didLevelUp = true;
    }

    await tx.scoreEvent.create({
      data: {
        userId: upserted.id,
        points: delta,
        reason,
        relationId: relationId ?? null,
      },
    });

    return { total: upserted.total, level: newLevel, leveledUp: didLevelUp };
  });

  const result: ScoreAwardResult = { userId, delta, reason, total, level, leveledUp };

  // Best-effort real-time delivery; emitToUser never throws.
  emitToUser(userId, 'score_update', result);

  return result;
}

/**
 * Deducts points, clamped at zero.
 *
 * Same clamping and audit behaviour as before, now transactional so the balance
 * and the ScoreEvent cannot diverge.
 */
export async function deductPoints(
  userId: string,
  delta: number,
  reason: ScoreReason,
  relationId?: string
): Promise<ScoreAwardResult | null> {
  const pointsToDeduct = Math.abs(delta);

  const outcome = await prisma.$transaction(async (tx) => {
    const existing = await tx.userScore.findUnique({ where: { userId } });
    if (!existing) return null;

    const newTotal = Math.max(0, existing.total - pointsToDeduct);
    const newLevel = calculateLevel(newTotal);

    await tx.userScore.update({
      where: { userId },
      data: { total: newTotal, level: newLevel },
    });

    await tx.scoreEvent.create({
      data: {
        userId: existing.id,
        points: -pointsToDeduct,
        reason,
        relationId: relationId ?? null,
      },
    });

    return { total: newTotal, level: newLevel };
  });

  if (!outcome) {
    log.debug({ userId }, 'no score record to deduct from');
    return null;
  }

  const result: ScoreAwardResult = {
    userId,
    delta: -pointsToDeduct,
    reason,
    total: outcome.total,
    level: outcome.level,
    leveledUp: false,
  };

  emitToUser(userId, 'score_update', result);

  return result;
}

export interface UserScoreData {
  total: number;
  level: number;
  nextLevelAt: number | null;
  recentEvents: {
    id: string;
    points: number;
    reason: ScoreReason;
    relationId: string | null;
    createdAt: Date;
  }[];
}

export async function getUserScore(userId: string): Promise<UserScoreData> {
  const score = await prisma.userScore.findUnique({
    where: { userId },
    select: {
      total: true,
      level: true,
      events: {
        select: { id: true, points: true, reason: true, relationId: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!score) {
    return { total: 0, level: 1, nextLevelAt: LEVEL_THRESHOLDS[1], recentEvents: [] };
  }

  const currentLevelIndex = score.level - 1;
  const nextLevelAt =
    currentLevelIndex + 1 < LEVEL_THRESHOLDS.length ? LEVEL_THRESHOLDS[currentLevelIndex + 1] : null;

  return {
    total: score.total,
    level: score.level,
    nextLevelAt,
    recentEvents: score.events.map((event) => ({
      id: event.id,
      points: event.points,
      reason: event.reason as ScoreReason,
      relationId: event.relationId,
      createdAt: event.createdAt,
    })),
  };
}

export interface LeaderboardEntry {
  userId: string;
  total: number;
  level: number;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
}

export async function getLeaderboard(limit = 10): Promise<LeaderboardEntry[]> {
  const scores = await prisma.userScore.findMany({
    take: limit,
    orderBy: { total: 'desc' },
    // Explicit select: the previous `include: { user: {...} }` was already
    // narrow, but selecting keeps the leaderboard free of any future User columns.
    select: {
      userId: true,
      total: true,
      level: true,
      user: { select: { firstName: true, lastName: true, photoUrl: true } },
    },
  });

  return scores.map((score) => ({
    userId: score.userId,
    total: score.total,
    level: score.level,
    firstName: score.user.firstName,
    lastName: score.user.lastName,
    photoUrl: score.user.photoUrl,
  }));
}
