import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { emitToUser } from '../lib/socket';
import { TreeCacheService } from '../services/treeCacheService';
import { awardPoints, deductPoints } from '../services/scoreService';
import { getRelationTypeRegistry, type RelationTypeRegistry } from '../services/relationTypeRegistry';
import { deletionPenalty } from '../config/gamification';
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
    }
  });

  if (!rootUser) throw notFound('User not found');

  const registry = await getRelationTypeRegistry();

  // 1. Fetch all friend relations (category = FRIEND, status != REJECTED).
  // `relationType: { include: { translations: true } }` dropped: labels now
  // come from the cached registry via relationTypeCode, so this join no longer
  // runs at all here.
  const allRelations = await prisma.relation.findMany({
    where: {
      category: 'FRIEND',
      status: { not: 'REJECTED' }
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
        createdById: true,
        createdAt: true,
        updatedAt: true,
        fromUser: {
          select: { id: true, phone: true, firstName: true, lastName: true, photoUrl: true, gender: true, isAlive: true }
        },
        toUser: {
          select: { id: true, phone: true, firstName: true, lastName: true, photoUrl: true, gender: true, isAlive: true }
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
      nextQueue.push(targetUser.id);

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
          visualSide: rel.visualSide
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

async function createNotification(args: {
  userId: string;
  type: 'RELATION_REQUEST' | 'RELATION_APPROVED' | 'RELATION_REJECTED';
  title: string;
  message: string;
  relationId?: string;
}) {
  const { userId, type, title, message, relationId } = args;
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relationId: relationId ?? null,
      },
      // Narrowed from `include: { relation: { include: { fromUser: true, toUser: true } } }`,
      // which pushed every column of both users into a websocket payload.
      include: {
        relation: {
          select: {
            id: true,
            fromUserId: true,
            toUserId: true,
            status: true,
            relationTypeCode: true,
            category: true,
            createdById: true,
            customName: true,
            customPhotoUrl: true,
            fromUser: { select: RELATION_USER_SELECT },
            toUser: { select: RELATION_USER_SELECT },
          },
        },
      },
    });

    // emitToUser never throws, so no try/catch is needed around the emit itself.
    emitToUser(userId, 'notification', notification);
  } catch (err) {
    // Notification delivery must never fail the action that triggered it.
    log.error({ err, userId, type }, 'failed to create notification');
  }
}

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

  const relation = await prisma.relation.findUnique({
    where: { id },
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      createdById: true,
      status: true,
      category: true,
    },
  });

  if (!relation || relation.toUserId !== userId) {
    throw notFound('Friend request not found or not authorized');
  }

  if (relation.category !== 'FRIEND') {
    throw badRequest('Not a friend request');
  }

  if (relation.status !== 'PENDING') {
    throw badRequest('Request is no longer pending');
  }

  // Mark the request as CONFIRMED
  const updated = await prisma.relation.update({
    where: { id },
    data: { status: 'CONFIRMED' },
  });

  const approver = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  });

  // Notify the original requester (createdById or fromUserId)
  await createNotification({
    userId: relation.createdById ?? relation.fromUserId,
    type: 'RELATION_APPROVED',
    title: 'Friend request approved',
    message: `${approver?.firstName || 'Someone'} approved your friend request.`,
    relationId: relation.id,
  });

  // Award +20 points to creator. Secondary to the approval itself.
  try {
    const creatorId = relation.createdById ?? relation.fromUserId;
    await awardPoints(creatorId, 'RELATION_APPROVED', relation.id);
  } catch (scoreErr) {
    log.warn({ err: scoreErr, relationId: relation.id }, 'score award failed');
  }

  await TreeCacheService.invalidateUserTree(relation.fromUserId, relation.toUserId, relation.createdById, userId);

  return res.json(updated);
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

  const relation = await prisma.relation.findUnique({
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

  if (!relation || relation.toUserId !== userId) {
    throw notFound('Friend request not found or not authorized');
  }

  if (relation.category !== 'FRIEND') {
    throw badRequest('Not a friend request');
  }

  if (relation.status !== 'PENDING') {
    throw badRequest('Request is no longer pending');
  }

  const updated = await prisma.relation.update({
    where: { id },
    data: { status: 'REJECTED' },
  });

  // Notify the original requester
  await createNotification({
    userId: relation.createdById ?? relation.fromUserId,
    type: 'RELATION_REJECTED',
    title: 'Friend request rejected',
    message: `${relation.toUser?.firstName || 'Someone'} rejected your friend request.`,
    relationId: relation.id,
  });

  await TreeCacheService.invalidateUserTree(relation.fromUserId, relation.toUserId, relation.createdById, userId);

  return res.json(updated);
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

  const relation = await prisma.relation.findUnique({
    where: { id },
    select: {
      id: true,
      fromUserId: true,
      toUserId: true,
      createdById: true,
      status: true,
      category: true,
      fromUser: { select: { firstName: true, isAlive: true } },
      toUser: { select: { firstName: true, isAlive: true } },
    },
  });

  if (!relation) throw notFound('Friend not found');

  // Must be a participant or the creator
  const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
  const isCreator = relation.createdById === userId;

  if (!isParticipant && !isCreator) {
    throw forbidden('Not authorized to remove this friend');
  }

  if (relation.category !== 'FRIEND') {
    throw badRequest('Not a friend relation');
  }

  // If already confirmed, mark the reciprocal side as REJECTED so the other party is aware
  if (relation.status === 'CONFIRMED') {
    await prisma.relation.updateMany({
      where: { fromUserId: relation.toUserId, toUserId: relation.fromUserId },
      data: { status: 'REJECTED' }
    });
    // Notify the other party
    const otherUserId = relation.fromUserId === userId ? relation.toUserId : relation.fromUserId;
    const remover = relation.fromUserId === userId ? relation.fromUser : relation.toUser;
    await createNotification({
      userId: otherUserId,
      type: 'RELATION_REJECTED',
      title: 'Friend removed',
      message: `${remover?.firstName || 'Someone'} has removed you from their friend list.`,
      relationId: relation.id,
    });
  }

  // 1. Unlink notifications referencing this relation to avoid foreign key failure
  await prisma.notification.updateMany({
    where: { relationId: id },
    data: { relationId: null }
  });

  // 2. Delete the relation
  await prisma.relation.delete({ where: { id } });

  // 3. Deduct points from creator.
  // `deletionPenalty` derives the exact same numbers the old inline logic did
  // (isTargetAlive ? 5 : 2, +20 if it had been confirmed) from SCORE_POINTS, so a
  // future change to those award amounts can no longer desync from the reversal.
  try {
    const creatorId = relation.createdById ?? relation.fromUserId;
    const targetUser = relation.createdById === relation.fromUserId ? relation.toUser : relation.fromUser;
    const isTargetAlive = targetUser?.isAlive !== false;

    const { points, reason } = deletionPenalty(isTargetAlive, relation.status === 'CONFIRMED');
    await deductPoints(creatorId, points, reason, relation.id);
  } catch (scoreErr) {
    log.warn({ err: scoreErr, relationId: relation.id }, 'score deduction failed');
  }

  await TreeCacheService.invalidateUserTree(relation.fromUserId, relation.toUserId, relation.createdById, userId);

  return res.json({ message: 'Friend removed' });
};

export const createFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  const {
    phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl, isAlive, visualSide, dateOfBirth, bloodGroup,
    education, occupation, maritalStatus, pincode, address, area
  } = req.body;

  const fromUserId = sourceUserId || userId;

  // AUTHORIZATION FIX (mirrors relationController.createRelation): `sourceUserId`
  // arrives in the request body and, until now, was used unchecked as the
  // relation's anchor. Verify it is actually a node in the caller's own tree
  // before creating anything against it.
  if (sourceUserId) {
    await assertSourceNodeOwned(userId, sourceUserId);
  }

  const isPersonAlive = isAlive !== undefined ? (String(isAlive) === 'true') : true;

  let parsedDob: Date | null = null;
  if (dateOfBirth) {
    const d = new Date(dateOfBirth);
    if (!isNaN(d.getTime())) parsedDob = d;
  }
  const cleanBloodGroup = bloodGroup ? String(bloodGroup).trim() : null;

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
    relatedUser = await prisma.user.findUnique({ where: { phone: cleanPhone } });
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
        bloodGroup: cleanBloodGroup,
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

  const relation = await prisma.relation.upsert({
    where: {
      fromUserId_toUserId_relationTypeCode: {
        fromUserId,
        toUserId: relatedUser.id,
        relationTypeCode,
      },
    },
    update: {
      status: 'PENDING',
      ...(customName ? { customName } : {}),
      ...(customPhotoUrl ? { customPhotoUrl } : {}),
      visualSide: normalizeVisualSide(visualSide),
      createdById: userId,
    },
    create: {
      fromUserId,
      toUserId: relatedUser.id,
      relationTypeCode,
      category: 'FRIEND',
      status: 'PENDING',
      customName: customName || null,
      customPhotoUrl: customPhotoUrl || null,
      visualSide: normalizeVisualSide(visualSide),
      createdById: userId,
    },
    include: { toUser: true, fromUser: true },
  });

  const displayLabel = resolveLabel(relType, lang);
  const authUser = await prisma.user.findUnique({ where: { id: userId } });

  // Notify the recipient of the friend request (if they have a phone = real registered user)
  if (relatedUser.phone) {
    await createNotification({
      userId: relatedUser.id,
      type: 'RELATION_REQUEST',
      title: 'New friend request',
      message: `${authUser?.firstName || 'Someone'} has sent you a friend request as "${displayLabel}".`,
      relationId: relation.id,
    });
  }

  // Notify the sender that the request was sent (mirrors family pattern)
  await createNotification({
    userId: userId,
    type: 'RELATION_REQUEST',
    title: 'Friend request sent',
    message: `You added ${firstName} as "${displayLabel}". Waiting for approval.`,
    relationId: relation.id,
  });

  // Award score to the creator. Secondary to the relation itself.
  try {
    const scoreReason = isPersonAlive ? 'ADD_ALIVE' : 'ADD_DECEASED';
    await awardPoints(userId, scoreReason, relation.id);
  } catch (scoreErr) {
    log.warn({ err: scoreErr, userId, relationId: relation.id }, 'score award failed');
  }

  await TreeCacheService.invalidateUserTree(fromUserId, relatedUser.id, userId);

  return res.status(201).json({
    ...relation,
    relationType: { code: relationTypeCode, label: displayLabel }
  });
};
