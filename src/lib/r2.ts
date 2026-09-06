// src/lib/r2.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import crypto from 'crypto';
import { config } from './../config/env';
import { validateUpload, type FileKind, type ValidatedFile } from './fileValidation';
import { internal, serviceUnavailable } from './errors';
import { createLogger } from './logger';

const log = createLogger('r2');

const endpoint = config.r2.accountId
  ? `https://${config.r2.accountId}.r2.cloudflarestorage.com`
  : undefined;

export const r2Client =
  config.r2.enabled && endpoint
    ? new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: config.r2.accessKeyId!,
          secretAccessKey: config.r2.secretAccessKey!,
        },
        maxAttempts: 3,
        requestHandler: { requestTimeout: 30_000 } as any,
      })
    : null;

if (!config.r2.enabled) {
  // In production the env validator already refuses to boot without R2.
  log.warn('R2 is not configured; uploads will use the local-disk fallback');
}

/** Object key prefixes, so bucket lifecycle rules can target each class of asset. */
export type UploadFolder = 'profile' | 'posts' | 'stories' | 'messages' | 'groups';

/**
 * Builds the storage key.
 *
 * The previous implementation was:
 *
 *   const ext = path.extname(file.originalname) || '.jpg';
 *   const key = `profile/${Date.now()}-${randomName}${safeExt}`;
 *
 * `file.originalname` is client-controlled, so the stored extension was too.
 * On a public bucket that means an uploaded file could be stored as `.html`,
 * `.svg` or `.xhtml` and be served as active content from the bucket's origin.
 *
 * The extension now comes from the sniffed content type only, and the rest of
 * the key is server-generated — no part of the client's filename reaches it.
 */
function buildKey(folder: UploadFolder, extension: string): string {
  const random = crypto.randomBytes(16).toString('hex');
  // Date-partitioned so the bucket stays browsable and lifecycle rules are simple.
  const now = new Date();
  const datePath = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${folder}/${datePath}/${Date.now()}-${random}${extension}`;
}

interface UploadOptions {
  folder?: UploadFolder;
  allowedKinds?: readonly FileKind[];
  /** Pre-computed validation from the upload middleware; re-validated if absent. */
  validated?: ValidatedFile;
}

/**
 * Uploads a buffered file to R2 and returns its public URL.
 */
export async function uploadToR2(
  file: Express.Multer.File,
  options: UploadOptions = {}
): Promise<string> {
  if (!r2Client || !config.r2.bucketName) {
    throw serviceUnavailable('Object storage is not configured');
  }
  if (!config.r2.publicDomain) {
    throw internal('CLOUDFLARE_R2_PUBLIC_DOMAIN is not set; cannot build a public URL');
  }

  // Defence in depth: validate here too, so a caller that forgets the
  // validateFiles middleware still cannot store unchecked content.
  const validated = options.validated ?? validateUpload(file, options.allowedKinds ?? ['image']);

  const key = buildKey(options.folder ?? 'profile', validated.extension);

  await r2Client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: file.buffer,
      // Sniffed type, not the client's claim.
      ContentType: validated.mime,
      /**
       * Keys are unique and content never changes, so responses are immutable.
       * This lets Cloudflare's edge and browsers cache aggressively, which takes
       * image traffic off the origin entirely.
       */
      CacheControl: 'public, max-age=31536000, immutable',
      /**
       * Forces a download rather than in-browser rendering for documents.
       * Combined with rejecting SVG, this removes the stored-XSS path via the
       * public bucket origin.
       */
      ...(validated.kind === 'document' ? { ContentDisposition: 'attachment' } : {}),
    })
  );

  log.debug({ key, kind: validated.kind, sizeBytes: validated.sizeBytes }, 'uploaded to R2');
  return `${config.r2.publicDomain}/${key}`;
}

/**
 * Backwards-compatible wrapper for existing call sites
 * (authController.registerUser, userController.updateMe, uploadController).
 */
export async function uploadProfileImageToR2(
  file: Express.Multer.File,
  validated?: ValidatedFile
): Promise<string> {
  return uploadToR2(file, { folder: 'profile', allowedKinds: ['image'], validated });
}
