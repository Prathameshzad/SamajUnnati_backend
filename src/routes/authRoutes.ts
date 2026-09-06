// src/routes/authRoutes.ts
import { Router } from 'express';
import { checkPhone, registerUser, requestOtp, verifyOtp } from '../controllers/authController';
import { uploadProfileImage } from '../middleware/uploadMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import {
  authIpLimiter,
  authPhoneLimiter,
  otpVerifyLimiter,
  registerLimiter,
} from '../middleware/rateLimit';
import {
  checkPhoneSchema,
  registerSchema,
  requestOtpSchema,
  verifyOtpSchema,
} from '../schemas/authSchemas';

const router = Router();

/**
 * Every auth route carries a per-IP ceiling *and* a per-phone limit.
 *
 * Both are needed: the per-phone limit stops a single account being ground down
 * from many IPs, and the per-IP limit stops one host enumerating many numbers.
 * `check-phone` in particular reveals whether a number is registered
 * (`{ exists: true|false }`), which is an account-enumeration oracle, and it also
 * triggers an SMS send.
 */
router.post(
  '/check-phone',
  authIpLimiter,
  authPhoneLimiter,
  validate(checkPhoneSchema),
  asyncHandler(checkPhone)
);

router.post(
  '/request-otp',
  authIpLimiter,
  authPhoneLimiter,
  validate(requestOtpSchema),
  asyncHandler(requestOtp)
);

router.post(
  '/verify-otp',
  authIpLimiter,
  otpVerifyLimiter,
  validate(verifyOtpSchema),
  asyncHandler(verifyOtp)
);

// Multipart: multer runs first so text fields are populated before validation.
router.post(
  '/register',
  authIpLimiter,
  registerLimiter,
  ...uploadProfileImage,
  validate(registerSchema),
  asyncHandler(registerUser)
);

export default router;
