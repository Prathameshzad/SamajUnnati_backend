// src/routes/friendRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter, heavyReadLimiter } from '../middleware/rateLimit';
import {
  getFriendTree,
  listFriends,
  createFriend,
  getFriendRequests,
  approveFriend,
  rejectFriend,
  deleteFriend,
} from '../controllers/friendController';
import {
  createRelationSchema,
  relationIdSchema,
  relationLangOnlySchema,
} from '../schemas/relationSchemas';

const router = Router();

router.use(authMiddleware);

// `createFriend` destructures exactly the same body shape as `createRelation`,
// so the schema is shared rather than duplicated.
router.get('/tree/full', heavyReadLimiter, validate(relationLangOnlySchema), asyncHandler(getFriendTree));
router.get('/requests', readLimiter, validate(relationLangOnlySchema), asyncHandler(getFriendRequests));
router.get('/', readLimiter, validate(relationLangOnlySchema), asyncHandler(listFriends));

router.post('/', writeLimiter, validate(createRelationSchema), asyncHandler(createFriend));
router.post('/:id/approve', writeLimiter, validate(relationIdSchema), asyncHandler(approveFriend));
router.post('/:id/reject', writeLimiter, validate(relationIdSchema), asyncHandler(rejectFriend));
router.delete('/:id', writeLimiter, validate(relationIdSchema), asyncHandler(deleteFriend));

export default router;
