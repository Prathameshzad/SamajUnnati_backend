// src/lib/errors.ts
/**
 * Error taxonomy.
 *
 * Before: every controller ended in `catch (err) { console.error(err); res.status(500)... }`,
 * and several (postController, storyController, messageController) returned
 * `{ message: err.message }` — leaking Prisma internals, table names and
 * constraint names to clients. Some returned 500 for what were really 400s,
 * which makes real incidents impossible to spot in metrics.
 *
 * Now: controllers throw a typed error, and one handler decides the status code,
 * the client-visible message, and the log level.
 */

export type ErrorCode =
  | 'BAD_REQUEST'
  | 'VALIDATION_FAILED'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'SERVICE_UNAVAILABLE';

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  RATE_LIMITED: 429,
  INTERNAL: 500,
  SERVICE_UNAVAILABLE: 503,
};

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly status: number;
  /** Safe to send to the client. */
  public readonly expose: boolean;
  /** Extra machine-readable context (e.g. field errors). Must not contain secrets. */
  public readonly details?: unknown;
  /**
   * Underlying error, preserved for logging only — never serialised to clients.
   * Declared explicitly rather than using the native `Error.cause`, which needs
   * an ES2022 target (this project compiles to ES2020).
   */
  public readonly cause?: unknown;

  constructor(code: ErrorCode, message: string, options?: { details?: unknown; cause?: unknown }) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    // 5xx messages are intentionally hidden from clients; 4xx are actionable.
    this.expose = this.status < 500;
    this.details = options?.details;
    this.cause = options?.cause;
    Error.captureStackTrace?.(this, AppError);
  }
}

/* Convenience constructors — keep call sites terse and consistent. */
export const badRequest = (message = 'Bad request', details?: unknown) =>
  new AppError('BAD_REQUEST', message, { details });

export const validationFailed = (message = 'Validation failed', details?: unknown) =>
  new AppError('VALIDATION_FAILED', message, { details });

export const unauthenticated = (message = 'Authentication required') =>
  new AppError('UNAUTHENTICATED', message);

/**
 * Deliberately vague by default. Distinguishing "exists but forbidden" from
 * "does not exist" leaks the existence of other users' records.
 */
export const forbidden = (message = 'You do not have access to this resource') =>
  new AppError('FORBIDDEN', message);

export const notFound = (message = 'Resource not found') => new AppError('NOT_FOUND', message);

export const conflict = (message = 'Resource already exists') => new AppError('CONFLICT', message);

export const payloadTooLarge = (message = 'Payload too large') =>
  new AppError('PAYLOAD_TOO_LARGE', message);

export const unsupportedMediaType = (message = 'Unsupported file type') =>
  new AppError('UNSUPPORTED_MEDIA_TYPE', message);

export const rateLimited = (message = 'Too many requests', details?: unknown) =>
  new AppError('RATE_LIMITED', message, { details });

export const internal = (message = 'Internal server error', cause?: unknown) =>
  new AppError('INTERNAL', message, { cause });

export const serviceUnavailable = (message = 'Service temporarily unavailable', cause?: unknown) =>
  new AppError('SERVICE_UNAVAILABLE', message, { cause });

export const isAppError = (err: unknown): err is AppError =>
  err instanceof AppError || (typeof err === 'object' && err !== null && (err as any).name === 'AppError');
