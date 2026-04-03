import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';

export const listNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }

  const stateQuery = (req.query.state as string | undefined)?.toUpperCase();
  const state =
    stateQuery === 'READ' || stateQuery === 'UNREAD' ? stateQuery : undefined;

  try {
    const notificationsRaw = await prisma.notification.findMany({
      where: {
        userId,
        ...(state ? { state } : {}),
      },
      include: {
        relation: {
          include: {
            fromUser: true,
            toUser: true,
            User_Relation_createdByIdToUser: true,
            relationType: { include: { translations: true } }
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const notifications = notificationsRaw.map((n) => {
      if (n.relation) {
        const rt = n.relation.relationType;
        const trans = rt?.translations.find(t => t.languageCode === lang) || rt?.translations[0];
        const label = trans ? trans.label : n.relation.relationTypeCode;

        // Only apply customName to toUser when the notification recipient themselves
        // created the relation (i.e. THEY typed the custom name for the relative).
        // For incoming requests (someone else added the recipient), the customName was
        // typed BY the other person FOR the recipient — it must not affect display names.
        const recipientCreated = n.relation.createdById === userId;
        const toUserResolved = n.relation.toUser && recipientCreated
          ? {
              ...n.relation.toUser,
              firstName: n.relation.customName || n.relation.toUser.firstName,
              photoUrl: n.relation.customPhotoUrl || n.relation.toUser.photoUrl,
            }
          : n.relation.toUser;

        // When the relation was added from another tree node (fromUserId !== createdById),
        // expose the actual root user who sent the request (createdByUser) as fromUser.
        // This ensures B sees A's name in the notification, not C (the source node).
        const createdByUser = (n.relation as any).User_Relation_createdByIdToUser;
        const effectiveFromUser =
          n.relation.createdById &&
          n.relation.createdById !== n.relation.fromUserId &&
          createdByUser
            ? createdByUser
            : n.relation.fromUser;

        return {
          ...n,
          relation: {
            ...n.relation,
            fromUser: effectiveFromUser,
            toUser: toUserResolved,
            relationType: {
              code: n.relation.relationTypeCode,
              label: label,
            },
          },
        };
      }
      return n;
    });

    return res.json(notifications);
  } catch (error) {
    console.error('listNotifications error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const markNotificationRead = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }

  try {
    const notif = await prisma.notification.findUnique({
      where: { id },
    });

    if (!notif) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    if (notif.userId !== userId) {
      return res.status(403).json({ message: 'Not authorised' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: {
        state: 'READ',
        readAt: new Date(),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error('markNotificationRead error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const markAllNotificationsRead = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ message: 'Unauthenticated' });
  }

  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        state: 'UNREAD',
      },
      data: {
        state: 'READ',
        readAt: new Date(),
      },
    });

    return res.json({ updatedCount: result.count });
  } catch (error) {
    console.error('markAllNotificationsRead error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
