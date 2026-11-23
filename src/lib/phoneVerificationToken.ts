// src/lib/phoneVerificationToken.ts
import jwt, { type SignOptions, type VerifyOptions } from 'jsonwebtoken';
import { config } from '../config/env';

/** How long a verified number can be used to complete registration. */
const EXPIRES_IN: SignOptions['expiresIn'] = '30m';

const audience = `${config.jwt.audience}-phone-verify`;

interface PhoneVerificationClaims {
  purpose: 'phone-verify';
  phone: string;
}

/**
 * Proof that `phone` (10-digit canonical form) passed an OTP check just now.
 *
 * `/auth/verify-otp` hands one out, and `/auth/register` requires it for the
 * primary number and for any secondary number. The audience differs from user
 * and admin tokens, so none of the three can be used in place of another.
 */
export const signPhoneVerificationToken = (phone: string): string =>
  jwt.sign({ purpose: 'phone-verify', phone } satisfies PhoneVerificationClaims, config.jwt.secret, {
    expiresIn: EXPIRES_IN,
    algorithm: config.jwt.algorithm,
    issuer: config.jwt.issuer,
    audience,
  });

/** Returns the verified 10-digit phone, or null if the token is missing, forged or expired. */
export const verifyPhoneVerificationToken = (token: unknown): string | null => {
  if (typeof token !== 'string' || token.length === 0) return null;
  const options: VerifyOptions = {
    algorithms: [config.jwt.algorithm],
    issuer: config.jwt.issuer,
    audience,
    clockTolerance: 5,
  };
  try {
    const decoded = jwt.verify(token, config.jwt.secret, options) as Partial<PhoneVerificationClaims>;
    return decoded.purpose === 'phone-verify' && typeof decoded.phone === 'string' ? decoded.phone : null;
  } catch {
    return null;
  }
};
