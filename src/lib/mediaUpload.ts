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

  if (r2Client) {
    try {
      const url = await uploadProfileImageToR2(file);
      return url;
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

  // Return a relative URL so the frontend can prepend the correct API base URL
  return `/uploads/media/${fileName}`;
}
