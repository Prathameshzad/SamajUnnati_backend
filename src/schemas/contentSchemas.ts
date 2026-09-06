// src/schemas/contentSchemas.ts
import { z } from 'zod';
import { boundedText, cursorQuery, limitQuery, uuidString, TEXT_LIMITS } from './common';

/* ── Posts ───────────────────────────────────────────────────────────────── */

export const createPostSchema = {
  body: z
    .object({
      caption: boundedText(TEXT_LIMITS.postCaption),
      location: boundedText(TEXT_LIMITS.location),
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
  body: z.object({ caption: boundedText(TEXT_LIMITS.storyCaption) }).strip(),
};

export const storyIdSchema = {
  params: z.object({ id: uuidString }).strip(),
};
