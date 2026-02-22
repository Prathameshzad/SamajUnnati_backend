// src/routes/userRoutes.ts
import { Router } from 'express';
import { getMe, updateMe } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadProfileImage } from '../middleware/uploadMiddleware';

const router = Router();

router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, uploadProfileImage,updateMe);

export default router;
