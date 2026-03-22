// src/middleware/uploadMiddleware.ts
import multer from 'multer';
import type { Express } from 'express';

function imageFilter(
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

function mediaFilter(
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) {
  if (
    file.mimetype.startsWith('image/') ||
    file.mimetype.startsWith('video/') ||
    file.mimetype === 'application/pdf'
  ) {
    cb(null, true);
  } else {
    cb(new Error('Only image, video, or pdf files are allowed'));
  }
}

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: imageFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

const mediaUpload = multer({
  storage,
  fileFilter: mediaFilter,
  limits: { fileSize: 50 * 1024 * 1024 },
});

/** Middleware to handle single profile image upload. */
export const uploadProfileImage = upload.single('photo');

/** Configurable middleware object for use in routes */
export const uploadMiddleware = mediaUpload;
