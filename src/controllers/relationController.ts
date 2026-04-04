// src/controllers/relationController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../lib/socket';
import { RELATION_AXIS_CONFIG } from '../utils/relationMetadata';


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
    // Fetch all relation rows relevant to this user:
    // 1. Rows they created (their own outgoing adds, including now-REJECTED cross-node originals)
    // 2. CONFIRMED rows where they are toUserId (reciprocal rows created by the other party pointing back to them)
    // 3. REJECTED rows where they are toUserId (so they can see rejections)
    const raw = await prisma.relation.findMany({
      where: {
        OR: [
          { createdById: userId },
          { toUserId: userId, status: 'CONFIRMED' },
          { toUserId: userId, status: 'REJECTED', createdById: { not: userId } },
        ],
      },
      include: {
        fromUser: true,
        toUser: true,
        User_Relation_createdByIdToUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'desc' },
    });

    // De-duplicate: for a confirmed connection, both the original row AND a reciprocal row
    // may appear. Always prefer the CONFIRMED row. Key by sorted user-pair + relation type.
    const deduped = new Map<string, typeof raw[0]>();
    for (const rel of raw) {
      const pair = [rel.fromUserId, rel.toUserId].sort().join(':') + ':' + rel.relationTypeCode;
      const existing = deduped.get(pair);
      if (!existing || (rel.status === 'CONFIRMED' && existing.status !== 'CONFIRMED')) {
        deduped.set(pair, rel);
      }
    }

    const relations = await Promise.all(Array.from(deduped.values()).map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);
      const isMyRelation = rel.createdById === userId;

      // Use createdById as the primary 'from' identifier for the relations list.
      // This ensures that if Root added KAKA from VADIL's node, both Root and KAKA see Root as the logical sender.
      const logicalFromUser = (rel as any).User_Relation_createdByIdToUser || rel.fromUser;
      const logicalFromUserId = rel.createdById || rel.fromUserId;

      let finalToUser = rel.toUser;
      if (logicalFromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }

      return {
        ...rel,
        fromUserId: logicalFromUserId,
        fromUser: logicalFromUser,
        customName: isMyRelation ? rel.customName : null,
        customPhotoUrl: isMyRelation ? rel.customPhotoUrl : null,
        toUser: finalToUser,
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
          // Only fetch rows the viewer created themselves.
          // For cross-node adds (Root added KAKA from VADIL), the original row
          // (VADIL→KAKA) is now REJECTED at approval time, so it won't appear here.
          // Root sees their own outgoing row; KAKA sees their own reciprocal row.
          { createdById: userId },
          // Also include confirmed relations where viewer is fromUserId
          // (handles the normal self-add case & reciprocal rows)
          { fromUserId: userId, status: 'CONFIRMED' },
        ]
      },
      include: {
        fromUser: true,
        toUser: true,
        User_Relation_createdByIdToUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'asc' },
    });

    const relations = await Promise.all(raw.map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);
      const isMyRelation = rel.createdById === userId;
      let finalToUser = rel.toUser;
      if (rel.fromUserId === userId) {
        finalToUser = resolveNodeForViewer(rel.toUser, rel, userId);
      }
      // Use createdById as the primary 'from' identifier.
      const logicalFromUser = (rel as any).User_Relation_createdByIdToUser || rel.fromUser;
      const logicalFromUserId = rel.createdById || rel.fromUserId;

      return {
        ...rel,
        customName: isMyRelation ? rel.customName : null,
        customPhotoUrl: isMyRelation ? rel.customPhotoUrl : null,
        toUser: finalToUser,
        fromUserId: logicalFromUserId,
        fromUser: logicalFromUser,
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
        User_Relation_createdByIdToUser: true,
        relationType: { include: { translations: true } }
      },
      orderBy: { createdAt: 'asc' },
    });

    const pending = await Promise.all(raw.map(async rel => {
      const view = await resolveRelationForViewer(rel, userId, lang);

      // Normalize: show the actual root user who added the request as fromUserId/fromUser.
      const logicalFromUser = (rel as any).User_Relation_createdByIdToUser || rel.fromUser;
      const logicalFromUserId = rel.createdById || rel.fromUserId;

      return {
        ...rel,
        fromUserId: logicalFromUserId,
        fromUser: logicalFromUser,
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

  const { phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl, isAlive } = req.body;
  const fromUserId = sourceUserId || userId;

  const isPersonAlive = isAlive !== undefined ? (String(isAlive) === 'true') : true;

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

    if (!relType) {
      return res.status(400).json({ message: `Invalid relation type: ${relationTypeCode}` });
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
          gender: normalizeGender(gender || relType.targetGender),
          profileCompleted: false,
          isAlive: isPersonAlive,
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

    // Determine who the reciprocal should point back to.
    // - Normal case: A adds B from A's own node → fromUserId = createdById = A
    //   Reciprocal: B→A
    // - Cross-node case: Root adds KAKA from VADIL's node → fromUserId=VADIL, createdById=Root
    //   Reciprocal should be: KAKA→Root  (NOT KAKA→VADIL)
    const addedFromDifferentNode =
      relation.createdById && relation.createdById !== relation.fromUserId;

    const reciprocalToUserId: string = addedFromDifferentNode
      ? relation.createdById!   // Root user — the actual person who added KAKA
      : relation.fromUserId!;   // Normal case: the structural source = the adder

    const reciprocalCode = relation.relationType?.reciprocalCode || relation.relationTypeCode;
    const recType = await prisma.relationType.findUnique({ where: { code: reciprocalCode } });

    // Step 1: Create/confirm the correct reciprocal row (KAKA → Root User)
    await prisma.relation.upsert({
      where: {
        fromUserId_toUserId_relationTypeCode: {
          fromUserId: relation.toUserId!,   // KAKA (approver)
          toUserId: reciprocalToUserId!,    // Root user (the actual adder)
          relationTypeCode: reciprocalCode,
        },
      },
      update: { status: 'CONFIRMED' },
      create: {
        fromUserId: relation.toUserId!,
        toUserId: reciprocalToUserId!,
        relationTypeCode: reciprocalCode,
        category: recType?.category || 'FAMILY',
        status: 'CONFIRMED',
        createdById: userId,  // KAKA created this reciprocal row
      },
    });

    // Step 2: Mark the original relation as CONFIRMED (standard approval)
    const updated = await prisma.relation.update({
      where: { id },
      data: { status: 'CONFIRMED' },
    });

    // Step 3: If the original row used a structural node (VADIL) as fromUserId instead of
    // the actual root user, retire it by marking it REJECTED.
    // This prevents VADIL from appearing in KAKA's relation list.
    // The reciprocal row (KAKA → Root) is the canonical record for KAKA's perspective.
    if (addedFromDifferentNode) {
      await prisma.relation.update({
        where: { id },
        data: { status: 'REJECTED' },
      }).catch(() => { /* ignore */ });

      // Also clean up any other stale reciprocal rows pointing to the structural node
      await prisma.relation.updateMany({
        where: {
          fromUserId: relation.toUserId,
          toUserId: relation.fromUserId,  // VADIL — the wrong target
          relationTypeCode: reciprocalCode,
          status: { not: 'REJECTED' },
        },
        data: { status: 'REJECTED' },
      }).catch(() => { /* ignore */ });
    }

    // Notify the actual root user (createdById) — not the structural source node
    const approver = await prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true },
    });

    await createNotification({
      userId: relation.createdById ?? relation.fromUserId,
      type: 'RELATION_APPROVED',
      title: 'Relation approved',
      message: `${approver?.firstName || 'Your family member'} approved your request.`,
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
  const { customName, customPhotoUrl, relationTypeCode, phone } = req.body;

  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: { relationType: true, toUser: true }
    });

    if (!relation || relation.fromUserId !== userId) {
      return res.status(403).json({ message: 'Not authorized to edit this relation' });
    }

    const updateData: any = {
      customName: customName !== undefined ? customName : relation.customName,
      customPhotoUrl: customPhotoUrl !== undefined ? customPhotoUrl : relation.customPhotoUrl
    };

    // ── Phone number change ──────────────────────────────────────
    let phoneChanged = false; // Disabled by user request: Phone numbers cannot be edited.

    // ── Relation type change ─────────────────────────────────────
    // Disabled by user request: User can only update names now.

    const updated = await prisma.relation.update({
      where: { id },
      data: updateData
    });

    return res.json({ ...updated, phoneChanged });
  } catch (error) {
    console.error('update relation error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getFullTree = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const maxDepth = Number(req.query.depth) || 5;
  const category = req.query.category as string;

  try {
    const rootUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!rootUser) return res.status(404).json({ message: 'User not found' });


    const { SPOUSE_PAIRS, RELATION_LEVEL_MAP } = require('../utils/relationMetadata');

    const visited = new Map<string, { gen: number, code: string }>();
    visited.set(userId, { gen: 0, code: 'ROOT' });

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
            ...(hop === 0 ? [{ createdById: userId }] : [])
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

        const sourceId = queue.find(id => id === rel.fromUserId || id === rel.toUserId);
        if (!sourceId) continue;

        const neighborUser = (rel.fromUserId === sourceId) ? rel.toUser : rel.fromUser;
        const isOutgoing = (rel.fromUserId === sourceId);
        const targetId = neighborUser.id;
        const sourceData = visited.get(sourceId)!;
        const sourceGen = sourceData.gen;

        // Resolve the relation code from ROOT's perspective
        const rootView = await resolveRelationForViewer(rel, userId, lang);

        processedRelations.add(rel.id);

        // Determine the correct visual source for this edge.
        // For nodes with a canonical absolute level (RELATION_LEVEL_MAP), always
        // link them from ROOT — not from a sibling/cousin that happened to be the
        // BFS traversal source.  This prevents VADIL/AAI from appearing connected
        // to BHAU in the UI.
        const targetViewCode = (await resolveRelationForViewer(rel, sourceId, lang)).code;
        const hasAbsoluteLevel = targetViewCode in RELATION_LEVEL_MAP;
        const visualSourceId = (hasAbsoluteLevel && sourceId !== userId) ? userId : sourceId;

        // Only carry customName/customPhotoUrl when the viewer (Prathamesh) created
        // this relation row. For incoming relations (created by someone else, e.g. Vinesh
        // added Prathamesh as PUTANYA), the customName is what VINESH typed for PRATHAMESH
        // and must NOT be used as Vinesh's display name in Prathamesh's tree.
        const isViewerCreated = rel.createdById === userId;
        allRelations.push({
          id: rel.id,
          fromUserId: rel.fromUserId,
          toUserId: rel.toUserId,
          relationType: { code: rootView.code, label: rootView.label },
          direction: isOutgoing ? 'OUTGOING' : 'INCOMING',
          sourceUserId: visualSourceId,
          status: rel.status,
          customName: isViewerCreated ? rel.customName : null,
          customPhotoUrl: isViewerCreated ? rel.customPhotoUrl : null,
          createdById: rel.createdById
        });

        if (visited.has(targetId)) continue;

        // ─── LEVEL ASSIGNMENT ───────────────────────────────────────────
        // Step 1: Resolve the relation code from the TARGET's perspective viewing the edge
        const targetViewFromSource = await resolveRelationForViewer(rel, sourceId, lang);
        const targetRelCode = targetViewFromSource.code;

        let localNeighborGen: number;

        // Step 2: Check if this code has a canonical absolute level in RELATION_LEVEL_MAP
        if (targetRelCode in RELATION_LEVEL_MAP) {
          // Use absolute level directly — most accurate, independent of traversal path
          localNeighborGen = RELATION_LEVEL_MAP[targetRelCode];
        } else {
          // Fallback: derive level from source generation + axis direction delta
          const sourceRelCode = sourceData.code || 'ROOT';
          const isSpousePairEdge = SPOUSE_PAIRS.some(
            ([a, b]: [string, string]) =>
              (a === sourceRelCode && b === targetRelCode) ||
              (b === sourceRelCode && a === targetRelCode)
          );

          const axis = RELATION_AXIS_CONFIG[sourceRelCode];
          let axisDirection: 'UP' | 'DOWN' | 'SAME' | null = null;
          if (axis) {
            const allOpts = [
              ...(axis.xAxis?.left || []),
              ...(axis.xAxis?.right || []),
              ...(axis.yAxis?.top || []),
              ...(axis.yAxis?.bottom || []),
            ];
            const matched = allOpts.find(opt => opt.code === targetRelCode);
            axisDirection = matched?.direction || null;
          }

          const unitDelta = isSpousePairEdge
            ? 0
            : axisDirection === 'SAME'
              ? 0
              : axisDirection === 'UP'
                ? 1
                : axisDirection === 'DOWN'
                  ? -1
                  : 0; // default: treat as same level if unknown

          localNeighborGen = sourceGen + unitDelta;
        }
        // ────────────────────────────────────────────────────────────────

        visited.set(targetId, { gen: localNeighborGen, code: targetRelCode });
        nextQueue.add(targetId);

        if (!nodesByGen.has(localNeighborGen)) nodesByGen.set(localNeighborGen, []);

        let displayNeighbor = neighborUser;
        if (rel.createdById === userId && rel.toUserId === targetId) {
          displayNeighbor = resolveNodeForViewer(neighborUser, rel, userId);
        }

        nodesByGen.get(localNeighborGen)!.push({
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
    const relation = await prisma.relation.findUnique({
      where: { id },
      include: { fromUser: true }
    });
    if (!relation) return res.status(404).json({ message: 'Relation not found' });

    const isParticipant = relation.fromUserId === userId || relation.toUserId === userId;
    const isCreator = relation.createdById === userId;

    if (!isParticipant && !isCreator) {
      return res.status(403).json({ message: 'Not authorized to delete this relation' });
    }

    // If CONFIRMED – mark the reciprocal as REJECTED so the other person sees it
    if (relation.status === 'CONFIRMED') {
      await prisma.relation.updateMany({
        where: { fromUserId: relation.toUserId, toUserId: relation.fromUserId },
        data: { status: 'REJECTED' }
      });
      await createNotification({
        userId: relation.toUserId,
        type: 'RELATION_REJECTED',
        title: 'Connection removed',
        message: `${relation.fromUser?.firstName || 'Someone'} has removed you from their family tree.`,
      });
    }

    await prisma.relation.delete({ where: { id } });
    return res.json({ message: 'Relation deleted' });
  } catch (error) {
    console.error('delete relation error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

