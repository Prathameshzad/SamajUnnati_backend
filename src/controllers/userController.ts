// src/controllers/userController.ts
import { Response } from 'express';
import type { Express } from 'express';
import prisma from '../lib/prisma';
import { AuthRequest } from '../middleware/authMiddleware';
import { uploadProfileImageToR2 } from '../lib/r2';
import { TreeCacheService } from '../services/treeCacheService';
import { getUserBadgeData } from '../services/badgeService';

type GenderValue = 'MALE' | 'FEMALE';

function normalizeGender(gender?: string | null): GenderValue | null {
  if (!gender) return null;
  const g = gender.toUpperCase();
  if (g === 'MALE' || g === 'FEMALE') return g;
  return null;
}

export const getMe = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const [user, badge] = await Promise.all([
      prisma.user.findUnique({
        where: { id: req.user.id },
      }),
      getUserBadgeData(req.user.id),
    ]);

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ ...user, badge });
  } catch (error) {
    console.error('get me error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const updateMe = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  const {
    // core contact
    phone, // optional, only if you want to allow editing
    whatsapp,
    email,

    // name
    firstName,
    middleName,
    lastName,

    // personal
    religion,
    community,
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
    phone?: string;
    whatsapp?: string;
    email?: string;

    firstName?: string;
    middleName?: string;
    lastName?: string;

    religion?: string;
    community?: string;
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

  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: 'Unauthenticated' });
    }

    const normalizedGender = normalizeGender(gender);
    const file = (req as any).file as Express.Multer.File | undefined;

    let uploadedPhotoUrl: string | undefined;
    if (file) {
      try {
        uploadedPhotoUrl = await uploadProfileImageToR2(file);
      } catch (err) {
        console.error('R2 upload error (updateMe)', err);
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
        phone,
        whatsapp,
        email,

        // name
        firstName,
        middleName,
        lastName,

        // personal
        religion,
        community,
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
  } catch (error) {
    console.error('update me error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const getUserById = async (
  req: AuthRequest,
  res: Response
): Promise<Response | void> => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'User ID is required' });

    const [user, badge] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
      }),
      getUserBadgeData(id),
    ]);

    if (!user) return res.status(404).json({ message: 'User not found' });

    return res.json({ ...user, badge });
  } catch (error) {
    console.error('getUserById error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
