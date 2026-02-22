// src/middleware/uploadMiddleware.ts
import multer from 'multer';
import type { Express } from 'express';

function fileFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed'));
  }
}

// Use memory storage so we can push buffer to R2
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

/**
 * Middleware to handle single profile image upload.
 * Frontend should send file field as "photo".
 */
export const uploadProfileImage = upload.single('photo');
