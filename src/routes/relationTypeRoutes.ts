// src/routes/relationTypeRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter } from '../middleware/rateLimit';
import { listRelationTypes, getRelationConfig } from '../controllers/relationTypeController';
import { relationConfigSchema, relationTypesSchema } from '../schemas/miscSchemas';

const router = Router();

/**
 * GET /api/relation-types/config
 *
 * The highest-volume endpoint in the app: both clients fetch it on every boot
 * (RelationContext) and it returns the whole RELATION_AXIS_CONFIG plus every
 * relation translation. The response depends only on `lang`, never on the user,
 * so it is now cached and ETagged in the controller.
 */
router.get(
  '/config',
  authMiddleware,
  readLimiter,
  validate(relationConfigSchema),
  asyncHandler(getRelationConfig)
);

router.get(
  '/',
  authMiddleware,
  readLimiter,
  validate(relationTypesSchema),
  asyncHandler(listRelationTypes)
);

export default router;
