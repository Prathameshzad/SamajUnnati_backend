// src/middleware/authMiddleware.ts
import type { Request, Response, NextFunction } from 'express';
import { verifyAuthToken, type JwtPayload } from '../lib/jwt';
import { AppError, forbidden, unauthenticated } from '../lib/errors';
import { config } from '../config/env';
import { RedisService } from '../services/redisService';
import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('auth');

export interface AuthUser {
  id: string;
  phone: string;
}

export interface AuthRequest<
  P = Record<string, string>,
  ResBody = any,
  ReqBody = any,
  ReqQuery = any
> extends Request<P, ResBody, ReqBody, ReqQuery> {
  user?: AuthUser;
}

/** Cached "is this account still usable" answer, to avoid a DB hit per request. */
const ACCOUNT_STATUS_TTL_SECONDS = 60;
type AccountStatus = { active: boolean };

/**
 * A valid token is not sufficient on its own: tokens live for 30 days, so a
 * soft-deleted account would keep working for the remainder of that window.
 *
 * This is checked through a short-lived Redis entry so the common case costs one
 * Redis GET rather than a Postgres round-trip. On infrastructure failure it
 * fails *open* (request proceeds) and logs — an outage should not lock every
 * user out of the app.
 */
async function isAccountActive(userId: string, reqLog: any): Promise<boolean> {
  const key = `auth:status:${userId}`;
  try {
    const cached = await RedisService.get<AccountStatus>(key);
    if (cached !== null) return cached.active;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, deletedAt: true },
    });
    const active = Boolean(user) && user!.deletedAt === null;
    await RedisService.set(key, { active } satisfies AccountStatus, ACCOUNT_STATUS_TTL_SECONDS);
    return active;
  } catch (err) {
    (reqLog ?? log).warn({ err }, 'account status check unavailable, allowing request');
    return true;
  }
}

/** Clears the cached status so a deletion or block takes effect immediately. */
export const invalidateAccountStatus = (userId: string): Promise<number> =>
  RedisService.del(`auth:status:${userId}`);

function extractBearer(header: string | undefined): string | null {
  if (!header) return null;
  // Case-insensitive scheme, tolerant of extra whitespace.
  const match = /^Bearer[ ]+(.+)$/i.exec(header.trim());
  if (!match) return null;
  const token = match[1].trim();
  return token.length > 0 ? token : null;
}

/**
 * Requires a valid bearer token.
 *
 * Changes vs. the previous version:
 *  - Errors go through the central handler instead of ad-hoc `res.status(401)`,
 *    so responses share one shape and are logged once with the request ID.
 *  - `console.error('JWT error', err)` is gone. It logged the full error for
 *    every expired token, which is routine, not exceptional — pure log noise
 *    that also hindered spotting real problems.
 *  - Verifies the account is still active (see `isAccountActive`).
 */
export const authMiddleware = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractBearer(req.headers.authorization);

  if (!token) {
    next(unauthenticated('Missing authentication token'));
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyAuthToken(token);
  } catch (err) {
    // Expired/invalid tokens are normal client behaviour: debug, not error.
    (req as any).log?.debug({ err: (err as Error).name }, 'token rejected');
    next(unauthenticated('Invalid or expired session'));
    return;
  }

  if (!(await isAccountActive(payload.userId, (req as any).log))) {
    next(unauthenticated('Account is no longer active'));
    return;
  }

  req.user = { id: payload.userId, phone: payload.phone };
  next();
};

/**
 * Attaches `req.user` when a valid token is present but never rejects.
 * For endpoints whose response varies by viewer without requiring sign-in.
 */
export const optionalAuth = async (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  const token = extractBearer(req.headers.authorization);
  if (!token) {
    next();
    return;
  }
  try {
    const payload = verifyAuthToken(token);
    if (await isAccountActive(payload.userId, (req as any).log)) {
      req.user = { id: payload.userId, phone: payload.phone };
    }
  } catch {
    // Ignored by design.
  }
  next();
};

/**
 * Gates maintenance endpoints behind an explicit allowlist.
 *
 * `GET /api/relations/init-coords` previously sat behind plain `authMiddleware`,
 * so any signed-in user could trigger a full-table scan and a write per user row.
 * With `ADMIN_USER_IDS` empty (the default) the endpoint is closed to everyone.
 */
export const requireAdmin = (req: AuthRequest, _res: Response, next: NextFunction): void => {
  const userId = req.user?.id;
  if (!userId) {
    next(unauthenticated());
    return;
  }
  if (config.adminUserIds.size === 0) {
    log.warn({ userId }, 'admin endpoint blocked: ADMIN_USER_IDS is not configured');
    next(new AppError('FORBIDDEN', 'This endpoint is disabled'));
    return;
  }
  if (!config.adminUserIds.has(userId)) {
    log.warn({ userId }, 'non-admin attempted admin endpoint');
    next(forbidden());
    return;
  }
  next();
};
