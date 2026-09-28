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

/**
 * The exact TTL values the "Disappearing messages" picker offers, mirrored on
 * the mobile side (`mobile/app/disappearing-messages.tsx`). Kept as a small,
 * explicit allowlist rather than an open `z.number()` range: an arbitrary TTL
 * (e.g. 3 seconds) has no UI to select it and would only ever come from a
 * hand-crafted request.
 */
export const DISAPPEARING_MESSAGE_OPTIONS = [24 * 60 * 60, 7 * 24 * 60 * 60, 90 * 24 * 60 * 60] as const;

/** Category is optional: if omitted, all conversations/contacts are returned. */
const categoryQuery = relationCategoryField.optional();

export const contactsSchema = {
  query: z.object({ category: categoryQuery }).strip(),
};

export const listConversationsSchema = {
  query: z.object({ category: categoryQuery }).strip(),
};

export const directConversationSchema = {
  body: z.object({ targetUserId: uuidString, category: relationCategoryField.optional() }).strip(),
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
      disappearingMessagesSeconds: z
        .preprocess((val) => {
          if (val === null || val === 'null') return null;
          if (val === undefined || val === '') return undefined;
          const n = Number(val);
          return isNaN(n) ? val : n;
        }, z.union([
          z.literal(null),
          z.literal(DISAPPEARING_MESSAGE_OPTIONS[0]),
          z.literal(DISAPPEARING_MESSAGE_OPTIONS[1]),
        z.literal(DISAPPEARING_MESSAGE_OPTIONS[2]),
      ]))
      .optional(),
      allowMembersEditInfo: z.preprocess((val) => (typeof val === 'string' ? val === 'true' : val), z.boolean()).optional(),
      allowMembersSendMessages: z.preprocess((val) => (typeof val === 'string' ? val === 'true' : val), z.boolean()).optional(),
      allowMembersAddMembers: z.preprocess((val) => (typeof val === 'string' ? val === 'true' : val), z.boolean()).optional(),
      approveNewMembers: z.preprocess((val) => (typeof val === 'string' ? val === 'true' : val), z.boolean()).optional(),
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


export const conversationMemberParamSchema = {
  params: z.object({ conversationId: uuidString, memberUserId: uuidString }).strip(),
};

/**
 * "Member capabilities" screen. All four flags are optional and independent —
 * a client toggling one switch should not have to resend the other three.
 * `disappearingMessagesSeconds: null` explicitly turns the timer off.
 */
export const updateGroupSettingsSchema = {
  params: z.object({ conversationId: uuidString }).strip(),
  body: z
    .object({
      allowMembersEditInfo: z.boolean().optional(),
      allowMembersSendMessages: z.boolean().optional(),
      allowMembersAddMembers: z.boolean().optional(),
      approveNewMembers: z.boolean().optional(),
      disappearingMessagesSeconds: z
        .union([
          z.literal(null),
          z.literal(DISAPPEARING_MESSAGE_OPTIONS[0]),
          z.literal(DISAPPEARING_MESSAGE_OPTIONS[1]),
          z.literal(DISAPPEARING_MESSAGE_OPTIONS[2]),
        ])
        .optional(),
    })
    .strip(),
};

export const updateMemberRoleSchema = {
  params: z.object({ conversationId: uuidString, memberUserId: uuidString }).strip(),
  body: z.object({ role: z.enum(['ADMIN', 'MEMBER']) }).strip(),
};

/** Invite codes are server-generated (see messageController.generateInviteCode); this only bounds the lookup. */
export const inviteCodeParamSchema = {
  params: z.object({ code: z.string().trim().min(6).max(64) }).strip(),
};

export const resolveJoinRequestSchema = {
  params: z.object({ conversationId: uuidString, requestId: uuidString }).strip(),
  body: z.object({ approve: z.boolean() }).strip(),
};
