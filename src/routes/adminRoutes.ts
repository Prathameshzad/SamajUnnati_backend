// src/routes/adminRoutes.ts
import { Router } from 'express';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { adminAuth, adminEnabled } from '../middleware/adminAuth';
import { adminLoginLimiter, heavyReadLimiter, readLimiter } from '../middleware/rateLimit';
import {
  adminLogin,
  adminMe,
  adminStats,
  adminListUsers,
  adminUserTree,
  adminRelationConfig,
  adminDeletedUsers,
  adminOverview,
  adminUserDetails,
} from '../controllers/adminController';
import {
  adminLoginSchema,
  adminListUsersSchema,
  adminRelationConfigSchema,
  adminUserTreeSchema,
  adminOverviewSchema,
  adminDeletedUsersSchema,
  adminUserDetailsSchema,
} from '../schemas/adminSchemas';

const router = Router();

router.use(adminEnabled);

router.post('/login', adminLoginLimiter, validate(adminLoginSchema), asyncHandler(adminLogin));

// Everything below requires a valid admin token.
router.use(adminAuth);

router.get('/me', adminMe);
router.get('/stats', readLimiter, asyncHandler(adminStats));
router.get('/overview', readLimiter, validate(adminOverviewSchema), asyncHandler(adminOverview));
router.get(
  '/deleted-users',
  readLimiter,
  validate(adminDeletedUsersSchema),
  asyncHandler(adminDeletedUsers)
);
router.get('/users', readLimiter, validate(adminListUsersSchema), asyncHandler(adminListUsers));
router.get('/users/:id', readLimiter, validate(adminUserDetailsSchema), asyncHandler(adminUserDetails));
router.get(
  '/users/:id/tree',
  heavyReadLimiter,
  validate(adminUserTreeSchema),
  asyncHandler(adminUserTree)
);
router.get(
  '/relation-config',
  readLimiter,
  validate(adminRelationConfigSchema),
  asyncHandler(adminRelationConfig)
);

export default router;
