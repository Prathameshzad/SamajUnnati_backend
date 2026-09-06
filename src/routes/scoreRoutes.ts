// src/routes/scoreRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter } from '../middleware/rateLimit';
import { getMyScore, getLeaderboardController } from '../controllers/scoreController';
import { leaderboardSchema } from '../schemas/miscSchemas';

const router = Router();

router.use(authMiddleware);

router.get('/me', readLimiter, asyncHandler(getMyScore));
router.get(
  '/leaderboard',
  readLimiter,
  validate(leaderboardSchema),
  asyncHandler(getLeaderboardController)
);

export default router;
