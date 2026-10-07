import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { createNotification } from '../services/notificationService';
import { TreeCacheService } from '../services/treeCacheService';
import {
  awardPointsInTransaction,
  emitScoreUpdate,
  lockScoreOwnerInTransaction,
  reverseRelationPointsInTransaction,
} from '../services/scoreService';
import { getRelationTypeRegistry, type RelationTypeRegistry } from '../services/relationTypeRegistry';
import { badRequest, forbidden, notFound, unauthenticated } from '../lib/errors';
import { createLogger } from '../lib/logger';
import { RELATION_USER_SELECT, assertSourceNodeOwned } from './relationController';

const log = createLogger('friends');

/**
 * Resolve display label for a relation type based on language.
 * Kept for the one place that still holds a Prisma relationType object
 * (the single `relationType.findUnique` in `createFriend`).
 */
function resolveLabel(relationType: any, lang: string = 'mr') {
  if (!relationType || !relationType.translations) return relationType?.code || 'UNKNOWN';
  const trans = relationType.translations.find((t: any) => t.languageCode === lang) || relationType.translations[0];
  return trans ? trans.label : relationType.code;
}

/**
 * Resolve which relation code and label should be shown to the given viewer.
 *
 * PERFORMANCE FIX: this was `async` and, on the incoming-side branch, ran
 *
 *     const recType = await prisma.relationType.findUnique({ where: { code: reciprocalCode },
 *                                                            include: { translations: true } })
 *
 * once per relation, inside `Promise.all(raw.map(...))` in `listFriends` and
 * `getFriendRequests`, and inside a BFS loop in `getFriendTree`. A user with N
 * friend relations issued up to N extra queries per request against a small,
 * near-static reference table. This mirrors the identical fix already applied
 * to relationController.ts: the lookup is now synchronous against the cached
 * registry, so these endpoints run a fixed number of queries regardless of how
 * many friends a user has.
 */
function resolveRelationForViewer(
  registry: RelationTypeRegistry,
  rel: any,
  viewerUserId: string,
  lang: string = 'mr'
): { code: string; label: string } {
  if (rel.fromUserId === viewerUserId) {
    return { code: rel.relationTypeCode, label: registry.label(rel.relationTypeCode, lang) };
  }

  if (rel.toUserId === viewerUserId) {
    const reciprocalCode = registry.reciprocalOf(rel.relationTypeCode);
    return { code: reciprocalCode, label: registry.label(reciprocalCode, lang) };
  }

  return { code: rel.relationTypeCode, label: registry.label(rel.relationTypeCode, lang) };
}

export const getFriendTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';

  if (!userId) throw unauthenticated();

  const maxDepth = Number(req.query.depth) || 20;

  const rootUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      photoUrl: true,
      gender: true,
      isAlive: true,
      phone: true,
      profileCompleted: true,
      isRegistered: true,
    }
  });

  if (!rootUser) throw notFound('User not found');

  const registry = await getRelationTypeRegistry();

  // 1. Fetch all friend relations (category = FRIEND, status != REJECTED OR created by user with status = REJECTED).
  // `relationType: { include: { translations: true } }` dropped: labels now
  // come from the cached registry via relationTypeCode, so this join no longer
  // runs at all here.
  const allRelations = await prisma.relation.findMany({
    where: {
      category: 'FRIEND',
      // Hide an edge only from the viewer who unfollowed it. If the other
      // participant unfollowed, keep it visible but return hiddenByUserIds so the
      // client removes the verified tick.
      NOT: { hiddenByUserIds: { has: userId } },
      OR: [
        { status: { not: 'REJECTED' } },
        { createdById: userId, status: 'REJECTED' },
      ],
    },
    select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        relationTypeCode: true,
        category: true,
        status: true,
        customName: true,
        customPhotoUrl: true,
        visualSide: true,
        hiddenByUserIds: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        fromUser: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            gender: true,
            isAlive: true,
            profileCompleted: true,
            isRegistered: true,
          }
        },
        toUser: {
          select: {
            id: true,
            phone: true,
            firstName: true,
            lastName: true,
            photoUrl: true,
            gender: true,
            isAlive: true,
            profileCompleted: true,
            isRegistered: true,
          }
        },
    }
  });

  // 2. Build hierarchy using createdById
  const visited = new Map<string, number>();
  visited.set(userId, 0);

  const nodesByLevel = new Map<number, any[]>();
  nodesByLevel.set(0, [{ user: rootUser, relation: null }]);

  let queue: string[] = [userId];
  let currentLevel = 0;

  while (queue.length > 0 && currentLevel < maxDepth) {
    const nextQueue: string[] = [];
    const currentLevelParents = new Set(queue);
    // Find relations where one of the participants is in our current level's queue
    const childRelations = allRelations.filter(rel =>
      (currentLevelParents.has(rel.fromUserId)) || (currentLevelParents.has(rel.toUserId))
    );

    for (const rel of childRelations) {
      let sourceUserId;
      let targetUser;
      let isOutgoing = false;

      if (currentLevelParents.has(rel.fromUserId)) {
        sourceUserId = rel.fromUserId;
        targetUser = rel.toUser;
        isOutgoing = true;
      } else {
        sourceUserId = rel.toUserId;
        targetUser = rel.fromUser;
      }

      // Avoid duplicates or cycles: If user already assigned a level -> skip
      if (visited.has(targetUser.id)) continue;

      const nextLevel = currentLevel + 1;
      visited.set(targetUser.id, nextLevel);
      if (rel.status !== 'REJECTED') {
        nextQueue.push(targetUser.id);
      }

      if (!nodesByLevel.has(nextLevel)) {
        nodesByLevel.set(nextLevel, []);
      }

      const view = resolveRelationForViewer(registry, rel, sourceUserId, lang);

      nodesByLevel.get(nextLevel)!.push({
        user: targetUser,
        relation: {
          id: rel.id,
          fromUserId: rel.fromUserId,
          toUserId: rel.toUserId,
          relationType: {
            code: view.code,
            label: view.label
          },
          direction: isOutgoing ? 'OUTGOING' : 'INCOMING',
          sourceUserId,
          status: rel.status,
          category: rel.category,
          customName: rel.customName,
          customPhotoUrl: rel.customPhotoUrl,
          // visualSide is stored relative to fromUserId. Invert it when this
          // tree traversal reaches the relation from the opposite endpoint.
          visualSide: isOutgoing
            ? rel.visualSide
            : rel.visualSide === 'top'
              ? 'bottom'
              : rel.visualSide === 'bottom'
                ? 'top'
                : rel.visualSide === 'left'
                  ? 'right'
                  : rel.visualSide === 'right'
                    ? 'left'
                    : null,
          hiddenByUserIds: rel.hiddenByUserIds
        }
      });
    }

    queue = nextQueue;
    currentLevel++;
  }

  const levels = Array.from(nodesByLevel.entries())
    .map(([level, nodes]) => ({ level, nodes }))
    .sort((a, b) => a.level - b.level);

  return res.json({ rootUser, levels });
};

export const listFriends = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const registry = await getRelationTypeRegistry();

  // Narrowed from `include: { fromUser: true, toUser: true, relationType: {...} } }`,
  // which returned every column (email, address, dateOfBirth, bloodGroup) of both
  // users on every relation, plus a relationType+translations join now handled by
  // the cached registry.
  const raw = await prisma.relation.findMany({
    where: {
      category: 'FRIEND',
      OR: [
        { createdById: userId },
        { fromUserId: userId },
        { toUserId: userId }
      ],
    },
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      status: true,
      relationTypeCode: true,
      category: true,
      customName: true,
      customPhotoUrl: true,
      createdById: true,
      createdAt: true,
      fromUser: { select: RELATION_USER_SELECT },
      toUser: { select: RELATION_USER_SELECT },
    },
    orderBy: { createdAt: 'desc' },
  });

  // No longer `Promise.all(async ...)`: label resolution is synchronous now.
  const friends = raw.map(rel => {
    const view = resolveRelationForViewer(registry, rel, userId, lang);
    const isMyRelation = rel.createdById === userId;
    return {
      id: rel.id,
      fromUserId: rel.fromUserId,
      toUserId: rel.toUserId,
      status: rel.status,
      relationTypeCode: rel.relationTypeCode,
      category: rel.category,
      customName: isMyRelation ? rel.customName : null,
      customPhotoUrl: isMyRelation ? rel.customPhotoUrl : null,
      createdById: rel.createdById,
      createdAt: rel.createdAt,
      fromUser: rel.fromUser ? {
        id: rel.fromUser.id,
        firstName: rel.fromUser.firstName,
        lastName: rel.fromUser.lastName,
        photoUrl: rel.fromUser.photoUrl,
        gender: rel.fromUser.gender,
        phone: rel.fromUser.phone,
        area: rel.fromUser.area,
        isAlive: rel.fromUser.isAlive,
      } : null,
      toUser: rel.toUser ? {
        id: rel.toUser.id,
        firstName: rel.toUser.firstName,
        lastName: rel.toUser.lastName,
        photoUrl: rel.toUser.photoUrl,
        gender: rel.toUser.gender,
        phone: rel.toUser.phone,
        area: rel.toUser.area,
        isAlive: rel.toUser.isAlive,
      } : null,
      relationType: { label: view.label, code: view.code }
    };
  });

  const filteredFriends = friends.filter(rel => {
    if (rel.status === 'PENDING') {
      const isMyRelation = rel.fromUserId === userId || rel.createdById === userId;
      const relativeUser = isMyRelation ? rel.toUser : rel.fromUser;
      if (!relativeUser) return false;
      if (relativeUser.isAlive === false) return false;
      if (!relativeUser.phone || !String(relativeUser.phone).trim()) return false;
    }
    return true;
  });

  return res.json(filteredFriends);
};

function normalizePhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/** Match both the current 10-digit format and legacy Indian numbers with 91. */
function phoneLookupVariants(normalizedPhone: string): string[] {
  return normalizedPhone.length === 10
    ? [normalizedPhone, `91${normalizedPhone}`]
    : [normalizedPhone];
}

function normalizeGender(gender?: string | null): 'MALE' | 'FEMALE' | null {
  if (!gender) return null;
  const g = String(gender).trim().toUpperCase();
  if (g === 'MALE') return 'MALE';
  if (g === 'FEMALE') return 'FEMALE';
  return null;
}

function normalizeVisualSide(side?: string | null): 'top' | 'bottom' | 'left' | 'right' | null {
  if (side === 'top' || side === 'bottom' || side === 'left' || side === 'right') return side;
  return null;
}

/**
 * This file used to carry a byte-for-byte duplicate of `relationController`'s
 * `createNotification`. Both are now the shared `services/notificationService`
 * implementation, which additionally dispatches an FCM push so friend requests
 * reach a closed app. Call sites take the same argument shape as before.
 */

/**
 * GET /friends/requests
 * Returns all pending incoming friend requests for the authenticated user.
 * Mirrors getRequests from relationController (family pattern).
 */
export const getFriendRequests = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const registry = await getRelationTypeRegistry();

  const raw = await prisma.relation.findMany({
    where: {
      toUserId: userId,
      status: 'PENDING',
      category: 'FRIEND',
    },
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      status: true,
      relationTypeCode: true,
      category: true,
      customName: true,
      customPhotoUrl: true,
      visualSide: true,
      createdById: true,
      createdAt: true,
      updatedAt: true,
      fromUser: { select: RELATION_USER_SELECT },
      toUser: { select: RELATION_USER_SELECT },
      User_Relation_createdByIdToUser: { select: RELATION_USER_SELECT },
    },
    orderBy: { createdAt: 'asc' },
  });

  const pending = raw.map(rel => {
    const view = resolveRelationForViewer(registry, rel, userId, lang);

    // Show the actual requester (createdById) as the logical sender
    const logicalFromUser = (rel as any).User_Relation_createdByIdToUser || rel.fromUser;
    const logicalFromUserId = rel.createdById || rel.fromUserId;

    return {
      ...rel,
      fromUserId: logicalFromUserId,
      fromUser: logicalFromUser,
      relationType: { label: view.label, code: view.code }
    };
  });

  // Filter out requests from deceased/phoneless users (same as family pattern)
  const filteredPending = pending.filter(rel => {
    const sender = rel.fromUser;
    if (!sender) return false;
    if (sender.isAlive === false) return false;
    if (!sender.phone || !String(sender.phone).trim()) return false;
    return true;
  });

  return res.json(filteredPending);
};

/**
 * POST /friends/:id/approve
 * Approve a pending friend request. Notifies the original requester.
 * Mirrors approveRelation from relationController (family pattern).
 */
export const approveFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) throw unauthenticated();

  const outcome = await prisma.$transaction(async (tx) => {
    const relation = await tx.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        status: true,
        category: true,
        hiddenByUserIds: true,
      },
    });
    if (!relation || relation.toUserId !== userId || relation.category !== 'FRIEND') {
      throw notFound('Friend request not found or not authorized');
    }
    if (relation.status === 'CONFIRMED') {
      if (relation.hiddenByUserIds && relation.hiddenByUserIds.length > 0) {
        await tx.relation.update({
          where: { id },
          data: { hiddenByUserIds: [] },
        });
        await tx.relation.updateMany({
          where: {
            fromUserId: relation.toUserId,
            toUserId: relation.fromUserId,
            category: 'FRIEND',
          },
          data: { hiddenByUserIds: [] },
        });
        const current = await tx.relation.findUniqueOrThrow({ where: { id } });
        return { relation: current, transitioned: true, scoreUpdate: null };
      }
      return { relation, transitioned: false, scoreUpdate: null };
    }
    if (relation.status !== 'PENDING') throw badRequest('Request is no longer pending');

    await lockScoreOwnerInTransaction(tx, relation.createdById ?? relation.fromUserId);

    const changed = await tx.relation.updateMany({
      where: { id, toUserId: userId, category: 'FRIEND', status: 'PENDING' },
      data: { status: 'CONFIRMED', approvedAt: new Date(), hiddenByUserIds: [] },
    });
    if (changed.count > 0) {
      await tx.relation.updateMany({
        where: {
          fromUserId: relation.toUserId,
          toUserId: relation.fromUserId,
          category: 'FRIEND',
        },
        data: { hiddenByUserIds: [] },
      });
    }
    if (changed.count === 0) {
      const current = await tx.relation.findUniqueOrThrow({ where: { id } });
      if (current.status !== 'CONFIRMED') {
        throw badRequest('Request was rejected before it could be approved');
      }
      return { relation: current, transitioned: false, scoreUpdate: null };
    }

    const updated = await tx.relation.findUniqueOrThrow({ where: { id } });
    const creatorId = relation.createdById ?? relation.fromUserId;
    const scoreUpdate = await awardPointsInTransaction(
      tx,
      creatorId,
      'RELATION_APPROVED',
      relation.id,
      `relation:${relation.id}:approved`
    );
    return { relation: updated, transitioned: true, scoreUpdate };
  });

  if (outcome.transitioned) {
    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });
    await createNotification({
      userId: outcome.relation.createdById ?? outcome.relation.fromUserId,
      type: 'RELATION_APPROVED',
      title: 'Friend request approved',
      message: `${approver?.firstName || 'Someone'} approved your friend request.`,
      relationId: outcome.relation.id,
    });
  }

  await TreeCacheService.invalidateUserTree(
    outcome.relation.fromUserId,
    outcome.relation.toUserId,
    outcome.relation.createdById,
    userId
  );
  emitScoreUpdate(outcome.scoreUpdate);
  return res.json(outcome.relation);
};

/**
 * POST /friends/:id/reject
 * Reject a pending friend request. Notifies the original requester.
 * Mirrors rejectRelation from relationController (family pattern).
 */
export const rejectFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) throw unauthenticated();

  const outcome = await prisma.$transaction(async (tx) => {
    const relation = await tx.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        status: true,
        category: true,
        toUser: { select: { firstName: true } },
      },
    });
    if (!relation || relation.toUserId !== userId || relation.category !== 'FRIEND') {
      throw notFound('Friend request not found or not authorized');
    }
    if (relation.status === 'REJECTED') return { relation, transitioned: false };
    if (relation.status !== 'PENDING') throw badRequest('Request is no longer pending');

    await lockScoreOwnerInTransaction(tx, relation.createdById ?? relation.fromUserId);

    const changed = await tx.relation.updateMany({
      where: { id, toUserId: userId, category: 'FRIEND', status: 'PENDING' },
      data: { status: 'REJECTED' },
    });
    const updated = await tx.relation.findUniqueOrThrow({
      where: { id },
      include: { toUser: { select: { firstName: true } } },
    });
    if (changed.count === 0 && updated.status !== 'REJECTED') {
      throw badRequest('Request was approved before it could be rejected');
    }
    return { relation: updated, transitioned: changed.count === 1 };
  });

  if (outcome.transitioned) {
    await createNotification({
      userId: outcome.relation.createdById ?? outcome.relation.fromUserId,
      type: 'RELATION_REJECTED',
      title: 'Friend request rejected',
      message: `${outcome.relation.toUser?.firstName || 'Someone'} rejected your friend request.`,
      relationId: outcome.relation.id,
    });
  }

  await TreeCacheService.invalidateUserTree(
    outcome.relation.fromUserId,
    outcome.relation.toUserId,
    outcome.relation.createdById,
    userId
  );
  return res.json(outcome.relation);
};

/**
 * DELETE /friends/:id
 * Remove a friend relation. Notifies the other party if already confirmed.
 * Mirrors deleteRelation from relationController (family pattern).
 */
export const deleteFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) throw unauthenticated();

  const outcome = await prisma.$transaction(async (tx) => {
    const relation = await tx.relation.findUnique({
      where: { id },
      select: {
        id: true,
        fromUserId: true,
        toUserId: true,
        createdById: true,
        status: true,
        category: true,
        relationTypeCode: true,
        relationType: { select: { reciprocalCode: true } },
        fromUser: { select: { firstName: true, isAlive: true } },
        toUser: { select: { firstName: true, isAlive: true } },
      },
    });
    if (!relation || relation.category !== 'FRIEND') throw notFound('Friend not found');

    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = relation.createdById === userId;
    if (!isParticipant && !isCreator) throw forbidden('Not authorized to remove this friend');

    const creatorId = relation.createdById ?? relation.fromUserId;
    await lockScoreOwnerInTransaction(tx, creatorId);

    if (relation.status === 'CONFIRMED') {
      await tx.relation.updateMany({
        where: {
          fromUserId: relation.toUserId,
          toUserId: relation.fromUserId,
          category: 'FRIEND',
          relationTypeCode: relation.relationType.reciprocalCode ?? relation.relationTypeCode,
          status: 'CONFIRMED',
        },
        data: { status: 'REJECTED' },
      });
    }

    await tx.notification.updateMany({
      where: { relationId: id },
      data: { relationId: null },
    });
    const scoreUpdate = await reverseRelationPointsInTransaction(
      tx,
      creatorId,
      relation.id,
      'ALL'
    );
    await tx.relation.delete({ where: { id } });
    return { relation, scoreUpdate };
  });

  await TreeCacheService.invalidateUserTree(
    outcome.relation.fromUserId,
    outcome.relation.toUserId,
    outcome.relation.createdById,
    userId
  );
  emitScoreUpdate(outcome.scoreUpdate);

  if (outcome.relation.status === 'CONFIRMED') {
    try {
      const otherUserId = outcome.relation.fromUserId === userId
        ? outcome.relation.toUserId
        : outcome.relation.fromUserId;
      const remover = outcome.relation.fromUserId === userId
        ? outcome.relation.fromUser
        : outcome.relation.toUser;
      const targetUser = outcome.relation.fromUserId === userId
        ? outcome.relation.toUser
        : outcome.relation.fromUser;
      if (otherUserId !== userId && targetUser?.isAlive !== false) {
        await createNotification({
          userId: otherUserId,
          type: 'RELATION_REJECTED',
          title: 'Friend removed',
          message: `${remover?.firstName || 'Someone'} has removed you from their friend list.`,
        });
      }
    } catch (notificationError) {
      log.warn(
        { err: notificationError, relationId: outcome.relation.id },
        'friend deleted but removal notification failed'
      );
    }
  }

  return res.json({ message: 'Friend removed' });
};

export const createFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const {
    phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl, isAlive, visualSide, dateOfBirth, dateOfDeath, bloodGroup,
    education, occupation, maritalStatus, pincode, address, area
  } = req.body;

  const fromUserId = sourceUserId || userId;

  if (sourceUserId) {
    await assertSourceNodeOwned(userId, sourceUserId);
  }

  const isPersonAlive = isAlive !== undefined ? (String(isAlive) === 'true') : true;

  let parsedDob: Date | null = null;
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    if (!isNaN(d.getTime())) parsedDob = d;
  }

  let parsedDateOfDeath: Date | null = null;
  if (!isPersonAlive && dateOfDeath) {
    const d = new Date(dateOfDeath);
    if (!isNaN(d.getTime())) parsedDateOfDeath = d;
  }

  const cleanBloodGroup = (isPersonAlive && bloodGroup) ? String(bloodGroup).trim() : null;

  let cleanPhone = null;
  if (isPersonAlive && phone && String(phone).trim()) {
    cleanPhone = normalizePhone(phone);
    if (!cleanPhone || cleanPhone.length < 10) {
      throw badRequest('Invalid phone number');
    }
  }

  const relType = await prisma.relationType.findUnique({
    where: { code: relationTypeCode },
    include: { translations: true }
  });

  if (!relType || relType.category !== 'FRIEND') {
    throw badRequest('Invalid friend relation type');
  }

  let relatedUser = null;
  if (cleanPhone) {
    relatedUser = await prisma.user.findFirst({
      where: { phone: { in: phoneLookupVariants(cleanPhone) } },
      // Prefer the real account if legacy 10/12-digit duplicates exist.
      orderBy: [
        { profileCompleted: 'desc' },
        { isRegistered: 'desc' },
      ],
    });
  }

  if (!relatedUser) {
    relatedUser = await prisma.user.create({
      data: {
        phone: cleanPhone,
        whatsapp: cleanPhone,
        firstName,
        lastName: lastName || null,
        gender: normalizeGender(gender),
        dateOfBirth: parsedDob,
        dateOfDeath: !isPersonAlive ? parsedDateOfDeath : null,
        bloodGroup: isPersonAlive ? cleanBloodGroup : null,
        education: education ? String(education).trim() : null,
        occupation: occupation ? String(occupation).trim() : null,
        maritalStatus: maritalStatus ? String(maritalStatus).trim() : null,
        pincode: pincode ? String(pincode).trim() : null,
        address: address ? String(address).trim() : null,
        area: area ? String(area).trim() : null,
        profileCompleted: false,
        isAlive: isPersonAlive,
      },
    });
  }

  if (relatedUser.id === fromUserId) {
    throw badRequest('Cannot add yourself or the source as a friend');
  }

  const { relation, scoreUpdate, isRecreating, hasPriorApproval } = await prisma.$transaction(async (tx) => {
    await lockScoreOwnerInTransaction(tx, userId);

    // Block adding the same friend with the exact same relation type if an active relation already exists in THIS user's tree
    const existingActiveRelation = await tx.relation.findFirst({
      where: {
        category: 'FRIEND',
        relationTypeCode,
        createdById: userId,
        toUserId: relatedUser.id,
        status: { in: ['CONFIRMED', 'PENDING'] },
        NOT: { hiddenByUserIds: { has: userId } },
      },
    });

    if (existingActiveRelation) {
      const displayLabel = resolveLabel(relType, lang);
      throw badRequest(`This person is already added with relation: ${displayLabel}`);
    }

    // Check if a confirmed approval already exists between these users (e.g. they approved an incoming friend request)
    const hasPriorApproval = Boolean(
      await tx.relation.findFirst({
        where: {
          category: 'FRIEND',
          status: 'CONFIRMED',
          OR: [
            { fromUserId: userId, toUserId: relatedUser.id },
            { fromUserId: relatedUser.id, toUserId: userId },
            { createdById: relatedUser.id, toUserId: userId },
            { createdById: relatedUser.id, fromUserId: userId },
            { createdById: userId, toUserId: relatedUser.id },
            { createdById: userId, fromUserId: relatedUser.id },
          ],
        },
      })
    );

    const targetStatus = (!isPersonAlive || hasPriorApproval) ? 'CONFIRMED' : 'PENDING';
    const targetApprovedAt = (!isPersonAlive || hasPriorApproval) ? new Date() : null;

    const existing = await tx.relation.findUnique({
      where: {
        fromUserId_toUserId_relationTypeCode: {
          fromUserId,
          toUserId: relatedUser.id,
          relationTypeCode,
        },
      },
      select: { id: true, status: true, hiddenByUserIds: true },
    });

    const isRecreating = Boolean(
      existing && (existing.hiddenByUserIds.length > 0 || existing.status === 'REJECTED')
    );

    const savedRelation = await tx.relation.upsert({
      where: {
        fromUserId_toUserId_relationTypeCode: {
          fromUserId,
          toUserId: relatedUser.id,
          relationTypeCode,
        },
      },
      update: {
        ...(customName ? { customName } : {}),
        ...(customPhotoUrl ? { customPhotoUrl } : {}),
        visualSide: normalizeVisualSide(visualSide),
        ...(isRecreating || hasPriorApproval
          ? {
              status: targetStatus,
              approvedAt: targetApprovedAt,
              createdById: userId,
              hiddenByUserIds: [],
            }
          : {}),
      },
      create: {
        fromUserId,
        toUserId: relatedUser.id,
        relationTypeCode,
        category: 'FRIEND',
        status: targetStatus,
        approvedAt: targetApprovedAt,
        customName: customName || null,
        customPhotoUrl: customPhotoUrl || null,
        visualSide: normalizeVisualSide(visualSide),
        createdById: userId,
        hiddenByUserIds: [],
      },
      include: { toUser: true, fromUser: true },
    });
    const addReason = savedRelation.toUser.isAlive === false ? 'ADD_DECEASED' : 'ADD_ALIVE';
    const score = await awardPointsInTransaction(
      tx,
      savedRelation.createdById ?? userId,
      addReason,
      savedRelation.id,
      `relation:${savedRelation.id}:add`
    );
    return { relation: savedRelation, scoreUpdate: score, isRecreating, hasPriorApproval };
  });
  const displayLabel = resolveLabel(relType, lang);
  const authUser = await prisma.user.findUnique({ where: { id: userId } });

  // Only send pending notifications if alive and not already approved
  if (isPersonAlive && !hasPriorApproval && (scoreUpdate.applied || isRecreating)) {
    // Notify the recipient of the friend request (if they have a phone = real registered user)
    if (relatedUser.phone) {
      await createNotification({
        userId: relatedUser.id,
        type: 'RELATION_REQUEST',
        title: 'New friend request',
        message: `${authUser?.firstName || 'Someone'} has sent you a friend request.`,
        relationId: relation.id,
      });
    }

    // Notify the sender that the request was sent (mirrors family pattern)
    await createNotification({
      userId: userId,
      type: 'RELATION_REQUEST',
      title: 'Friend request sent',
      message: `You added ${firstName}. Waiting for approval.`,
      relationId: relation.id,
    });
  }

  await TreeCacheService.invalidateUserTree(fromUserId, relatedUser.id, userId);
  emitScoreUpdate(scoreUpdate);

  return res.status(201).json({
    ...relation,
    relationType: { code: relationTypeCode, label: displayLabel }
  });
};
