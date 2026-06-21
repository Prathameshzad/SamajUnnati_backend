import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { MatrimonyController } from '../controllers/matrimonyController';

const router = Router();
const controller = new MatrimonyController();

// Use authentication for all routes
router.use(authMiddleware);

// Profile
router.post('/profile', controller.upsertProfile.bind(controller));
router.get('/profile', controller.getProfile.bind(controller));

// Preferences
router.post('/preference', controller.upsertPreference.bind(controller));
router.get('/preference', controller.getPreference.bind(controller));

// Feed & Recommendations
router.get('/feed', controller.getFeed.bind(controller));

// Actions
router.post('/action', controller.handleAction.bind(controller));

// Matches
router.get('/matches', controller.getMatches.bind(controller));
router.get('/shortlists', controller.getShortlists.bind(controller));

// Parent-managed profiles
router.post('/profile/for-child', controller.upsertProfileForChild.bind(controller));
router.get('/managed-profiles', controller.getManagedProfiles.bind(controller));
router.post('/profile/claim', controller.claimProfile.bind(controller));

export default router;
