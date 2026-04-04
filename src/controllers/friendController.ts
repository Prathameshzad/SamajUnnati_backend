import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

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
      where: { id: userId }
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
            customPhotoUrl: rel.customPhotoUrl
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
      return {
        ...rel,
        relationType: { label: view.label, code: view.code }
      };
    }));

    return res.json(friends);
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
      }
    });
    // In a real app, emit via socket here too if available
  } catch (err) {
    console.error('Failed to create notification', err);
  }
}

export const createFriend = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const { phone, firstName, lastName, gender, relationTypeCode, sourceUserId, customName, customPhotoUrl, isAlive } = req.body;
  console.log('DEBUG: createFriend. sourceUserId:', sourceUserId, 'userId:', userId);

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
        title: 'New friend request',
        message: `${authUser?.firstName || 'Someone'} has added you as a "${displayLabel}".`,
        relationId: relation.id,
      });
    }

    return res.status(201).json({
      ...relation,
      relationType: { code: relationTypeCode, label: displayLabel }
    });
  } catch (error) {
    console.error('create friend error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
