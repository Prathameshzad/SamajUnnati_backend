// src/lib/adminJwt.ts
import jwt, { type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { config } from '../config/env';

export interface AdminJwtPayload {
  role: 'admin';
  username: string;
}

/**
 * Admin tokens share the signing secret with user tokens but carry a different
 * audience and a `role` claim instead of `userId`. That makes the two
 * non-interchangeable in both directions: `verifyAuthToken` rejects an admin
 * token (audience mismatch, no userId) and `verifyAdminToken` rejects a user
 * token (wrong audience, no admin role).
 */
export const signAdminToken = (username: string): string => {
  const options: SignOptions = {
    expiresIn: config.admin.tokenExpiresIn as SignOptions['expiresIn'],
    algorithm: config.jwt.algorithm,
    issuer: config.jwt.issuer,
    audience: config.admin.audience,
  };
  return jwt.sign({ role: 'admin', username } satisfies AdminJwtPayload, config.jwt.secret, options);
};

export const verifyAdminToken = (token: string): AdminJwtPayload => {
  const options: VerifyOptions = {
    algorithms: [config.jwt.algorithm],
    issuer: config.jwt.issuer,
    audience: config.admin.audience,
    clockTolerance: 5,
  };
  const decoded = jwt.verify(token, config.jwt.secret, options) as Partial<AdminJwtPayload>;
  if (decoded.role !== 'admin' || typeof decoded.username !== 'string') {
    throw new jwt.JsonWebTokenError('Not an admin token');
  }
  return { role: 'admin', username: decoded.username };
};
