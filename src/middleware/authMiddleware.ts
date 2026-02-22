// src/middleware/authMiddleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAuthToken, JwtPayload } from '../lib/jwt';

export interface AuthUser {
  id: string;
  phone: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

export const authMiddleware = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing token' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload: JwtPayload = verifyAuthToken(token);
    req.user = { id: payload.userId, phone: payload.phone };
    return next();
  } catch (err) {
    console.error('JWT error', err);
    return res.status(401).json({ message: 'Invalid token' });
  }
};
