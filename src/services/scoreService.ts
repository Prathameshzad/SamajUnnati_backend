// src/services/scoreService.ts
import prisma from '../lib/prisma';
import { getIO } from '../lib/socket';

export type ScoreReason =
  | 'ADD_ALIVE'
  | 'ADD_DECEASED'
  | 'RELATION_APPROVED'
  | 'REMOVE_ALIVE'
  | 'REMOVE_DECEASED'
  | 'REMOVE_RELATION';

/** XP needed to reach each level (cumulative threshold). */
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 2000, 3000, 5000];

function calculateLevel(total: number): number {
  let level = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (total >= LEVEL_THRESHOLDS[i]) {
      level = i + 1;
      break;
    }
  }
  return level;
}

/** Points awarded per reason */
export const SCORE_POINTS: Record<ScoreReason, number> = {
  ADD_ALIVE: 5,
  ADD_DECEASED: 2,
  RELATION_APPROVED: 20,
  REMOVE_ALIVE: -5,
  REMOVE_DECEASED: -2,
  REMOVE_RELATION: -5,
};

export interface ScoreAwardResult {
  userId: string;
  delta: number;
  reason: ScoreReason;
  total: number;
  level: number;
  leveledUp: boolean;
}

/**
 * Atomically upsert UserScore and insert a ScoreEvent.
 * Emits a real-time `score_update` socket event to the user's room.
 */
export async function awardPoints(
  userId: string,
  reason: ScoreReason,
  relationId?: string
): Promise<ScoreAwardResult> {
  const delta = SCORE_POINTS[reason];

  // Upsert UserScore atomically
  const upserted = await prisma.userScore.upsert({
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

  // Re-calculate level after update (upsert returns the raw new total)
  const newLevel = calculateLevel(upserted.total);
  let leveledUp = false;

  if (newLevel !== upserted.level) {
    await prisma.userScore.update({
      where: { userId },
      data: { level: newLevel },
    });
    leveledUp = true;
  }

  // Insert score event audit log
  await prisma.scoreEvent.create({
    data: {
      userId: upserted.id,
      points: delta,
      reason,
      relationId: relationId ?? null,
    },
  });

  const result: ScoreAwardResult = {
    userId,
    delta,
    reason,
    total: upserted.total,
    level: newLevel,
    leveledUp,
  };

  // Emit real-time score update
  try {
    getIO().to(userId).emit('score_update', result);
  } catch (e) {
    console.warn('[ScoreService] Socket emit failed:', e);
  }

  return result;
}

/**
 * Atomically deduct points from a user when a relation/friend is deleted.
 * Prevents total score from going below 0 and emits socket event.
 */
export async function deductPoints(
  userId: string,
  delta: number,
  reason: ScoreReason,
  relationId?: string
): Promise<ScoreAwardResult | null> {
  const existing = await prisma.userScore.findUnique({ where: { userId } });
  if (!existing) return null;

  const pointsToDeduct = Math.abs(delta);
  const newTotal = Math.max(0, existing.total - pointsToDeduct);
  const newLevel = calculateLevel(newTotal);

  await prisma.userScore.update({
    where: { userId },
    data: {
      total: newTotal,
      level: newLevel,
    },
  });

  await prisma.scoreEvent.create({
    data: {
      userId: existing.id,
      points: -pointsToDeduct,
      reason,
      relationId: relationId ?? null,
    },
  });

  const result: ScoreAwardResult = {
    userId,
    delta: -pointsToDeduct,
    reason,
    total: newTotal,
    level: newLevel,
    leveledUp: false,
  };

  try {
    getIO().to(userId).emit('score_update', result);
  } catch (e) {
    console.warn('[ScoreService] Socket emit failed:', e);
  }

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
    include: {
      events: {
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
    currentLevelIndex + 1 < LEVEL_THRESHOLDS.length
      ? LEVEL_THRESHOLDS[currentLevelIndex + 1]
      : null;

  return {
    total: score.total,
    level: score.level,
    nextLevelAt,
    recentEvents: score.events.map((e) => ({
      id: e.id,
      points: e.points,
      reason: e.reason as ScoreReason,
      relationId: e.relationId,
      createdAt: e.createdAt,
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
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, photoUrl: true },
      },
    },
  });

  return scores.map((s) => ({
    userId: s.userId,
    total: s.total,
    level: s.level,
    firstName: s.user.firstName,
    lastName: s.user.lastName,
    photoUrl: s.user.photoUrl,
  }));
}
