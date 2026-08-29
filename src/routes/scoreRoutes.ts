// src/routes/scoreRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { getMyScore, getLeaderboardController } from '../controllers/scoreController';

const router = Router();

router.get('/me', authMiddleware, getMyScore);
router.get('/leaderboard', authMiddleware, getLeaderboardController);

export default router;
