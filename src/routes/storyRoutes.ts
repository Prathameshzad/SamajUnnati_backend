// src/routes/storyRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadMiddleware } from '../middleware/uploadMiddleware';
import {
  createStory,
  getStoryFeed,
  getMyStories,
  viewStory,
  deleteStory,
} from '../controllers/storyController';

const router = Router();
router.use(authMiddleware as any);

router.get('/feed', getStoryFeed as any);
router.get('/my', getMyStories as any);
router.post('/', uploadMiddleware.single('media'), createStory as any);
router.post('/:id/view', viewStory as any);
router.delete('/:id', deleteStory as any);

export default router;
