import { Router } from 'express';
import { uploadImage } from '../controllers/uploadController';
import { uploadProfileImage } from '../middleware/uploadMiddleware';

const router = Router();

router.post('/', uploadProfileImage, uploadImage);

export default router;
