// src/middleware/errorHandler.ts
/**
 * One place that converts any thrown value into an HTTP response.
 *
 * Replaces:
 *  - the two partial error handlers in index.ts (a JSON-syntax one registered
 *    *before* the routes, so it never fired for route errors, and a Multer one after),
 *  - ~60 per-controller `catch` blocks that each invented their own status code
 *    and, in several cases, returned `err.message` straight to the client.
 */
import type { ErrorRequestHandler, RequestHandler } from 'express';
import { MulterError } from 'multer';
import { AppError, isAppError } from '../lib/errors';
import { config } from '../config/env';

/** Prisma error codes we can translate into meaningful client responses. */
function fromPrisma(err: any): AppError | null {
  const code = err?.code;
  if (typeof code !== 'string' || !code.startsWith('P')) return null;

  switch (code) {
    case 'P2002':
      // Unique constraint. Do not echo `err.meta.target` — it exposes column names.
      return new AppError('CONFLICT', 'A record with these details already exists');
    case 'P2025':
      return new AppError('NOT_FOUND', 'Resource not found');
    case 'P2003':
      return new AppError('BAD_REQUEST', 'Referenced record does not exist');
    case 'P2000':
      return new AppError('BAD_REQUEST', 'A provided value is too long');
    case 'P2023':
      return new AppError('BAD_REQUEST', 'Malformed identifier');
    default:
      return null;
  }
}

function fromMulter(err: MulterError): AppError {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return new AppError('PAYLOAD_TOO_LARGE', 'File is larger than the allowed size');
    case 'LIMIT_FILE_COUNT':
      return new AppError('BAD_REQUEST', 'Too many files uploaded');
    case 'LIMIT_UNEXPECTED_FILE':
      return new AppError('BAD_REQUEST', `Unexpected file field "${err.field ?? ''}"`.trim());
    case 'LIMIT_FIELD_COUNT':
    case 'LIMIT_FIELD_KEY':
    case 'LIMIT_FIELD_VALUE':
      return new AppError('BAD_REQUEST', 'Form data exceeds allowed limits');
    case 'LIMIT_PART_COUNT':
      return new AppError('BAD_REQUEST', 'Too many form parts');
    default:
      return new AppError('BAD_REQUEST', 'File upload rejected');
  }
}

function normalise(err: unknown): AppError {
  if (isAppError(err)) return err as AppError;

  if (err instanceof MulterError) return fromMulter(err);

  const prismaError = fromPrisma(err);
  if (prismaError) return prismaError;

  // express.json() body parse failure
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in (err as any)) {
    return new AppError('BAD_REQUEST', 'Request body is not valid JSON');
  }

  // express.json() size limit
  if ((err as any)?.type === 'entity.too.large') {
    return new AppError('PAYLOAD_TOO_LARGE', 'Request body is too large');
  }

  if ((err as any)?.name === 'TokenExpiredError') {
    return new AppError('UNAUTHENTICATED', 'Session expired, please sign in again');
  }
  if ((err as any)?.name === 'JsonWebTokenError' || (err as any)?.name === 'NotBeforeError') {
    return new AppError('UNAUTHENTICATED', 'Invalid authentication token');
  }

  return new AppError('INTERNAL', 'Internal server error', { cause: err });
}

/** Terminal 404 for unmatched routes, so unknown paths are logged consistently. */
export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new AppError('NOT_FOUND', `Route ${req.method} ${req.path} does not exist`));
};

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const appError = normalise(err);
  const log = (req as any).log ?? console;

  const context = {
    err: appError.status >= 500 ? (appError.cause ?? appError) : undefined,
    code: appError.code,
    status: appError.status,
    method: req.method,
    // req.route?.path is the pattern (e.g. /:id), so IDs are not logged as raw values
    route: (req as any).route?.path ?? req.path,
    userId: (req as any).user?.id,
  };

  if (appError.status >= 500) {
    log.error?.(context, appError.message);
  } else if (appError.status === 429) {
    log.warn?.(context, appError.message);
  } else {
    log.debug?.(context, appError.message);
  }

  // Headers already flushed (e.g. failure mid-stream): nothing safe to send.
  if (res.headersSent) {
    res.destroy();
    return;
  }

  res.status(appError.status).json({
    status: 'error',
    code: appError.code,
    // 5xx never exposes internals; 4xx messages are written to be user-facing.
    message: appError.expose ? appError.message : 'Internal server error',
    ...(appError.details !== undefined ? { details: appError.details } : {}),
    requestId: (req as any).id,
    // Stack traces only outside production, and only for genuine 5xx.
    ...(!config.isProduction && appError.status >= 500
      ? { debug: (appError.cause as any)?.message ?? appError.message }
      : {}),
  });
};
