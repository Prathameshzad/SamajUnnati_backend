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
      limit: limitQuery(50, 100),
    })
    .strip(),
};

export const notificationIdSchema = {
  params: z.object({ id: uuidString }).strip(),
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
