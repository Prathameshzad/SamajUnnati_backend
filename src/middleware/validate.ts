// src/middleware/validate.ts
/**
 * Request validation.
 *
 * Previously there was none. Controllers destructured `req.body` and passed the
 * values to Prisma directly, which produced several classes of problem:
 *
 *  - Unbounded strings. `caption`, `content`, `bio`, `address` and friends had no
 *    length limit, so a single request could store megabytes of text per row.
 *  - Unvalidated pagination. `messageController.getMessages` used
 *    `Number(req.query.limit) || 50` with no ceiling, so `?limit=1000000` was a
 *    denial-of-service primitive. `getFullTree` took `depth` straight from the
 *    query string and used it as a BFS bound.
 *  - Mass assignment. Whole `req.body` objects reached `prisma.update`, so any
 *    column named in the body could be written whether or not it was intended
 *    to be user-editable.
 *  - Type confusion. `Number(...)`/`String(...)` coercions were scattered and
 *    inconsistent, and `NaN` reached Prisma in some paths.
 *
 * Validated values are written back onto the request, so controllers receive
 * parsed, coerced, trimmed, whitelisted data. Unknown keys are stripped, which is
 * what closes the mass-assignment hole.
 */
import type { RequestHandler } from 'express';
import { ZodError, type ZodType } from 'zod';
import { validationFailed } from '../lib/errors';

export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Flattens Zod issues into a compact, client-safe shape. */
function formatIssues(error: ZodError): Array<{ field: string; message: string }> {
  return error.issues.map((issue) => ({
    field: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message,
  }));
}

/**
 * `req.query` is a lazy getter in Express 5, so plain assignment is unreliable.
 * Defining the property directly on the request instance works in both v4 and v5.
 */
function overwrite(req: any, key: 'body' | 'query' | 'params', value: unknown): void {
  try {
    Object.defineProperty(req, key, {
      value,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } catch {
    // Extremely defensive: if the property is locked down, expose it separately
    // so the controller can still reach the validated data.
    req[`validated_${key}`] = value;
  }
}

export function validate(schemas: RequestSchemas): RequestHandler {
  return (req, _res, next) => {
    const issues: Array<{ field: string; message: string }> = [];

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);
      if (result.success) overwrite(req, 'params', result.data);
      else issues.push(...formatIssues(result.error).map((i) => ({ ...i, field: `params.${i.field}` })));
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);
      if (result.success) overwrite(req, 'query', result.data);
      else issues.push(...formatIssues(result.error).map((i) => ({ ...i, field: `query.${i.field}` })));
    }

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body ?? {});
      if (result.success) overwrite(req, 'body', result.data);
      else issues.push(...formatIssues(result.error));
    }

    if (issues.length > 0) {
      next(validationFailed('Request validation failed', issues));
      return;
    }

    next();
  };
}

/**
 * Validation for multipart routes.
 *
 * `multer` populates `req.body` with string values only, so numeric and boolean
 * fields must be coerced. Schemas passed here should use `z.coerce.*`.
 * Kept as a distinct export purely for intent at the call site.
 */
export const validateMultipart = (schemas: RequestSchemas): RequestHandler => validate(schemas);
