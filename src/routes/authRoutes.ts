// src/routes/authRoutes.ts
import { Router } from 'express';
import { checkPhone, registerUser } from '../controllers/authController';
import { uploadProfileImage } from '../middleware/uploadMiddleware';

const router = Router();

router.post('/check-phone', checkPhone);
router.post('/register',uploadProfileImage, registerUser);

export default router;
