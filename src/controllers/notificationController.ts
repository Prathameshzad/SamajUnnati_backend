import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { forbidden, notFound, unauthenticated } from '../lib/errors';

/**
 * Field set for the participants embedded in a notification's relation.
 *
 * Was `include: { fromUser: true, toUser: true, User_Relation_createdByIdToUser: true }`,
 * which returned every User column — email, address, pincode, dateOfBirth,
 * bloodGroup — for up to 3 users per notification, up to 50 notifications per
 * request. Nothing beyond display fields is ever rendered here.
 */
const NOTIFICATION_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  gender: true,
  isAlive: true,
} as const;

export const listNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  // Already validated/capped by listNotificationsSchema (limit default 50, max 100).
  const stateQuery = (req.query.state as string | undefined)?.toUpperCase();
  const state =
    stateQuery === 'READ' || stateQuery === 'UNREAD' ? stateQuery : undefined;
  const limit = Number(req.query.limit) || 50;

  const notificationsRaw = await prisma.notification.findMany({
    where: {
      userId,
      ...(state ? { state } : {}),
    },
    include: {
      relation: {
        include: {
          fromUser: { select: NOTIFICATION_USER_SELECT },
          toUser: { select: NOTIFICATION_USER_SELECT },
          User_Relation_createdByIdToUser: { select: NOTIFICATION_USER_SELECT },
          // Single join per notification (not per-relation N+1); resolution
          // logic below is unchanged.
          relationType: { include: { translations: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
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
};

export const markNotificationRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { id } = req.params;

  if (!userId) throw unauthenticated();

  const notif = await prisma.notification.findUnique({
    where: { id },
  });

  if (!notif) {
    throw notFound('Notification not found');
  }

  if (notif.userId !== userId) {
    throw forbidden('Not authorised');
  }

  const updated = await prisma.notification.update({
    where: { id },
    data: {
      state: 'READ',
      readAt: new Date(),
    },
  });

  return res.json(updated);
};

export const markAllNotificationsRead = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

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
};
