// src/routes/matrimonyRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { asyncHandler } from '../lib/asyncHandler';
import {
  readLimiter,
  writeLimiter,
  authPhoneLimiter,
  otpVerifyLimiter,
} from '../middleware/rateLimit';
import { MatrimonyController } from '../controllers/matrimonyController';

const router = Router();
const controller = new MatrimonyController();

router.use(authMiddleware);

// Profile
router.post('/profile', writeLimiter, asyncHandler(controller.upsertProfile.bind(controller)));
router.get('/profile', readLimiter, asyncHandler(controller.getProfile.bind(controller)));

// Preferences
router.post('/preference', writeLimiter, asyncHandler(controller.upsertPreference.bind(controller)));
router.get('/preference', readLimiter, asyncHandler(controller.getPreference.bind(controller)));

// Feed & recommendations
router.get('/feed', readLimiter, asyncHandler(controller.getFeed.bind(controller)));

// Actions
router.post('/action', writeLimiter, asyncHandler(controller.handleAction.bind(controller)));

// Matches
router.get('/matches', readLimiter, asyncHandler(controller.getMatches.bind(controller)));
router.get('/shortlists', readLimiter, asyncHandler(controller.getShortlists.bind(controller)));

// Parent-managed profiles
router.post(
  '/profile/for-child',
  writeLimiter,
  asyncHandler(controller.upsertProfileForChild.bind(controller))
);
router.get(
  '/managed-profiles',
  readLimiter,
  asyncHandler(controller.getManagedProfiles.bind(controller))
);
router.post('/profile/claim', writeLimiter, asyncHandler(controller.claimProfile.bind(controller)));

/**
 * These three are a second OTP surface (phone lookup, OTP send, OTP verify) that
 * previously had no rate limiting of any kind. They share the same limiters as
 * /api/auth so the protections cannot be sidestepped by using this path instead.
 */
router.post(
  '/profile/check-phone-managed',
  authPhoneLimiter,
  asyncHandler(controller.checkPhoneForManagedProfile.bind(controller))
);
router.post(
  '/profile/request-approval',
  authPhoneLimiter,
  asyncHandler(controller.requestManagedProfileApproval.bind(controller))
);
router.post(
  '/profile/verify-otp-managed',
  otpVerifyLimiter,
  asyncHandler(controller.verifyOtpAndCreateUser.bind(controller))
);

export default router;
