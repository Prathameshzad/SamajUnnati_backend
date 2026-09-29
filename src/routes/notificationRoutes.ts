// src/routes/notificationRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import { validate } from '../middleware/validate';
import { asyncHandler } from '../lib/asyncHandler';
import { readLimiter, writeLimiter } from '../middleware/rateLimit';
import {
  listNotifications,
  getNotificationSummary,
  markNotificationRead,
  markAllNotificationsRead,
  registerPushToken,
  unregisterPushToken,
  sendTestPush,
} from '../controllers/notificationController';
import {
  listNotificationsSchema,
  notificationIdSchema,
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from '../schemas/miscSchemas';

const router = Router();

router.use(authMiddleware);

router.get('/', readLimiter, validate(listNotificationsSchema), asyncHandler(listNotifications));
router.get('/summary', readLimiter, asyncHandler(getNotificationSummary));

/**
 * Device push registration. `writeLimiter` applies because the client calls this
 * on every app start; it is idempotent, so the limiter is protection against a
 * looping client rather than against abuse.
 */
router.post(
  '/push-token',
  writeLimiter,
  validate(registerPushTokenSchema),
  asyncHandler(registerPushToken)
);
router.delete(
  '/push-token',
  writeLimiter,
  validate(unregisterPushTokenSchema),
  asyncHandler(unregisterPushToken)
);

/** Self-targeted delivery check. See controller for why it cannot target others. */
router.post('/push-test', writeLimiter, asyncHandler(sendTestPush));

// Literal path registered before the parameterised one.
router.patch('/read-all', writeLimiter, asyncHandler(markAllNotificationsRead));
router.patch(
  '/:id/read',
  writeLimiter,
  validate(notificationIdSchema),
  asyncHandler(markNotificationRead)
);

export default router;
