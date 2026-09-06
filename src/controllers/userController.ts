// src/controllers/userController.ts
import { Response } from 'express';
import type { Express } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadProfileImageToR2 } from '../lib/r2';
import { TreeCacheService } from '../services/treeCacheService';
import { getUserBadgeData } from '../services/badgeService';
import { notFound, unauthenticated } from '../lib/errors';
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
    subcaste?: string;
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
  } else if ((req.body as any).photoUrl) {
    finalPhotoUrl = (req.body as any).photoUrl;
  } else {
    finalPhotoUrl = undefined;
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      photoUrl: finalPhotoUrl,
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
