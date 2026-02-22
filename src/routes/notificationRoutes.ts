// src/routes/notificationRoutes.ts
import { Router } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import {
  listNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../controllers/notificationController';

const router = Router();

router.get('/', authMiddleware, listNotifications);
router.patch('/:id/read', authMiddleware, markNotificationRead);
router.patch('/read-all', authMiddleware, markAllNotificationsRead);

export default router;
