// src/controllers/followController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { createNotification } from '../services/notificationService';
import { badRequest, notFound, unauthenticated } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('follow');

// POST /api/follow/:userId – follow or unfollow
export const followUser = async (req: AuthRequest, res: Response) => {
  const followerId = req.user?.id;
  if (!followerId) throw unauthenticated();

  const { userId: followingId } = req.params;

  if (followerId === followingId) {
    throw badRequest('Cannot follow yourself');
  }

  const target = await prisma.user.findUnique({
    where: { id: followingId },
    select: { isPrivate: true, firstName: true },
  });
  if (!target) throw notFound('User not found');

  const existing = await prisma.follow.findUnique({
    where: { followerId_followingId: { followerId, followingId } },
  });

  if (existing) {
    // Unfollow or cancel request
    await prisma.follow.delete({ where: { followerId_followingId: { followerId, followingId } } });
    return res.json({ status: 'UNFOLLOWED' });
  }

  const status = target.isPrivate ? 'PENDING' : 'ACCEPTED';
  await prisma.follow.create({ data: { followerId, followingId, status } });

  // Notify target. `createNotification` persists, emits over the socket and
  // dispatches the push, and never throws — the follow itself is already
  // committed and must not be turned into a 500 by a delivery failure.
  const follower = await prisma.user
    .findUnique({
      where: { id: followerId },
      select: { firstName: true, lastName: true, photoUrl: true },
    })
    .catch((err) => {
      log.warn({ err, followerId }, 'could not load follower for notification');
      return null;
    });

  await createNotification({
    userId: followingId,
    type: target.isPrivate ? 'FOLLOW_REQUEST' : 'FOLLOW_ACCEPTED',
    title: target.isPrivate ? 'Follow Request' : 'New Follower',
    message: target.isPrivate
      ? `${follower?.firstName ?? 'Someone'} wants to follow you`
      : `${follower?.firstName ?? 'Someone'} started following you`,
    imageUrl: follower?.photoUrl,
  });

  return res.json({ status: target.isPrivate ? 'REQUESTED' : 'FOLLOWED' });
};

// GET /api/follow/requests – pending requests for private account
export const getFollowRequests = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const requests = await prisma.follow.findMany({
    where: { followingId: userId, status: 'PENDING' },
    include: {
      follower: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } },
    },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(requests);
};

// POST /api/follow/requests/:id/accept
export const acceptFollowRequest = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id } = req.params;
  const follow = await prisma.follow.findFirst({
    where: { id, followingId: userId, status: 'PENDING' },
  });
  if (!follow) throw notFound('Request not found');

  await prisma.follow.update({ where: { id }, data: { status: 'ACCEPTED' } });

  // Notify the follower. Best-effort: never fails the accept action.
  const me = await prisma.user
    .findUnique({ where: { id: userId }, select: { firstName: true, photoUrl: true } })
    .catch((err) => {
      log.warn({ err, userId }, 'could not load accepter for notification');
      return null;
    });

  await createNotification({
    userId: follow.followerId,
    type: 'FOLLOW_ACCEPTED',
    title: 'Follow Accepted',
    message: `${me?.firstName ?? 'Someone'} accepted your follow request`,
    imageUrl: me?.photoUrl,
  });

  return res.json({ message: 'Follow request accepted' });
};

// POST /api/follow/requests/:id/reject
export const rejectFollowRequest = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const { id } = req.params;
  const follow = await prisma.follow.findFirst({ where: { id, followingId: userId, status: 'PENDING' } });
  if (!follow) throw notFound('Request not found');

  await prisma.follow.delete({ where: { id } });
  return res.json({ message: 'Follow request rejected' });
};

// GET /api/follow/followers
export const getFollowers = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const followers = await prisma.follow.findMany({
    where: { followingId: userId, status: 'ACCEPTED' },
    include: { follower: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(followers.map((f) => f.follower));
};

// GET /api/follow/following
export const getFollowing = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  const following = await prisma.follow.findMany({
    where: { followerId: userId, status: 'ACCEPTED' },
    include: { following: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
    orderBy: { createdAt: 'desc' },
  });
  return res.json(following.map((f) => f.following));
};

// GET /api/follow/status/:userId – check follow status
export const getFollowStatus = async (req: AuthRequest, res: Response) => {
  const followerId = req.user?.id;
  if (!followerId) throw unauthenticated();

  const { userId: followingId } = req.params;

  const [follow, reverseFollow] = await Promise.all([
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId, followingId } },
    }),
    prisma.follow.findUnique({
      where: { followerId_followingId: { followerId: followingId, followingId: followerId } },
    }),
  ]);

  return res.json({
    followStatus: follow?.status ?? 'NONE',
    isFollower: reverseFollow?.status === 'ACCEPTED',
  });
};

// PATCH /api/users/me/privacy
export const updatePrivacy = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) throw unauthenticated();

  // updatePrivacySchema already validates bio length and requires at least
  // one of isPrivate/bio to be present.
  const { isPrivate, bio } = req.body;

  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      ...(typeof isPrivate === 'boolean' ? { isPrivate } : {}),
      ...(bio !== undefined ? { bio } : {}),
    },
  });

  return res.json(user);
};
