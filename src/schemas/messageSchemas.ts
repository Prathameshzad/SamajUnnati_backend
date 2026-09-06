// src/schemas/messageSchemas.ts
import { z } from 'zod';
import {
  boundedText,
  cursorQuery,
  limitQuery,
  relationCategoryField,
  uuidArray,
  uuidString,
  TEXT_LIMITS,
} from './common';

/** Controllers default to FAMILY when the parameter is absent; preserved. */
const categoryQuery = relationCategoryField.default('FAMILY');

export const contactsSchema = {
  query: z.object({ category: categoryQuery }).strip(),
};

export const listConversationsSchema = {
  query: z.object({ category: categoryQuery }).strip(),
};

export const directConversationSchema = {
  body: z.object({ targetUserId: uuidString, category: relationCategoryField }).strip(),
};

export const createGroupSchema = {
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(1, 'group name is required')
        .max(TEXT_LIMITS.groupName, `group name must be at most ${TEXT_LIMITS.groupName} characters`),
      /**
       * `memberIds` was an unbounded array read straight from the body, so a single
       * request could attempt to create a group with an arbitrary number of members
       * (each one a row insert). Capped at 256.
       *
       * Multipart form data may deliver this as a JSON string or as repeated
       * fields, so both shapes are accepted.
       */
      memberIds: z.preprocess((value) => {
        if (typeof value === 'string') {
          try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [value];
          } catch {
            return value.split(',').map((entry) => entry.trim()).filter(Boolean);
          }
        }
        return value;
      }, uuidArray(256)),
      category: relationCategoryField,
    })
    .strip(),
};

export const conversationIdSchema = {
  params: z.object({ conversationId: uuidString }).strip(),
};

/**
 * `getMessages` previously used `Number(req.query.limit) || 50` with no upper
 * bound, so `?limit=1000000` would attempt to load a million rows with their
 * sender and read receipts included. Capped at 100.
 */
export const getMessagesSchema = {
  params: z.object({ conversationId: uuidString }).strip(),
  query: z.object({ limit: limitQuery(50, 100), cursor: cursorQuery }).strip(),
};

export const sendMessageSchema = {
  params: z.object({ conversationId: uuidString }).strip(),
  body: z.object({ content: boundedText(TEXT_LIMITS.message) }).strip(),
};

export const messageIdSchema = {
  params: z.object({ messageId: uuidString }).strip(),
};

export const updateGroupSchema = {
  params: z.object({ conversationId: uuidString }).strip(),
  body: z.object({ name: boundedText(TEXT_LIMITS.groupName) }).strip(),
};

export const addGroupMemberSchema = {
  params: z.object({ conversationId: uuidString }).strip(),
  body: z.object({ targetUserId: uuidString }).strip(),
};

export const blockUserSchema = {
  body: z.object({ targetUserId: uuidString }).strip(),
};
