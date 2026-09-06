// src/routes/followRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter } from '../middleware/rateLimit';
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
import {
  followListSchema,
  followRequestIdSchema,
  followStatusSchema,
  followUserSchema,
  updatePrivacySchema,
} from '../schemas/miscSchemas';

const router = Router();
router.use(authMiddleware);

router.get('/requests', readLimiter, validate(followListSchema), asyncHandler(getFollowRequests));
router.post(
  '/requests/:id/accept',
  writeLimiter,
  validate(followRequestIdSchema),
  asyncHandler(acceptFollowRequest)
);
router.post(
  '/requests/:id/reject',
  writeLimiter,
  validate(followRequestIdSchema),
  asyncHandler(rejectFollowRequest)
);

router.get('/followers', readLimiter, validate(followListSchema), asyncHandler(getFollowers));
router.get('/following', readLimiter, validate(followListSchema), asyncHandler(getFollowing));
router.get('/status/:userId', readLimiter, validate(followStatusSchema), asyncHandler(getFollowStatus));

router.patch('/privacy', writeLimiter, validate(updatePrivacySchema), asyncHandler(updatePrivacy));

// Parameterised POST last so it cannot shadow '/requests/...'.
router.post('/:userId', writeLimiter, validate(followUserSchema), asyncHandler(followUser));

export default router;
