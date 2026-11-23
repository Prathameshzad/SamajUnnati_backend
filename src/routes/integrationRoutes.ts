// src/routes/integrationRoutes.ts
// Read-only reporting API for the Ads Management panel. Mounted at /api/integration.
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { integrationAuth } from '../middleware/integrationAuth';
import { heavyReadLimiter, readLimiter } from '../middleware/rateLimit';
import {
  reportStats,
  reportListUsers,
  reportUserTree,
  reportRelationConfig,
  reportDeletedUsers,
  reportOverview,
  reportUserDetails,
} from '../controllers/integrationController';
import {
  reportListUsersSchema,
  reportRelationConfigSchema,
  reportUserTreeSchema,
  reportOverviewSchema,
  reportDeletedUsersSchema,
  reportUserDetailsSchema,
} from '../schemas/integrationSchemas';

const router = Router();

// Every endpoint requires the integration API key.
router.use(integrationAuth);

router.get('/stats', readLimiter, asyncHandler(reportStats));
router.get('/overview', readLimiter, validate(reportOverviewSchema), asyncHandler(reportOverview));
router.get('/deleted-users', readLimiter, validate(reportDeletedUsersSchema), asyncHandler(reportDeletedUsers));
router.get('/users', readLimiter, validate(reportListUsersSchema), asyncHandler(reportListUsers));
router.get('/users/:id', readLimiter, validate(reportUserDetailsSchema), asyncHandler(reportUserDetails));
router.get('/users/:id/tree', heavyReadLimiter, validate(reportUserTreeSchema), asyncHandler(reportUserTree));
router.get('/relation-config', readLimiter, validate(reportRelationConfigSchema), asyncHandler(reportRelationConfig));

export default router;
