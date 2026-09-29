// src/schemas/miscSchemas.ts
import { z } from 'zod';
import { langQuery, limitQuery, uuidString, relationCategoryField } from './common';

/* ── Notifications ───────────────────────────────────────────────────────── */

/**
 * `state` was read as `(req.query.state as string)?.toUpperCase()` and silently
 * ignored when it was not READ/UNREAD. That leniency is preserved via `.catch`,
 * so existing clients sending anything else keep the previous behaviour.
 *
 * `limit` is new: the handler had a hardcoded `take: 50`, which is now the
 * default and can be reduced by the client but not exceeded.
 */
export const listNotificationsSchema = {
  query: z
    .object({
      lang: langQuery('mr'),
      state: z
        .string()
        .trim()
        .toUpperCase()
        .pipe(z.enum(['READ', 'UNREAD']))
        .optional()
        .catch(undefined),
      limit: limitQuery(30, 30),
    })
    .strip(),
};

export const notificationIdSchema = {
  params: z.object({ id: uuidString }).strip(),
};

/* ── Push tokens ─────────────────────────────────────────────────────────── */

/**
 * An FCM registration token is an opaque string — roughly 160 characters for
 * Android today, but the format is explicitly not part of Google's contract and
 * has changed before. So this validates length and nothing else: a regex would
 * start rejecting real devices the next time the format moves. The ceiling exists
 * only to stop an unbounded string reaching a `@unique` TEXT column.
 */
const pushTokenField = z
  .string()
  .trim()
  .min(32, 'token looks too short to be a push token')
  .max(4096, 'token must be at most 4096 characters');

export const registerPushTokenSchema = {
  body: z
    .object({
      token: pushTokenField,
      platform: z.enum(['ANDROID', 'IOS', 'WEB']),
      /** Stable per-install ID, so a rotated token replaces its predecessor. */
      deviceId: z.string().trim().max(128).optional(),
      deviceName: z.string().trim().max(128).optional(),
      appVersion: z.string().trim().max(32).optional(),
    })
    .strip(),
};

export const unregisterPushTokenSchema = {
  body: z.object({ token: pushTokenField }).strip(),
};

/* ── Scores ──────────────────────────────────────────────────────────────── */

/** Already `Math.min(Number(limit) || 10, 50)`; same bounds, now validated. */
export const leaderboardSchema = {
  query: z.object({ limit: limitQuery(10, 50) }).strip(),
};

/* ── Relation types / config ─────────────────────────────────────────────── */

export const relationTypesSchema = {
  query: z
    .object({
      lang: langQuery('mr'),
      gender: z.enum(['MALE', 'FEMALE']).optional(),
      category: relationCategoryField.optional(),
    })
    .strip(),
};

export const relationConfigSchema = {
  query: z.object({ lang: langQuery('mr') }).strip(),
};

/* ── Follow ──────────────────────────────────────────────────────────────── */

export const followUserSchema = {
  params: z.object({ userId: uuidString }).strip(),
};

export const followRequestIdSchema = {
  params: z.object({ id: uuidString }).strip(),
};

export const followStatusSchema = {
  params: z.object({ userId: uuidString }).strip(),
};

/**
 * The handler accepts `isPrivate` and `bio`. `bio` was previously written with no
 * length limit, so a single request could store an arbitrarily large string.
 */
export const updatePrivacySchema = {
  body: z
    .object({
      isPrivate: z.boolean().optional(),
      bio: z.string().trim().max(500, 'bio must be at most 500 characters').optional(),
    })
    .strip()
    .refine((value) => value.isPrivate !== undefined || value.bio !== undefined, {
      message: 'provide isPrivate or bio',
    }),
};

export const followListSchema = {
  query: z.object({ limit: limitQuery(50, 100) }).strip(),
};
