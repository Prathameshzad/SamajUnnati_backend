// src/controllers/messageController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../lib/socket';
import { uploadMedia } from '../lib/mediaUpload';
import { badRequest, forbidden, notFound, unauthenticated } from '../lib/errors';
import { createLogger } from '../lib/logger';
import type { ValidatedFile } from '../lib/fileValidation';

const log = createLogger('messages');

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns confirmed relation user IDs for the calling user (phones must exist = real users) */
async function getEligibleContactIds(userId: string, category: 'FAMILY' | 'FRIEND' | 'MATRIMONY'): Promise<string[]> {
  // Fetch all CONFIRMED rows where the user is either side
  // This covers both normal rows (fromUserId=user) and reciprocal rows (toUserId=user)
  const relations = await prisma.relation.findMany({
    where: {
      status: 'CONFIRMED',
      category,
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
      profileCompleted: true,
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
  const category = (req.query.category as 'FAMILY' | 'FRIEND' | 'MATRIMONY') || 'FAMILY';
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
    },
  });

  return res.json(users);
};

// ─── List Conversations ────────────────────────────────────────────────────────

export const listConversations = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const category = (req.query.category as 'FAMILY' | 'FRIEND' | 'MATRIMONY') || 'FAMILY';
  if (!userId) throw unauthenticated();

  const raw = await prisma.conversation.findMany({
    where: {
      category,
      members: { some: { userId } },
    },
    include: {
      members: {
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true },
          },
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
  const { targetUserId, category } = req.body as {
    targetUserId: string;
    category: 'FAMILY' | 'FRIEND' | 'MATRIMONY';
  };
  if (!userId) throw unauthenticated();

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
      category,
      AND: [
        { members: { some: { userId } } },
        { members: { some: { userId: targetUserId } } },
      ],
    },
    include: {
      members: {
        include: {
          user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } },
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
      category,
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
          user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } },
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
  const { name, memberIds, category } = req.body as {
    name: string;
    memberIds: string[];
    category: 'FAMILY' | 'FRIEND' | 'MATRIMONY';
  };
  if (!userId) throw unauthenticated();

  const eligibleIds = await getEligibleContactIds(userId, category);
  const validMembers = memberIds.filter((id) => eligibleIds.includes(id));

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
          user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } },
        },
      },
    },
  });

  const io = getIO();
  allMemberIds.forEach((id) => {
    io.to(id).emit('conversation:new', conv);
  });

  const formatted = await formatConversation(conv, userId);
  return res.status(201).json(formatted);
};

// ─── Get Messages ─────────────────────────────────────────────────────────────

export const getMessages = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const cursor = req.query.cursor as string | undefined;
  // Already validated and capped (max 100) by getMessagesSchema at the route level.
  const limit = req.query.limit as number;
  if (!userId) throw unauthenticated();

  const membership = await prisma.conversationMember.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  });
  if (!membership) throw forbidden('Not a member of this conversation');

  const messages = await prisma.message.findMany({
    where: {
      conversationId,
      deletedAt: null,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
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

    const io = getIO();
    io.to(conversationId).emit('messages:read', { conversationId, userId, messageIds: unreadMessageIds });
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
  });
  if (!membership) throw forbidden('Not a member of this conversation');

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
      sender: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
      reads: { select: { userId: true, readAt: true } },
    },
  });

  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });

  const io = getIO();
  io.to(conversationId).emit('message:new', message);

  return res.status(201).json(message);
};

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

  const io = getIO();
  io.to(message.conversationId).emit('message:deleted', { messageId, conversationId: message.conversationId });

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
  });
  if (!membership || membership.role !== 'ADMIN') {
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
  });

  const io = getIO();
  io.to(conversationId).emit('conversation:updated', updated);

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
  if (!membership || membership.role !== 'ADMIN') {
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

  await prisma.message.create({
    data: {
      conversationId,
      senderId: userId,
      type: 'SYSTEM',
      content: 'A new member was added to the group.',
    },
  });

  const io = getIO();
  io.to(targetUserId).emit('conversation:new', conv);
  io.to(conversationId).emit('group:memberAdded', { conversationId, targetUserId });

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
          user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true, email: true, occupation: true, community: true } },
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
    include: { blocked: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(blocks.map((b) => b.blocked));
};
