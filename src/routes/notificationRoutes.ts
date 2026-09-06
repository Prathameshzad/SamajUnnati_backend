// src/routes/notificationRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter } from '../middleware/rateLimit';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController';
import { listNotificationsSchema, notificationIdSchema } from '../schemas/miscSchemas';

const router = Router();

router.use(authMiddleware);

router.get('/', readLimiter, validate(listNotificationsSchema), asyncHandler(listNotifications));

// Literal path registered before the parameterised one.
router.patch('/read-all', writeLimiter, asyncHandler(markAllNotificationsRead));
router.patch(
  '/:id/read',
  writeLimiter,
  validate(notificationIdSchema),
  asyncHandler(markNotificationRead)
);

export default router;
