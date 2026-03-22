// src/controllers/followController.ts
import { Response } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { getIO } from '../lib/socket';

// POST /api/follow/:userId – follow or unfollow
export const followUser = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const followerId = req.user?.id;
    if (!followerId) return res.status(401).json({ message: 'Unauthenticated' });

    const { userId: followingId } = req.params;

    if (followerId === followingId) {
      return res.status(400).json({ message: 'Cannot follow yourself' });
    }

    const target = await prisma.user.findUnique({
      where: { id: followingId },
      select: { isPrivate: true, firstName: true },
    });
    if (!target) return res.status(404).json({ message: 'User not found' });

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

    // Notify target
    try {
      const follower = await prisma.user.findUnique({ where: { id: followerId }, select: { firstName: true, lastName: true } });
      const notif = await prisma.notification.create({
        data: {
          userId: followingId,
          type: target.isPrivate ? 'FOLLOW_REQUEST' : ('FOLLOW_ACCEPTED' as any),
          title: target.isPrivate ? 'Follow Request' : 'New Follower',
          message: target.isPrivate
            ? `${follower?.firstName ?? 'Someone'} wants to follow you`
            : `${follower?.firstName ?? 'Someone'} started following you`,
        },
      });
      const io = getIO();
      io.to(followingId).emit('notification:new', notif);
    } catch (e) {
      console.warn('Follow notification failed', e);
    }

    return res.json({ status: target.isPrivate ? 'REQUESTED' : 'FOLLOWED' });
  } catch (err: any) {
    console.error('followUser error:', err);
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/follow/requests – pending requests for private account
export const getFollowRequests = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const requests = await prisma.follow.findMany({
      where: { followingId: userId, status: 'PENDING' },
      include: {
        follower: { select: { id: true, firstName: true, lastName: true, photoUrl: true, phone: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json(requests);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/follow/requests/:id/accept
export const acceptFollowRequest = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id } = req.params;
    const follow = await prisma.follow.findFirst({
      where: { id, followingId: userId, status: 'PENDING' },
    });
    if (!follow) return res.status(404).json({ message: 'Request not found' });

    await prisma.follow.update({ where: { id }, data: { status: 'ACCEPTED' } });

    // Notify the follower
    try {
      const me = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
      const notif = await prisma.notification.create({
        data: {
          userId: follow.followerId,
          type: 'FOLLOW_ACCEPTED',
          title: 'Follow Accepted',
          message: `${me?.firstName ?? 'Someone'} accepted your follow request`,
        },
      });
      const io = getIO();
      io.to(follow.followerId).emit('notification:new', notif);
    } catch (e) {
      console.warn('Accept notification failed', e);
    }

    return res.json({ message: 'Follow request accepted' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// POST /api/follow/requests/:id/reject
export const rejectFollowRequest = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { id } = req.params;
    const follow = await prisma.follow.findFirst({ where: { id, followingId: userId, status: 'PENDING' } });
    if (!follow) return res.status(404).json({ message: 'Request not found' });

    await prisma.follow.delete({ where: { id } });
    return res.json({ message: 'Follow request rejected' });
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/follow/followers
export const getFollowers = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const followers = await prisma.follow.findMany({
      where: { followingId: userId, status: 'ACCEPTED' },
      include: { follower: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(followers.map((f) => f.follower));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/follow/following
export const getFollowing = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const following = await prisma.follow.findMany({
      where: { followerId: userId, status: 'ACCEPTED' },
      include: { following: { select: { id: true, firstName: true, lastName: true, photoUrl: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json(following.map((f) => f.following));
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// GET /api/follow/status/:userId – check follow status
export const getFollowStatus = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const followerId = req.user?.id;
    if (!followerId) return res.status(401).json({ message: 'Unauthenticated' });

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
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};

// PATCH /api/users/me/privacy
export const updatePrivacy = async (req: AuthRequest, res: Response): Promise<Response | void> => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

    const { isPrivate, bio } = req.body;

    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(typeof isPrivate === 'boolean' ? { isPrivate } : {}),
        ...(bio !== undefined ? { bio } : {}),
      },
    });

    return res.json(user);
  } catch (err: any) {
    return res.status(500).json({ message: err.message });
  }
};
