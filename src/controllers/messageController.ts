// src/controllers/messageController.ts
import { Response } from 'express';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { emitToUser, emitToRoom } from '../lib/socket';
import { PUSH_CHANNELS, sendToUsers } from '../services/pushService';
import { uploadMedia } from '../lib/mediaUpload';
import { badRequest, conflict, forbidden, notFound, unauthenticated } from '../lib/errors';
import { createLogger } from '../lib/logger';
import type { ValidatedFile } from '../lib/fileValidation';

const log = createLogger('messages');

/**
 * Public member fields, reused across the member-management endpoints below.
 *
 * `gender` is included because the mobile client picks the placeholder avatar
 * from it when a user has no `photoUrl` (see mobile/utils/avatarUtils.ts).
 * Without it every photo-less member fell back to the male illustration.
 */
const MEMBER_USER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  phone: true,
  gender: true,
} as const;

/**
 * Fields exposed for a message's author. Kept separate from
 * `MEMBER_USER_SELECT` (no `phone`) since a message payload has no reason to
 * carry contact details, but it does need `gender` for the same placeholder
 * avatar reason, plus `firstName`/`lastName` so group chats can label bubbles.
 */
const MESSAGE_SENDER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  gender: true,
} as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns confirmed relation user IDs for the calling user (phones must exist = real users) */
async function getEligibleContactIds(userId: string, category?: 'FAMILY' | 'FRIEND' | 'MATRIMONY'): Promise<string[]> {
  // Fetch all CONFIRMED rows where the user is either side
  // This covers both normal rows (fromUserId=user) and reciprocal rows (toUserId=user)
  const relations = await prisma.relation.findMany({
    where: {
      status: 'CONFIRMED',
      ...(category ? { category } : {}),
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
        { createdById: userId }, // covers cases where user created but fromUserId differs
      ],
    },
    // Narrowed from a bare `findMany` (every column of every matching relation)
    // to the only two fields this function actually reads.
    select: { fromUserId: true, toUserId: true },
  });

  const ids = new Set<string>();
  for (const rel of relations) {
    if (rel.fromUserId !== userId) ids.add(rel.fromUserId);
    if (rel.toUserId !== userId) ids.add(rel.toUserId);
    // If user is the creator but neither fromUser nor toUser, createdById link won't help
    // (already covered by fromUserId/toUserId above)
  }
  // Remove self just in case
  ids.delete(userId);

  const users = await prisma.user.findMany({
    where: {
      id: { in: Array.from(ids) },
      phone: { not: null },
    },
    select: { id: true },
  });

  return users.map((u) => u.id);
}

/**
 * Format a conversation for API response.
 *
 * PERF: this issues `prisma.message.findFirst` + `prisma.message.count` per
 * conversation, and is called via `Promise.all(raw.map(...))` from
 * `listConversations` — i.e. 2 queries x number of conversations (N+1). Left
 * as-is for this pass since fixing it properly means batching last-message and
 * unread-count lookups into one or two grouped queries across all conversation
 * IDs at once, which is a bigger restructure than the fixes requested here.
 * Should be revisited in a follow-up.
 */
async function formatConversation(conv: any, viewerId: string) {
  const lastMessage = await prisma.message.findFirst({
    where: { conversationId: conv.id, deletedAt: null },
    orderBy: { createdAt: 'desc' },
    include: { sender: { select: { id: true, firstName: true } } },
  });

  const myMembership = conv.members?.find((m: any) => m.userId === viewerId);
  const lastReadAt = myMembership?.lastReadAt;

  const unreadCount = await prisma.message.count({
    where: {
      conversationId: conv.id,
      senderId: { not: viewerId },
      deletedAt: null,
      ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
    },
  });

  return {
    ...conv,
    lastMessage: lastMessage
      ? {
          id: lastMessage.id,
          content: lastMessage.content,
          mediaType: lastMessage.mediaType,
          type: lastMessage.type,
          createdAt: lastMessage.createdAt,
          senderName: lastMessage.sender?.firstName,
          senderId: lastMessage.senderId,
        }
      : null,
    unreadCount,
  };
}

/** Maps the content-sniffed upload kind to the Prisma `MediaType` enum. */
function mediaTypeFromKind(kind: ValidatedFile['kind']): 'PHOTO' | 'VIDEO' | 'DOCUMENT' {
  if (kind === 'video') return 'VIDEO';
  if (kind === 'image') return 'PHOTO';
  return 'DOCUMENT';
}

// ─── Get contacts eligible for messaging ──────────────────────────────────────

export const getMessagableContacts = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const category = req.query.category as ('FAMILY' | 'FRIEND' | 'MATRIMONY') | undefined;
  if (!userId) throw unauthenticated();

  const eligibleIds = await getEligibleContactIds(userId, category);

  // Exclude blocked users
  const blocks = await prisma.userBlock.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  });
  const blockedSet = new Set(
    blocks.map((b) => (b.blockerId === userId ? b.blockedId : b.blockerId))
  );

  const users = await prisma.user.findMany({
    where: { id: { in: eligibleIds.filter((id) => !blockedSet.has(id)) } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      middleName: true,
      photoUrl: true,
      phone: true,
      gender: true,
    },
  });

  return res.json(users);
};

// ─── List Conversations ────────────────────────────────────────────────────────

export const listConversations = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const category = req.query.category as ('FAMILY' | 'FRIEND' | 'MATRIMONY') | undefined;
  if (!userId) throw unauthenticated();

  const raw = await prisma.conversation.findMany({
    where: {
      ...(category ? { category } : {}),
      members: { some: { userId } },
    },
    include: {
      members: {
        include: {
          user: { select: MEMBER_USER_SELECT },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const conversations = await Promise.all(raw.map((c) => formatConversation(c, userId)));
  return res.json(conversations);
};

// ─── Get or Create 1:1 Conversation ──────────────────────────────────────────

export const getOrCreateDirectConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId } = req.body;
  let category = req.body.category as 'FAMILY' | 'FRIEND' | 'MATRIMONY' | undefined;
  if (!userId) throw unauthenticated();

  if (!category) {
    const rel = await prisma.relation.findFirst({
      where: {
        status: 'CONFIRMED',
        OR: [
          { fromUserId: userId, toUserId: targetUserId },
          { fromUserId: targetUserId, toUserId: userId },
          { createdById: userId, toUserId: targetUserId },
          { createdById: targetUserId, toUserId: userId },
        ],
      },
      select: { category: true },
    });
    category = (rel?.category as any) || 'FAMILY';
  }

  const eligibleIds = await getEligibleContactIds(userId, category);
  if (!eligibleIds.includes(targetUserId)) {
    throw forbidden('You can only chat with approved contacts');
  }

  // Check if blocked
  const block = await prisma.userBlock.findFirst({
    where: { OR: [{ blockerId: userId, blockedId: targetUserId }, { blockerId: targetUserId, blockedId: userId }] },
  });
  if (block) throw forbidden('Cannot chat with this user');

  const existing = await prisma.conversation.findFirst({
    where: {
      isGroup: false,
      ...(category ? { category } : {}),
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: targetUserId } } },
      ],
    },
    include: {
      members: {
        include: {
          user: { select: MEMBER_USER_SELECT },
        },
      },
    },
  });

  if (existing) {
    const formatted = await formatConversation(existing, userId);
    return res.json(formatted);
  }

  const conv = await prisma.conversation.create({
    data: {
      isGroup: false,
      category: category || 'FAMILY',
      createdById: userId,
      members: {
        create: [
          { userId, role: 'ADMIN' },
          { userId: targetUserId, role: 'MEMBER' },
        ],
      },
    },
    include: {
      members: {
        include: {
          user: { select: MEMBER_USER_SELECT },
        },
      },
    },
  });

  const formatted = await formatConversation(conv, userId);
  return res.status(201).json(formatted);
};

// ─── Create Group Conversation ────────────────────────────────────────────────

export const createGroupConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const {
    name,
    memberIds,
    category,
    disappearingMessagesSeconds,
    allowMembersEditInfo,
    allowMembersSendMessages,
    allowMembersAddMembers,
    approveNewMembers,
  } = req.body as {
    name: string;
    memberIds: string[];
    category: 'FAMILY' | 'FRIEND' | 'MATRIMONY';
    disappearingMessagesSeconds?: number | null;
    allowMembersEditInfo?: boolean;
    allowMembersSendMessages?: boolean;
    allowMembersAddMembers?: boolean;
    approveNewMembers?: boolean;
  };
  if (!userId) throw unauthenticated();

  const eligibleIds = await getEligibleContactIds(userId, category);
  const validMembers = (memberIds || []).filter((id) => eligibleIds.includes(id));

  if (validMembers.length === 0) {
    throw badRequest('Please select at least one confirmed contact to create a group');
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  let photoUrl: string | null = null;
  if (file) {
    // Graceful degradation preserved: a failed group-photo upload should not
    // block group creation, so the group is created with photoUrl = null.
    try {
      const validatedMap = (req as any).validatedFileMap as WeakMap<Express.Multer.File, ValidatedFile> | undefined;
      photoUrl = await uploadMedia(file, { validated: validatedMap?.get(file) });
    } catch (e) {
      log.warn({ err: e, userId }, 'group photo upload failed');
    }
  }

  const allMemberIds = Array.from(new Set([userId, ...validMembers]));

  const conv = await prisma.conversation.create({
    data: {
      name: name.trim(),
      isGroup: true,
      category,
      createdById: userId,
      photoUrl,
      ...(disappearingMessagesSeconds !== undefined ? { disappearingMessagesSeconds } : {}),
      ...(allowMembersEditInfo !== undefined ? { allowMembersEditInfo } : {}),
      ...(allowMembersSendMessages !== undefined ? { allowMembersSendMessages } : {}),
      ...(allowMembersAddMembers !== undefined ? { allowMembersAddMembers } : {}),
      ...(approveNewMembers !== undefined ? { approveNewMembers } : {}),
      members: {
        create: allMemberIds.map((id) => ({
          userId: id,
          role: id === userId ? 'ADMIN' : 'MEMBER',
        })),
      },
    },
    include: {
      members: {
        include: {
          user: { select: MEMBER_USER_SELECT },
        },
      },
    },
  });

  allMemberIds.forEach((id) => {
    emitToUser(id, 'conversation:new', conv);
  });

  const formatted = await formatConversation(conv, userId);
  return res.status(201).json(formatted);
};

// ─── Get Messages ─────────────────────────────────────────────────────────────

/**
 * Lazily expires disappearing messages.
 *
 * There is no background job runner in this codebase (no cron, no queue
 * consumer for time-based work), so rather than add one just for this feature,
 * expiry piggybacks on `getMessages`: every read of a conversation first soft
 * deletes any of its messages older than the current TTL. This is the same
 * `deletedAt` + nulled-content mechanism `deleteMessage` already uses, so
 * expired messages render identically to a manually deleted one ("Message
 * deleted") instead of needing new UI. The timer applies to the whole
 * conversation's history, not just messages sent after the timer was enabled —
 * simpler to reason about than WhatsApp's "only future messages" behaviour, and
 * fine here since either interpretation is a reasonable reading of the toggle.
 */
async function expireDisappearingMessages(conversationId: string, disappearingMessagesSeconds: number | null): Promise<void> {
  if (!disappearingMessagesSeconds) return;
  const cutoff = new Date(Date.now() - disappearingMessagesSeconds * 1000);
  await prisma.message.updateMany({
    where: { conversationId, deletedAt: null, createdAt: { lt: cutoff } },
    data: { deletedAt: new Date(), content: null, mediaUrl: null },
  });
}

export const getMessages = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const cursor = req.query.cursor as string | undefined;
  // Already validated and capped (max 100) by getMessagesSchema at the route level.
  const limit = req.query.limit as number;
  if (!userId) throw unauthenticated();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: { select: { disappearingMessagesSeconds: true } } },
  });
  if (!membership) throw forbidden('Not a member of this conversation');

  await expireDisappearingMessages(conversationId, membership.conversation.disappearingMessagesSeconds);

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: { select: MESSAGE_SENDER_SELECT },
      reads: { select: { userId: true, readAt: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });

  const unreadMessageIds = messages
    .filter((m) => m.senderId !== userId && !m.reads.some((r) => r.userId === userId))
    .map((m) => m.id);

  if (unreadMessageIds.length > 0) {
    await prisma.messageRead.createMany({
      data: unreadMessageIds.map((messageId) => ({ messageId, userId })),
      skipDuplicates: true,
    });

    emitToRoom(conversationId, 'messages:read', { conversationId, userId, messageIds: unreadMessageIds });
  }

  return res.json(messages.reverse());
};

// ─── Send Message ─────────────────────────────────────────────────────────────

export const sendMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const { content } = req.body;
  if (!userId) throw unauthenticated();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    // `name` is needed for the push notification title on group chats.
    include: {
      conversation: { select: { isGroup: true, name: true, allowMembersSendMessages: true } },
    },
  });
  if (!membership) throw forbidden('Not a member of this conversation');

  // DMs have no "members can send" toggle; the restriction only applies to
  // groups, and only to non-admins (admins can always send, per the group
  // permissions screen).
  if (
    membership.conversation.isGroup &&
    membership.role !== 'ADMIN' &&
    !membership.conversation.allowMembersSendMessages
  ) {
    throw forbidden('Only admins can send messages in this group');
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  let mediaUrl: string | null = null;
  let mediaType: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | null = null;
  let msgType: 'TEXT' | 'MEDIA' = 'TEXT';

  if (file) {
    // Use the content-sniffed kind from uploadMiddleware's validation, not the
    // client-declared `file.mimetype`, to decide mediaType.
    const validatedMap = (req as any).validatedFileMap as WeakMap<Express.Multer.File, ValidatedFile> | undefined;
    const validated = validatedMap?.get(file);
    mediaUrl = await uploadMedia(file, { validated });
    mediaType = mediaTypeFromKind(validated!.kind);
    msgType = 'MEDIA';
  }

  if (!content?.trim() && !mediaUrl) {
    throw badRequest('Content or media is required');
  }

  const message = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      content: content?.trim() || null,
      mediaUrl,
      mediaType,
      type: msgType,
    },
    include: {
      sender: { select: MESSAGE_SENDER_SELECT },
      reads: { select: { userId: true, readAt: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  emitToRoom(conversationId, 'message:new', message);

  /**
   * Fan the message out to the other members over both transports.
   *
   * Socket: so clients not yet joined to this conversation room still update
   * their chat list immediately.
   *
   * Push: so the message reaches a phone whose app is closed — the case the
   * socket cannot cover at all.
   *
   * Deliberately not awaited. The message is already committed and returned to
   * the sender; making them wait on a recipient lookup plus an FCM round-trip
   * would put roughly 100-300ms of someone else's notification latency into every
   * "send" tap.
   */
  prisma.conversationMember
    .findMany({
      where: { conversationId, userId: { not: userId } },
      select: { userId: true },
    })
    .then(async (members) => {
      const recipientIds = members.map((m) => m.userId);

      for (const recipientId of recipientIds) {
        emitToUser(recipientId, 'message:new', message);
      }

      await notifyNewMessage({
        recipientIds,
        conversationId,
        isGroup: membership.conversation.isGroup,
        groupName: membership.conversation.name,
        senderName:
          [message.sender?.firstName, message.sender?.lastName].filter(Boolean).join(' ') ||
          'Someone',
        senderPhotoUrl: message.sender?.photoUrl ?? null,
        preview: messagePreview(message.content, mediaType),
      });
    })
    .catch((err) => {
      log.error({ err, conversationId }, 'failed to fan out message:new to members');
    });

  return res.status(201).json(message);
};

/**
 * One-line summary of a message for a notification body.
 *
 * Media messages have no text, so they get a labelled placeholder rather than an
 * empty notification. Text is truncated because Android collapses the body to a
 * single line anyway and FCM rejects payloads above 4KB — a pasted wall of text
 * would otherwise fail the whole send.
 */
function messagePreview(
  content: string | null,
  mediaType: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | null
): string {
  const text = content?.trim();
  if (text) return text.length > 180 ? `${text.slice(0, 177)}...` : text;

  switch (mediaType) {
    case 'PHOTO':
      return 'Sent a photo';
    case 'VIDEO':
      return 'Sent a video';
    case 'DOCUMENT':
      return 'Sent a document';
    default:
      return 'Sent a message';
  }
}

/**
 * Pushes a new chat message to every recipient's devices.
 *
 * No `Notification` row is written for chat, on purpose. Messages already have a
 * dedicated surface — the conversation list and its unread counts — and the
 * notifications screen is an activity feed for things that happen *to* the user
 * (relation requests, approvals, follows). Writing a row per message would double
 * the write volume on the hottest path in the app and bury approvals under chat
 * noise. The push is the notification; the chat list is the record.
 *
 * Every recipient is pushed regardless of socket state. "Has a live socket" is not
 * the same as "is looking at the screen" — Android keeps sockets alive briefly
 * after backgrounding — so filtering on it here would drop notifications for
 * exactly the backgrounded case this is meant to serve. The client suppresses the
 * banner when it is genuinely in the foreground.
 */
async function notifyNewMessage(args: {
  recipientIds: string[];
  conversationId: string;
  isGroup: boolean;
  groupName: string | null;
  senderName: string;
  senderPhotoUrl: string | null;
  preview: string;
}): Promise<void> {
  const {
    recipientIds,
    conversationId,
    isGroup,
    groupName,
    senderName,
    senderPhotoUrl,
    preview,
  } = args;

  if (recipientIds.length === 0) return;

  // In a group the chat name is the useful header and the sender belongs in the
  // body; in a DM the sender *is* the conversation.
  const title = isGroup ? groupName || 'Group chat' : senderName;
  const body = isGroup ? `${senderName}: ${preview}` : preview;

  await sendToUsers(recipientIds, {
    title,
    body,
    channel: PUSH_CHANNELS.messages,
    imageUrl: senderPhotoUrl ?? undefined,
    // One tray entry per conversation. Ten messages in a row replace each other
    // instead of stacking ten notifications.
    collapseKey: `chat:${conversationId}`,
    data: {
      type: 'MESSAGE',
      route: '/chat',
      conversationId,
      title,
    },
  }).catch((err) => {
    log.warn({ err, conversationId }, 'message push failed');
  });
}

// ─── Delete Message ───────────────────────────────────────────────────────────

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { messageId } = req.params;
  if (!userId) throw unauthenticated();

  const message = await prisma.message.findUnique({ where: { id: messageId } });
  if (!message) throw notFound('Message not found');
  if (message.senderId !== userId) throw forbidden('Not authorized');

  const deleted = await prisma.message.update({
    where: { id: messageId },
    data: { deletedAt: new Date(), content: null, mediaUrl: null },
  });

  emitToRoom(message.conversationId, 'message:deleted', { messageId, conversationId: message.conversationId });

  return res.json(deleted);
};

// ─── Update Group Info ────────────────────────────────────────────────────────

export const updateGroupInfo = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const { name } = req.body;
  if (!userId) throw unauthenticated();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { conversation: { select: { allowMembersEditInfo: true } } },
  });
  if (!membership) throw forbidden('Not a member of this conversation');
  if (membership.role !== 'ADMIN' && !membership.conversation.allowMembersEditInfo) {
    throw forbidden('Only admins can update group info');
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  let photoUrl: string | undefined;
  if (file) {
    // Graceful degradation preserved: a failed photo update should not block
    // updating the rest of the group info.
    try {
      const validatedMap = (req as any).validatedFileMap as WeakMap<Express.Multer.File, ValidatedFile> | undefined;
      photoUrl = await uploadMedia(file, { validated: validatedMap?.get(file) });
    } catch (e) {
      log.warn({ err: e, userId, conversationId }, 'group photo update failed');
    }
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(name ? { name: name.trim() } : {}),
      ...(photoUrl ? { photoUrl } : {}),
    },
    include: {
      members: {
        include: {
          user: { select: MEMBER_USER_SELECT },
        },
      },
    },
  });

  emitToRoom(conversationId, 'conversation:updated', updated);

  return res.json(updated);
};

// ─── Add Group Member ─────────────────────────────────────────────────────────

export const addGroupMember = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const { targetUserId } = req.body;
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.isGroup) throw notFound('Group not found');

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership) throw forbidden('Not a member of this conversation');
  if (membership.role !== 'ADMIN' && !conv.allowMembersAddMembers) {
    throw forbidden('Only admins can add members');
  }

  const eligibleIds = await getEligibleContactIds(userId, conv.category);
  if (!eligibleIds.includes(targetUserId)) {
    throw forbidden('User is not an eligible contact');
  }

  await prisma.conversationMember.upsert({
    where: { conversationId_userId: { conversationId, userId: targetUserId } },
    update: {},
    create: { conversationId, userId: targetUserId, role: 'MEMBER' },
  });

  const systemMessage = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      type: 'SYSTEM',
      content: 'A new member was added to the group.',
    },
  });

  emitToUser(targetUserId, 'conversation:new', conv);
  emitToRoom(conversationId, 'group:memberAdded', { conversationId, targetUserId });
  // So an open chat screen shows the system message live, the same as any other `sendMessage`.
  emitToRoom(conversationId, 'message:new', systemMessage);

  return res.json({ message: 'Member added' });
};

// ─── Get Conversation Info (for contact profile screen) ───────────────────────

export const getConversationInfo = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        include: {
          // Exposes phone/email/occupation/community for every member to any
          // other member. Confirmed this is intentional: conversation membership
          // itself is gated by `getEligibleContactIds` (see
          // getOrCreateDirectConversation / addGroupMember), so every member is
          // already an approved contact who is expected to see these fields to
          // call/message them. Left as-is.
          user: { select: { ...MEMBER_USER_SELECT, email: true, occupation: true, community: true } },
        },
      },
    },
  });
  if (!conv) throw notFound('Conversation not found');

  const isMember = conv.members.some((m) => m.userId === userId);
  if (!isMember) throw forbidden('Not a member');

  // Get all shared media
  const mediaMessages = await prisma.message.findMany({
    where: { conversationId, type: 'MEDIA', deletedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, mediaUrl: true, mediaType: true, createdAt: true, senderId: true },
    take: 100,
  });

  // Check if current user has blocked the other person
  const other = conv.members.find((m) => m.userId !== userId);
  let isBlocked = false;
  let isBlockedBy = false;
  if (other) {
    const blockA = await prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: userId, blockedId: other.userId } } });
    const blockB = await prisma.userBlock.findUnique({ where: { blockerId_blockedId: { blockerId: other.userId, blockedId: userId } } });
    isBlocked = !!blockA;
    isBlockedBy = !!blockB;
  }

  return res.json({ conversation: conv, mediaMessages, isBlocked, isBlockedBy });
};

// ─── Block / Unblock User ─────────────────────────────────────────────────────

export const blockUser = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId } = req.body;
  if (!userId) throw unauthenticated();
  // blockUserSchema validates shape (a UUID string) but has no access to the
  // authenticated user id — `validate()` only parses req.body/query/params, so
  // "not equal to self" cannot be expressed as a schema-level `.refine()` here.
  // Kept as a controller-level business check.
  if (targetUserId === userId) throw badRequest('Cannot block yourself');

  await prisma.userBlock.upsert({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
    create: { blockerId: userId, blockedId: targetUserId },
    update: {},
  });
  return res.json({ blocked: true, message: 'User blocked' });
};

export const unblockUser = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId } = req.body;
  if (!userId) throw unauthenticated();

  await prisma.userBlock.deleteMany({
    where: { blockerId: userId, blockedId: targetUserId },
  });
  return res.json({ blocked: false, message: 'User unblocked' });
};

export const getBlockedUsers = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const blocks = await prisma.userBlock.findMany({
    where: { blockerId: userId },
    include: { blocked: { select: MEMBER_USER_SELECT } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(blocks.map((b) => b.blocked));
};
// ─── Update Group Settings ("Member capabilities" screen) ────────────────────

/**
 * Admin-only, unconditionally — unlike `updateGroupInfo`/`addGroupMember`,
 * there is no "members can edit permissions" toggle. Letting a member flip the
 * switch that controls what members can do would let them grant themselves
 * (or anyone) more access, which defeats the point of the screen.
 */
export const updateGroupSettings = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const settings = req.body as {
    allowMembersEditInfo?: boolean;
    allowMembersSendMessages?: boolean;
    allowMembersAddMembers?: boolean;
    approveNewMembers?: boolean;
    disappearingMessagesSeconds?: number | null;
  };
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.isGroup) throw notFound('Group not found');

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership || membership.role !== 'ADMIN') {
    throw forbidden('Only admins can change group permissions');
  }

  const updated = await prisma.conversation.update({
    where: { id: conversationId },
    data: {
      ...(settings.allowMembersEditInfo !== undefined ? { allowMembersEditInfo: settings.allowMembersEditInfo } : {}),
      ...(settings.allowMembersSendMessages !== undefined ? { allowMembersSendMessages: settings.allowMembersSendMessages } : {}),
      ...(settings.allowMembersAddMembers !== undefined ? { allowMembersAddMembers: settings.allowMembersAddMembers } : {}),
      ...(settings.approveNewMembers !== undefined ? { approveNewMembers: settings.approveNewMembers } : {}),
      ...(settings.disappearingMessagesSeconds !== undefined
        ? { disappearingMessagesSeconds: settings.disappearingMessagesSeconds }
        : {}),
    },
    include: {
      members: {
        include: {
          user: { select: MEMBER_USER_SELECT },
        },
      },
    },
  });

  emitToRoom(conversationId, 'conversation:updated', updated);
  return res.json(updated);
};

// ─── Member Management (promote/demote, remove, leave) ───────────────────────

/**
 * Changes a member's role. Admin-only, and an admin cannot demote themselves if
 * they are the group's last admin — that would leave the group with no one able
 * to manage it (add/remove members, change settings), which is only recoverable
 * by direct DB intervention. They can still demote themselves once someone else
 * has been promoted.
 */
export const updateMemberRole = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId, memberUserId } = req.params;
  const { role } = req.body as { role: 'ADMIN' | 'MEMBER' };
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.isGroup) throw notFound('Group not found');

  const actorMembership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!actorMembership || actorMembership.role !== 'ADMIN') {
    throw forbidden('Only admins can change member roles');
  }

  const targetMembership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: memberUserId } },
  });
  if (!targetMembership) throw notFound('Member not found in this group');

  if (memberUserId === userId && role === 'MEMBER') {
    const adminCount = await prisma.conversationMember.count({
      where: { conversationId, role: 'ADMIN' },
    });
    if (adminCount <= 1) {
      throw badRequest('Promote another member to admin before stepping down');
    }
  }

  const updated = await prisma.conversationMember.update({
    where: { conversationId_userId: { conversationId, userId: memberUserId } },
    data: { role },
    include: { user: { select: MEMBER_USER_SELECT } },
  });

  const systemMessage = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      type: 'SYSTEM',
      content:
        role === 'ADMIN'
          ? `${updated.user.firstName || 'A member'} was made an admin.`
          : `${updated.user.firstName || 'A member'} is no longer an admin.`,
    },
  });

  emitToRoom(conversationId, 'group:memberRoleChanged', { conversationId, memberUserId, role });
  emitToRoom(conversationId, 'message:new', systemMessage);
  return res.json(updated);
};

/**
 * Removes a member from a group. Admin-only. An admin cannot remove themselves
 * this way (that is `leaveGroup`) so the two intents — "I'm managing the roster"
 * vs. "I'm leaving" — stay distinct and produce different system messages.
 */
export const removeGroupMember = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId, memberUserId } = req.params;
  if (!userId) throw unauthenticated();

  if (memberUserId === userId) {
    throw badRequest('Use the leave-group action to remove yourself');
  }

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.isGroup) throw notFound('Group not found');

  const actorMembership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!actorMembership || actorMembership.role !== 'ADMIN') {
    throw forbidden('Only admins can remove members');
  }

  const targetMembership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId: memberUserId } },
    include: { user: { select: MEMBER_USER_SELECT } },
  });
  if (!targetMembership) throw notFound('Member not found in this group');

  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId, userId: memberUserId } },
  });

  const systemMessage = await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      type: 'SYSTEM',
      content: `${targetMembership.user.firstName || 'A member'} was removed from the group.`,
    },
  });

  emitToRoom(conversationId, 'group:memberRemoved', { conversationId, memberUserId });
  emitToUser(memberUserId, 'group:removedFromGroup', { conversationId });
  emitToRoom(conversationId, 'message:new', systemMessage);
  return res.json({ message: 'Member removed' });
};

/**
 * Leaving is self-service and always allowed, with one guard: the sole
 * remaining admin cannot leave while other members remain, for the same reason
 * they cannot demote themselves — the group would be orphaned. A lone member
 * (no one else left) can always leave, which effectively abandons the group.
 */
export const leaveGroup = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.isGroup) throw notFound('Group not found');

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
    include: { user: { select: MEMBER_USER_SELECT } },
  });
  if (!membership) throw forbidden('Not a member of this conversation');

  const memberCount = await prisma.conversationMember.count({ where: { conversationId } });
  if (membership.role === 'ADMIN' && memberCount > 1) {
    const otherAdmins = await prisma.conversationMember.count({
      where: { conversationId, role: 'ADMIN', userId: { not: userId } },
    });
    if (otherAdmins === 0) {
      throw badRequest('Promote another member to admin before leaving the group');
    }
  }

  await prisma.conversationMember.delete({
    where: { conversationId_userId: { conversationId, userId } },
  });

  if (memberCount > 1) {
    const systemMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: 'SYSTEM',
        content: `${membership.user.firstName || 'A member'} left the group.`,
      },
    });
    emitToRoom(conversationId, 'message:new', systemMessage);
  }

  emitToRoom(conversationId, 'group:memberLeft', { conversationId, userId });
  return res.json({ message: 'Left group' });
};

// ─── Invite Links ──────────────────────────────────────────────────────────────

/** URL-safe, unambiguous-enough for a shared link; collision odds are astronomically low but retried once regardless. */
function generateInviteCode(): string {
  return crypto.randomBytes(9).toString('base64url');
}

/** Admin-only: generates (or returns the existing) invite code for a group. */
export const createInviteLink = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
  if (!conv || !conv.isGroup) throw notFound('Group not found');

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership || membership.role !== 'ADMIN') {
    throw forbidden('Only admins can create an invite link');
  }

  if (conv.inviteCode) {
    return res.json({ inviteCode: conv.inviteCode });
  }

  // A unique-constraint collision here is vanishingly unlikely (54 bits of
  // randomness) but retried once rather than surfacing a 500 for it.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const updated = await prisma.conversation.update({
        where: { id: conversationId },
        data: { inviteCode: generateInviteCode() },
      });
      return res.json({ inviteCode: updated.inviteCode });
    } catch (err: any) {
      if (err?.code !== 'P2002' || attempt === 1) throw err;
    }
  }
};

/** Admin-only: revokes the current invite link. Existing PENDING requests are left for the admin to resolve explicitly. */
export const revokeInviteLink = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  if (!userId) throw unauthenticated();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership || membership.role !== 'ADMIN') {
    throw forbidden('Only admins can revoke the invite link');
  }

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { inviteCode: null },
  });
  return res.json({ inviteCode: null });
};

/**
 * Public preview of what an invite code resolves to, so the mobile app can show
 * "You're joining <Group Name>" before the user commits. Deliberately minimal —
 * no member list, no message history — since the caller is not yet a member.
 */
export const previewInvite = async (req: AuthRequest, res: Response) => {
  const { code } = req.params;
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({
    where: { inviteCode: code },
    select: { id: true, name: true, photoUrl: true, isGroup: true, approveNewMembers: true, _count: { select: { members: true } } },
  });
  if (!conv || !conv.isGroup) throw notFound('This invite link is invalid or has expired');

  const alreadyMember = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: conv.id, userId } },
  });

  return res.json({
    conversationId: conv.id,
    name: conv.name,
    photoUrl: conv.photoUrl,
    memberCount: conv._count.members,
    requiresApproval: conv.approveNewMembers,
    alreadyMember: !!alreadyMember,
  });
};

/**
 * Joins via invite code. If the group requires approval, this creates/reopens a
 * PENDING `GroupJoinRequest` instead of an immediate membership — the caller
 * gets a distinct response shape (`{ status: 'PENDING' }`) so the mobile client
 * can show "Request sent" instead of dropping straight into the chat.
 */
export const joinViaInvite = async (req: AuthRequest, res: Response) => {
  const { code } = req.params;
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const conv = await prisma.conversation.findUnique({ where: { inviteCode: code } });
  if (!conv || !conv.isGroup) throw notFound('This invite link is invalid or has expired');

  const existing = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId: conv.id, userId } },
  });
  if (existing) {
    const formatted = await formatConversation(
      await prisma.conversation.findUnique({
        where: { id: conv.id },
        include: { members: { include: { user: { select: MEMBER_USER_SELECT } } } },
      }),
      userId
    );
    return res.json({ status: 'JOINED', conversation: formatted });
  }

  if (conv.approveNewMembers) {
    const request = await prisma.groupJoinRequest.upsert({
      where: { conversationId_userId: { conversationId: conv.id, userId } },
      // Re-requesting after a prior rejection resets to PENDING rather than
      // being permanently stuck — see the GroupJoinRequest model comment.
      update: { status: 'PENDING', resolvedAt: null, resolvedById: null },
      create: { conversationId: conv.id, userId },
    });

    const admins = await prisma.conversationMember.findMany({
      where: { conversationId: conv.id, role: 'ADMIN' },
      select: { userId: true },
    });
    admins.forEach((a) => emitToUser(a.userId, 'group:joinRequestCreated', { conversationId: conv.id, requestId: request.id, userId }));

    return res.status(202).json({ status: 'PENDING', requestId: request.id });
  }

  await prisma.conversationMember.create({
    data: { conversationId: conv.id, userId, role: 'MEMBER' },
  });

  const user = await prisma.user.findUnique({ where: { id: userId }, select: MEMBER_USER_SELECT });
  const systemMessage = await prisma.message.create({
    data: {
      conversationId: conv.id,
      senderId: userId,
      type: 'SYSTEM',
      content: `${user?.firstName || 'A new member'} joined via invite link.`,
    },
  });

  const updatedConv = await prisma.conversation.findUnique({
    where: { id: conv.id },
    include: { members: { include: { user: { select: MEMBER_USER_SELECT } } } },
  });
  const formatted = await formatConversation(updatedConv, userId);

  emitToUser(userId, 'conversation:new', updatedConv);
  emitToRoom(conv.id, 'group:memberAdded', { conversationId: conv.id, targetUserId: userId });
  emitToRoom(conv.id, 'message:new', systemMessage);

  return res.status(201).json({ status: 'JOINED', conversation: formatted });
};

// ─── Join Requests (approval queue) ───────────────────────────────────────────

/** Admin-only: lists pending join requests for a group, for the "Approve new members" review UI. */
export const listJoinRequests = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  if (!userId) throw unauthenticated();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership || membership.role !== 'ADMIN') {
    throw forbidden('Only admins can view join requests');
  }

  const requests = await prisma.groupJoinRequest.findMany({
    where: { conversationId, status: 'PENDING' },
    include: { user: { select: MEMBER_USER_SELECT } },
    orderBy: { createdAt: 'asc' },
  });
  return res.json(requests);
};

/** Admin-only: approves or rejects a single pending join request. */
export const resolveJoinRequest = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId, requestId } = req.params;
  const { approve } = req.body as { approve: boolean };
  if (!userId) throw unauthenticated();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership || membership.role !== 'ADMIN') {
    throw forbidden('Only admins can resolve join requests');
  }

  const request = await prisma.groupJoinRequest.findUnique({ where: { id: requestId } });
  if (!request || request.conversationId !== conversationId) throw notFound('Join request not found');
  if (request.status !== 'PENDING') throw conflict('This request was already resolved');

  await prisma.groupJoinRequest.update({
    where: { id: requestId },
    data: { status: approve ? 'APPROVED' : 'REJECTED', resolvedAt: new Date(), resolvedById: userId },
  });

  if (approve) {
    await prisma.conversationMember.upsert({
      where: { conversationId_userId: { conversationId, userId: request.userId } },
      update: {},
      create: { conversationId, userId: request.userId, role: 'MEMBER' },
    });

    const joined = await prisma.user.findUnique({ where: { id: request.userId }, select: MEMBER_USER_SELECT });
    const systemMessage = await prisma.message.create({
      data: {
        conversationId,
        senderId: userId,
        type: 'SYSTEM',
        content: `${joined?.firstName || 'A new member'} joined the group.`,
      },
    });

    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    emitToUser(request.userId, 'conversation:new', conv);
    emitToRoom(conversationId, 'group:memberAdded', { conversationId, targetUserId: request.userId });
    emitToRoom(conversationId, 'message:new', systemMessage);
  }

  emitToUser(request.userId, 'group:joinRequestResolved', { conversationId, approved: approve });
  return res.json({ message: approve ? 'Request approved' : 'Request rejected' });
};
