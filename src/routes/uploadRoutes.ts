// src/routes/uploadRoutes.ts
import { Router } from 'express';
import { uploadImage } from '../controllers/uploadController';
import { uploadProfileImage } from '../middleware/uploadMiddleware';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadLimiter } from '../middleware/rateLimit';
import { asyncHandler } from '../lib/asyncHandler';

const router = Router();

/**
 * SECURITY FIX: this route previously had no authentication at all —
 *
 *   router.post('/', uploadProfileImage, uploadImage);
 *
 * Combined with `app.use('/api/upload', uploadRoutes)`, that meant anyone on the
 * internet could POST files and have them stored in the public R2 bucket and get
 * back a public URL. That is an open file host: unbounded storage and egress cost
 * on your account, plus the ability to serve arbitrary content from your domain.
 *
 * It now requires a valid session, enforces a per-user upload quota, and
 * content-verifies the bytes (see uploadMiddleware / fileValidation).
 */
router.post('/', authMiddleware, uploadLimiter, ...uploadProfileImage, asyncHandler(uploadImage));

export default router;
