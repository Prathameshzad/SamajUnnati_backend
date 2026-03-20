// src/controllers/relationController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../lib/socket';

type GenderValue = 'MALE' | 'FEMALE' | null;

function normalizeGender(gender?: string | null): GenderValue {
  if (!gender) return null;
  const g = String(gender).trim().toUpperCase();
  if (g === 'MALE') return 'MALE';
  if (g === 'FEMALE') return 'FEMALE';
  return null;
}

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
  // If we already have the relationType included in rel (from findMany include)
  if (rel.fromUserId === viewerUserId) {
    return {
      code: rel.relationTypeCode,
      label: resolveLabel(rel.relationType, lang)
    };
  }

  // If viewing the incoming side, we need to show the reciprocal
  if (rel.toUserId === viewerUserId) {
    const reciprocalCode = rel.relationType?.reciprocalCode || rel.relationTypeCode;
    // For label of reciprocal, we might need another DB fetch or if we have all types cached?
    // Let's assume we fetch the reciprocal type if needed, or if it's common we cache it.
    // For now, simpler: resolve label if we can find it in a pre-fetched list.
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

    try {
      getIO().to(userId).emit('notification', notification);
    } catch (e) {
      console.warn('Socket emit failed', e);
    }
  } catch (err) {
    console.error('Failed to create notification', err);
  }
}

function resolveNodeForViewer(nodeUser: any, relation: any, viewerUserId: string) {
  if (!relation) return nodeUser;
  const isMyOutgoing = relation.fromUserId === viewerUserId;

  if (isMyOutgoing) {
    return {
      ...nodeUser,
      firstName: relation.customName || nodeUser.firstName,
      photoUrl: relation.customPhotoUrl || nodeUser.photoUrl,
      originalFirstName: nodeUser.firstName,
      originalPhotoUrl: nodeUser.photoUrl,
    };
  }
  return nodeUser;
}

export const listRelations = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const raw = await prisma.relation.findMany({
      where: {
        OR: [
          { createdById: userId },
          {
            status: 'CONFIRMED',
            OR: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          },
          { toUserId: userId, status: 'REJECTED' },
        ],
      },
      include: {
        fromUser: true,
        toUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    const relations = await Promise.all(raw.map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);
      let finalToUser = rel.toUser;
      if (rel.fromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }

      return {
        ...rel,
        toUser: finalToUser,
        fromUser: rel.fromUser,
        relationType: { label: view.label, code: view.code }
      };
    }));

    return res.json(relations);
  } catch (error) {
    console.error('list relations error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const rootUser = await prisma.user.findUnique({ where: { id: userId } });
    const raw = await prisma.relation.findMany({
      where: {
        OR: [
          { createdById: userId },
          {
            status: 'CONFIRMED',
            OR: [
              { fromUserId: userId },
              { toUserId: userId }
            ]
          }
        ]
      },
      include: {
        fromUser: true,
        toUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'asc' },
    });

    const relations = await Promise.all(raw.map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);
      let finalToUser = rel.toUser;
      if (rel.fromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }

      return {
        ...rel,
        toUser: finalToUser,
        relationType: { label: view.label, code: view.code }
      };
    }));

    return res.json({ rootUser, relations });
  } catch (error) {
    console.error('tree error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRequests = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const raw = await prisma.relation.findMany({
      where: { toUserId: userId, status: 'PENDING' },
      include: {
        fromUser: true,
        toUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'asc' },
    });

    const pending = await Promise.all(raw.map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);
      return {
        ...rel,
        relationType: { label: view.label, code: view.code }
      };
    }));

    return res.json(pending);
  } catch (error) {
    console.error('requests error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

function normalizePhone(value: string): string {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

export const createRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const { phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl } = req.body;
  const fromUserId = sourceUserId || userId;

  let cleanPhone = null;
  if (phone && String(phone).trim()) {
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

    if (!relType) {
      return res.status(400).json({ message: 'Invalid relation type' });
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
          profileCompleted: false,
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
        ...(customName ? { customName } : {}),
        ...(customPhotoUrl ? { customPhotoUrl } : {}),
        createdById: userId,
      },
      create: {
        fromUserId,
        toUserId: relatedUser.id,
        relationTypeCode,
        category: relType.category,
        status: 'PENDING',
        customName: customName || null,
        customPhotoUrl: customPhotoUrl || null,
        createdById: userId,
      },
      include: { toUser: true, fromUser: true },
    });

    const displayLabel = resolveLabel(relType, lang);
    const authUser = await prisma.user.findUnique({ where: { id: userId } });

    if (relatedUser.phone) {
      await createNotification({
        userId: relatedUser.id,
        type: 'RELATION_REQUEST',
        title: 'New relation request',
        message: `${authUser?.firstName || 'Someone'} has added you as "${displayLabel}".`,
        relationId: relation.id,
      });
    }

    await createNotification({
      userId: userId,
      type: 'RELATION_REQUEST',
      title: 'Request Sent',
      message: `You added ${firstName} as "${displayLabel}". Waiting for approval.`,
      relationId: relation.id,
    });

    return res.status(201).json({
      ...relation,
      relationType: { code: relationTypeCode, label: displayLabel }
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
      include: {
        fromUser: true,
        toUser: true,
        relationType: true
      },
    });

    if (!relation || relation.toUserId !== userId) {
      return res.status(404).json({ message: 'Relation not found or not authorized' });
    }

    const updated = await prisma.relation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    // Handle Reciprocal
    const reciprocalCode = relation.relationType?.reciprocalCode || relation.relationTypeCode;
    const recType = await prisma.relationType.findUnique({ where: { code: reciprocalCode } });

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
        category: recType?.category || 'FAMILY',
        status: 'CONFIRMED',
        createdById: userId,
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
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: { relationType: true }
    });

    if (!relation || relation.fromUserId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this relation' });
    }

    const updateData: any = {
      customName: customName !== undefined ? customName : relation.customName,
      customPhotoUrl: customPhotoUrl !== undefined ? customPhotoUrl : relation.customPhotoUrl
    };

    if (relationTypeCode) {
      const newType = await prisma.relationType.findUnique({ where: { code: relationTypeCode } });
      if (newType) {
        updateData.relationTypeCode = relationTypeCode;
        updateData.category = newType.category;

        if (relation.status === 'CONFIRMED') {
          const reciprocalCode = newType.reciprocalCode || relationTypeCode;
          const recType = await prisma.relationType.findUnique({ where: { code: reciprocalCode } });

          await prisma.relation.updateMany({
            where: {
              fromUserId: relation.toUserId,
              toUserId: relation.fromUserId,
            },
            data: {
              relationTypeCode: reciprocalCode,
              category: recType?.category || 'FAMILY'
            }
          });
        }
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
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const maxDepth = Number(req.query.depth) || 10;
  const category = req.query.category as string;

  try {
    const rootUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!rootUser) return res.status(404).json({ message: 'User not found' });

    // 1. Pre-fetch all relation types and spouse mapping
    const allTypesRaw = await prisma.relationType.findMany({ include: { translations: true } });
    const typeMap = new Map<string, any>();
    allTypesRaw.forEach(rt => typeMap.set(rt.code, rt));
    
    // Using the same SPOUSE_PAIRS logic as metadata
    const { SPOUSE_PAIRS } = require('../utils/relationMetadata');
    const flatSpouseCodes = new Set<string>(SPOUSE_PAIRS.flat());

    const visited = new Map<string, number>();
    visited.set(userId, 0);

    const processedRelations = new Set<string>();
    const allRelations: any[] = [];
    
    let queue = [userId];
    const nodesByGen = new Map<number, any[]>();
    nodesByGen.set(0, [{
      user: rootUser,
      relation: { id: `root-${userId}`, status: 'ROOT', relationType: { code: 'ROOT', label: 'You' } }
    }]);

    let hop = 0;
    while (queue.length > 0 && hop < maxDepth) {
      const nextQueue = new Set<string>();

      const rawRelations: any[] = await prisma.relation.findMany({
        where: {
          OR: [
            { fromUserId: { in: queue } },
            { toUserId: { in: queue } },
            // Only include createdById in the first hop to find disconnected islands
            ...(hop === 0 ? [{ createdById: userId }] : [])
          ],
        },
        include: {
          fromUser: true,
          toUser: true,
          relationType: { include: { translations: true } }
        },
      });

      for (const rel of rawRelations) {
        if (processedRelations.has(rel.id)) continue;
        if (category && rel.category !== category) continue;
        if (rel.status === 'REJECTED') continue;

        const isCreator = rel.createdById === userId;
        const isParticipant = (rel.fromUserId === userId || rel.toUserId === userId);
        const isConfirmed = rel.status === 'CONFIRMED';
        if (!isCreator && !(isParticipant && isConfirmed)) continue;

        // Follow graph strictly from existing nodes (queue)
        const sourceId = queue.find(id => id === rel.fromUserId || id === rel.toUserId);
        if (!sourceId) continue;

        const neighborUser = (rel.fromUserId === sourceId) ? rel.toUser : rel.fromUser;
        const isOutgoing = (rel.fromUserId === sourceId);
        const targetId = neighborUser.id;
        const sourceGen = visited.get(sourceId) || 0;

        // Calculate ROOT-relative perspective
        const rootView = await resolveRelationForViewer(rel, userId, lang);
        
        processedRelations.add(rel.id);
        allRelations.push({
          id: rel.id,
          fromUserId: rel.fromUserId,
          toUserId: rel.toUserId,
          relationType: { code: rootView.code, label: rootView.label },
          direction: isOutgoing ? 'OUTGOING' : 'INCOMING',
          sourceUserId: sourceId,
          status: rel.status,
          customName: rel.customName,
          customPhotoUrl: rel.customPhotoUrl
        });

        // Discovery
        if (visited.has(targetId)) continue;
        
        // Use Root-relative generation
        const resolvedType = typeMap.get(rootView.code);
        const neighborGen = resolvedType?.treeLevel ?? 0;

        visited.set(targetId, neighborGen);
        nextQueue.add(targetId);

        if (!nodesByGen.has(neighborGen)) nodesByGen.set(neighborGen, []);
        
        // Name resolution: only apply custom names created by the VIEWER for THEIR OWN relations
        let displayNeighbor = neighborUser;
        if (rel.createdById === userId && rel.toUserId === targetId) {
           displayNeighbor = resolveNodeForViewer(neighborUser, rel, userId);
        }

        nodesByGen.get(neighborGen)!.push({
          user: displayNeighbor,
          relation: allRelations[allRelations.length - 1]
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

    return res.json({ rootUser, levels, allRelations });
  } catch (error) {
    console.error('getFullTree error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getRelationCounts = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const [pending, confirmed, rejected] = await Promise.all([
      prisma.relation.count({
        where: { createdById: userId, status: 'PENDING' },
      }),
      prisma.relation.count({
        where: { fromUserId: userId, status: 'CONFIRMED' },
      }),
      prisma.relation.count({
        where: { createdById: userId, status: 'REJECTED' },
      }),
    ]);
    return res.json({ pending, confirmed, rejected });
  } catch (error) {
    console.error('getRelationCounts error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const deleteRelation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({ where: { id } });
    if (!relation) return res.status(404).json({ message: 'Relation not found' });

    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = relation.createdById === userId;

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
