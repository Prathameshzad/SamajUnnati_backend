// src/controllers/storyController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadMedia } from '../lib/mediaUpload';
import { badRequest, notFound, unauthenticated } from '../lib/errors';
import type { ValidatedFile } from '../lib/fileValidation';
import { awardPoints } from '../services/scoreService';
import { emitToUser } from '../lib/socket';

// POST /api/stories
export const createStory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const file = (req as any).file as Express.Multer.File | undefined;
  const {
    caption,
    audience,
    treePin,
    mentions,
    metadata,
    musicVideoId,
    musicTitle,
    musicArtist,
    musicThumbnail,
    musicHookStart,
    musicHookDuration,
  } = req.body;

  if (!file) throw badRequest('Media file is required');

  // `uploadSingleMedia('media')` (see uploadMiddleware.ts) has already sniffed
  // the file's content and populated `validatedFileMap`. `file.mimetype` is
  // client-supplied and unverified, so it is never trusted for the stored
  // media type — the sniffed `kind` is used instead, and passed through to
  // `uploadMedia` so it does not re-sniff the buffer.
  const validatedFileMap = (req as any).validatedFileMap as WeakMap<Express.Multer.File, ValidatedFile> | undefined;
  const validated = validatedFileMap?.get(file);

  const mediaUrl = await uploadMedia(file, { validated, folder: 'stories' });
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  // See postController.createPost for why this guard exists: a NaN/Infinity
  // value must never reach Prisma as an Int column value.
  const toSafeSeconds = (value: unknown): number | null => {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };

  const story = await prisma.story.create({
    data: {
      userId,
      mediaUrl,
      mediaType: validated?.kind === 'video' ? 'VIDEO' : 'PHOTO',
      caption: caption || null,
      audience: audience || 'BOTH',
      treePin: treePin === true || treePin === 'true',
      mentions: Array.isArray(mentions) ? mentions : [],
      metadata: metadata ? (typeof metadata === 'string' ? JSON.parse(metadata) : metadata) : undefined,
      musicVideoId: musicVideoId || null,
      musicTitle: musicTitle || null,
      musicArtist: musicArtist || null,
      musicThumbnail: musicThumbnail || null,
      musicHookStart: toSafeSeconds(musicHookStart),
      musicHookDuration: toSafeSeconds(musicHookDuration),
      expiresAt,
    },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
      _count: { select: { views: true } },
    },
  });

  // Award XP for creating a story (+15 XP)
  awardPoints(userId, 'STORY_CREATE').catch(() => {});

  // Real-time story announcement to user and kinship/followers
  (async () => {
    try {
      emitToUser(userId, 'story:new', { storyId: story.id, userId });

      const followers = await prisma.follow.findMany({
        where: { followingId: userId, status: 'ACCEPTED' },
        select: { followerId: true },
      });
      for (const f of followers) {
        emitToUser(f.followerId, 'story:new', { storyId: story.id, userId });
      }

      const familyRelations = await prisma.relation.findMany({
        where: {
          status: 'CONFIRMED',
          OR: [{ fromUserId: userId }, { toUserId: userId }, { createdById: userId }],
        },
        select: { fromUserId: true, toUserId: true },
      });
      for (const r of familyRelations) {
        if (r.fromUserId && r.fromUserId !== userId) {
          emitToUser(r.fromUserId, 'story:new', { storyId: story.id, userId });
        }
        if (r.toUserId && r.toUserId !== userId) {
          emitToUser(r.toUserId, 'story:new', { storyId: story.id, userId });
        }
      }
    } catch (e) {
      // non-blocking best-effort
    }
  })().catch(() => {});

  return res.status(201).json(story);
};

// GET /api/stories/active-users - users who currently have active stories
export const getActiveStoryUserIds = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const now = new Date();

  // Get accepted following IDs
  const following = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);

  // Confirmed family relations
  const familyRelations = await prisma.relation.findMany({
    where: {
      status: 'CONFIRMED',
      OR: [{ fromUserId: userId }, { toUserId: userId }, { createdById: userId }],
    },
    select: { fromUserId: true, toUserId: true },
  });
  const familyIdSet = new Set<string>();
  for (const r of familyRelations) {
    if (r.fromUserId && r.fromUserId !== userId) familyIdSet.add(r.fromUserId);
    if (r.toUserId && r.toUserId !== userId) familyIdSet.add(r.toUserId);
  }
  const familyIds = Array.from(familyIdSet);

  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: now },
      deletedAt: null,
      OR: [
        { userId },
        { audience: { in: ['BOTH', 'both', 'ALL', 'all'] } },
        ...(familyIds.length > 0
          ? [{ userId: { in: familyIds }, audience: { in: ['FAMILY', 'family', 'BOTH', 'both'] } }]
          : []),
        ...(followingIds.length > 0
          ? [{ userId: { in: followingIds }, audience: { in: ['FRIEND', 'FRIENDS', 'friend', 'friends', 'BOTH', 'both'] } }]
          : []),
      ],
    },
    select: {
      userId: true,
      id: true,
      views: {
        where: { userId },
        select: { id: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  const userMap: Record<string, { userId: string; hasUnviewed: boolean }> = {};
  for (const s of stories) {
    if (!userMap[s.userId]) {
      userMap[s.userId] = { userId: s.userId, hasUnviewed: false };
    }
    const isViewed = s.views.length > 0;
    if (!isViewed) {
      userMap[s.userId].hasUnviewed = true;
    }
  }

  return res.json({
    userIds: Object.keys(userMap),
    activeUsers: Object.values(userMap),
  });
};

// GET /api/stories/user/:userId - active stories for a specific user
export const getUserStories = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const currentUserId = req.user?.id;
  if (!currentUserId) throw unauthenticated();

  const { userId } = req.params;
  const now = new Date();

  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, photoUrl: true, gender: true },
  });
  if (!targetUser) throw notFound('User not found');

  const stories = await prisma.story.findMany({
    where: {
      userId,
      expiresAt: { gt: now },
      deletedAt: null,
    },
    orderBy: { createdAt: 'asc' },
    include: {
      views: { where: { userId: currentUserId }, select: { id: true } },
      _count: { select: { views: true } },
    },
  });

  const isOwn = userId === currentUserId;
  const storyItems = stories.map((s: any) => ({
    id: s.id,
    mediaUrl: s.mediaUrl,
    mediaType: s.mediaType,
    caption: s.caption,
    audience: s.audience,
    treePin: s.treePin,
    metadata: s.metadata,
    expiresAt: s.expiresAt,
    createdAt: s.createdAt,
    isViewed: s.views.length > 0,
    viewCount: s._count?.views || 0,
    musicVideoId: s.musicVideoId || null,
    musicTitle: s.musicTitle || null,
    musicArtist: s.musicArtist || null,
    musicThumbnail: s.musicThumbnail || null,
    musicHookStart: s.musicHookStart ?? null,
    musicHookDuration: s.musicHookDuration ?? null,
  }));

  const hasUnviewed = isOwn ? false : storyItems.some((s) => !s.isViewed);

  return res.json({
    user: targetUser,
    stories: storyItems,
    hasUnviewed,
  });
};

// GET /api/stories/feed – stories from followed users, family, and community (grouped by user)
export const getStoryFeed = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const now = new Date();

  // Get accepted following IDs
  const following = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    select: { followingId: true },
  });
  const followingIds = following.map((f) => f.followingId);

  // Confirmed family relations
  const familyRelations = await prisma.relation.findMany({
    where: {
      status: 'CONFIRMED',
      OR: [
        { fromUserId: userId },
        { toUserId: userId },
        { createdById: userId },
      ],
    },
    select: { fromUserId: true, toUserId: true, createdById: true },
  });
  const familyIdSet = new Set<string>();
  for (const r of familyRelations) {
    if (r.fromUserId && r.fromUserId !== userId) familyIdSet.add(r.fromUserId);
    if (r.toUserId && r.toUserId !== userId) familyIdSet.add(r.toUserId);
  }
  const familyIds = Array.from(familyIdSet);

  const stories = await prisma.story.findMany({
    where: {
      expiresAt: { gt: now },
      deletedAt: null,
      OR: [
        { userId },
        { audience: { in: ['BOTH', 'both', 'ALL', 'all'] } },
        ...(familyIds.length > 0
          ? [{ userId: { in: familyIds }, audience: { in: ['FAMILY', 'family', 'BOTH', 'both'] } }]
          : []),
        ...(followingIds.length > 0
          ? [{ userId: { in: followingIds }, audience: { in: ['FRIEND', 'FRIENDS', 'friend', 'friends', 'BOTH', 'both'] } }]
          : []),
      ],
    },
    orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
    include: {
      user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, gender: true } },
      views: { where: { userId }, select: { id: true } },
      _count: { select: { views: true } },
    },
  });

  // Group by user
  const grouped: Record<string, any> = {};
  for (const story of stories) {
    const uid = story.userId;
    if (!grouped[uid]) {
      grouped[uid] = { user: story.user, stories: [], hasUnviewed: false };
    }
    const isViewed = story.views.length > 0;
    grouped[uid].stories.push({
      id: story.id,
      mediaUrl: story.mediaUrl,
      mediaType: story.mediaType,
      caption: story.caption,
      audience: story.audience,
      treePin: story.treePin,
      metadata: story.metadata,
      expiresAt: story.expiresAt,
      createdAt: story.createdAt,
      isViewed,
      viewCount: story._count?.views || 0,
      musicVideoId: (story as any).musicVideoId || null,
      musicTitle: (story as any).musicTitle || null,
      musicArtist: (story as any).musicArtist || null,
      musicThumbnail: (story as any).musicThumbnail || null,
      musicHookStart: (story as any).musicHookStart ?? null,
      musicHookDuration: (story as any).musicHookDuration ?? null,
    });
    if (!isViewed) grouped[uid].hasUnviewed = true;
  }

  // Own stories first, then unviewed, then viewed
  const groups = Object.values(grouped);
  groups.sort((a: any, b: any) => {
    if (a.user.id === userId) return -1;
    if (b.user.id === userId) return 1;
    if (a.hasUnviewed && !b.hasUnviewed) return -1;
    if (!a.hasUnviewed && b.hasUnviewed) return 1;
    return 0;
  });

  return res.json(groups);
};

// GET /api/stories/my
export const getMyStories = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const now = new Date();
  const stories = await prisma.story.findMany({
    where: { userId, deletedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
    include: {
      _count: { select: { views: true } },
      views: {
        include: { viewer: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
      },
    },
  });

  return res.json(stories);
};

// POST /api/stories/:id/view
export const viewStory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id: storyId } = req.params;

  const story = await prisma.story.findFirst({
    where: { id: storyId, deletedAt: null, expiresAt: { gt: new Date() } },
  });
  if (!story) throw notFound('Story not found or expired');

  await prisma.storyView.upsert({
    where: { storyId_userId: { storyId, userId } },
    create: { storyId, userId },
    update: { viewedAt: new Date() },
  });

  return res.json({ viewed: true });
};

// DELETE /api/stories/:id
export const deleteStory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id } = req.params;
  const story = await prisma.story.findFirst({ where: { id, userId, deletedAt: null } });
  if (!story) throw notFound('Story not found');

  await prisma.story.update({ where: { id }, data: { deletedAt: new Date() } });

  // Real-time story deletion announcement
  (async () => {
    try {
      emitToUser(userId, 'story:deleted', { storyId: id, userId });
      emitToUser(userId, 'story:new', { storyId: id, userId });

      const followers = await prisma.follow.findMany({
        where: { followingId: userId, status: 'ACCEPTED' },
        select: { followerId: true },
      });
      for (const f of followers) {
        emitToUser(f.followerId, 'story:deleted', { storyId: id, userId });
        emitToUser(f.followerId, 'story:new', { storyId: id, userId });
      }

      const familyRelations = await prisma.relation.findMany({
        where: {
          status: 'CONFIRMED',
          OR: [{ fromUserId: userId }, { toUserId: userId }, { createdById: userId }],
        },
        select: { fromUserId: true, toUserId: true },
      });
      for (const r of familyRelations) {
        if (r.fromUserId && r.fromUserId !== userId) {
          emitToUser(r.fromUserId, 'story:deleted', { storyId: id, userId });
          emitToUser(r.fromUserId, 'story:new', { storyId: id, userId });
        }
        if (r.toUserId && r.toUserId !== userId) {
          emitToUser(r.toUserId, 'story:deleted', { storyId: id, userId });
          emitToUser(r.toUserId, 'story:new', { storyId: id, userId });
        }
      }
    } catch (e) {
      // non-blocking best-effort
    }
  })().catch(() => {});

  return res.json({ message: 'Story deleted' });
};

// GET /api/stories/:id/viewers
export const getStoryViewers = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id: storyId } = req.params;
  const story = await prisma.story.findFirst({
    where: { id: storyId, userId, deletedAt: null },
    include: {
      views: {
        orderBy: { viewedAt: 'desc' },
        include: {
          viewer: {
            select: { id: true, firstName: true, lastName: true, photoUrl: true, gender: true },
          },
        },
      },
    },
  });

  if (!story) throw notFound('Story not found or unauthorized');

  return res.json({
    totalViews: story.views.length,
    viewers: story.views.map((v) => ({
      ...v.viewer,
      viewedAt: v.viewedAt,
    })),
  });
};

// GET /api/stories/:id
export const getStoryById = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  const currentUserId = req.user?.id;
  if (!currentUserId) throw unauthenticated();

  const { id } = req.params;
  const story = await prisma.story.findFirst({
    where: { id, deletedAt: null, expiresAt: { gt: new Date() } },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, gender: true } },
      views: { where: { userId: currentUserId }, select: { id: true } },
      _count: { select: { views: true } },
    },
  });

  if (!story) throw notFound('Story not found or expired');

  return res.json({
    id: story.id,
    userId: story.userId,
    user: story.user,
    mediaUrl: story.mediaUrl,
    mediaType: story.mediaType,
    caption: story.caption,
    audience: story.audience,
    treePin: story.treePin,
    metadata: story.metadata,
    expiresAt: story.expiresAt,
    createdAt: story.createdAt,
    isViewed: story.views.length > 0,
    viewCount: story._count?.views || 0,
    musicVideoId: (story as any).musicVideoId || null,
    musicTitle: (story as any).musicTitle || null,
    musicArtist: (story as any).musicArtist || null,
    musicThumbnail: (story as any).musicThumbnail || null,
    musicHookStart: (story as any).musicHookStart ?? null,
    musicHookDuration: (story as any).musicHookDuration ?? null,
  });
};

