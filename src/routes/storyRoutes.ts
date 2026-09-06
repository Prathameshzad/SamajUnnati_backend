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
  viewStory,
  deleteStory,
} from '../controllers/storyController';
import { createStorySchema, storyIdSchema } from '../schemas/contentSchemas';

const router = Router();
router.use(authMiddleware);

router.get('/feed', readLimiter, asyncHandler(getStoryFeed));
router.get('/my', readLimiter, asyncHandler(getMyStories));

router.post(
  '/',
  uploadLimiter,
  ...uploadSingleMedia('media'),
  validate(createStorySchema),
  asyncHandler(createStory)
);

router.post('/:id/view', writeLimiter, validate(storyIdSchema), asyncHandler(viewStory));
router.delete('/:id', writeLimiter, validate(storyIdSchema), asyncHandler(deleteStory));

export default router;
