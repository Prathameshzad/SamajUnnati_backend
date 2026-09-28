// src/routes/musicRoutes.ts
import { Router } from 'express';
import { getTrendingMusic, searchMusic, getMusicHook, streamAudio } from '../controllers/musicController';
import { asyncHandler } from '../lib/asyncHandler';
import { authIpLimiter } from '../middleware/rateLimit';

const router = Router();

/**
 * Audio Streaming Endpoints (High-throughput, unthrottled for smooth playback)
 * Streams standard audio/mp4 with HTTP 206 Partial Content (Range requests)
 */
router.get('/stream/:id.mp4', asyncHandler(streamAudio));
router.get('/stream', asyncHandler(streamAudio));

// IP rate limit on music discovery endpoints to protect quota
router.use(authIpLimiter);

/**
 * GET /api/music/trending
 * Returns trending music videos in India.
 */
router.get('/trending', asyncHandler(getTrendingMusic));

/**
 * GET /api/music/search?q=Arijit+Singh
 * Full-text search of music tracks.
 */
router.get('/search', asyncHandler(searchMusic));

/**
 * GET /api/music/hook?videoId=dQw4w9WgXcW
 * Returns the best hook start time for a given video.
 */
router.get('/hook', asyncHandler(getMusicHook));

export default router;
