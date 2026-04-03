// src/controllers/postController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../lib/socket';
import { uploadMedia } from '../lib/mediaUpload';

// Helper: check if user can view a post (privacy check)
async function canViewUserPosts(viewerId: string, targetUserId: string): Promise<boolean> {
  if (viewerId === targetUserId) return true;
  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { isPrivate: true } });
  if (!target) return false;
  if (!target.isPrivate) return true;

  // Confirmed family relation always grants view access (even on private accounts)
  // Check all directions: fromUserId/toUserId (covers both normal and reciprocal rows)
  const familyRelation = await prisma.relation.findFirst({
    where: {
      status: 'CONFIRMED',
      OR: [
        { fromUserId: viewerId, toUserId: targetUserId },
        { fromUserId: targetUserId, toUserId: viewerId },
        // Also cover cross-node adds: createdById is the root user, toUserId is the relative
        { createdById: viewerId, toUserId: targetUserId },
        { createdById: targetUserId, toUserId: viewerId },
      ],
    },
  });
  if (familyRelation) return true;

  const follow = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId: viewerId, followingId: targetUserId } },
  });
  return follow?.status === 'ACCEPTED';
}

// POST /api/posts  – Create post (multipart, up to 10 files)
export const createPost = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { caption, location } = req.body;
    const files = (req.files as Express.Multer.File[]) || [];

    if (files.length === 0) {
      return res.status(400).json({ message: 'At least one media file is required' });
    }

    // Upload all files
    const uploadedUrls = await Promise.all(files.map((f) => uploadMedia(f)));

    const post = await prisma.post.create({
      data: {
        userId,
        caption: caption || null,
        location: location || null,
        media: {
          create: uploadedUrls.map((url, index) => ({
            url,
            type: files[index].mimetype.startsWith('video/') ? 'VIDEO' as const : 'PHOTO' as const,
            order: index,
          })),
        },
      },
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isPrivate: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
      },
    });

    return res.status(201).json({ ...post, isLiked: false, likeCount: 0, commentCount: 0, shareCount: 0 });
  } catch (err: any) {
    console.error('createPost error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/posts/feed  – cursor-based feed
export const getFeed = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const limit = Math.min(parseInt(req.query.limit as string) || 10, 30);
    const cursor = req.query.cursor as string | undefined;

    // Get accepted following IDs
    const following = await prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      select: { followingId: true },
    });
    const followingIds = following.map((f) => f.followingId);

    // Also include confirmed family members in the feed:
    // Covers both normal rows (fromUserId=userId) and reciprocal rows (toUserId=userId)
    // and cross-node adds (createdById=userId)
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
      if (r.fromUserId !== userId) familyIdSet.add(r.fromUserId);
      if (r.toUserId !== userId) familyIdSet.add(r.toUserId);
    }
    familyIdSet.delete(userId);
    const familyIds = Array.from(familyIdSet);

    const feedUserIds = [...new Set([userId, ...followingIds, ...familyIds])];

    const posts = await prisma.post.findMany({
      where: {
        userId: { in: feedUserIds },
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isPrivate: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
        likes: { where: { userId }, select: { id: true } },
      },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    const result = items.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      shareCount: post._count.shares,
      likes: undefined,
    }));

    return res.json({ posts: result, nextCursor });
  } catch (err: any) {
    console.error('getFeed error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/posts/user/:userId – posts by a specific user
export const getUserPosts = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) return res.status(401).json({ message: 'Unauthenticated' });

    const { userId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 12, 30);
    const cursor = req.query.cursor as string | undefined;

    const canView = await canViewUserPosts(viewerId, userId);

    const [postCount, followerCount, followingCount] = await Promise.all([
      prisma.post.count({ where: { userId, deletedAt: null } }),
      prisma.follow.count({ where: { followingId: userId, status: 'ACCEPTED' } }),
      prisma.follow.count({ where: { followerId: userId, status: 'ACCEPTED' } }),
    ]);

    // Check follow status for this viewer
    const followRecord = await prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: viewerId, followingId: userId } },
    });

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, lastName: true, photoUrl: true, isPrivate: true, bio: true },
    });

    if (!canView) {
      return res.json({
        posts: [],
        nextCursor: null,
        isPrivate: true,
        postCount,
        followerCount,
        followingCount,
        user: targetUser,
        followStatus: followRecord?.status ?? 'NONE',
      });
    }

    const posts = await prisma.post.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isPrivate: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
        likes: { where: { userId: viewerId }, select: { id: true } },
      },
    });

    const hasMore = posts.length > limit;
    const items = hasMore ? posts.slice(0, limit) : posts;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    const result = items.map((post) => ({
      ...post,
      isLiked: post.likes.length > 0,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      shareCount: post._count.shares,
      likes: undefined,
    }));

    return res.json({
      posts: result,
      nextCursor,
      isPrivate: false,
      postCount,
      followerCount,
      followingCount,
      user: targetUser,
      followStatus: followRecord?.status ?? 'NONE',
    });
  } catch (err: any) {
    console.error('getUserPosts error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/posts/:id
export const getPost = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const viewerId = req.user?.id;
    if (!viewerId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id } = req.params;

    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: {
        media: { orderBy: { order: 'asc' } },
        user: { select: { id: true, firstName: true, lastName: true, photoUrl: true, isPrivate: true } },
        _count: { select: { likes: true, comments: true, shares: true } },
        likes: { where: { userId: viewerId }, select: { id: true } },
      },
    });

    if (!post) return res.status(404).json({ message: 'Post not found' });

    const canView = await canViewUserPosts(viewerId, post.userId);
    if (!canView) return res.status(403).json({ message: 'This account is private' });

    return res.json({
      ...post,
      isLiked: post.likes.length > 0,
      likeCount: post._count.likes,
      commentCount: post._count.comments,
      shareCount: post._count.shares,
      likes: undefined,
    });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/posts/:id
export const deletePost = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id } = req.params;
    const post = await prisma.post.findFirst({ where: { id, userId, deletedAt: null } });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
    return res.json({ message: 'Post deleted' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/posts/:id/like – toggle like
export const toggleLike = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id: postId } = req.params;

    const post = await prisma.post.findFirst({
      where: { id: postId, deletedAt: null },
      select: { userId: true },
    });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const existing = await prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    let liked: boolean;
    if (existing) {
      await prisma.postLike.delete({ where: { postId_userId: { postId, userId } } });
      liked = false;
    } else {
      await prisma.postLike.create({ data: { postId, userId } });
      liked = true;

      // Notify post owner (not self)
      if (post.userId !== userId) {
        try {
          const liker = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true, lastName: true } });
          const notif = await prisma.notification.create({
            data: {
              userId: post.userId,
              type: 'POST_LIKE',
              title: 'New Like',
              message: `${liker?.firstName ?? 'Someone'} liked your post`,
              postId,
            },
          });
          const io = getIO();
          io.to(post.userId).emit('notification:new', notif);
        } catch (e) {
          console.warn('Like notification failed', e);
        }
      }
    }

    const likeCount = await prisma.postLike.count({ where: { postId } });
    return res.json({ liked, likeCount });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/posts/:id/likes
export const getPostLikes = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id: postId } = req.params;
    const likes = await prisma.postLike.findMany({
      where: { postId },
      include: { user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    return res.json(likes.map((l) => l.user));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/posts/:id/comments
export const addComment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id: postId } = req.params;
    const { content, parentId } = req.body;

    if (!content?.trim()) return res.status(400).json({ message: 'Content is required' });

    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null }, select: { userId: true } });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    const comment = await prisma.postComment.create({
      data: { postId, userId, content: content.trim(), parentId: parentId || null },
      include: { user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    });

    // Notify post owner
    if (post.userId !== userId) {
      try {
        const commenter = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
        const notif = await prisma.notification.create({
          data: {
            userId: post.userId,
            type: 'POST_COMMENT',
            title: 'New Comment',
            message: `${commenter?.firstName ?? 'Someone'} commented on your post`,
            postId,
          },
        });
        const io = getIO();
        io.to(post.userId).emit('notification:new', notif);
        io.to(postId).emit('post:comment', comment);
      } catch (e) {
        console.warn('Comment notification failed', e);
      }
    }

    return res.status(201).json(comment);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/posts/:id/comments
export const getComments = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const { id: postId } = req.params;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
    const cursor = req.query.cursor as string | undefined;

    const comments = await prisma.postComment.findMany({
      where: {
        postId,
        parentId: null,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } },
        replies: {
          where: { deletedAt: null },
          include: { user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
          orderBy: { createdAt: 'asc' },
          take: 3,
        },
        _count: { select: { replies: true } },
      },
    });

    const hasMore = comments.length > limit;
    const items = hasMore ? comments.slice(0, limit) : comments;
    const nextCursor = hasMore ? items[items.length - 1].createdAt.toISOString() : null;

    return res.json({ comments: items, nextCursor });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// DELETE /api/posts/:id/comments/:commentId
export const deleteComment = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { commentId } = req.params;
    const comment = await prisma.postComment.findFirst({ where: { id: commentId, userId, deletedAt: null } });
    if (!comment) return res.status(404).json({ message: 'Comment not found' });

    await prisma.postComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
    return res.json({ message: 'Comment deleted' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/posts/:id/share
export const sharePost = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id: postId } = req.params;
    const { sharedTo } = req.body;

    const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null }, select: { userId: true } });
    if (!post) return res.status(404).json({ message: 'Post not found' });

    await prisma.postShare.create({ data: { postId, userId, sharedTo: sharedTo || null } });

    const shareCount = await prisma.postShare.count({ where: { postId } });
    return res.json({ shareCount });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};
