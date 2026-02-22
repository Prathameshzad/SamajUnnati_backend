// src/controllers/authController.ts
import { Request, Response } from 'express';
import type { Express } from 'express';
import prisma from '../lib/prisma';
import { signAuthToken } from '../lib/jwt';
import { uploadProfileImageToR2 } from '../lib/r2';

type GenderValue = 'MALE' | 'FEMALE';

function normalizeGender(gender?: string | null): GenderValue | null {
  if (!gender) return null;
  const g = gender.toUpperCase();
  if (g === 'MALE' || g === 'FEMALE') return g;
  return null;
}

/**
 * Normalize phone number:
 * - Keep digits only
 * - Use last 10 digits (so +91 / 0 prefixes don’t matter)
 * Returns null if nothing valid.
 */
function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length > 10) return digits.slice(-10);
  return digits;
}

/**
 * POST /api/auth/check-phone
 * Body: { phone }
 *
 * If user exists → { exists: true, token, user }
 * If not → { exists: false }
 */
export const checkPhone = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const { phone } = req.body as { phone?: string };

  if (!phone) {
    return res.status(400).json({ message: 'Phone is required' });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return res.status(400).json({ message: 'Invalid phone number' });
  }

  try {
    // First, try with normalized phone (new standard)
    let user = await prisma.user.findUnique({
      where: { phone: normalized },
    });

    // Fallback: if not found and normalized !== raw, try raw phone
    if (!user && normalized !== phone) {
      user = await prisma.user.findUnique({
        where: { phone },
      });
    }

    if (!user) {
      return res.json({ exists: false });
    }

    const token = signAuthToken({ userId: user.id, phone: user.phone });

    return res.json({
      exists: true,
      token,
      user,
    });
  } catch (error) {
    console.error('check-phone error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * POST /api/auth/register
 * multipart/form-data:
 *  - phone, whatsapp, email
 *  - firstName, middleName, lastName
 *  - religion, community, dateOfBirth, bloodGroup, gender
 *  - education, occupation, occupationDetails
 *  - maritalStatus, matrimonialStatus
 *  - address, pincode, area
 *  - photo (file)
 *  - photoUrl (optional string)
 */
export const registerUser = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const {
    // contact
    phone,
    whatsapp,
    email,

    // name parts
    firstName,
    middleName,
    lastName,

    // personal
    religion,
    community,
    dateOfBirth,
    bloodGroup,
    gender,

    // education / work
    education,
    occupation,
    occupationDetails,

    // family / marital
    maritalStatus,
    matrimonialStatus,

    // address
    address,
    pincode,
    area,

    // legacy
    designation,

    // direct URL fallback
    photoUrl,
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

    education?: string;
    occupation?: string;
    occupationDetails?: string;

    maritalStatus?: string;
    matrimonialStatus?: string;

    address?: string;
    pincode?: string;
    area?: string;

    designation?: string;
    photoUrl?: string;
  };

  // we use firstName as required "name"
  if (!phone || !firstName?.trim()) {
    return res
      .status(400)
      .json({ message: 'Phone and firstName are required' });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Invalid phone number' });
  }

  const normalizedGender = normalizeGender(gender);

  const file = (req as any).file as Express.Multer.File | undefined;
  let uploadedPhotoUrl: string | undefined;

  if (file) {
    try {
      uploadedPhotoUrl = await uploadProfileImageToR2(file);
    } catch (err) {
      console.error('R2 upload error (registerUser)', err);
      uploadedPhotoUrl = undefined;
    }
  }

  const finalPhotoUrl: string | null =
    uploadedPhotoUrl ?? (photoUrl ? photoUrl : null);

  try {
    // We treat normalizedPhone as canonical
    const existing = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });

    if (existing) {
      if (existing.profileCompleted) {
        return res
          .status(409)
          .json({ message: 'User with this phone already exists' });
      }

      // Claim the stub user
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: {
          // contact
          // phone is immutable/unique key here
          whatsapp: whatsapp ?? null,
          email: email ?? null,

          // names
          firstName: firstName?.trim() ?? null,
          middleName: middleName?.trim() ?? null,
          lastName: lastName?.trim() ?? null,

          // personal
          religion: religion ?? null,
          community: community ?? null,
          dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
          bloodGroup: bloodGroup ?? null,
          gender: normalizedGender,

          // education / work
          education: education ?? null,
          occupation: occupation ?? null,
          occupationDetails: occupationDetails ?? null,

          // family / marital
          maritalStatus: maritalStatus ?? null,
          matrimonialStatus: matrimonialStatus ?? null,

          // address
          address: address ?? null,
          pincode: pincode ?? null,
          area: area ?? null,

          // legacy
          designation: designation ?? null,

          // image
          photoUrl: finalPhotoUrl,

          profileCompleted: true, // MARK COMPLETED
        },
      });

      const token = signAuthToken({ userId: user.id, phone: user.phone });
      return res.status(200).json({ token, user });
    }

    const user = await prisma.user.create({
      data: {
        // contact
        phone: normalizedPhone,
        whatsapp: whatsapp ?? null,
        email: email ?? null,

        // names
        firstName: firstName?.trim() ?? null,
        middleName: middleName?.trim() ?? null,
        lastName: lastName?.trim() ?? null,

        // personal
        religion: religion ?? null,
        community: community ?? null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        bloodGroup: bloodGroup ?? null,
        gender: normalizedGender,

        // education / work
        education: education ?? null,
        occupation: occupation ?? null,
        occupationDetails: occupationDetails ?? null,

        // family / marital
        maritalStatus: maritalStatus ?? null,
        matrimonialStatus: matrimonialStatus ?? null,

        // address
        address: address ?? null,
        pincode: pincode ?? null,
        area: area ?? null,

        // legacy
        designation: designation ?? null,

        // image
        photoUrl: finalPhotoUrl,

        profileCompleted: true,
      },
    });

    const token = signAuthToken({ userId: user.id, phone: user.phone });

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
