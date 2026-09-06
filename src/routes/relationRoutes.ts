// src/routes/relationRoutes.ts
import { Router } from 'express';
import { authMiddleware, requireAdmin } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter, heavyReadLimiter } from '../middleware/rateLimit';
import {
  listRelations,
  getTree,
  getRequests,
  createRelation,
  approveRelation,
  rejectRelation,
  updateRelation,
  deleteRelation,
  getFullTree,
  getRelationCounts,
  getAcceptedRequests,
  checkAcceptedByPhone,
  getGraphChunk,
  initWorldCoords,
} from '../controllers/relationController';
import {
  checkAcceptedByPhoneSchema,
  createRelationSchema,
  getFullTreeSchema,
  getGraphChunkSchema,
  getTreeSchema,
  listRelationsSchema,
  relationIdSchema,
  relationLangOnlySchema,
  updateRelationSchema,
} from '../schemas/relationSchemas';

const router = Router();

router.use(authMiddleware);

/**
 * Maintenance endpoint. Previously sat behind plain `authMiddleware`, so any
 * signed-in user could trigger `prisma.user.findMany()` (every row, all columns)
 * followed by a separate UPDATE per user. Now admin-only, and disabled entirely
 * unless ADMIN_USER_IDS is configured.
 */
router.get('/init-coords', requireAdmin, asyncHandler(initWorldCoords));

// Spatial graph query: expensive, so it gets the tighter limiter.
router.get(
  '/chunk',
  heavyReadLimiter,
  validate(getGraphChunkSchema),
  asyncHandler(getGraphChunk)
);

// Must stay ahead of any '/:id' patterns.
router.get('/counts', readLimiter, asyncHandler(getRelationCounts));

router.get('/', readLimiter, validate(listRelationsSchema), asyncHandler(listRelations));
router.get('/tree', readLimiter, validate(getTreeSchema), asyncHandler(getTree));
router.get('/tree/full', heavyReadLimiter, validate(getFullTreeSchema), asyncHandler(getFullTree));
router.get('/requests', readLimiter, validate(relationLangOnlySchema), asyncHandler(getRequests));
router.get('/accepted', readLimiter, validate(relationLangOnlySchema), asyncHandler(getAcceptedRequests));
router.get(
  '/check-accepted',
  readLimiter,
  validate(checkAcceptedByPhoneSchema),
  asyncHandler(checkAcceptedByPhone)
);

router.post('/', writeLimiter, validate(createRelationSchema), asyncHandler(createRelation));
router.post('/:id/approve', writeLimiter, validate(relationIdSchema), asyncHandler(approveRelation));
router.post('/:id/reject', writeLimiter, validate(relationIdSchema), asyncHandler(rejectRelation));
router.patch('/:id', writeLimiter, validate(updateRelationSchema), asyncHandler(updateRelation));
router.delete('/:id', writeLimiter, validate(relationIdSchema), asyncHandler(deleteRelation));

export default router;
