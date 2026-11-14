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
import { validate } from '../middleware/validate';
import { searchCities, getPlaceDetails } from '../controllers/placesController';
import { matrimonyRegisterSchema } from '../schemas/matrimonySchemas';

const router = Router();
const controller = new MatrimonyController();

router.use(authMiddleware);

// Birth-place search (Google Places proxy)
router.get('/places/cities', readLimiter, asyncHandler(searchCities));
router.get('/places/:placeId', readLimiter, asyncHandler(getPlaceDetails));

// Quick (Bumble-style) registration + waitlist
router.get('/status', readLimiter, asyncHandler(controller.getStatus.bind(controller)));
router.post(
  '/register',
  writeLimiter,
  validate(matrimonyRegisterSchema),
  asyncHandler(controller.register.bind(controller))
);

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
  writeLimiter,
  asyncHandler(controller.verifyOtpAndCreateUser.bind(controller))
);

export default router;
