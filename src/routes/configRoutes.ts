// src/routes/configRoutes.ts
import { Router } from 'express';
import { readLimiter } from '../middleware/rateLimit';
import {
  getGamificationConfig,
  getCountriesConfig,
  getReligionCasteConfig,
  getCastesByReligion,
  getMatrimonyConfig,
} from '../controllers/configController';

const router = Router();

/**
 * Public on purpose: these are presentation constants (tier names, colours, point
 * values, country phone lengths, religion & caste taxonomy, matrimony options)
 * that the login, signup, and onboarding screens may need before a session exists.
 * They contain no user data.
 */
router.get('/gamification', readLimiter, getGamificationConfig);
router.get('/countries', readLimiter, getCountriesConfig);
router.get('/religion-caste', readLimiter, getReligionCasteConfig);
router.get('/castes', readLimiter, getCastesByReligion);
router.get('/matrimony', readLimiter, getMatrimonyConfig);

export default router;

