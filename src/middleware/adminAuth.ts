// src/middleware/adminAuth.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyAdminToken } from '../lib/adminJwt';
import { config } from '../config/env';
import { AppError, unauthenticated } from '../lib/errors';

export interface AdminRequest extends Request {
  admin?: { username: string };
}

/** The whole /api/admin surface is closed unless credentials are configured. */
export const adminEnabled = (_req: Request, _res: Response, next: NextFunction): void => {
  if (!config.admin.enabled) {
    next(new AppError('FORBIDDEN', 'Admin API is disabled'));
    return;
  }
  next();
};

export const adminAuth = (req: AdminRequest, _res: Response, next: NextFunction): void => {
  const match = /^Bearer[ ]+(.+)$/i.exec((req.headers.authorization ?? '').trim());
  if (!match) {
    next(unauthenticated('Missing admin token'));
    return;
  }
  try {
    const payload = verifyAdminToken(match[1].trim());
    req.admin = { username: payload.username };
    next();
  } catch {
    next(unauthenticated('Invalid or expired admin session'));
  }
};
