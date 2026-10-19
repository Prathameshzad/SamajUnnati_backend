import { Response } from 'express';
import type { PushPlatform } from '@prisma/client';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { forbidden, notFound, unauthenticated } from '../lib/errors';
import {
  isPushEnabled,
  registerToken,
  unregisterToken,
  sendToUser,
  PUSH_CHANNELS,
} from '../services/pushService';
import { syncPendingRelationsForUser } from '../services/relationReconnectService';

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
  area: true,
  community: true,
  occupation: true,
} as const;

export const listNotifications = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const lang = (req.query.lang as string) || 'mr';
  if (!userId) throw unauthenticated();

  // Ensure any placeholder relations added by other users for this phone or previous account are claimed and notified
  if (req.user?.id) {
    await syncPendingRelationsForUser(userId, req.user?.phone).catch((err) => {
      console.error('Failed to sync pending relations in listNotifications:', err);
    });
  }

  // Already validated/capped by listNotificationsSchema (limit default 50, max 100).
  const stateQuery = (req.query.state as string | undefined)?.toUpperCase();
  const state =
    stateQuery === 'READ' || stateQuery === 'UNREAD' ? stateQuery : undefined;
  const limit = Math.min(Number(req.query.limit) || 30, 30);

  const notificationsRaw = await prisma.notification.findMany({
    where: {
      userId,
      ...(state ? { state } : {}),
      NOT: {
        relation: {
          toUser: {
            isAlive: false,
          },
        },
      },
    },
    include: {
      relation: {
        include: {
          fromUser: { select: NOTIFICATION_USER_SELECT },
          toUser: { select: NOTIFICATION_USER_SELECT },
          User_Relation_createdByIdToUser: { select: NOTIFICATION_USER_SELECT },
          relationType: { include: { translations: true } },
        },
      },
      post: {
        select: {
          id: true,
          caption: true,
          location: true,
          media: {
            select: {
              id: true,
              url: true,
              type: true,
              order: true,
            },
            take: 1,
            orderBy: { order: 'asc' },
          },
          user: { select: NOTIFICATION_USER_SELECT },
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
      const toUserResolved = n.relation.toUser
        ? {
            ...n.relation.toUser,
            firstName: (recipientCreated && n.relation.customName) ? n.relation.customName : n.relation.toUser.firstName,
            photoUrl: (recipientCreated && n.relation.customPhotoUrl) ? n.relation.customPhotoUrl : n.relation.toUser.photoUrl,
          }
        : n.relation.toUser;

      // When the relation was added from another tree node (fromUserId !== createdById),
      // and this is an incoming notification for the recipient (!recipientCreated),
      // expose the actual root user who sent the request (createdByUser) as fromUser.
      // This ensures B sees A's name in the notification, not C (the source node).
      const createdByUser = (n.relation as any).User_Relation_createdByIdToUser;
      const effectiveFromUser =
        !recipientCreated &&
        n.relation.createdById &&
        n.relation.createdById !== n.relation.fromUserId &&
        createdByUser
          ? createdByUser
          : n.relation.fromUser;

      return {
        ...n,
        relation: {
          ...n.relation,
          createdByUser: createdByUser || null,
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

export const getNotificationSummary = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  // 1. Total unread count (excluding deceased notifications)
  const unreadCount = await prisma.notification.count({
    where: {
      userId,
      state: 'UNREAD',
      NOT: {
        relation: {
          toUser: {
            isAlive: false,
          },
        },
      },
    },
  });

  // 2. Pending Kinship / Relation Requests
  const pendingRelations = await prisma.relation.findMany({
    where: {
      toUserId: userId,
      status: 'PENDING',
      deletedAt: null,
    },
    include: {
      fromUser: { select: NOTIFICATION_USER_SELECT },
      User_Relation_createdByIdToUser: { select: NOTIFICATION_USER_SELECT },
      relationType: { include: { translations: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  const requestsCount = await prisma.relation.count({
    where: { toUserId: userId, status: 'PENDING', deletedAt: null },
  });

  const requestSenders = pendingRelations.map((r) => {
    const creator = (r as any).User_Relation_createdByIdToUser;
    const effective = (r.createdById && r.createdById !== r.fromUserId && creator) ? creator : r.fromUser;
    return [effective?.firstName, effective?.lastName].filter(Boolean).join(' ') || 'Relative';
  });

  // 3. Social Unread Count (likes, comments)
  const socialCount = await prisma.notification.count({
    where: {
      userId,
      state: 'UNREAD',
      type: { in: ['POST_LIKE', 'POST_COMMENT', 'POST_SHARE'] },
    },
  });

  // 4. Today's Milestones (Birthdays of user's connected family members)
  const confirmedRelations = await prisma.relation.findMany({
    where: {
      OR: [
        { fromUserId: userId, status: 'CONFIRMED' },
        { toUserId: userId, status: 'CONFIRMED' },
      ],
      deletedAt: null,
    },
    select: {
      fromUserId: true,
      toUserId: true,
      fromUser: { select: { id: true, firstName: true, lastName: true, photoUrl: true, dateOfBirth: true, area: true } },
      toUser: { select: { id: true, firstName: true, lastName: true, photoUrl: true, dateOfBirth: true, area: true } },
    },
    take: 100,
  });

  const today = new Date();
  const currentMonth = today.getMonth();
  const currentDate = today.getDate();

  const seenUsers = new Set<string>();
  const todayMilestones: {
    userId: string;
    name: string;
    photoUrl?: string | null;
    turningAge?: number;
    area?: string | null;
  }[] = [];

  for (const rel of confirmedRelations) {
    const relative = (rel.fromUserId === userId ? rel.toUser : rel.fromUser) as {
      id: string;
      firstName: string | null;
      lastName: string | null;
      photoUrl: string | null;
      dateOfBirth: Date | null;
      area: string | null;
    } | null;
    if (!relative || seenUsers.has(relative.id) || relative.id === userId) continue;
    seenUsers.add(relative.id);

    if (relative.dateOfBirth) {
      const dob = new Date(relative.dateOfBirth);
      if (dob.getMonth() === currentMonth && dob.getDate() === currentDate) {
        const age = today.getFullYear() - dob.getFullYear();
        todayMilestones.push({
          userId: relative.id,
          name: [relative.firstName, relative.lastName].filter(Boolean).join(' ') || 'Family Member',
          photoUrl: relative.photoUrl,
          turningAge: age > 0 ? age : undefined,
          area: relative.area,
        });
      }
    }
  }

  return res.json({
    unreadCount,
    requestsCount,
    requestSenders,
    socialCount,
    todayMilestones,
  });
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

/* ── Push token registration ─────────────────────────────────────────────── */

/**
 * POST /api/notifications/push-token
 *
 * Called by the client every time it obtains a device token: on login, and again
 * whenever FCM rotates it. Idempotent, so the client can call it on every app
 * start without checking whether the token has changed.
 *
 * `userId` comes from the verified JWT, never the body — otherwise one account
 * could register a token against another and redirect their notifications.
 *
 * Returns `pushEnabled: false` when the server has no Firebase credentials, which
 * lets the client stop asking for notification permission it cannot act on.
 */
export const registerPushToken = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { token, platform, deviceId, deviceName, appVersion } = req.body as {
    token: string;
    platform: PushPlatform;
    deviceId?: string;
    deviceName?: string;
    appVersion?: string;
  };

  const saved = await registerToken({
    userId,
    token,
    platform,
    deviceId,
    deviceName,
    appVersion,
  });

  // The token itself is never echoed back: it is a delivery credential, and the
  // client already has it.
  return res.status(201).json({
    registered: true,
    pushEnabled: isPushEnabled(),
    platform: saved.platform,
  });
};

/**
 * DELETE /api/notifications/push-token
 *
 * Called on logout. Without this, the next person to sign in on a shared handset
 * keeps receiving the previous user's notifications until FCM happens to rotate
 * the token.
 *
 * Returns 200 even when nothing matched — logout must not fail because the token
 * was already gone.
 */
export const unregisterPushToken = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { token } = req.body as { token: string };
  const removed = await unregisterToken(userId, token);

  return res.json({ unregistered: removed > 0 });
};

/**
 * POST /api/notifications/push-test
 *
 * Sends a push to the caller's own devices. Exists so push delivery can be
 * verified end to end without staging a real relation request, which is otherwise
 * a two-account, several-screen exercise on a physical device.
 *
 * Self-targeted only — the caller's ID comes from the JWT and no recipient
 * parameter is accepted, so this cannot be used to send arbitrary notifications
 * to other users.
 */
export const sendTestPush = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  if (!isPushEnabled()) {
    return res.status(503).json({
      sent: false,
      reason:
        'Push is not configured on this server. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY.',
    });
  }

  const activeTokens = await prisma.pushToken.count({
    where: { userId, disabledAt: null },
  });

  if (activeTokens === 0) {
    return res.status(404).json({
      sent: false,
      reason:
        'No active device registered for this account. Open the app, grant notification permission, then retry.',
    });
  }

  const result = await sendToUser(userId, {
    title: 'Samaj Unnati',
    body: 'Push notifications are working correctly.',
    channel: PUSH_CHANNELS.default,
    data: { type: 'TEST', route: '/notifications' },
  });

  return res.json({
    sent: result.sent > 0,
    devices: activeTokens,
    // Per-device breakdown: `disabled` being non-zero means some registered
    // tokens were dead and have just been pruned.
    delivered: result.sent,
    failed: result.failed,
    disabled: result.disabled,
  });
};
