import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../lib/socket';
import { TreeCacheService } from '../services/treeCacheService';
import { awardPoints, deductPoints } from '../services/scoreService';

/**
 * Resolve display label for a relation type based on language.
 */
function resolveLabel(relationType: any, lang: string = 'mr') {
  if (!relationType || !relationType.translations) return relationType?.code || 'UNKNOWN';
  const trans = relationType.translations.find((t: any) => t.languageCode === lang) || relationType.translations[0];
  return trans ? trans.label : relationType.code;
}

/**
 * Resolve which relation code and label should be shown to the given viewer.
 */
async function resolveRelationForViewer(rel: any, viewerUserId: string, lang: string = 'mr') {
  if (rel.fromUserId === viewerUserId) {
    return {
      code: rel.relationTypeCode,
      label: resolveLabel(rel.relationType, lang)
    };
  }

  if (rel.toUserId === viewerUserId) {
    const reciprocalCode = rel.relationType?.reciprocalCode || rel.relationTypeCode;
    const recType = await prisma.relationType.findUnique({
      where: { code: reciprocalCode },
      include: { translations: true }
    });

    return {
      code: reciprocalCode,
      label: resolveLabel(recType, lang)
    };
  }

  return {
    code: rel.relationTypeCode,
    label: resolveLabel(rel.relationType, lang)
  };
}

export const getFriendTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';

  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const maxDepth = Number(req.query.depth) || 20;

  try {
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

    if (!rootUser) return res.status(404).json({ message: 'User not found' });

    // 1. Fetch all friend relations (category = FRIEND, status != REJECTED)
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
          relationType: { include: { translations: true } }
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

        const view = await resolveRelationForViewer(rel, sourceUserId, lang);

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

  } catch (error) {
    console.error('getFriendTree error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const listFriends = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const raw = await prisma.relation.findMany({
      where: {
        category: 'FRIEND',
        OR: [
          { createdById: userId },
          { fromUserId: userId },
          { toUserId: userId }
        ],
      },
      include: {
        fromUser: true,
        toUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    const friends = await Promise.all(raw.map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);
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
    }));

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
  } catch (error) {
    console.error('list friends error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
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
      include: {
        relation: {
          include: {
            fromUser: true,
            toUser: true,
          },
        },
      },
    });

    // Emit real-time notification via Socket.IO (matches family pattern)
    try {
      getIO().to(userId).emit('notification', notification);
    } catch (e) {
      console.warn('Socket emit failed', e);
    }
  } catch (err) {
    console.error('Failed to create notification', err);
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
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const raw = await prisma.relation.findMany({
      where: {
        toUserId: userId,
        status: 'PENDING',
        category: 'FRIEND',
      },
      include: {
        fromUser: true,
        toUser: true,
        User_Relation_createdByIdToUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'asc' },
    });

    const pending = await Promise.all(raw.map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);

      // Show the actual requester (createdById) as the logical sender
      const logicalFromUser = (rel as any).User_Relation_createdByIdToUser || rel.fromUser;
      const logicalFromUserId = rel.createdById || rel.fromUserId;

      return {
        ...rel,
        fromUserId: logicalFromUserId,
        fromUser: logicalFromUser,
        relationType: { label: view.label, code: view.code }
      };
    }));

    // Filter out requests from deceased/phoneless users (same as family pattern)
    const filteredPending = pending.filter(rel => {
      const sender = rel.fromUser;
      if (!sender) return false;
      if (sender.isAlive === false) return false;
      if (!sender.phone || !String(sender.phone).trim()) return false;
      return true;
    });

    return res.json(filteredPending);
  } catch (error) {
    console.error('getFriendRequests error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /friends/:id/approve
 * Approve a pending friend request. Notifies the original requester.
 * Mirrors approveRelation from relationController (family pattern).
 */
export const approveFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: {
        fromUser: true,
        toUser: true,
        relationType: { include: { translations: true } },
      },
    });

    if (!relation || relation.toUserId !== userId) {
      return res.status(404).json({ message: 'Friend request not found or not authorized' });
    }

    if (relation.category !== 'FRIEND') {
      return res.status(400).json({ message: 'Not a friend request' });
    }

    if (relation.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request is no longer pending' });
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

    // Award +20 points to creator
    try {
      const creatorId = relation.createdById ?? relation.fromUserId;
      await awardPoints(creatorId, 'RELATION_APPROVED', relation.id);
    } catch (scoreErr) {
      console.warn('[approveFriend] Score award failed:', scoreErr);
    }

    await TreeCacheService.invalidateUserTree(relation.fromUserId, relation.toUserId, relation.createdById, userId);

    return res.json(updated);
  } catch (error) {
    console.error('approveFriend error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /friends/:id/reject
 * Reject a pending friend request. Notifies the original requester.
 * Mirrors rejectRelation from relationController (family pattern).
 */
export const rejectFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: {
        toUser: true,
        fromUser: true,
      },
    });

    if (!relation || relation.toUserId !== userId) {
      return res.status(404).json({ message: 'Friend request not found or not authorized' });
    }

    if (relation.category !== 'FRIEND') {
      return res.status(400).json({ message: 'Not a friend request' });
    }

    if (relation.status !== 'PENDING') {
      return res.status(400).json({ message: 'Request is no longer pending' });
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
  } catch (error) {
    console.error('rejectFriend error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * DELETE /friends/:id
 * Remove a friend relation. Notifies the other party if already confirmed.
 * Mirrors deleteRelation from relationController (family pattern).
 */
export const deleteFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: { fromUser: true, toUser: true }
    });

    if (!relation) return res.status(404).json({ message: 'Friend not found' });

    // Must be a participant or the creator
    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = relation.createdById === userId;

    if (!isParticipant && !isCreator) {
      return res.status(403).json({ message: 'Not authorized to remove this friend' });
    }

    if (relation.category !== 'FRIEND') {
      return res.status(400).json({ message: 'Not a friend relation' });
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

    // 3. Deduct points from creator
    try {
      const creatorId = relation.createdById ?? relation.fromUserId;
      const targetUser = relation.createdById === relation.fromUserId ? relation.toUser : relation.fromUser;
      const isTargetAlive = targetUser?.isAlive !== false;

      let pointsToDeduct = isTargetAlive ? 5 : 2;
      let reason: 'REMOVE_ALIVE' | 'REMOVE_DECEASED' = isTargetAlive ? 'REMOVE_ALIVE' : 'REMOVE_DECEASED';

      if (relation.status === 'CONFIRMED') {
        pointsToDeduct += 20; // Reverse the +20 approval bonus as well
      }

      await deductPoints(creatorId, pointsToDeduct, reason, relation.id);
    } catch (scoreErr) {
      console.warn('[deleteFriend] Score deduction failed:', scoreErr);
    }

    await TreeCacheService.invalidateUserTree(relation.fromUserId, relation.toUserId, relation.createdById, userId);

    return res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('deleteFriend error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const createFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const {
    phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl, isAlive, visualSide, dateOfBirth, bloodGroup,
    education, occupation, maritalStatus, pincode, address, area
  } = req.body;
  console.log('DEBUG: createFriend. sourceUserId:', sourceUserId, 'userId:', userId);

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
        return res.status(400).json({ message: 'Invalid phone number' });
      }
  }

  try {
    const relType = await prisma.relationType.findUnique({
      where: { code: relationTypeCode },
      include: { translations: true }
    });

    if (!relType || relType.category !== 'FRIEND') {
      return res.status(400).json({ message: 'Invalid friend relation type' });
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

    if (relatedUser.id === userId || (sourceUserId && relatedUser.id === sourceUserId)) {
      return res.status(400).json({ message: 'Cannot add yourself or the source as a friend' });
    }

    const fromUserId = sourceUserId || userId;

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

    // Award score to the creator
    try {
      const scoreReason = isPersonAlive ? 'ADD_ALIVE' : 'ADD_DECEASED';
      await awardPoints(userId, scoreReason, relation.id);
    } catch (scoreErr) {
      console.warn('[createFriend] Score award failed:', scoreErr);
    }

    await TreeCacheService.invalidateUserTree(fromUserId, relatedUser.id, userId);

    return res.status(201).json({
      ...relation,
      relationType: { code: relationTypeCode, label: displayLabel }
    });
  } catch (error) {
    console.error('create friend error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
