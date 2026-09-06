// src/controllers/postController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { emitToUser, emitToRoom } from '../lib/socket';
import { uploadMedia } from '../lib/mediaUpload';
import type { ValidatedFile } from '../lib/fileValidation';
import { badRequest, forbidden, notFound, unauthenticated } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('posts');

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

/**
 * Best-effort "someone liked your post" notification.
 *
 * Split out of `toggleLike` so the like itself (already committed) is never
 * rolled back or turned into a 500 by a notification failure. Callers attach
 * `.catch(...)` rather than wrapping in try/catch, per this file's no-try/catch
 * convention — the promise chain gives the same "log and move on" behaviour
 * without a block.
 */
async function notifyPostLike(postOwnerId: string, likerId: string, postId: string): Promise<void> {
  const liker = await prisma.user.findUnique({ where: { id: likerId }, select: { firstName: true } });
  const notif = await prisma.notification.create({
    data: {
      userId: postOwnerId,
      type: 'POST_LIKE',
      title: 'New Like',
      message: `${liker?.firstName ?? 'Someone'} liked your post`,
      postId,
    },
  });
  emitToUser(postOwnerId, 'notification:new', notif);
}

/** Best-effort "someone commented on your post" notification. See notifyPostLike. */
async function notifyPostComment(
  postOwnerId: string,
  commenterId: string,
  postId: string,
  comment: unknown
): Promise<void> {
  const commenter = await prisma.user.findUnique({ where: { id: commenterId }, select: { firstName: true } });
  const notif = await prisma.notification.create({
    data: {
      userId: postOwnerId,
      type: 'POST_COMMENT',
      title: 'New Comment',
      message: `${commenter?.firstName ?? 'Someone'} commented on your post`,
      postId,
    },
  });
  emitToUser(postOwnerId, 'notification:new', notif);
  emitToRoom(postId, 'post:comment', comment);
}

// POST /api/posts  – Create post (multipart, up to 10 files)
export const createPost = async (req: AuthRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { caption, location } = req.body;
  const files = (req.files as Express.Multer.File[]) || [];

  if (files.length === 0) {
    throw badRequest('At least one media file is required');
  }

  /**
   * `validatedFileMap` is populated by the `uploadMediaArray` middleware from
   * real content-sniffing (see fileValidation.ts), not the client-declared
   * mimetype. Passing it through avoids re-sniffing the buffer here and lets
   * PostMedia.type be derived from the verified kind below instead of
   * `file.mimetype.startsWith('video/')`, which is trivially spoofed by the client.
   */
  const validatedMap = (req as any).validatedFileMap as WeakMap<Express.Multer.File, ValidatedFile> | undefined;

  const uploadedUrls = await Promise.all(
    files.map((f) => uploadMedia(f, { validated: validatedMap?.get(f) }))
  );

  const post = await prisma.post.create({
    data: {
      userId,
      caption: caption || null,
      location: location || null,
      media: {
        create: uploadedUrls.map((url, index) => ({
          url,
          type: validatedMap?.get(files[index])?.kind === 'video' ? ('VIDEO' as const) : ('PHOTO' as const),
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
};

// GET /api/posts/feed  – cursor-based feed
export const getFeed = async (req: AuthRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  // Bounded and defaulted by feedQuerySchema (max 30) — no Math.min needed here.
  const limit = req.query.limit as number;
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
};

// GET /api/posts/user/:userId – posts by a specific user
export const getUserPosts = async (req: AuthRequest, res: Response): Promise<Response> => {
  const viewerId = req.user?.id;
  if (!viewerId) throw unauthenticated();

  const { userId } = req.params;
  // Bounded and defaulted by userPostsSchema (max 30) — no Math.min needed here.
  const limit = req.query.limit as number;
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
    select: { id: true, firstName: true, lastName: true, photoUrl: true, isPrivate: true, bio: true, dateOfBirth: true, bloodGroup: true, education: true, occupation: true, maritalStatus: true, pincode: true, address: true, area: true },
  });

  /**
   * PII fix: a private account's extended profile (bio, dateOfBirth,
   * bloodGroup, education, occupation, maritalStatus, pincode, address, area)
   * was previously returned to *any* viewer regardless of `canView`. Narrow to
   * the same public fields used elsewhere in this file (id, firstName,
   * lastName, photoUrl, isPrivate) whenever the viewer is not allowed in.
   */
  const publicUser = !targetUser || canView
    ? targetUser
    : {
        id: targetUser.id,
        firstName: targetUser.firstName,
        lastName: targetUser.lastName,
        photoUrl: targetUser.photoUrl,
        isPrivate: targetUser.isPrivate,
      };

  if (!canView) {
    return res.json({
      posts: [],
      nextCursor: null,
      isPrivate: true,
      postCount,
      followerCount,
      followingCount,
      user: publicUser,
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
    user: publicUser,
    followStatus: followRecord?.status ?? 'NONE',
  });
};

// GET /api/posts/:id
export const getPost = async (req: AuthRequest, res: Response): Promise<Response> => {
  const viewerId = req.user?.id;
  if (!viewerId) throw unauthenticated();

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

  if (!post) throw notFound('Post not found');

  const canView = await canViewUserPosts(viewerId, post.userId);
  if (!canView) throw forbidden('This account is private');

  return res.json({
    ...post,
    isLiked: post.likes.length > 0,
    likeCount: post._count.likes,
    commentCount: post._count.comments,
    shareCount: post._count.shares,
    likes: undefined,
  });
};

// DELETE /api/posts/:id
export const deletePost = async (req: AuthRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id } = req.params;
  const post = await prisma.post.findFirst({ where: { id, userId, deletedAt: null } });
  if (!post) throw notFound('Post not found');

  await prisma.post.update({ where: { id }, data: { deletedAt: new Date() } });
  return res.json({ message: 'Post deleted' });
};

// POST /api/posts/:id/like – toggle like
export const toggleLike = async (req: AuthRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id: postId } = req.params;

  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null },
    select: { userId: true },
  });
  if (!post) throw notFound('Post not found');

  // Privacy check: liking a post is a form of viewing it, so it must be gated
  // the same way getPost/getUserPosts/getFeed already are. Previously this
  // handler only checked the post existed, so anyone could like (and thereby
  // confirm the existence of, and notify the owner of activity on) a post
  // belonging to a private account they have no relationship with.
  const canView = await canViewUserPosts(userId, post.userId);
  if (!canView) throw forbidden('This account is private');

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

    // Notify post owner (not self). Best-effort: must not fail the like itself.
    if (post.userId !== userId) {
      await notifyPostLike(post.userId, userId, postId).catch((err) => {
        log.error({ err, postId, userId }, 'like notification failed');
      });
    }
  }

  const likeCount = await prisma.postLike.count({ where: { postId } });
  return res.json({ liked, likeCount });
};

// GET /api/posts/:id/likes
export const getPostLikes = async (req: AuthRequest, res: Response): Promise<Response> => {
  const viewerId = req.user?.id;
  if (!viewerId) throw unauthenticated();

  const { id: postId } = req.params;

  // Privacy check: this previously had no gate at all — it only assumed the
  // post existed. Fetch the owner first so the same view rule applies here as
  // everywhere else in this file.
  const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null }, select: { userId: true } });
  if (!post) throw notFound('Post not found');

  const canView = await canViewUserPosts(viewerId, post.userId);
  if (!canView) throw forbidden('This account is private');

  const likes = await prisma.postLike.findMany({
    where: { postId },
    include: { user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  return res.json(likes.map((l) => l.user));
};

// POST /api/posts/:id/comments
export const addComment = async (req: AuthRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id: postId } = req.params;
  const { content, parentId } = req.body;

  if (!content?.trim()) throw badRequest('Content is required');

  const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null }, select: { userId: true } });
  if (!post) throw notFound('Post not found');

  // Privacy check: commenting previously had no gate — see getPostLikes above.
  const canView = await canViewUserPosts(userId, post.userId);
  if (!canView) throw forbidden('This account is private');

  const comment = await prisma.postComment.create({
    data: { postId, userId, content: content.trim(), parentId: parentId || null },
    include: { user: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
  });

  // Notify post owner. Best-effort: must not fail a comment that already succeeded.
  if (post.userId !== userId) {
    await notifyPostComment(post.userId, userId, postId, comment).catch((err) => {
      log.error({ err, postId, userId }, 'comment notification failed');
    });
  }

  return res.status(201).json(comment);
};

// GET /api/posts/:id/comments
export const getComments = async (req: AuthRequest, res: Response): Promise<Response> => {
  const viewerId = req.user?.id;
  if (!viewerId) throw unauthenticated();

  const { id: postId } = req.params;
  // Bounded and defaulted by commentsQuerySchema (max 50) — no Math.min needed here.
  const limit = req.query.limit as number;
  const cursor = req.query.cursor as string | undefined;

  // Privacy check: reading comments previously had no gate — see getPostLikes above.
  const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null }, select: { userId: true } });
  if (!post) throw notFound('Post not found');

  const canView = await canViewUserPosts(viewerId, post.userId);
  if (!canView) throw forbidden('This account is private');

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
};

// DELETE /api/posts/:id/comments/:commentId
export const deleteComment = async (req: AuthRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { commentId } = req.params;
  const comment = await prisma.postComment.findFirst({ where: { id: commentId, userId, deletedAt: null } });
  if (!comment) throw notFound('Comment not found');

  await prisma.postComment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  return res.json({ message: 'Comment deleted' });
};

// POST /api/posts/:id/share
export const sharePost = async (req: AuthRequest, res: Response): Promise<Response> => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id: postId } = req.params;
  const { sharedTo } = req.body;

  const post = await prisma.post.findFirst({ where: { id: postId, deletedAt: null }, select: { userId: true } });
  if (!post) throw notFound('Post not found');

  // Privacy check: sharing previously had no gate — see getPostLikes above.
  const canView = await canViewUserPosts(userId, post.userId);
  if (!canView) throw forbidden('This account is private');

  await prisma.postShare.create({ data: { postId, userId, sharedTo: sharedTo || null } });

  const shareCount = await prisma.postShare.count({ where: { postId } });
  return res.json({ shareCount });
};
