// src/routes/configRoutes.ts
import { Router } from 'express';
import { readLimiter } from '../middleware/rateLimit';
import { getGamificationConfig } from '../controllers/configController';

const router = Router();

/**
 * Public on purpose: these are presentation constants (tier names, colours, point
 * values) that the login and signup screens may need before a session exists.
 * It contains no user data.
 */
router.get('/gamification', readLimiter, getGamificationConfig);

export default router;
