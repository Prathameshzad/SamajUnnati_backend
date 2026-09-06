// src/lib/asyncHandler.ts
import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wraps an async controller so a rejected promise reaches the central error
 * handler instead of becoming an unhandled rejection.
 *
 * Express 5 forwards rejections from async handlers automatically, but wrapping
 * explicitly keeps behaviour identical if the app is ever run under Express 4
 * and makes the intent obvious at the route definition.
 */
export const asyncHandler =
  <Req extends Request = Request>(
    handler: (req: Req, res: Response, next: NextFunction) => Promise<unknown> | unknown
  ): RequestHandler =>
  (req, res, next) => {
    void Promise.resolve(handler(req as unknown as Req, res, next)).catch(next);
  };
