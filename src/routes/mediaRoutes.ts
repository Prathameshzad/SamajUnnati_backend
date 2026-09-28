// src/routes/mediaRoutes.ts
import { Router } from 'express';
import { proxyMedia } from '../controllers/mediaController';
import { readLimiter } from '../middleware/rateLimit';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

/**
 * GET /api/media?key=profile/2026/09/<object>.jpg
 *
 * A query parameter rather than a wildcard path segment: object keys contain
 * slashes, and Express 5's path-to-regexp requires named wildcards that arrive
 * as split arrays. A single encoded query value avoids that entirely.
 */
router.get('/', readLimiter, asyncHandler(proxyMedia));

export default router;
