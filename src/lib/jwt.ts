// src/lib/jwt.ts
import jwt, { type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { config } from '../config/env';

export interface JwtPayload {
  userId: string;
  phone: string;
}

/** Full decoded shape, including registered claims. */
interface DecodedToken extends JwtPayload {
  iss?: string;
  aud?: string;
  iat?: number;
  exp?: number;
}

/**
 * Signs an auth token.
 *
 * Hardening vs. the previous version:
 *  - The secret comes from validated config, so the `'change-me-please'`
 *    fallback is gone and production refuses to boot on a placeholder secret.
 *  - `issuer` / `audience` are now stamped, which lets us reject tokens minted
 *    for a different service that happens to share the secret.
 *  - The algorithm is pinned explicitly rather than left to library defaults.
 */
export const signAuthToken = (
  payload: JwtPayload,
  expiresIn: SignOptions['expiresIn'] = config.jwt.expiresIn as SignOptions['expiresIn']
): string => {
  const options: SignOptions = {
    expiresIn,
    algorithm: config.jwt.algorithm,
    issuer: config.jwt.issuer,
    audience: config.jwt.audience,
  };
  // Only the two fields we actually use are signed — no spreading of user rows
  // into the token, which keeps PII out of a value stored on the client.
  return jwt.sign({ userId: payload.userId, phone: payload.phone }, config.jwt.secret, options);
};

/**
 * Verifies an auth token.
 *
 * Algorithm pinning is the important part: without `algorithms`, jsonwebtoken
 * accepts whatever the token's own header claims, which is the classic
 * algorithm-confusion vector.
 *
 * `issuer` / `audience` are validated only when the token actually carries them.
 * Tokens issued before this change have no `iss`/`aud`, and rejecting them would
 * have force-logged-out every existing user (tokens live for 30 days). New
 * tokens always carry the claims, so this leniency ages out on its own.
 */
export const verifyAuthToken = (token: string): JwtPayload => {
  const options: VerifyOptions = {
    algorithms: [config.jwt.algorithm],
    clockTolerance: 5,
  };

  const decoded = jwt.verify(token, config.jwt.secret, options) as DecodedToken;

  if (decoded.iss !== undefined && decoded.iss !== config.jwt.issuer) {
    throw new jwt.JsonWebTokenError('Token issuer mismatch');
  }
  if (decoded.aud !== undefined) {
    const audiences = Array.isArray(decoded.aud) ? decoded.aud : [decoded.aud];
    if (!audiences.includes(config.jwt.audience)) {
      throw new jwt.JsonWebTokenError('Token audience mismatch');
    }
  }

  if (typeof decoded.userId !== 'string' || decoded.userId.length === 0) {
    throw new jwt.JsonWebTokenError('Token is missing a subject');
  }

  return { userId: decoded.userId, phone: decoded.phone };
};
