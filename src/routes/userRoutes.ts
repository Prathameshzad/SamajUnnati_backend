import { Router } from 'express';
import { getMe, updateMe, getUserById } from '../controllers/userController';
import { authMiddleware } from '../middleware/authMiddleware';
import { uploadProfileImage } from '../middleware/uploadMiddleware';

const router = Router();

router.get('/me', authMiddleware, getMe);
router.put('/me', authMiddleware, uploadProfileImage, updateMe);
router.get('/:id', authMiddleware, getUserById);

export default router;
