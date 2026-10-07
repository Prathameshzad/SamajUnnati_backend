import { Router } from 'express';
import {
  getMe,
  updateMe,
  deleteMyAccount,
  getUserById,
  requestChangePhoneOtp,
  verifyChangePhoneOtp,
} from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadProfileImage } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter, otpVerifyLimiter } from '../middleware/rateLimit';
import { updateMeSchema, userIdParamSchema } from '../schemas/userSchemas';

const router = Router();

router.get('/me', authMiddleware, readLimiter, asyncHandler(getMe));

router.put(
  '/me',
  authMiddleware,
  writeLimiter,
  ...uploadProfileImage,
  validate(updateMeSchema),
  asyncHandler(updateMe)
);

router.delete(
  '/me',
  authMiddleware,
  writeLimiter,
  asyncHandler(deleteMyAccount)
);

router.post(
  '/change-phone/request-otp',
  authMiddleware,
  writeLimiter,
  asyncHandler(requestChangePhoneOtp)
);

router.post(
  '/change-phone/verify-otp',
  authMiddleware,
  otpVerifyLimiter,
  asyncHandler(verifyChangePhoneOtp)
);

/**
 * Declared after '/me' so the literal path wins over the parameter.
 * `id` is validated as a UUID, which stops malformed IDs reaching Postgres as an
 * unhandled P2023 (previously surfaced as a 500).
 */
router.get(
  '/:id',
  authMiddleware,
  readLimiter,
  validate(userIdParamSchema),
  asyncHandler(getUserById)
);

export default router;
