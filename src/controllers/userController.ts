// src/controllers/userController.ts
import { Response } from 'express';
import type { Express } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest, invalidateAccountStatus } from '../middleware/authMiddleware';
import { uploadProfileImageToR2 } from '../lib/r2';
import { TreeCacheService } from '../services/treeCacheService';
import { getUserBadgeData } from '../services/badgeService';
import { notFound, unauthenticated, badRequest } from '../lib/errors';
import { OtpService } from '../services/otpService';
import { signAuthToken } from '../lib/jwt';
import { createLogger } from '../lib/logger';

const log = createLogger('users');

type GenderValue = 'MALE' | 'FEMALE';

function normalizeGender(gender?: string | null): GenderValue | null {
  if (!gender) return null;
  const g = gender.toUpperCase();
  if (g === 'MALE' || g === 'FEMALE') return g;
  return null;
}

/**
 * Fields safe to expose about any user to any authenticated caller. Excludes
 * phone, email, address, pincode, whatsapp, dateOfBirth and bloodGroup — those
 * are PII and previously leaked to every viewer via an unselected `findUnique`.
 */
const PUBLIC_SAFE_SELECT = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  photoUrl: true,
  bannerUrl: true,
  gender: true,
  isAlive: true,
  bio: true,
  occupation: true,
  education: true,
  designation: true,
  area: true,
  createdAt: true,
} as const;

/** Owner viewing their own profile through this endpoint also gets contact fields. */
const OWNER_SAFE_SELECT = {
  ...PUBLIC_SAFE_SELECT,
  phone: true,
  email: true,
} as const;

export const getMe = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  if (!req.user?.id) throw unauthenticated();

  const [user, badge] = await Promise.all([
    prisma.user.findUnique({
      where: { id: req.user.id },
    }),
    getUserBadgeData(req.user.id),
  ]);

  if (!user) throw notFound('User not found');

  return res.json({ ...user, badge });
};

export const updateMe = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  const {
    // NOTE: `phone` is intentionally not accepted here. It is the login
    // identity (auth is phone + OTP), so an unverified edit here could point
    // an account at a number the caller does not control. `updateMeSchema`
    // strips `phone` from the validated body; changing it needs a separate
    // OTP-verified flow. See schemas/userSchemas.ts for the same rationale.
    whatsapp,
    email,

    // name
    firstName,
    middleName,
    lastName,

    // personal
    religion,
    community,
    caste,
    subcaste,
    dateOfBirth,
    bloodGroup,
    gender,

    // languages
    appLanguage,
    relationLanguage,

    // education / work
    education,
    occupation,
    occupationDetails,

    // family/marital
    maritalStatus,
    matrimonialStatus,

    // address
    address,
    pincode,
    area,

    // bio
    bio,

    // legacy
    designation,
  } = req.body as {
    whatsapp?: string;
    email?: string;

    firstName?: string;
    middleName?: string;
    lastName?: string;

    religion?: string;
    community?: string;
    caste?: string;
    subcaste?: string | null;
    dateOfBirth?: string;
    bloodGroup?: string;
    gender?: string;

    appLanguage?: string;
    relationLanguage?: string;

    education?: string;
    occupation?: string;
    occupationDetails?: string;

    maritalStatus?: string;
    matrimonialStatus?: string;

    address?: string;
    pincode?: string;
    area?: string;

    bio?: string;
    designation?: string;
  };

  if (!req.user?.id) throw unauthenticated();

  const normalizedGender = normalizeGender(gender);
  let file = (req as any).file as Express.Multer.File | undefined;
  if (!file && (req as any).files) {
    const files = (req as any).files;
    if (Array.isArray(files) && files.length > 0) {
      file = files[0];
    } else if (typeof files === 'object') {
      file = files.photo?.[0] || files.image?.[0] || files.avatar?.[0] || files.media?.[0] || files.file?.[0];
    }
  }

  let uploadedPhotoUrl: string | undefined;
  if (file) {
    try {
      uploadedPhotoUrl = await uploadProfileImageToR2(file);
    } catch (err) {
      // Graceful degradation: a failed photo upload should not block the rest
      // of the profile update.
      log.warn({ err }, 'profile photo upload failed, continuing without photo update');
      uploadedPhotoUrl = undefined;
    }
  }

  let finalPhotoUrl: string | null | undefined;
  if (uploadedPhotoUrl) {
    finalPhotoUrl = uploadedPhotoUrl;
  } else if ((req.body as any).photoUrl !== undefined) {
    finalPhotoUrl = (req.body as any).photoUrl;
  } else {
    finalPhotoUrl = undefined;
  }

  let finalBannerUrl: string | null | undefined;
  if ((req.body as any).bannerUrl !== undefined) {
    finalBannerUrl = (req.body as any).bannerUrl;
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      photoUrl: finalPhotoUrl,
      bannerUrl: finalBannerUrl !== undefined ? finalBannerUrl : undefined,
      // contact
      whatsapp,
      email,

      // name
      firstName,
      middleName,
      lastName,

      // personal
      religion,
      community: community ?? (caste ? caste : undefined),
      caste,
      subcaste,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      bloodGroup,
      gender:
        typeof gender === 'undefined' ? undefined : normalizedGender,

      // languages
      appLanguage,
      relationLanguage,

      // education / work
      education,
      occupation,
      occupationDetails,

      // family/marital
      maritalStatus,
      matrimonialStatus,

      // address
      address,
      pincode,
      area,

      // bio
      bio,

      // legacy
      designation,
    },
  });

  // Invalidate tree cache for this user and all connected users
  const connectedRelations = await prisma.relation.findMany({
    where: {
      OR: [
        { fromUserId: req.user.id },
        { toUserId: req.user.id },
        { createdById: req.user.id },
      ]
    },
    select: { fromUserId: true, toUserId: true, createdById: true }
  });
  const idsToInvalidate = new Set<string>([req.user.id]);
  for (const rel of connectedRelations) {
    if (rel.fromUserId) idsToInvalidate.add(rel.fromUserId);
    if (rel.toUserId) idsToInvalidate.add(rel.toUserId);
    if (rel.createdById) idsToInvalidate.add(rel.createdById);
  }
  await TreeCacheService.invalidateUserTree(...Array.from(idsToInvalidate));

  return res.json(user);
};

export const getUserById = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  if (!req.user?.id) throw unauthenticated();

  const { id } = req.params;

  const isOwner = req.user.id === id;

  const [user, badge] = await Promise.all([
    prisma.user.findUnique({
      where: { id },
      // Non-owners only ever get the public-safe field set — regardless of the
      // target's `isPrivate` flag, which governs post visibility elsewhere, not
      // whether phone/email/address/dateOfBirth/bloodGroup/pincode/whatsapp leak
      // through this endpoint.
      select: isOwner ? OWNER_SAFE_SELECT : PUBLIC_SAFE_SELECT,
    }),
    getUserBadgeData(id),
  ]);

  if (!user) throw notFound('User not found');

  return res.json({ ...user, badge });
};

function normalizeDigitsPhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  return digits.length > 0 ? digits : null;
}

export const requestChangePhoneOtp = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  if (!req.user?.id) throw unauthenticated();
  const { newPhone } = req.body as { newPhone?: string };
  if (!newPhone) throw badRequest('New phone number is required');

  const normalized = normalizeDigitsPhone(newPhone);
  if (!normalized || normalized.length < 8 || normalized.length > 15) {
    throw badRequest('Invalid phone number format');
  }

  const currentUser = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { phone: true },
  });

  if (currentUser?.phone === normalized) {
    throw badRequest('New phone number cannot be the same as your current phone number');
  }

  const existing = await prisma.user.findUnique({
    where: { phone: normalized },
  });
  if (existing) {
    throw badRequest('This phone number is already registered with another account');
  }

  const otpResult = await OtpService.sendOtp(normalized, 'CHANGE_PHONE');
  if (otpResult.rateLimited) {
    return res.status(429).json({
      message: otpResult.message,
      rateLimited: true,
      retryAfterSeconds: otpResult.retryAfterSeconds,
    });
  }
  if (!otpResult.success) {
    return res.status(503).json({ message: otpResult.message });
  }

  return res.json({
    message: 'OTP sent to new phone number',
  });
};

export const verifyChangePhoneOtp = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  if (!req.user?.id) throw unauthenticated();
  const { newPhone, code } = req.body as { newPhone?: string; code?: string };
  if (!newPhone || !code) throw badRequest('Phone number and OTP code are required');

  const normalized = normalizeDigitsPhone(newPhone);
  if (!normalized) throw badRequest('Invalid phone number format');

  const isVerified = await OtpService.verifyOtp(normalized, code.trim());
  if (!isVerified) {
    return res.status(400).json({ message: 'Invalid or expired OTP' });
  }

  // Conflict re-check
  const existing = await prisma.user.findUnique({
    where: { phone: normalized },
  });
  if (existing && existing.id !== req.user.id) {
    throw badRequest('This phone number is already registered with another account');
  }

  const updatedUser = await prisma.user.update({
    where: { id: req.user.id },
    data: { phone: normalized },
    select: OWNER_SAFE_SELECT,
  });

  await invalidateAccountStatus(req.user.id);

  const token = signAuthToken({
    userId: updatedUser.id,
    phone: updatedUser.phone!,
  });

  return res.json({
    message: 'Phone number updated successfully',
    token,
    user: updatedUser,
  });
};
