// src/schemas/contentSchemas.ts
import { z } from 'zod';
import { boundedText, cursorQuery, limitQuery, uuidString, TEXT_LIMITS } from './common';

/**
 * A music hook start/duration value in seconds. Shared by createPostSchema and
 * createStorySchema so the two copies can't drift.
 *
 * The client (multipart form) always sends numbers as strings, so this must
 * accept both a real number and a numeric string. Previously the string
 * branch parsed with `parseInt` but never validated the result: a malformed
 * string (e.g. "NaN", "abc") parses to `NaN`, which satisfies "optional
 * number" as far as Zod is concerned and reaches Prisma as a literal NaN,
 * which Postgres rejects as an invalid Int — surfacing as an opaque 500
 * instead of a clean 400. `.refine` rejects non-finite results here so bad
 * input is caught at the validation layer.
 */
const musicSeconds = z
  .union([
    z.number(),
    z
      .string()
      .trim()
      .transform((v) => (v ? parseInt(v, 10) : undefined)),
  ])
  .refine((v) => v === undefined || Number.isFinite(v), { message: 'must be a valid number of seconds' })
  .optional();

/* ── Posts ───────────────────────────────────────────────────────────────── */

export const createPostSchema = {
  body: z
    .object({
      caption: boundedText(TEXT_LIMITS.postCaption),
      location: boundedText(TEXT_LIMITS.location),
      privacy: z.enum(['BOTH', 'FAMILY', 'FRIENDS']).optional(),
      taggedUserIds: z
        .union([
          z.array(z.string()),
          z.string().transform((v) => {
            try {
              const parsed = JSON.parse(v);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
            }
          }),
        ])
        .optional(),
      musicVideoId: z.string().trim().max(TEXT_LIMITS.shortField).optional(),
      musicTitle: z.string().trim().max(TEXT_LIMITS.shortField).optional(),
      musicArtist: z.string().trim().max(TEXT_LIMITS.shortField).optional(),
      musicThumbnail: z.string().trim().max(TEXT_LIMITS.url).optional(),
      musicHookStart: musicSeconds,
      musicHookDuration: musicSeconds,
    })
    .strip(),
};

/** Feed already capped at 30; now enforced by the schema rather than Math.min. */
export const feedQuerySchema = {
  query: z.object({ limit: limitQuery(10, 30), cursor: cursorQuery }).strip(),
};

export const userPostsSchema = {
  params: z.object({ userId: uuidString }).strip(),
  query: z.object({ limit: limitQuery(12, 30), cursor: cursorQuery }).strip(),
};

export const postIdSchema = {
  params: z.object({ id: uuidString }).strip(),
};

export const addCommentSchema = {
  params: z.object({ id: uuidString }).strip(),
  body: z
    .object({
      content: z
        .string()
        .trim()
        .min(1, 'comment cannot be empty')
        .max(TEXT_LIMITS.comment, `comment must be at most ${TEXT_LIMITS.comment} characters`),
      parentId: uuidString.optional(),
    })
    .strip(),
};

export const commentsQuerySchema = {
  params: z.object({ id: uuidString }).strip(),
  query: z.object({ limit: limitQuery(20, 50), cursor: cursorQuery }).strip(),
};

export const deleteCommentSchema = {
  params: z.object({ id: uuidString, commentId: uuidString }).strip(),
};

export const sharePostSchema = {
  params: z.object({ id: uuidString }).strip(),
  body: z.object({ sharedTo: boundedText(TEXT_LIMITS.shortField) }).strip(),
};

export const postLikesSchema = {
  params: z.object({ id: uuidString }).strip(),
  query: z.object({ limit: limitQuery(50, 100) }).strip(),
};

/* ── Stories ─────────────────────────────────────────────────────────────── */

export const createStorySchema = {
  body: z
    .object({
      caption: boundedText(TEXT_LIMITS.storyCaption),
      audience: z.enum(['BOTH', 'FAMILY', 'FRIENDS']).optional(),
      treePin: z.union([z.boolean(), z.string().transform((v) => v === 'true')]).optional(),
      mentions: z
        .union([
          z.array(z.string()),
          z.string().transform((v) => {
            try {
              const parsed = JSON.parse(v);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return v ? v.split(',').map((s) => s.trim()).filter(Boolean) : [];
            }
          }),
        ])
        .optional(),
      metadata: z
        .union([
          z.record(z.string(), z.any()),
          z.string().transform((v) => {
            try {
              return JSON.parse(v);
            } catch {
              return null;
            }
          }),
        ])
        .optional(),
      musicVideoId: z.string().trim().max(TEXT_LIMITS.shortField).optional(),
      musicTitle: z.string().trim().max(TEXT_LIMITS.shortField).optional(),
      musicArtist: z.string().trim().max(TEXT_LIMITS.shortField).optional(),
      musicThumbnail: z.string().trim().max(TEXT_LIMITS.url).optional(),
      musicHookStart: musicSeconds,
      musicHookDuration: musicSeconds,
    })
    .strip(),
};

export const storyIdSchema = {
  params: z.object({ id: uuidString }).strip(),
};

export const userStorySchema = {
  params: z.object({ userId: uuidString }).strip(),
};

