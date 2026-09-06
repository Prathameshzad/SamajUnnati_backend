// src/lib/mediaUpload.ts
// Unified media upload: R2 when configured, local disk only as a development fallback.
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';
import { uploadToR2, r2Client, type UploadFolder } from './r2';
import { validateUpload, type FileKind, type ValidatedFile } from './fileValidation';
import { config } from '../config/env';
import { serviceUnavailable } from './errors';
import { createLogger } from './logger';

const log = createLogger('media-upload');

interface UploadMediaOptions {
  folder?: UploadFolder;
  allowedKinds?: readonly FileKind[];
  validated?: ValidatedFile;
}

/**
 * Uploads a media file and returns a URL.
 *
 * Changes from the previous version:
 *  - The local-disk fallback is now gated on ALLOW_LOCAL_UPLOAD_FALLBACK and is
 *    force-disabled in production. Previously any R2 hiccup silently wrote to the
 *    container filesystem: the data is lost on redeploy, disk usage is unbounded,
 *    and it does not work at all across multiple instances (a file written by one
 *    replica 404s when the next request hits another). Failing loudly is correct.
 *  - The filename extension is derived from sniffed content rather than from the
 *    client-supplied `file.originalname`.
 *  - `fs.writeFileSync` / `existsSync` replaced with the promise API so a large
 *    write no longer blocks the event loop.
 */
export async function uploadMedia(
  file: Express.Multer.File,
  options: UploadMediaOptions = {}
): Promise<string> {
  const validated =
    options.validated ?? validateUpload(file, options.allowedKinds ?? ['image', 'video']);

  if (r2Client) {
    try {
      return await uploadToR2(file, {
        folder: options.folder ?? 'posts',
        allowedKinds: options.allowedKinds,
        validated,
      });
    } catch (err) {
      if (!config.uploads.allowLocalFallback) {
        log.error({ err }, 'R2 upload failed and local fallback is disabled');
        throw serviceUnavailable('Media upload is temporarily unavailable, please try again');
      }
      log.warn({ err }, 'R2 upload failed, falling back to local disk (development only)');
    }
  } else if (!config.uploads.allowLocalFallback) {
    throw serviceUnavailable('Object storage is not configured');
  }

  const random = crypto.randomBytes(16).toString('hex');
  const fileName = `${Date.now()}-${random}${validated.extension}`;
  const uploadDir = path.join(process.cwd(), 'uploads', 'media');

  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, fileName), file.buffer);

  log.debug({ fileName, kind: validated.kind }, 'stored on local disk');
  return `/uploads/media/${fileName}`;
}
