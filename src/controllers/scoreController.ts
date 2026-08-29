// src/controllers/scoreController.ts
import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { getUserScore, getLeaderboard } from '../services/scoreService';

/** GET /api/scores/me */
export const getMyScore = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  try {
    const score = await getUserScore(userId);
    return res.json(score);
  } catch (error) {
    console.error('getMyScore error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/** GET /api/scores/leaderboard?limit=10 */
export const getLeaderboardController = async (req: AuthRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Unauthenticated' });

  const limit = Math.min(Number(req.query.limit) || 10, 50);

  try {
    const board = await getLeaderboard(limit);
    return res.json(board);
  } catch (error) {
    console.error('getLeaderboard error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
