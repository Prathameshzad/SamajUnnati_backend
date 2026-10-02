// src/services/scoreService.ts
import { Prisma } from '@prisma/client';
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
  /** False means the deterministic operation had already been recorded. */
  applied: boolean;
}

export type RelationReversalScope = 'APPROVAL_ONLY' | 'ALL';

type ScoreTx = Prisma.TransactionClient;

/**
 * Shared lifecycle mutex that exists even before a UserScore row does.
 *
 * All relation state/score transactions and score bootstrap acquire this first.
 * That prevents bootstrap from awarding a relation concurrently being deleted,
 * and gives every lifecycle path one lock order: owner advisory lock -> relation
 * row -> score row -> ledger events.
 */
export async function lockScoreOwnerInTransaction(tx: ScoreTx, userId: string): Promise<void> {
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(hashtextextended(${`score-owner:${userId}`}, 0))
  `;
}

/**
 * Serialize every mutation for one scorecard. Without this row lock, two
 * different relation transactions can each aggregate a partial ledger snapshot
 * and the later UserScore write can overwrite the other, even though both event
 * inserts committed correctly.
 */
async function lockScoreRow(tx: ScoreTx, scoreId: string) {
  await tx.$queryRaw`SELECT "id" FROM "UserScore" WHERE "id" = ${scoreId} FOR UPDATE`;
  return tx.userScore.findUniqueOrThrow({ where: { id: scoreId } });
}

async function syncScoreFromLedger(
  tx: ScoreTx,
  scoreId: string,
  previousLevel: number
): Promise<{ total: number; level: number; leveledUp: boolean }> {
  const aggregate = await tx.scoreEvent.aggregate({
    where: { userId: scoreId },
    _sum: { points: true },
  });
  // Scores are never exposed below zero. Because relation reversals reference
  // real positive events, new data remains balanced; the clamp only protects
  // users with inconsistent legacy rows.
  const total = Math.max(0, aggregate._sum.points ?? 0);
  const level = calculateLevel(total);
  await tx.userScore.update({ where: { id: scoreId }, data: { total, level } });
  return { total, level, leveledUp: level > previousLevel };
}

/** Emit only after the caller's outer relation transaction has committed. */
export function emitScoreUpdate(result: ScoreAwardResult | null): void {
  if (result?.applied) emitToUser(result.userId, 'score_update', result);
}

/**
 * Records one score award inside the caller's transaction.
 *
 * `operationKey` is deterministic for relation lifecycle events, for example
 * `relation:<id>:add` or `relation:<id>:approved`. The database unique index and
 * createMany(skipDuplicates) make retries and concurrent requests no-ops. The
 * legacy relation/reason lookup prevents a one-time duplicate when pre-migration
 * events have no operationKey.
 */
export async function awardPointsInTransaction(
  tx: ScoreTx,
  userId: string,
  reason: ScoreReason,
  relationId?: string,
  operationKey?: string
): Promise<ScoreAwardResult> {
  const delta = SCORE_POINTS[reason];
  const upserted = await tx.userScore.upsert({
    where: { userId },
    create: { userId, total: 0, level: 1 },
    update: {},
  });
  const score = await lockScoreRow(tx, upserted.id);

  if (relationId) {
    // ADD_ALIVE and ADD_DECEASED are two variants of the same logical "add"
    // operation. If legacy data already has either one, a later profile liveness
    // edit or retry must not award the other variant as a second add.
    const legacyReasons: ScoreReason[] = reason === 'ADD_ALIVE' || reason === 'ADD_DECEASED'
      ? ['ADD_ALIVE', 'ADD_DECEASED']
      : [reason];
    const legacyEvent = await tx.scoreEvent.findFirst({
      where: {
        userId: score.id,
        relationId,
        reason: { in: legacyReasons as any },
        points: { gt: 0 },
      },
      select: { id: true },
    });
    if (legacyEvent) {
      return {
        userId,
        delta: 0,
        reason,
        total: score.total,
        level: score.level,
        leveledUp: false,
        applied: false,
      };
    }
  }

  const inserted = await tx.scoreEvent.createMany({
    data: [{
      userId: score.id,
      points: delta,
      reason: reason as any,
      relationId: relationId ?? null,
      operationKey: operationKey ?? null,
    }],
    skipDuplicates: true,
  });

  if (inserted.count === 0) {
    const current = await tx.userScore.findUniqueOrThrow({ where: { id: score.id } });
    return {
      userId,
      delta: 0,
      reason,
      total: current.total,
      level: current.level,
      leveledUp: false,
      applied: false,
    };
  }

  const synced = await syncScoreFromLedger(tx, score.id, score.level);
  return { userId, delta, reason, ...synced, applied: true };
}

/**
 * Reverses positive relation events by referencing the actual ledger rows.
 * APPROVAL_ONLY is used by unfollow; ALL is used by deletion/cancellation.
 * Each source event can be reversed once because reversesEventId is unique.
 */
export async function reverseRelationPointsInTransaction(
  tx: ScoreTx,
  userId: string,
  relationId: string,
  scope: RelationReversalScope
): Promise<ScoreAwardResult | null> {
  const existingScore = await tx.userScore.findUnique({ where: { userId } });
  if (!existingScore) return null;
  const score = await lockScoreRow(tx, existingScore.id);

  const reasons: ScoreReason[] = scope === 'APPROVAL_ONLY'
    ? ['RELATION_APPROVED']
    : ['ADD_ALIVE', 'ADD_DECEASED', 'RELATION_APPROVED'];

  const positiveEvents = await tx.scoreEvent.findMany({
    where: {
      userId: score.id,
      relationId,
      points: { gt: 0 },
      reason: { in: reasons as any },
    },
    select: { id: true, points: true, reason: true },
  });

  let appliedDelta = 0;
  for (const event of positiveEvents) {
    const reverseReason: ScoreReason = event.reason === 'ADD_ALIVE'
      ? 'REMOVE_ALIVE'
      : event.reason === 'ADD_DECEASED'
        ? 'REMOVE_DECEASED'
        : 'REMOVE_RELATION';

    const inserted = await tx.scoreEvent.createMany({
      data: [{
        userId: score.id,
        points: -event.points,
        reason: reverseReason as any,
        relationId,
        operationKey: `score:reverse:${event.id}`,
        reversesEventId: event.id,
      }],
      skipDuplicates: true,
    });
    if (inserted.count === 1) appliedDelta -= event.points;
  }

  if (appliedDelta === 0) return null;

  const synced = await syncScoreFromLedger(tx, score.id, score.level);
  return {
    userId,
    delta: appliedDelta,
    reason: 'REMOVE_RELATION',
    ...synced,
    applied: true,
  };
}

/** Standalone award API retained for posts/stories and other non-relation calls. */
export async function awardPoints(
  userId: string,
  reason: ScoreReason,
  relationId?: string,
  operationKey?: string
): Promise<ScoreAwardResult> {
  const result = await prisma.$transaction(async (tx) => {
    await lockScoreOwnerInTransaction(tx, userId);
    return awardPointsInTransaction(tx, userId, reason, relationId, operationKey);
  });
  emitScoreUpdate(result);
  return result;
}

/**
 * General standalone deduction retained for non-lifecycle callers. Relation
 * removal must use reverseRelationPointsInTransaction so it reverses real events.
 */
export async function deductPoints(
  userId: string,
  delta: number,
  reason: ScoreReason,
  relationId?: string
): Promise<ScoreAwardResult | null> {
  const pointsToDeduct = Math.abs(delta);
  const result = await prisma.$transaction(async (tx) => {
    await lockScoreOwnerInTransaction(tx, userId);
    const existingScore = await tx.userScore.findUnique({ where: { userId } });
    if (!existingScore) return null;
    const score = await lockScoreRow(tx, existingScore.id);
    const actualDelta = -Math.min(score.total, pointsToDeduct);
    if (actualDelta === 0) return null;
    await tx.scoreEvent.create({
      data: {
        userId: score.id,
        points: actualDelta,
        reason: reason as any,
        relationId: relationId ?? null,
      },
    });
    const synced = await syncScoreFromLedger(tx, score.id, score.level);
    return { userId, delta: actualDelta, reason, ...synced, applied: true };
  });

  if (!result) log.debug({ userId }, 'no score points available to deduct');
  emitScoreUpdate(result);
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
  const selection = {
    total: true,
    level: true,
    events: {
      select: { id: true, points: true, reason: true, relationId: true, createdAt: true },
      orderBy: { createdAt: 'desc' as const },
      take: 20,
    },
  };

  let score = await prisma.userScore.findUnique({ where: { userId }, select: selection });

  if (!score) {
    // The owner advisory lock is acquired BEFORE taking the relation snapshot.
    // Delete/add/approve/unfollow use the same lock, so bootstrap cannot create an
    // event for a relation that is concurrently being removed.
    score = await prisma.$transaction(async (tx) => {
      await lockScoreOwnerInTransaction(tx, userId);

      const existing = await tx.userScore.findUnique({ where: { userId }, select: selection });
      if (existing) return existing;

      const [relations, postCount, storyCount] = await Promise.all([
        tx.relation.findMany({
          where: {
            deletedAt: null,
            category: { in: ['FAMILY', 'FRIEND'] },
            OR: [
              { createdById: userId },
              { createdById: null, fromUserId: userId },
            ],
          },
          select: {
            id: true,
            status: true,
            approvedAt: true,
            hiddenByUserIds: true,
            toUser: { select: { isAlive: true } },
          },
        }),
        tx.post.count({ where: { userId, deletedAt: null } }),
        tx.story.count({ where: { userId, deletedAt: null } }),
      ]);

      if (relations.length === 0 && postCount === 0 && storyCount === 0) return null;

      const initialEvents: {
        points: number;
        reason: ScoreReason;
        relationId?: string;
        operationKey: string;
      }[] = [];

      for (const relation of relations) {
        const isAlive = relation.toUser?.isAlive !== false;
        const addReason: ScoreReason = isAlive ? 'ADD_ALIVE' : 'ADD_DECEASED';
        initialEvents.push({
          points: SCORE_POINTS[addReason],
          reason: addReason,
          relationId: relation.id,
          operationKey: `relation:${relation.id}:add`,
        });

        // approvedAt is durable provenance set only by an explicit approval.
        // Auto-confirmed deceased/manual reciprocal rows keep it NULL. A hidden
        // relation has been unfollowed and has lost the verification bonus.
        if (
          relation.status === 'CONFIRMED' &&
          relation.approvedAt !== null &&
          relation.hiddenByUserIds.length === 0
        ) {
          initialEvents.push({
            points: SCORE_POINTS.RELATION_APPROVED,
            reason: 'RELATION_APPROVED',
            relationId: relation.id,
            operationKey: `relation:${relation.id}:approved`,
          });
        }
      }

      if (postCount > 0) {
        initialEvents.push({
          points: postCount * SCORE_POINTS.POST_CREATE,
          reason: 'POST_CREATE',
          operationKey: `score-rebuild:${userId}:posts`,
        });
      }
      if (storyCount > 0) {
        initialEvents.push({
          points: storyCount * SCORE_POINTS.STORY_CREATE,
          reason: 'STORY_CREATE',
          operationKey: `score-rebuild:${userId}:stories`,
        });
      }

      const created = await tx.userScore.create({ data: { userId, total: 0, level: 1 } });
      const lockedScore = await lockScoreRow(tx, created.id);
      await tx.scoreEvent.createMany({
        data: initialEvents.map((event) => ({
          userId: created.id,
          points: event.points,
          reason: event.reason as any,
          relationId: event.relationId ?? null,
          operationKey: event.operationKey,
        })),
        skipDuplicates: true,
      });
      await syncScoreFromLedger(tx, created.id, lockedScore.level);
      return tx.userScore.findUnique({ where: { userId }, select: selection });
    });
  }

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
