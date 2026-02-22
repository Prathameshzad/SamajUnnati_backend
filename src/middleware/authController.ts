// src/controllers/authController.ts
import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { signAuthToken } from '../lib/jwt';

export const checkPhone = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const { phone } = req.body as { phone?: string };

  if (!phone) {
    return res.status(400).json({ message: 'Phone is required' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { phone }
    });

    if (!user) {
      return res.json({ exists: false });
    }

    const token = signAuthToken({ userId: user.id, phone: user.phone });

    return res.json({
      exists: true,
      token,
      user
    });
  } catch (error) {
    console.error('check-phone error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};

export const registerUser = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const {
    phone,
    email,
    name,
    photoUrl,
    address,
    pincode,
    gender,
    designation,
    dateOfBirth
  } = req.body as {
    phone?: string;
    email?: string;
    name?: string;
    photoUrl?: string;
    address?: string;
    pincode?: string;
    gender?: 'MALE' | 'FEMALE';
    designation?: string;
    dateOfBirth?: string;
  };

  if (!phone || !name) {
    return res.status(400).json({ message: 'Phone and name are required' });
  }

  try {
    const existing = await prisma.user.findUnique({
      where: { phone }
    });

    if (existing) {
      return res
        .status(409)
        .json({ message: 'User with this phone already exists' });
    }

    // Gender normalize
    let finalGender: 'MALE' | 'FEMALE' | null = null;
    if (gender === 'MALE' || gender === 'FEMALE') {
      finalGender = gender;
    }

    const user = await prisma.user.create({
      data: {
        phone,
        email: email ?? null,
        firstName: name, // Assuming 'name' maps to firstName for now
        photoUrl: photoUrl ?? null,
        address: address ?? null,
        pincode: pincode ?? null,
        gender: finalGender,
        designation: designation ?? null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
      }
    });

    const token = signAuthToken({ userId: user.id, phone: user.phone });

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};
