// src/services/notificationService.ts
/**
 * One place where a notification is created, delivered live, and pushed.
 *
 * Before this existed, `createNotification` was copy-pasted into
 * `relationController` and `friendController`, with three further ad-hoc variants
 * inline in `followController`, `postController` and `matrimonyController`. Each
 * one persisted a row and emitted over Socket.IO, but they disagreed about which
 * events to emit and which relations to include, and adding push delivery would
 * have meant editing five call sites and keeping them in step forever.
 *
 * The delivery contract, in order:
 *   1. Persist the `Notification` row (the durable record the notifications screen reads).
 *   2. Emit over Socket.IO — instant, and only reaches a foregrounded app.
 *   3. Dispatch an FCM push — reaches the device whether or not the app is running.
 *
 * Steps 2 and 3 deliberately both fire, rather than the server guessing which one
 * the client needs. A socket can stay connected for a while after Android
 * backgrounds the process, so "has a socket" is not a reliable proxy for "the user
 * can see the screen", and gating the push on it would silently drop notifications
 * for backgrounded apps — the exact failure this feature exists to fix. The client
 * suppresses the duplicate instead, in `setNotificationHandler`, where the real
 * foreground state is known.
 *
 * Nothing here throws. See `pushService` for why.
 */
import type { NotificationType, Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { emitToUser } from '../lib/socket';
import { createLogger } from '../lib/logger';
import { PUSH_CHANNELS, sendToUser, type PushChannel } from './pushService';

const log = createLogger('notifications');

/**
 * Participant fields embedded in the socket payload.
 *
 * Mirrors `RELATION_USER_SELECT` in the relation controllers. Kept explicit
 * because the original code used `include: { fromUser: true, toUser: true }`,
 * which pushed every User column — email, address, dateOfBirth, bloodGroup —
 * over a websocket to the recipient.
 */
const NOTIFICATION_RELATION_INCLUDE = {
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
      fromUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          gender: true,
          isAlive: true,
        },
      },
      toUser: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          photoUrl: true,
          gender: true,
          isAlive: true,
        },
      },
    },
  },
} satisfies Prisma.NotificationInclude;

/**
 * Per-type delivery policy.
 *
 * `push: false` means the notification still appears in-app and in the
 * notifications screen, but never reaches the lock screen. Likes, comments and
 * shares are deliberately excluded: in a community app of this size they are the
 * highest-volume event by an order of magnitude, and pushing each one is the
 * fastest route to users disabling notifications wholesale. Flip a single flag
 * here to change that — no controller needs to know.
 *
 * `route` is the client screen a tap should open. Params are filled per
 * notification from the row's `relationId` / `postId`.
 */
const POLICY: Record<
  NotificationType,
  { push: boolean; channel: PushChannel; route: string }
> = {
  RELATION_REQUEST: { push: true, channel: PUSH_CHANNELS.relations, route: '/notifications' },
  RELATION_APPROVED: { push: true, channel: PUSH_CHANNELS.relations, route: '/notifications' },
  RELATION_REJECTED: { push: true, channel: PUSH_CHANNELS.relations, route: '/notifications' },
  FOLLOW_REQUEST: { push: true, channel: PUSH_CHANNELS.social, route: '/follow-requests' },
  FOLLOW_ACCEPTED: { push: true, channel: PUSH_CHANNELS.social, route: '/notifications' },
  MATRIMONY_PROFILE_APPROVAL: {
    push: true,
    channel: PUSH_CHANNELS.relations,
    route: '/notifications',
  },
  POST_LIKE: { push: false, channel: PUSH_CHANNELS.social, route: '/post-detail' },
  POST_COMMENT: { push: false, channel: PUSH_CHANNELS.social, route: '/post-detail' },
  POST_SHARE: { push: false, channel: PUSH_CHANNELS.social, route: '/post-detail' },
};

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relationId?: string | null;
  postId?: string | null;
  /** Avatar to show in the tray entry. */
  imageUrl?: string | null;
  /**
   * Forces push on or off for this one notification, overriding `POLICY`.
   * Intended for cases the type alone cannot express.
   */
  push?: boolean;
}

/**
 * Creates a notification and delivers it over both channels.
 *
 * Resolves to the created row, or `null` if persistence failed. Callers on the
 * request path should not await it — attach `.catch()` and return the HTTP
 * response immediately, so an FCM round-trip never shows up in user-facing
 * latency. It is internally safe to await.
 */
export async function createNotification(
  input: CreateNotificationInput
): Promise<{ id: string } | null> {
  const { userId, type, title, message, relationId, postId, imageUrl } = input;

  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        relationId: relationId ?? null,
        postId: postId ?? null,
      },
      include: NOTIFICATION_RELATION_INCLUDE,
    });

    // `emitToUser` swallows its own errors, so no guard is needed. Both event
    // names are emitted because shipped app builds listen for one or the other;
    // the client deduplicates on `id`.
    emitToUser(userId, 'notification', notification);
    emitToUser(userId, 'notification:new', notification);

    const policy = POLICY[type];
    const shouldPush = input.push ?? policy.push;

    if (shouldPush) {
      // Floating promise by design: the notification row is already committed and
      // the socket emit has already happened. Push is the slowest leg and the
      // least critical, so it settles on its own.
      void sendToUser(userId, {
        title,
        body: message,
        channel: policy.channel,
        imageUrl: imageUrl ?? undefined,
        data: {
          notificationId: notification.id,
          type,
          route: policy.route,
          relationId: relationId ?? undefined,
          postId: postId ?? undefined,
        },
        // One pending entry per notification type, so ten relation requests
        // arriving overnight collapse into one tray row rather than ten.
        collapseKey: `notif:${type}`,
      }).catch((err) => log.warn({ err, userId, type }, 'push dispatch failed'));
    }

    return notification;
  } catch (err) {
    // A notification must never fail the action that produced it.
    log.error({ err, userId, type }, 'failed to create notification');
    return null;
  }
}
