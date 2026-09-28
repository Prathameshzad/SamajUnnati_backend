// src/controllers/mediaController.ts
import { Request, Response } from 'express';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import type { Readable } from 'stream';
import { r2Client } from '../lib/r2';
import { config } from '../config/env';
import { badRequest, notFound, serviceUnavailable } from '../lib/errors';
import { createLogger } from '../lib/logger';

const log = createLogger('media-proxy');

/**
 * Only keys this application itself writes. `buildKey` in lib/r2.ts and
 * `uploadMedia` in lib/mediaUpload.ts are the only writers, and both prefix with
 * one of these folders. Restricting to them stops this endpoint from becoming a
 * general-purpose reader for anything that ends up in the bucket.
 */
const ALLOWED_PREFIX = /^(profile|posts|stories|messages|groups)\//;

/**
 * Streams an R2 object through the API origin.
 *
 * Why this exists: profile images are stored on the bucket's public domain
 * (CLOUDFLARE_R2_PUBLIC_DOMAIN, e.g. `pub-<id>.r2.dev`) and the clients embed
 * that URL directly. That only renders if the *device* can reach that host on
 * the open internet, which is a separate requirement from reaching this API.
 * It fails when the phone is on a dev-machine hotspot with no upstream, on
 * networks that block or throttle `r2.dev`, and when Cloudflare rate-limits the
 * public development subdomain. In every one of those cases the upload succeeds,
 * the URL is stored, and the image silently never appears.
 *
 * The device has demonstrably reached this API (it authenticated through it), so
 * serving the same bytes from here is a reliable retry path. Clients use it as a
 * fallback, not as the primary source, so the happy path still goes edge-cached
 * straight from Cloudflare and this adds no origin traffic.
 *
 * NOTE ON ACCESS: this is deliberately unauthenticated, matching the objects it
 * serves — they are already world-readable on the public bucket domain, so this
 * exposes nothing that a plain GET to that domain would not. It is prefix-scoped
 * and rate-limited. If the bucket is ever made private, this route must gain
 * `authMiddleware` at the same time.
 */
export const proxyMedia = async (req: Request, res: Response): Promise<void> => {
  if (!r2Client || !config.r2.bucketName) {
    throw serviceUnavailable('Object storage is not configured');
  }

  const rawKey = req.query.key;
  const key = typeof rawKey === 'string' ? rawKey.trim() : '';

  // Path traversal is not meaningful against S3-style flat keys, but rejecting
  // `..` and absolute keys keeps the accepted shape identical to what we write.
  if (
    !key ||
    key.length > 512 ||
    key.startsWith('/') ||
    key.includes('..') ||
    !ALLOWED_PREFIX.test(key)
  ) {
    throw badRequest('Invalid media key');
  }

  const range = typeof req.headers.range === 'string' ? req.headers.range : undefined;

  let object;
  try {
    object = await r2Client.send(
      new GetObjectCommand({
        Bucket: config.r2.bucketName,
        Key: key,
        ...(range ? { Range: range } : {}),
      })
    );
  } catch (err: any) {
    const status = err?.$metadata?.httpStatusCode;
    if (status === 404 || err?.name === 'NoSuchKey') {
      throw notFound('Media not found');
    }
    log.error({ err, key }, 'media proxy could not read object');
    throw serviceUnavailable('Unable to fetch media');
  }

  const body = object.Body as Readable | undefined;
  if (!body) throw notFound('Media not found');

  if (object.ContentType) res.setHeader('Content-Type', object.ContentType);
  if (object.ContentLength !== undefined) {
    res.setHeader('Content-Length', String(object.ContentLength));
  }
  if (object.ETag) res.setHeader('ETag', object.ETag);
  if (object.ContentRange) res.setHeader('Content-Range', object.ContentRange);
  res.setHeader('Accept-Ranges', 'bytes');
  // Keys are content-addressed and never rewritten, so the object is immutable.
  res.setHeader('Cache-Control', object.CacheControl ?? 'public, max-age=31536000, immutable');

  if (range && object.ContentRange) res.status(206);

  // A stream error after headers are flushed cannot become a JSON error response;
  // destroying the socket is the only correct signal to the client.
  body.on('error', (err) => {
    log.error({ err, key }, 'media proxy stream failed mid-response');
    res.destroy(err);
  });

  body.pipe(res);
};
