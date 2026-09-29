// src/services/pushService.ts
/**
 * Push delivery over Firebase Cloud Messaging (HTTP v1).
 *
 * This is the only path by which the app reaches a user whose app is closed.
 * Socket.IO (`lib/socket.ts`) covers the foreground case and stops the instant the
 * process is backgrounded, so the two are complementary rather than redundant:
 * `notificationService` emits over the socket *and* pushes, and the client
 * suppresses whichever arrives second.
 *
 * Design notes:
 *
 *  - **Never throws.** Every exported function resolves, logging failures instead.
 *    A notification is a side effect of an action that has already been committed
 *    (a relation approved, a message stored); letting FCM turn that into a 500
 *    would be strictly worse than losing the notification.
 *
 *  - **Disabled by default.** With no Firebase credentials in the environment
 *    `config.push.enabled` is false and every send short-circuits. Local
 *    development and CI therefore need no Firebase project at all.
 *
 *  - **Self-cleaning token table.** FCM reports permanently dead tokens
 *    (uninstalled app, revoked permission) per-recipient. Those rows are marked
 *    `disabledAt` so the fanout shrinks back down instead of retrying corpses
 *    forever.
 *
 *  - **Sends a `notification` block, not data-only.** A data-only message is
 *    handed to the app process, which Android will not start for a swiped-away
 *    app — the notification would silently never appear, which is the entire
 *    problem being solved here. The `notification` block makes FCM render it in
 *    the system tray without waking the app, and `data` rides along for deep
 *    linking when the user taps it.
 */
import { cert, getApp, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getMessaging, type MulticastMessage } from 'firebase-admin/messaging';
import type { PushPlatform } from '@prisma/client';
import prisma from '../lib/prisma';
import { config } from '../config/env';
import { createLogger } from '../lib/logger';

const log = createLogger('push');

/** Named so it cannot collide with a Firebase app initialised elsewhere. */
const FIREBASE_APP_NAME = 'samajunati-push';

/**
 * `sendEachForMulticast` accepts at most 500 tokens per call. A community group
 * push can exceed that, so fanouts are chunked.
 */
const FCM_MULTICAST_LIMIT = 500;

/**
 * Android notification channels, mirrored in the client
 * (`mobile/hooks/usePushNotifications.ts`). The IDs must match exactly on both
 * sides: a channel ID the client has not created is dropped by Android 8+ with no
 * visible error. Channels exist so a user can silence chat without also silencing
 * relation requests.
 */
export const PUSH_CHANNELS = {
  messages: 'messages',
  relations: 'relations',
  social: 'social',
  default: 'default',
} as const;

export type PushChannel = (typeof PUSH_CHANNELS)[keyof typeof PUSH_CHANNELS];

export interface PushPayload {
  title: string;
  body: string;
  /**
   * Deep-link target and context, read by the client's notification-tap handler.
   * FCM requires every value to be a string, so numbers and booleans must be
   * stringified by the caller — `buildData` below enforces that.
   */
  data?: Record<string, string | number | boolean | null | undefined>;
  channel?: PushChannel;
  /**
   * Replaces any undelivered notification carrying the same key rather than
   * stacking a new one. Used for chat so twenty rapid messages in one
   * conversation collapse into a single tray entry instead of twenty.
   */
  collapseKey?: string;
  /** iOS unread badge. Omit to leave the current badge untouched. */
  badge?: number;
  /** Small round image shown alongside the notification (sender's avatar). */
  imageUrl?: string;
}

let cachedApp: App | null = null;

/**
 * Lazily initialises the Firebase app.
 *
 * Deliberately not done at module load: importing this file must stay free of
 * side effects so that controllers can import it unconditionally, and so a
 * malformed private key surfaces on first send rather than crashing boot.
 */
function getFirebaseApp(): App | null {
  if (cachedApp) return cachedApp;
  if (!config.push.enabled) return null;

  try {
    // Survives module re-evaluation under ts-node-dev's respawn, which would
    // otherwise throw "app already exists".
    cachedApp = getApps().some((app) => app.name === FIREBASE_APP_NAME)
      ? getApp(FIREBASE_APP_NAME)
      : initializeApp(
          {
            credential: cert({
              projectId: config.push.projectId!,
              clientEmail: config.push.clientEmail!,
              privateKey: config.push.privateKey!,
            }),
          },
          FIREBASE_APP_NAME
        );

    log.info({ projectId: config.push.projectId }, 'firebase messaging initialised');
    return cachedApp;
  } catch (err) {
    log.error({ err }, 'firebase init failed; push disabled for this process');
    // Left null so the next call retries rather than caching a broken app.
    return null;
  }
}

/** True when credentials are present and Firebase accepted them. */
export const isPushEnabled = (): boolean => getFirebaseApp() !== null;

/** FCM rejects non-string data values outright, and drops undefined/null silently. */
function buildData(data: PushPayload['data']): Record<string, string> {
  const out: Record<string, string> = {};
  if (!data) return out;
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    out[key] = String(value);
  }
  return out;
}

function buildMessage(tokens: string[], payload: PushPayload): MulticastMessage {
  const channel = payload.channel ?? PUSH_CHANNELS.default;

  return {
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
      ...(payload.imageUrl ? { imageUrl: payload.imageUrl } : {}),
    },
    data: buildData(payload.data),
    android: {
      // 'high' is what allows a heads-up notification while the screen is on and
      // wakes the device when it is off. The default ('normal') can be deferred
      // indefinitely by Doze.
      priority: 'high',
      ttl: config.push.ttlSeconds * 1000,
      ...(payload.collapseKey ? { collapseKey: payload.collapseKey } : {}),
      notification: {
        channelId: channel,
        sound: 'default',
        defaultVibrateTimings: true,
        // Groups entries in the shade by conversation/type, so the tray shows
        // "3 new messages" rather than three separate rows.
        tag: payload.collapseKey,
      },
    },
    apns: {
      headers: {
        // 10 = deliver immediately. Required for alerts; APNs throttles 5.
        'apns-priority': '10',
        'apns-expiration': String(Math.floor(Date.now() / 1000) + config.push.ttlSeconds),
        ...(payload.collapseKey ? { 'apns-collapse-id': payload.collapseKey.slice(0, 64) } : {}),
      },
      payload: {
        aps: {
          sound: 'default',
          // Lets iOS group notifications the same way Android's `tag` does.
          threadId: payload.collapseKey,
          ...(payload.badge !== undefined ? { badge: payload.badge } : {}),
          // Required for iOS to hand the payload to the app on tap when the
          // notification arrives while backgrounded.
          contentAvailable: true,
          mutableContent: true,
        },
      },
    },
  };
}

/**
 * FCM error codes that mean "this token will never work again".
 *
 * Distinguished from transient failures (`messaging/internal-error`,
 * `messaging/server-unavailable`, quota errors) which must *not* disable a token
 * — doing so would permanently unsubscribe healthy devices during an FCM outage.
 */
const DEAD_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

async function disableTokens(tokens: string[]): Promise<void> {
  if (tokens.length === 0) return;
  try {
    const { count } = await prisma.pushToken.updateMany({
      where: { token: { in: tokens }, disabledAt: null },
      data: { disabledAt: new Date() },
    });
    if (count > 0) log.info({ count }, 'disabled dead push tokens');
  } catch (err) {
    log.warn({ err }, 'failed to disable dead push tokens');
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export interface PushResult {
  sent: number;
  failed: number;
  /** Tokens newly marked dead by this send. */
  disabled: number;
}

const EMPTY_RESULT: PushResult = { sent: 0, failed: 0, disabled: 0 };

/**
 * Sends to an explicit list of device tokens.
 *
 * Exported mainly for the admin test endpoint; normal callers should use
 * `sendToUser`/`sendToUsers` so token lookup and pruning stay in one place.
 */
export async function sendToTokens(tokens: string[], payload: PushPayload): Promise<PushResult> {
  const app = getFirebaseApp();
  if (!app || tokens.length === 0) return EMPTY_RESULT;

  const messaging = getMessaging(app);
  const result: PushResult = { sent: 0, failed: 0, disabled: 0 };
  const deadTokens: string[] = [];

  for (const batch of chunk(tokens, FCM_MULTICAST_LIMIT)) {
    try {
      // `sendEachForMulticast` reports per-token outcomes, unlike the removed
      // `sendMulticast`, which is what makes selective pruning possible.
      const response = await messaging.sendEachForMulticast(buildMessage(batch, payload));

      result.sent += response.successCount;
      result.failed += response.failureCount;

      response.responses.forEach((res, index) => {
        if (res.success) return;
        const code = res.error?.code;
        if (code && DEAD_TOKEN_CODES.has(code)) {
          deadTokens.push(batch[index]);
        } else {
          log.warn({ code, message: res.error?.message }, 'push delivery failed (transient)');
        }
      });
    } catch (err) {
      // A whole-batch failure: bad credentials, network, FCM down. Nothing here
      // is attributable to a specific token, so no pruning.
      result.failed += batch.length;
      log.error({ err, batchSize: batch.length }, 'push batch failed');
    }
  }

  if (deadTokens.length > 0) {
    await disableTokens(deadTokens);
    result.disabled = deadTokens.length;
  }

  return result;
}

/** Active tokens for a set of users, deduplicated. */
async function activeTokensFor(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const rows = await prisma.pushToken.findMany({
    where: { userId: { in: userIds }, disabledAt: null },
    select: { token: true },
  });
  return Array.from(new Set(rows.map((row) => row.token)));
}

/**
 * Sends to every active device belonging to one user.
 *
 * Callers should not await this on the request path — attach `.catch()` and let
 * it settle in the background, matching the convention already used by
 * `postController.notifyPostLike`. It is safe either way; awaiting only adds the
 * FCM round-trip to the caller's response time.
 */
export async function sendToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  if (!config.push.enabled) return EMPTY_RESULT;
  try {
    const tokens = await activeTokensFor([userId]);
    if (tokens.length === 0) return EMPTY_RESULT;
    return await sendToTokens(tokens, payload);
  } catch (err) {
    log.error({ err, userId }, 'sendToUser failed');
    return EMPTY_RESULT;
  }
}

/**
 * Fanout to many users with one FCM round-trip per 500 devices.
 *
 * Used for group chat, where looking up and sending per-member would mean N
 * queries and N HTTP calls for an N-member group.
 */
export async function sendToUsers(userIds: string[], payload: PushPayload): Promise<PushResult> {
  if (!config.push.enabled) return EMPTY_RESULT;
  const unique = Array.from(new Set(userIds));
  if (unique.length === 0) return EMPTY_RESULT;

  try {
    const tokens = await activeTokensFor(unique);
    if (tokens.length === 0) return EMPTY_RESULT;
    return await sendToTokens(tokens, payload);
  } catch (err) {
    log.error({ err, userCount: unique.length }, 'sendToUsers failed');
    return EMPTY_RESULT;
  }
}

/* ── Token registration ───────────────────────────────────────────────────── */

export interface RegisterTokenInput {
  userId: string;
  token: string;
  platform: PushPlatform;
  deviceId?: string;
  deviceName?: string;
  appVersion?: string;
}

/**
 * Registers or refreshes a device token.
 *
 * Two distinct cases have to be handled, and getting either wrong causes
 * cross-account notification leaks:
 *
 *  1. **Same token, different user.** Someone logs out and a second person logs
 *     in on the same handset. FCM returns the identical token, so the row is
 *     re-pointed at the new user. Inserting a second row would deliver the first
 *     user's private messages to the second user's lock screen.
 *
 *  2. **Same device, new token.** FCM rotates tokens on reinstall, restore, or
 *     after a long idle period. The old token for this `deviceId` is deleted so
 *     the table does not accumulate one dead row per rotation per device.
 */
export async function registerToken(input: RegisterTokenInput) {
  const { userId, token, platform, deviceId, deviceName, appVersion } = input;

  if (deviceId) {
    await prisma.pushToken
      .deleteMany({ where: { userId, deviceId, token: { not: token } } })
      .catch((err) => log.warn({ err, userId }, 'failed to clear rotated device token'));
  }

  return prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform, deviceId, deviceName, appVersion },
    update: {
      userId,
      platform,
      deviceId,
      deviceName,
      appVersion,
      lastSeenAt: new Date(),
      // Clears a previous "dead" mark: the user has plainly reinstalled or
      // re-granted permission, since the client just produced this token.
      disabledAt: null,
    },
  });
}

/**
 * Removes a token on logout.
 *
 * Scoped to the owning user so one account cannot unregister another's device by
 * guessing a token.
 */
export async function unregisterToken(userId: string, token: string): Promise<number> {
  const { count } = await prisma.pushToken.deleteMany({ where: { userId, token } });
  return count;
}
