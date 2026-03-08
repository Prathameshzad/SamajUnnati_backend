// src/routes/authRoutes.ts
import { Router } from 'express';
import { checkPhone, registerUser, requestOtp, verifyOtp } from '../controllers/authController';
import { uploadProfileImage } from '../middleware/uploadMiddleware';

const router = Router();

router.post('/check-phone', checkPhone);
router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/register', uploadProfileImage, registerUser);

export default router;
