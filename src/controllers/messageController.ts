// src/controllers/messageController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../lib/socket';
import { uploadMedia } from '../lib/mediaUpload';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Returns confirmed relation user IDs for the calling user (phones must exist = real users) */
async function getEligibleContactIds(userId: string, category: 'FAMILY' | 'FRIEND'): Promise<string[]> {
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

/** Format a conversation for API response */
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

// ─── Get contacts eligible for messaging ──────────────────────────────────────

export const getMessagableContacts = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const category = (req.query.category as 'FAMILY' | 'FRIEND') || 'FAMILY';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
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
  } catch (err) {
    console.error('getMessagableContacts error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── List Conversations ────────────────────────────────────────────────────────

export const listConversations = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const category = (req.query.category as 'FAMILY' | 'FRIEND') || 'FAMILY';
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
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
  } catch (err) {
    console.error('listConversations error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Get or Create 1:1 Conversation ──────────────────────────────────────────

export const getOrCreateDirectConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId, category } = req.body as {
    targetUserId: string;
    category: 'FAMILY' | 'FRIEND';
  };
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const eligibleIds = await getEligibleContactIds(userId, category);
    if (!eligibleIds.includes(targetUserId)) {
      return res.status(403).json({ message: 'You can only chat with approved contacts' });
    }

    // Check if blocked
    const block = await prisma.userBlock.findFirst({
      where: { OR: [{ blockerId: userId, blockedId: targetUserId }, { blockerId: targetUserId, blockedId: userId }] },
    });
    if (block) return res.status(403).json({ message: 'Cannot chat with this user' });

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
  } catch (err) {
    console.error('getOrCreateDirectConversation error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Create Group Conversation ────────────────────────────────────────────────

export const createGroupConversation = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { name, memberIds, category } = req.body as {
    name: string;
    memberIds: string[];
    category: 'FAMILY' | 'FRIEND';
  };
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });
  if (!name?.trim()) return res.status(400).json({ message: 'Group name is required' });
  if (!memberIds || memberIds.length < 1) return res.status(400).json({ message: 'At least 1 member required' });

  try {
    const eligibleIds = await getEligibleContactIds(userId, category);
    const validMembers = memberIds.filter((id) => eligibleIds.includes(id));

    const file = (req as any).file;
    let photoUrl: string | null = null;
    if (file) {
      try {
        photoUrl = await uploadMedia(file);
      } catch (e) {
        console.error('Group photo upload failed', e);
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
  } catch (err) {
    console.error('createGroupConversation error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Get Messages ─────────────────────────────────────────────────────────────

export const getMessages = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const cursor = req.query.cursor as string | undefined;
  const limit = Number(req.query.limit) || 50;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) return res.status(403).json({ message: 'Not a member of this conversation' });

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
  } catch (err) {
    console.error('getMessages error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Send Message ─────────────────────────────────────────────────────────────

export const sendMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const { content } = req.body;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership) return res.status(403).json({ message: 'Not a member of this conversation' });

    const file = (req as any).file;
    let mediaUrl: string | null = null;
    let mediaType: 'PHOTO' | 'VIDEO' | 'DOCUMENT' | null = null;
    let msgType: 'TEXT' | 'MEDIA' = 'TEXT';

    if (file) {
      try {
        mediaUrl = await uploadMedia(file);
        if (file.mimetype.startsWith('video/')) mediaType = 'VIDEO';
        else if (file.mimetype.startsWith('image/')) mediaType = 'PHOTO';
        else mediaType = 'DOCUMENT';
        msgType = 'MEDIA';
      } catch (e) {
        console.error('Media upload failed', e);
        return res.status(500).json({ message: 'Media upload failed' });
      }
    }

    if (!content?.trim() && !mediaUrl) {
      return res.status(400).json({ message: 'Content or media is required' });
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
  } catch (err) {
    console.error('sendMessage error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Delete Message ───────────────────────────────────────────────────────────

export const deleteMessage = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { messageId } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const message = await prisma.message.findUnique({ where: { id: messageId } });
    if (!message) return res.status(404).json({ message: 'Message not found' });
    if (message.senderId !== userId) return res.status(403).json({ message: 'Not authorized' });

    const deleted = await prisma.message.update({
      where: { id: messageId },
      data: { deletedAt: new Date(), content: null, mediaUrl: null },
    });

    const io = getIO();
    io.to(message.conversationId).emit('message:deleted', { messageId, conversationId: message.conversationId });

    return res.json(deleted);
  } catch (err) {
    console.error('deleteMessage error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Update Group Info ────────────────────────────────────────────────────────

export const updateGroupInfo = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const { name } = req.body;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admins can update group info' });
    }

    const file = (req as any).file;
    let photoUrl: string | undefined;
    if (file) {
      try {
        photoUrl = await uploadMedia(file);
      } catch (e) {
        console.error('Group photo update failed', e);
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
  } catch (err) {
    console.error('updateGroupInfo error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Add Group Member ─────────────────────────────────────────────────────────

export const addGroupMember = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  const { targetUserId } = req.body;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const conv = await prisma.conversation.findUnique({ where: { id: conversationId } });
    if (!conv || !conv.isGroup) return res.status(404).json({ message: 'Group not found' });

    const membership = await prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      return res.status(403).json({ message: 'Only admins can add members' });
    }

    const eligibleIds = await getEligibleContactIds(userId, conv.category);
    if (!eligibleIds.includes(targetUserId)) {
      return res.status(403).json({ message: 'User is not an eligible contact' });
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
  } catch (err) {
    console.error('addGroupMember error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Get Conversation Info (for contact profile screen) ───────────────────────

export const getConversationInfo = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { conversationId } = req.params;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const conv = await prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        members: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true, email: true, occupation: true, community: true } },
          },
        },
      },
    });
    if (!conv) return res.status(404).json({ message: 'Conversation not found' });

    const isMember = conv.members.some((m) => m.userId === userId);
    if (!isMember) return res.status(403).json({ message: 'Not a member' });

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
  } catch (err) {
    console.error('getConversationInfo error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

// ─── Block / Unblock User ─────────────────────────────────────────────────────

export const blockUser = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId } = req.body;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });
  if (!targetUserId || targetUserId === userId) return res.status(400).json({ message: 'Invalid target' });

  try {
    await prisma.userBlock.upsert({
      where: { blockerId_blockedId: { blockerId: userId, blockedId: targetUserId } },
      create: { blockerId: userId, blockedId: targetUserId },
      update: {},
    });
    return res.json({ blocked: true, message: 'User blocked' });
  } catch (err) {
    console.error('blockUser error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const unblockUser = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  const { targetUserId } = req.body;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    await prisma.userBlock.deleteMany({
      where: { blockerId: userId, blockedId: targetUserId },
    });
    return res.json({ blocked: false, message: 'User unblocked' });
  } catch (err) {
    console.error('unblockUser error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getBlockedUsers = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const blocks = await prisma.userBlock.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(blocks.map((b) => b.blocked));
  } catch (err) {
    console.error('getBlockedUsers error', err);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
