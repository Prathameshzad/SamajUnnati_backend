// src/controllers/storyController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadMedia } from '../lib/mediaUpload';

// POST /api/stories
export const createStory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const file = (req as any).file as Express.Multer.File | undefined;
    const { caption } = req.body;

    if (!file) return res.status(400).json({ message: 'Media file is required' });

    const mediaUrl = await uploadMedia(file);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const story = await prisma.story.create({
      data: {
        userId,
        mediaUrl,
        mediaType: file.mimetype.startsWith('video/') ? 'VIDEO' : 'PHOTO',
        caption: caption || null,
        expiresAt,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
        _count: { select: { views: true } },
      },
    });

    return res.status(201).json(story);
  } catch (err: any) {
    console.error('createStory error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/stories/feed – stories from followed users (grouped by user)
export const getStoryFeed = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const now = new Date();

    // Get accepted following IDs
    const following = await prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const feedUserIds = [userId, ...following.map((f) => f.followingId)];

    const stories = await prisma.story.findMany({
      where: {
        userId: { in: feedUserIds },
        expiresAt: { gt: now },
        deletedAt: null,
      },
      orderBy: [{ userId: 'asc' }, { createdAt: 'asc' }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
        views: { where: { userId }, select: { id: true } },
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
        expiresAt: story.expiresAt,
        createdAt: story.createdAt,
        isViewed,
      });
      if (!isViewed && uid !== userId) grouped[uid].hasUnviewed = true;
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
  } catch (err: any) {
    console.error('getStoryFeed error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/stories/my
export const getMyStories = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

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
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/stories/:id/view
export const viewStory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id: storyId } = req.params;

    const story = await prisma.story.findFirst({
      where: { id: storyId, deletedAt: null, expiresAt: { gt: new Date() } },
    });
    if (!story) return res.status(404).json({ message: 'Story not found or expired' });

    await prisma.storyView.upsert({
      where: { storyId_userId: { storyId, userId } },
      create: { storyId, userId },
      update: { viewedAt: new Date() },
    });

    return res.json({ viewed: true });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/stories/:id
export const deleteStory = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id } = req.params;
    const story = await prisma.story.findFirst({ where: { id, userId, deletedAt: null } });
    if (!story) return res.status(404).json({ message: 'Story not found' });

    await prisma.story.update({ where: { id }, data: { deletedAt: new Date() } });
    return res.json({ message: 'Story deleted' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};
