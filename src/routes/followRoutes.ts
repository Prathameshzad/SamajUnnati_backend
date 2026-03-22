// src/routes/followRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  followUser,
  getFollowRequests,
  acceptFollowRequest,
  rejectFollowRequest,
  getFollowers,
  getFollowing,
  getFollowStatus,
  updatePrivacy,
} from '../controllers/followController';

const router = Router();
router.use(authMiddleware as any);

router.get('/requests', getFollowRequests as any);
router.post('/requests/:id/accept', acceptFollowRequest as any);
router.post('/requests/:id/reject', rejectFollowRequest as any);
router.get('/followers', getFollowers as any);
router.get('/following', getFollowing as any);
router.get('/status/:userId', getFollowStatus as any);
router.patch('/privacy', updatePrivacy as any);
router.post('/:userId', followUser as any);

export default router;
