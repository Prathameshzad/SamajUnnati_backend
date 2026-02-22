import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getRelationLabel } from '../utils/relationMetadata';

export const listNotifications = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  const userId = req.user?.id;
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
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const notifications = notificationsRaw.map((n) => {
      if (n.relation) {
        return {
          ...n,
          relation: {
            ...n.relation,
            relationType: {
              code: n.relation.relationTypeCode,
              label:
                n.relation.relationLabel ||
                getRelationLabel(n.relation.relationTypeCode),
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
