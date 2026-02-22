// src/lib/r2.ts
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import path from 'path';
import crypto from 'crypto';

const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID;
const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
  console.warn(
    '⚠️ Cloudflare R2 env vars missing. Image upload will not work until these are set.'
  );
}

const endpoint = accountId
  ? `https://${accountId}.r2.cloudflarestorage.com`
  : undefined;

export const r2Client =
  endpoint && accessKeyId && secretAccessKey
    ? new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      })
    : null;

/**
 * Upload a profile image (Multer file in memory) to R2 and
 * return a public-style URL like:
 * https://<accountid>.r2.cloudflarestorage.com/<bucket>/<key>
 *
 * NOTE: Bucket must be configured public / via CDN for this URL
 * to be directly accessible from the app.
 */
export async function uploadProfileImageToR2(
  file: Express.Multer.File
): Promise<string> {
  if (!r2Client || !bucketName || !endpoint) {
    throw new Error('R2 client not configured');
  }

  const ext = path.extname(file.originalname) || '.jpg';
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const randomName = crypto.randomBytes(16).toString('hex');
  const key = `profile/${Date.now()}-${randomName}${safeExt}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    })
  );

  // Public-style URL
  return `${endpoint}/${bucketName}/${key}`;
}
