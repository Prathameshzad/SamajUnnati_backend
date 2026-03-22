// src/lib/mediaUpload.ts
// Unified media upload: uses R2 if configured, falls back to local disk.
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

/**
 * Upload any multer file (image or video) and return a publicly accessible URL.
 * If Cloudflare R2 env vars are set, it uploads there.
 * Otherwise, it saves to /uploads/media/ and returns a local URL.
 */
export async function uploadMedia(file: Express.Multer.File): Promise<string> {
  const { r2Client, uploadProfileImageToR2 } = await import('./r2');

  // Use R2 ONLY if a public URL/domain is configured in env
  const publicDomain = process.env.CLOUDFLARE_R2_PUBLIC_DOMAIN;

  if (r2Client && publicDomain) {
    try {
      const url = await uploadProfileImageToR2(file);
      // Replace the private cloudflarestorage.com URL with the public domain
      // Old: https://<accountid>.r2.cloudflarestorage.com/<bucket>/<key>
      // New: https://your-public-domain.com/<key>
      const key = url.split('/').slice(-2).join('/'); // bucket/key or just key mapping? 
      // Most R2 public buckets map the root to the bucket root
      const actualKey = url.split('/').pop();
      const folder = url.split('/').slice(-2, -1)[0];
      return `${publicDomain}/${folder}/${actualKey}`;
    } catch (e) {
      console.warn('R2 upload failed, falling back to local disk:', e);
    }
  }

  // Fallback: save to local uploads/media/
  const ext = path.extname(file.originalname || 'file') || '.bin';
  const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
  const randomName = crypto.randomBytes(16).toString('hex');
  const fileName = `${Date.now()}-${randomName}${safeExt}`;

  const uploadDir = path.join(process.cwd(), 'uploads', 'media');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  const filePath = path.join(uploadDir, fileName);
  fs.writeFileSync(filePath, file.buffer);

  // Return a URL that will be served by express static
  const baseUrl = process.env.API_BASE_URL || `http://localhost:${process.env.PORT || 8000}`;
  return `${baseUrl}/uploads/media/${fileName}`;
}
