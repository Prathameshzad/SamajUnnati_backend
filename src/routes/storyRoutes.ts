// src/routes/storyRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadSingleMedia } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter, uploadLimiter } from '../middleware/rateLimit';
import {
  createStory,
  getStoryFeed,
  getMyStories,
  getActiveStoryUserIds,
  getUserStories,
  getStoryViewers,
  viewStory,
  deleteStory,
  getStoryById,
} from '../controllers/storyController';
import { createStorySchema, storyIdSchema, userStorySchema } from '../schemas/contentSchemas';

const router = Router();
router.use(authMiddleware);

router.get('/feed', readLimiter, asyncHandler(getStoryFeed));
router.get('/active-users', readLimiter, asyncHandler(getActiveStoryUserIds));
router.get('/my', readLimiter, asyncHandler(getMyStories));
router.get('/user/:userId', readLimiter, validate(userStorySchema), asyncHandler(getUserStories));

router.post(
  '/',
  uploadLimiter,
  ...uploadSingleMedia('media'),
  validate(createStorySchema),
  asyncHandler(createStory)
);

router.get('/:id/viewers', readLimiter, validate(storyIdSchema), asyncHandler(getStoryViewers));
router.post('/:id/view', writeLimiter, validate(storyIdSchema), asyncHandler(viewStory));
router.delete('/:id', writeLimiter, validate(storyIdSchema), asyncHandler(deleteStory));
router.get('/:id', readLimiter, validate(storyIdSchema), asyncHandler(getStoryById));

export default router;

