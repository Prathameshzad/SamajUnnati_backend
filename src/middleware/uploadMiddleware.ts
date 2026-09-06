// src/middleware/uploadMiddleware.ts
/**
 * Multipart upload handling.
 *
 * Multer's `fileFilter` runs before any bytes are read, so it can only ever see
 * client-declared metadata. It is used here purely as a cheap first pass (cap
 * obviously-wrong types early, before buffering 50MB); the authoritative check
 * is the content sniffing in `validateFiles`, which runs after multer has
 * buffered the file.
 *
 * Also fixed here: the profile-image handler was `upload.any()` with no file
 * count limit and no field-name restriction, so a single request could carry an
 * unbounded number of files under arbitrary field names.
 */
import multer from 'multer';
import type { RequestHandler } from 'express';
import { config } from '../config/env';
import {
  validateUploads,
  sanitiseFilename,
  type FileKind,
  type ValidatedFile,
} from '../lib/fileValidation';
import { badRequest } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('upload');

/** Field names the app actually uses. Anything else is rejected outright. */
const ALLOWED_FIELDS = new Set(['photo', 'image', 'avatar', 'media', 'file']);

/** Coarse pre-filter on the declared type. Real validation happens post-buffer. */
function declaredTypeFilter(allowed: readonly FileKind[]) {
  return (
    _req: Express.Request,
    file: Express.Multer.File,
    cb: multer.FileFilterCallback
  ): void => {
    if (!ALLOWED_FIELDS.has(file.fieldname)) {
      cb(badRequest(`Unexpected upload field "${sanitiseFilename(file.fieldname)}"`));
      return;
    }

    const declared = (file.mimetype || '').toLowerCase();
    const category = declared.split('/')[0];
    const permitted =
      (allowed.includes('image') && category === 'image') ||
      (allowed.includes('video') && category === 'video') ||
      (allowed.includes('document') && declared === 'application/pdf') ||
      // Some clients send a generic type; content sniffing will settle it.
      declared === '' ||
      declared === 'application/octet-stream';

    if (!permitted) {
      cb(badRequest('Unsupported file type'));
      return;
    }
    cb(null, true);
  };
}

const storage = multer.memoryStorage();

/** Profile/avatar images: one file, image-only, image size cap. */
const imageUpload = multer({
  storage,
  fileFilter: declaredTypeFilter(['image']),
  limits: {
    fileSize: config.uploads.maxImageBytes,
    files: 1,
    fields: 40,
    parts: 45,
  },
});

/** Post/story/message media: images, video or PDF, video size cap. */
const mediaUpload = multer({
  storage,
  fileFilter: declaredTypeFilter(['image', 'video', 'document']),
  limits: {
    fileSize: config.uploads.maxVideoBytes,
    files: 10,
    fields: 30,
    parts: 45,
  },
});

/** Normalises multer's several output shapes into one array. */
export function collectFiles(req: any): Express.Multer.File[] {
  if (Array.isArray(req.files)) return req.files as Express.Multer.File[];
  if (req.files && typeof req.files === 'object') {
    return Object.values(req.files as Record<string, Express.Multer.File[]>).flat();
  }
  if (req.file) return [req.file as Express.Multer.File];
  return [];
}

/**
 * Content validation. Mount immediately after the multer handler.
 *
 * Attaches `req.validatedFiles`, a parallel array of trustworthy type
 * information that upload helpers use instead of `file.mimetype` /
 * `file.originalname`.
 */
export function validateFiles(
  allowed: readonly FileKind[],
  options: { required?: boolean } = {}
): RequestHandler {
  return (req, _res, next) => {
    const files = collectFiles(req);

    if (files.length === 0) {
      if (options.required) {
        next(badRequest('A file is required'));
        return;
      }
      (req as any).validatedFiles = [];
      next();
      return;
    }

    try {
      const validated = validateUploads(files, allowed);
      (req as any).validatedFiles = validated;

      // Map each file to its validated counterpart so downstream helpers can
      // look it up without relying on array index bookkeeping.
      const byFile = new WeakMap<Express.Multer.File, ValidatedFile>();
      files.forEach((file, index) => byFile.set(file, validated[index]));
      (req as any).validatedFileMap = byFile;

      log.debug(
        { count: validated.length, kinds: validated.map((v) => v.kind) },
        'uploads validated'
      );
      next();
    } catch (err) {
      next(err);
    }
  };
}

/* ── Route-ready middleware ───────────────────────────────────────────────── */

/** Single profile image, content-verified. */
export const uploadProfileImage: RequestHandler[] = [
  imageUpload.any(),
  validateFiles(['image']),
];

/** Single required media file (stories). */
export const uploadSingleMedia = (field: string): RequestHandler[] => [
  mediaUpload.single(field),
  validateFiles(['image', 'video'], { required: true }),
];

/** Single optional media file (chat messages, group photos). */
export const uploadOptionalMedia = (field: string, allowed: readonly FileKind[] = ['image', 'video', 'document']): RequestHandler[] => [
  mediaUpload.single(field),
  validateFiles(allowed),
];

/** Multiple media files (posts). */
export const uploadMediaArray = (field: string, maxCount: number): RequestHandler[] => [
  mediaUpload.array(field, maxCount),
  validateFiles(['image', 'video'], { required: true }),
];

/**
 * Raw multer instances, retained for any route that needs bespoke wiring.
 * Prefer the composed arrays above — they include content validation.
 */
export const rawUpload = { imageUpload, mediaUpload };
