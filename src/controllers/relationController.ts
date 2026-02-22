// src/controllers/relationController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getReciprocalCode, getRelationLabel, RELATION_METADATA } from '../utils/relationMetadata';

type GenderValue = 'MALE' | 'FEMALE' | null;

function normalizeGender(gender?: string | null): GenderValue {
  if (!gender) return null;
  const g = String(gender).trim().toUpperCase();
  if (g === 'MALE') return 'MALE';
  if (g === 'FEMALE') return 'FEMALE';
  return null;
}

/**
 * Resolve which relation code and label should be shown to the given viewer.
 */
function resolveRelationForViewer(rel: any, viewerUserId: string) {
  if (rel.fromUserId === viewerUserId) {
    return {
      code: rel.relationTypeCode,
      label: rel.relationLabel || getRelationLabel(rel.relationTypeCode)
    };
  }

  if (rel.toUserId === viewerUserId) {
    const reciprocalCode = getReciprocalCode(rel.relationTypeCode);
    return {
      code: reciprocalCode,
      label: getRelationLabel(reciprocalCode)
    };
  }

  return {
    code: rel.relationTypeCode,
    label: rel.relationLabel || getRelationLabel(rel.relationTypeCode)
  };
}

import { getIO } from '../lib/socket';

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
            toUser: true
          }
        }
      }
    });

    // Emit real-time event
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
 * Resolves user/relation fields for the given viewer.
 * If I (viewer) added you, I might have set a custom name or photo for you in THIS relation.
 * So we overlay `customName` -> `user.firstName` and `customPhotoUrl` -> `user.photoUrl`.
 */
function resolveNodeForViewer(nodeUser: any, relation: any, viewerUserId: string) {
  // Logic: 
  // If I am the creator of this relation (fromUserId == viewerUserId), 
  // then `relation.customName` should override `nodeUser.firstName`
  // and `relation.customPhotoUrl` should override `nodeUser.photoUrl`.

  // NOTE: This logic assumes `relation` connects `viewer` -> `nodeUser`.
  // If the relation is `nodeUser` -> `viewer` (incoming), then I (viewer) did NOT create it, 
  // so I can't have custom aliases on it (unless we support custom alias on incoming, which schema allows, but UI flow usually is for people I added).

  if (!relation) return nodeUser;

  const isMyOutgoing = relation.fromUserId === viewerUserId;
  // const isMyIncoming = relation.toUserId === viewerUserId; 

  // We only show custom aliases if I created the relation (Outgoing)
  // because that's where I would have "Edit" rights. 
  // (Unless you want to allow renaming *anyone* in your tree? 
  //  For now, let's assume you can only rename people YOU added).

  if (isMyOutgoing) {
    return {
      ...nodeUser,
      firstName: relation.customName || nodeUser.firstName, // Overlay name
      photoUrl: relation.customPhotoUrl || nodeUser.photoUrl, // Overlay photo
      // We keep original fields if needed, or UI can just use firstName
      originalFirstName: nodeUser.firstName,
      originalPhotoUrl: nodeUser.photoUrl,
    };
  }

  return nodeUser;
}

export const listRelations = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const raw = await prisma.relation.findMany({
      where: {
        OR: [
          { fromUserId: userId },
          { toUserId: userId, status: 'PENDING' },
          { toUserId: userId, status: 'REJECTED' },
        ],
      },
      include: {
        fromUser: true,
        toUser: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const relations = raw.map(rel => {
      const view = resolveRelationForViewer(rel, userId);

      // Resolve the "other" user with potential custom aliases
      // If I am fromUser, then toUser might have custom alias.
      // If I am toUser, fromUser is standard.
      let finalToUser = rel.toUser;
      let finalFromUser = rel.fromUser;

      if (rel.fromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }
      // If I am toUser, I see fromUser as is (no custom alias processing for incoming usually, unless we support it)

      return {
        ...rel,
        toUser: finalToUser,
        fromUser: finalFromUser,
        relationType: { label: view.label, code: view.code }
      };
    });

    return res.json(relations);
  } catch (error) {
    console.error('list relations error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const rootUser = await prisma.user.findUnique({ where: { id: userId } });
    const raw = await prisma.relation.findMany({
      where: { fromUserId: userId },
      include: { fromUser: true, toUser: true },
      orderBy: { createdAt: 'asc' },
    });

    const relations = raw.map(rel => {
      const view = resolveRelationForViewer(rel, userId);

      let finalToUser = rel.toUser;
      if (rel.fromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }

      return {
        ...rel,
        toUser: finalToUser,
        relationType: { label: view.label, code: view.code }
      };
    });

    return res.json({ rootUser, relations });
  } catch (error) {
    console.error('tree error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRequests = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const raw = await prisma.relation.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      include: { fromUser: true, toUser: true },
      orderBy: { createdAt: 'asc' },
    });

    const pending = raw.map(rel => {
      const view = resolveRelationForViewer(rel, userId);
      // Requests are incoming, so I see the sender as they are.
      return {
        ...rel,
        relationType: { label: view.label, code: view.code }
      };
    });

    return res.json(pending);
  } catch (error) {
    console.error('requests error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Normalize phone local helper
 */
function normalizePhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export const createRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  // customName/PhotoUrl can be passed during creation too ideally, but for now we stick to edit
  const { phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl } = req.body;
  const fromUserId = sourceUserId || userId;

  if (!phone || !relationTypeCode || !firstName) {
    return res.status(400).json({ message: 'phone, firstName and relationTypeCode are required' });
  }

  const cleanPhone = normalizePhone(phone);
  if (!cleanPhone || cleanPhone.length < 10) {
    return res.status(400).json({ message: 'Invalid phone number' });
  }

  try {
    let relatedUser = await prisma.user.findUnique({ where: { phone: cleanPhone } });

    if (!relatedUser) {
      relatedUser = await prisma.user.create({
        data: {
          phone: cleanPhone,
          whatsapp: cleanPhone,
          firstName,
          lastName: lastName || null,
          gender: normalizeGender(gender),
          profileCompleted: false, // Explicitly mark as stub
        },
      });
    }

    if (relatedUser.id === fromUserId) {
      return res.status(400).json({ message: 'Cannot create relation with yourself' });
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
        // If re-adding, update custom fields if provided?
        // Let's assume we maintain them or update if passed
        ...(customName ? { customName } : {}),
        ...(customPhotoUrl ? { customPhotoUrl } : {}),
        createdBy: userId, // Claim ownership
      },
      create: {
        fromUserId,
        toUserId: relatedUser.id,
        relationTypeCode,
        relationLabel: getRelationLabel(relationTypeCode),
        status: 'PENDING',
        customName: customName || null,
        customPhotoUrl: customPhotoUrl || null,
        createdBy: userId, // Set ownership
      },
      include: { toUser: true, fromUser: true },
    });

    const authUser = await prisma.user.findUnique({ where: { id: userId } });
    await createNotification({
      userId: relatedUser.id,
      type: 'RELATION_REQUEST',
      title: 'New relation request',
      message: `${authUser?.firstName || 'Someone'} has added you as "${getRelationLabel(relationTypeCode)}".`,
      relationId: relation.id,
    });

    // Notify the sender as well so they have a record
    await createNotification({
      userId: userId,
      type: 'RELATION_REQUEST', // or a new type 'RELATION_SENT'? reusing REQUEST for now or generic message
      title: 'Request Sent',
      message: `You added ${firstName} as "${getRelationLabel(relationTypeCode)}". Waiting for approval.`,
      relationId: relation.id,
    });

    return res.status(201).json({
      ...relation,
      relationType: { code: relationTypeCode, label: getRelationLabel(relationTypeCode) }
    });
  } catch (error) {
    console.error('create relation error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const approveRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: { fromUser: true, toUser: true },
    });

    if (!relation || relation.toUserId !== userId) {
      return res.status(404).json({ message: 'Relation not found or not authorized' });
    }

    const updated = await prisma.relation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    // Reciprocal
    const reciprocalCode = getReciprocalCode(relation.relationTypeCode);
    await prisma.relation.upsert({
      where: {
        fromUserId_toUserId_relationTypeCode: {
          fromUserId: relation.toUserId,
          toUserId: relation.fromUserId,
          relationTypeCode: reciprocalCode,
        },
      },
      update: { status: 'CONFIRMED' },
      create: {
        fromUserId: relation.toUserId,
        toUserId: relation.fromUserId,
        relationTypeCode: reciprocalCode,
        relationLabel: getRelationLabel(reciprocalCode),
        status: 'CONFIRMED',
      },
    });

    await createNotification({
      userId: relation.fromUserId,
      type: 'RELATION_APPROVED',
      title: 'Relation approved',
      message: `${relation.toUser?.firstName || 'User'} approved your request.`,
      relationId: relation.id,
    });

    return res.json(updated);
  } catch (error) {
    console.error('approve relation error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const rejectRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: { toUser: true },
    });
    if (!relation || relation.toUserId !== userId) {
      return res.status(404).json({ message: 'Relation not found' });
    }

    const updated = await prisma.relation.update({
      where: { id },
      data: { status: 'REJECTED' },
    });

    await createNotification({
      userId: relation.fromUserId,
      type: 'RELATION_REJECTED',
      title: 'Relation rejected',
      message: `${relation.toUser?.firstName || 'User'} rejected your request.`,
      relationId: relation.id,
    });

    return res.json(updated);
  } catch (error) {
    console.error('reject relation error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  const { customName, customPhotoUrl, relationTypeCode } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({ where: { id } });

    // I can only edit relations WHERE I AM THE fromUserId (creator)
    if (!relation || relation.fromUserId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this relation' });
    }

    const updateData: any = {
      customName: customName !== undefined ? customName : relation.customName,
      customPhotoUrl: customPhotoUrl !== undefined ? customPhotoUrl : relation.customPhotoUrl
    };

    if (relationTypeCode) {
      updateData.relationTypeCode = relationTypeCode;
      updateData.relationLabel = getRelationLabel(relationTypeCode);

      // Also update reciprocal relation if it exists (for confirmed/pending)
      // Note: If status is PENDING, reciprocal might not exist or be relevant yet depending on flow, 
      // but usually we create them in pairs or at least logic expects consistency.
      // But actually, for PENDING requests, often only one direction exists until approval?
      // Check createRelation: it creates ONE direction. Reciprocal is created on APPROVE.
      // So if status is PENDING, we don't need to update reciprocal because it doesn't exist yet.
      // If status is CONFIRMED, we MUST update reciprocal.

      if (relation.status === 'CONFIRMED') {
        const reciprocalCode = getReciprocalCode(relationTypeCode);
        await prisma.relation.updateMany({
          where: {
            fromUserId: relation.toUserId,
            toUserId: relation.fromUserId,
            // We don't filter by code because the old code might be anything if we are changing it.
            // But safer to assume there is only one active relation between two people?
            // The unique constraint is [from, to, code].
            // If we change code, we might clash if another relation exists?
            // Assuming simple tree for now.
          },
          data: {
            relationTypeCode: reciprocalCode,
            relationLabel: getRelationLabel(reciprocalCode)
          }
        });
      }
    }

    const updated = await prisma.relation.update({
      where: { id },
      data: updateData
    });

    return res.json(updated);
  } catch (error) {
    console.error('update relation error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getFullTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const maxDepth = Number(req.query.depth) || 10;

  try {
    const rootUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!rootUser) return res.status(404).json({ message: 'User not found' });

    // BFS Queue: { id: string }
    const visited = new Map<string, number>();
    visited.set(userId, 0);

    let queue = [userId];
    const nodesByGen = new Map<number, any[]>();

    let hop = 0;
    while (queue.length > 0 && hop < maxDepth) {
      const nextQueue = new Set<string>();

      const rawRelations = await prisma.relation.findMany({
        where: {
          OR: [
            { fromUserId: { in: queue } },
            {
              toUserId: { in: queue },
              OR: [
                { status: 'CONFIRMED' },
                { status: 'PENDING', fromUser: { profileCompleted: false } }
              ]
            },
          ],
        },
        include: { fromUser: true, toUser: true },
      });

      for (const rel of rawRelations) {
        let neighborUser;
        let sourceUserId;
        let relationCodeToCheck;
        let isOutgoing = false;

        // Determine Source and Neighbor
        if (queue.includes(rel.fromUserId)) {
          // Outgoing: Source -> Neighbor
          sourceUserId = rel.fromUserId;
          neighborUser = rel.toUser;
          relationCodeToCheck = rel.relationTypeCode;
          isOutgoing = true;
        } else {
          // Incoming: Neighbor -> Source
          sourceUserId = rel.toUserId;
          neighborUser = rel.fromUser;
          relationCodeToCheck = rel.relationTypeCode;
        }

        if (rel.status === 'REJECTED') continue;

        // Visibility Logic (Strict Private Tree):
        // 1. Participant: Always see your own relations (e.g. Me -> Dad).
        // 2. Creator: See relations YOU created (e.g. You added Grandpa to Dad), tracking ownership via 'createdBy'.
        // 3. Others: HIDDEN. You cannot see relations created by others (e.g. Vivek's additions).
        //    This enforces that "Everyone creates their own tree".

        const isParticipant = (rel.fromUserId === userId || rel.toUserId === userId);
        // Cast to any to access createdBy until types update
        const createdBy = (rel as any).createdBy;
        const isCreator = createdBy === userId;

        // DEBUG LOGS
        // console.log(`[TreeDebug] Rel ${rel.id} (${rel.fromUser?.firstName}->${rel.toUser?.firstName}): Participant=${isParticipant}, Creator=${isCreator}, CreatedBy=${createdBy}, Me=${userId}`);

        if (!isParticipant && !isCreator) {
          // console.log(`[TreeDebug] HIDING relation ${rel.id}`);
          continue;
        }

        // Hide incoming pending requests directed AT ME from the graph (they belong in Notifications/Requests tab)
        if (rel.status === 'PENDING' && rel.toUserId === userId) {
          continue;
        }

        if (visited.has(neighborUser.id)) continue;

        // Calculate Generation - Use ABSOLUTE canonical levels from metadata
        // This ensures e.g. all Cousins are on Gen 0, all Uncles on Gen 1, etc.
        const meta = RELATION_METADATA[relationCodeToCheck];
        let neighborGen = 0; // Default to root level if unknown

        if (meta) {
          if (meta.vg === 'UP') neighborGen = meta.level;
          else if (meta.vg === 'DOWN') neighborGen = -meta.level;
          else neighborGen = 0;
        }

        visited.set(neighborUser.id, neighborGen);
        nextQueue.add(neighborUser.id);

        // Add to result
        if (!nodesByGen.has(neighborGen)) nodesByGen.set(neighborGen, []);

        const view = resolveRelationForViewer(rel, sourceUserId);

        // --- CUSTOM ALIAS LOGIC ---
        // If I (the viewer of the tree) am the one who created this link, I see my custom names.
        // Wait, `userId` is the viewer.
        // If `rel.fromUserId === userId`, then I created it.
        // So I see `rel.toUser` with MY custom aliases.

        let displayNeighbor = neighborUser;
        if (isOutgoing && rel.fromUserId === userId) {
          displayNeighbor = resolveNodeForViewer(neighborUser, rel, userId);
        }

        nodesByGen.get(neighborGen)!.push({
          user: displayNeighbor,
          relation: {
            id: rel.id,
            fromUserId: rel.fromUserId,
            toUserId: rel.toUserId,
            relationType: { code: view.code, label: view.label },
            direction: isOutgoing ? 'OUTGOING' : 'INCOMING',
            sourceUserId,
            status: rel.status,
            // Include custom fields in relation object for UI to edit if needed
            customName: rel.customName,
            customPhotoUrl: rel.customPhotoUrl
          },
        });
      }

      queue = Array.from(nextQueue);
      hop++;
    }

    const levels = [];
    for (const [gen, nodes] of nodesByGen.entries()) {
      levels.push({ level: gen, nodes });
    }
    levels.sort((a, b) => a.level - b.level);

    return res.json({ rootUser, levels });
  } catch (error) {
    console.error('getFullTree error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


export const deleteRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({ where: { id } });
    if (!relation) {
      return res.status(404).json({ message: 'Relation not found' });
    }

    // Allow deletion if user is a participant OR the creator
    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = (relation as any).createdBy === userId;

    if (!isParticipant && !isCreator) {
      return res.status(403).json({ message: 'Not authorized to delete this relation' });
    }

    await prisma.relation.delete({ where: { id } });
    return res.json({ message: 'Relation deleted' });
  } catch (error) {
    console.error('delete relation error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
