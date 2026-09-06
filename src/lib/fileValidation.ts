// src/lib/fileValidation.ts
/**
 * Content-based file validation.
 *
 * The old checks were:
 *
 *   if (file.mimetype.startsWith('image/')) cb(null, true);
 *
 * `file.mimetype` is taken verbatim from the multipart `Content-Type` part
 * supplied by the client. It is trivially forged — `curl -F "photo=@shell.html;type=image/png"`
 * passes. Nothing ever inspected the actual bytes.
 *
 * That mattered because uploads land in a *public* R2 bucket and the object key
 * reused the client's own filename extension:
 *
 *   const ext = path.extname(file.originalname) || '.jpg';   // attacker-controlled
 *   const key = `profile/${Date.now()}-${randomName}${safeExt}`;
 *
 * So a file declared as `image/png` but named `payload.html` was stored as
 * `.html` on a public domain and served as HTML — stored XSS on the bucket
 * origin, with a valid-looking URL saved on the victim's profile. SVG has the
 * same problem: it is a legitimate image type that can carry `<script>`.
 *
 * This module sniffs magic bytes, requires the sniffed type to be in an explicit
 * allowlist, cross-checks it against the declared type, and derives the stored
 * extension from the *detected* type only.
 */
import { unsupportedMediaType, payloadTooLarge, badRequest } from './errors';
import { config } from '../config/env';

export type FileKind = 'image' | 'video' | 'document';

export interface DetectedType {
  mime: string;
  extension: string;
  kind: FileKind;
}

/** Reads an ASCII marker at a byte offset. */
const asciiAt = (buffer: Buffer, offset: number, length: number): string =>
  buffer.length >= offset + length ? buffer.subarray(offset, offset + length).toString('latin1') : '';

const startsWithBytes = (buffer: Buffer, bytes: number[]): boolean => {
  if (buffer.length < bytes.length) return false;
  return bytes.every((byte, index) => buffer[index] === byte);
};

/**
 * ISO base media format (MP4/MOV/HEIC) brand, found at offset 8 after 'ftyp'.
 * All of these share a container, so the brand is what distinguishes them.
 */
const isoBrand = (buffer: Buffer): string | null => {
  if (asciiAt(buffer, 4, 4) !== 'ftyp') return null;
  return asciiAt(buffer, 8, 4).trim().toLowerCase();
};

const ISO_IMAGE_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1', 'heim', 'heis']);
const ISO_VIDEO_BRANDS = new Set([
  'isom', 'iso2', 'iso4', 'iso5', 'iso6', 'mp41', 'mp42', 'avc1',
  'm4v ', 'm4v', 'mmp4', 'qt', 'dash', '3gp4', '3gp5', '3g2a',
]);

/**
 * Detects the true type from the leading bytes.
 * Returns null when the content does not match any allowed type — which is the
 * safe default: anything unrecognised is rejected rather than trusted.
 */
export function detectFileType(buffer: Buffer): DetectedType | null {
  if (buffer.length < 12) return null;

  /* ── Images ─────────────────────────────────────────────────────────────── */

  // JPEG: FF D8 FF
  if (startsWithBytes(buffer, [0xff, 0xd8, 0xff])) {
    return { mime: 'image/jpeg', extension: '.jpg', kind: 'image' };
  }

  // PNG: 89 'PNG' CR LF 1A LF
  if (startsWithBytes(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return { mime: 'image/png', extension: '.png', kind: 'image' };
  }

  // GIF: 'GIF87a' / 'GIF89a'
  if (asciiAt(buffer, 0, 3) === 'GIF') {
    return { mime: 'image/gif', extension: '.gif', kind: 'image' };
  }

  // RIFF container: WEBP (image) or AVI (video)
  if (asciiAt(buffer, 0, 4) === 'RIFF') {
    const form = asciiAt(buffer, 8, 4);
    if (form === 'WEBP') return { mime: 'image/webp', extension: '.webp', kind: 'image' };
    if (form === 'AVI ') return { mime: 'video/x-msvideo', extension: '.avi', kind: 'video' };
    return null;
  }

  // BMP: 'BM'
  if (startsWithBytes(buffer, [0x42, 0x4d])) {
    return { mime: 'image/bmp', extension: '.bmp', kind: 'image' };
  }

  /* ── ISO base media (HEIC images, MP4/MOV video) ────────────────────────── */

  const brand = isoBrand(buffer);
  if (brand !== null) {
    if (ISO_IMAGE_BRANDS.has(brand)) {
      return { mime: 'image/heic', extension: '.heic', kind: 'image' };
    }
    if (ISO_VIDEO_BRANDS.has(brand)) {
      const isQuickTime = brand === 'qt';
      return isQuickTime
        ? { mime: 'video/quicktime', extension: '.mov', kind: 'video' }
        : { mime: 'video/mp4', extension: '.mp4', kind: 'video' };
    }
    return null;
  }

  /* ── Other video ────────────────────────────────────────────────────────── */

  // Matroska / WebM (EBML header)
  if (startsWithBytes(buffer, [0x1a, 0x45, 0xdf, 0xa3])) {
    return { mime: 'video/webm', extension: '.webm', kind: 'video' };
  }

  /* ── Documents ──────────────────────────────────────────────────────────── */

  // '%PDF-'
  if (startsWithBytes(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d])) {
    return { mime: 'application/pdf', extension: '.pdf', kind: 'document' };
  }

  /**
   * Deliberately absent: SVG.
   *
   * SVG is XML and can contain <script> and event handlers. Served from the
   * public bucket origin it executes as same-origin content for that domain.
   * There is no safe way to accept it here without sanitising, so it is rejected.
   */

  return null;
}

/** Size ceiling per kind, so a 50MB limit is not applied to avatars. */
function maxBytesFor(kind: FileKind): number {
  switch (kind) {
    case 'image':
      return config.uploads.maxImageBytes;
    case 'video':
      return config.uploads.maxVideoBytes;
    case 'document':
      return config.uploads.maxDocumentBytes;
  }
}

const KIND_LABEL: Record<FileKind, string> = {
  image: 'image',
  video: 'video',
  document: 'document',
};

export interface ValidatedFile {
  detected: DetectedType;
  /** Safe object-storage extension, derived from content — never from the filename. */
  extension: string;
  /** Trustworthy MIME type to store and to send as Content-Type. */
  mime: string;
  kind: FileKind;
  sizeBytes: number;
}

/**
 * Validates a buffered upload against the allowed kinds.
 * Throws a typed AppError so the central handler produces a 415/413 rather than
 * a generic 500.
 */
export function validateUpload(
  file: Express.Multer.File,
  allowedKinds: readonly FileKind[]
): ValidatedFile {
  if (!file.buffer || file.buffer.length === 0) {
    throw badRequest('Uploaded file is empty');
  }

  const detected = detectFileType(file.buffer);

  if (!detected) {
    throw unsupportedMediaType(
      'File content is not a supported format. Allowed: JPEG, PNG, GIF, WebP, BMP, HEIC' +
        (allowedKinds.includes('video') ? ', MP4, MOV, WebM, AVI' : '') +
        (allowedKinds.includes('document') ? ', PDF' : '') +
        '.'
    );
  }

  if (!allowedKinds.includes(detected.kind)) {
    const expected = allowedKinds.map((kind) => KIND_LABEL[kind]).join(' or ');
    throw unsupportedMediaType(`Expected ${expected} but received ${KIND_LABEL[detected.kind]}.`);
  }

  /**
   * Cross-check the declared type against the sniffed one. A mismatch is not
   * necessarily an attack (some clients send application/octet-stream), so only
   * a contradictory *category* is rejected — e.g. bytes say PDF, client claimed
   * image/png.
   */
  const declared = (file.mimetype || '').toLowerCase();
  const declaredCategory = declared.split('/')[0];
  const detectedCategory = detected.mime.split('/')[0];
  const declaredIsGeneric =
    declared === '' || declared === 'application/octet-stream' || declared === 'application/binary';

  if (!declaredIsGeneric && declaredCategory !== detectedCategory) {
    // PDFs legitimately arrive declared as application/pdf under the 'document' kind.
    const pdfOk = detected.mime === 'application/pdf' && declared === 'application/pdf';
    if (!pdfOk) {
      throw unsupportedMediaType(
        `Declared file type (${declared}) does not match actual content (${detected.mime}).`
      );
    }
  }

  const maxBytes = maxBytesFor(detected.kind);
  if (file.size > maxBytes) {
    const limitMb = Math.round(maxBytes / (1024 * 1024));
    throw payloadTooLarge(`${KIND_LABEL[detected.kind]} exceeds the ${limitMb}MB limit.`);
  }

  return {
    detected,
    extension: detected.extension,
    mime: detected.mime,
    kind: detected.kind,
    sizeBytes: file.size,
  };
}

/** Validates a batch, reporting which item failed. */
export function validateUploads(
  files: Express.Multer.File[],
  allowedKinds: readonly FileKind[]
): ValidatedFile[] {
  return files.map((file, index) => {
    try {
      return validateUpload(file, allowedKinds);
    } catch (err) {
      if (err instanceof Error) {
        err.message = `File ${index + 1} (${sanitiseFilename(file.originalname)}): ${err.message}`;
      }
      throw err;
    }
  });
}

/**
 * Filename made safe for logs and error messages.
 * Raw `originalname` can contain path separators, control characters and
 * newlines (log injection), so it is never echoed unfiltered.
 */
export function sanitiseFilename(name: string | undefined): string {
  if (!name) return 'unnamed';
  return name
    .replace(/[\r\n\t]/g, ' ')
    .replace(/[/\\]/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, 100) || 'unnamed';
}
