// src/lib/jwt.ts
import dotenv from 'dotenv';
import jwt, { SignOptions } from 'jsonwebtoken';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-please';

export interface JwtPayload {
  userId: string;
  phone: string;
}

export const signAuthToken = (
  payload: JwtPayload,
  expiresIn: SignOptions['expiresIn'] = '30d'
): string => {
  const signOptions: SignOptions = { expiresIn };
  return jwt.sign(payload, JWT_SECRET, signOptions);
};

export const verifyAuthToken = (token: string): JwtPayload => {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
};
