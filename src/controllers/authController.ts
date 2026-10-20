// src/controllers/authController.ts
import { Request, Response } from 'express';
import type { Express } from 'express';
import prisma from '../lib/prisma';
import { signAuthToken } from '../lib/jwt';
import { uploadProfileImageToR2 } from '../lib/r2';
import { OtpService } from '../services/otpService';
import { config, isTestBypassPhone } from '../config/env';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from '../constants/legal';
import { syncPendingRelationsForUser, reconnectDeletedUserRelations } from '../services/relationReconnectService';

type GenderValue = 'MALE' | 'FEMALE';

function normalizeGender(gender?: string | null): GenderValue | null {
  if (!gender) return null;
  const g = gender.toUpperCase();
  if (g === 'MALE' || g === 'FEMALE') return g;
  return null;
}

/**
 * Normalizes or creates a complete review test user in the database so that
 * reviewers bypass onboarding friction and can test all authenticated features.
 */
async function getOrCreateTestReviewUser(phone: string) {
  const normalized = phone.replace(/\D/g, '');
  const tenDigit = normalized.length >= 10 ? normalized.slice(-10) : normalized;

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: normalized },
        { phone: tenDigit },
        { phone: `91${tenDigit}` },
      ],
    },
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: normalized,
        firstName: 'Google',
        lastName: 'Reviewer',
        gender: 'MALE',
        religion: 'Hindu',
        community: 'General',
        appLanguage: 'en',
        relationLanguage: 'en',
        profileCompleted: true,
        isRegistered: true,
        termsPrivacyAcceptedAt: new Date(),
        termsVersion: CURRENT_TERMS_VERSION,
        privacyVersion: CURRENT_PRIVACY_VERSION,
        worldX: 0,
        worldY: 0,
      },
    });
  } else if (!user.profileCompleted) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        firstName: user.firstName || 'Google',
        lastName: user.lastName || 'Reviewer',
        profileCompleted: true,
        isRegistered: true,
      },
    });
  }

  return user;
}

/**
 * Normalize phone number:
 * - Keep digits only
 * Returns null if nothing valid.
 */
function normalizePhone(value?: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return digits;
}

/**
 * POST /api/auth/check-phone
 * Body: { phone }
 *
 * If user exists → Sends OTP, returns { exists: true, message }
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
    const phoneVariants = [normalized];
    if (normalized.length === 12 && normalized.startsWith('91')) {
      phoneVariants.push(normalized.slice(2));
    }
    if (normalized.length === 10) {
      phoneVariants.push(`91${normalized}`);
    }
    if (normalized !== phone) {
      phoneVariants.push(phone);
    }

    let user = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: { in: phoneVariants } },
          { secondaryPhone: { in: phoneVariants } },
        ],
      },
      orderBy: [
        { profileCompleted: 'desc' },
        { isRegistered: 'desc' },
      ],
    });

    const isRegisteredUser = Boolean(user && (user.profileCompleted || user.isRegistered));

    // If caller is already authenticated (e.g. looking up a relative from within the app),
    // return existence status immediately without triggering any OTP SMS!
    if (req.headers.authorization) {
      return res.json({
        exists: isRegisteredUser,
        isRegistered: isRegisteredUser,
        message: isRegisteredUser ? 'User is registered' : 'User is not registered',
      });
    }

    const isBypass = config.isDevelopment || isTestBypassPhone(normalized);

    if (isBypass) {
      if (isTestBypassPhone(normalized) && (!user || !user.profileCompleted)) {
        user = await getOrCreateTestReviewUser(normalized);
      }

      if (user && user.profileCompleted) {
        const token = signAuthToken({ userId: user.id, phone: user.phone || normalized });
        return res.json({
          exists: true,
          bypass: true,
          token,
          user,
          message: isTestBypassPhone(normalized) ? 'Test review account login bypass' : 'Development login bypass',
        });
      }
      return res.json({
        exists: false,
        bypass: true,
        verified: true,
        phone: normalized,
        user: user || undefined,
        message: isTestBypassPhone(normalized) ? 'Test review account register bypass' : 'Development register bypass',
      });
    }

    if (!isRegisteredUser) {
      const otpResult = await OtpService.sendOtp(normalized, 'REGISTER');
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
        exists: false,
        message: 'OTP sent for registration',
        ...(config.isDevelopment && otpResult.developmentOtp
          ? { developmentOtp: otpResult.developmentOtp }
          : {}),
      });
    }

    // Trigger OTP send with rate limit check
    const otpResult = await OtpService.sendOtp(normalized, 'LOGIN');
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
      exists: true,
      message: 'OTP sent to registered number',
      ...(config.isDevelopment && otpResult.developmentOtp
        ? { developmentOtp: otpResult.developmentOtp }
        : {}),
    });
  } catch (error: any) {
    console.error('check-phone error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
    });
    return res.status(500).json({
      message: 'Internal server error during phone check',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

/**
 * POST /api/auth/register
 * Body: { phone, email, firstName, middleName, lastName, religion, community, dateOfBirth }
 */
export const registerUser = async (
  req: Request,
  res: Response
): Promise<Response | void> => {
  const {
    phone,
    secondaryPhone,
    email,
    firstName,
    middleName,
    lastName,
    religion,
    community,
    caste,
    subcaste,
    dateOfBirth,
    gender,
    fullName,
    appLanguage,
    relationLanguage,
    address,
    societyName,
    society,
    pincode,
    area,
    latitude,
    longitude,
    acceptedTermsAndPrivacy,
  } = req.body as {
    phone?: string;
    secondaryPhone?: string;
    email?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
    fullName?: string;
    religion?: string;
    community?: string;
    caste?: string;
    subcaste?: string;
    dateOfBirth?: string;
    gender?: string;
    appLanguage?: string;
    relationLanguage?: string;
    address?: string;
    societyName?: string;
    society?: string;
    pincode?: string;
    area?: string;
    latitude?: string;
    longitude?: string;
    acceptedTermsAndPrivacy?: true;
  };

  if (acceptedTermsAndPrivacy !== true) {
    return res.status(400).json({
      message: 'You must accept the Terms and Conditions and Privacy Policy to register',
    });
  }

  // Derive firstName / lastName from fullName if needed
  let derivedFirstName = firstName?.trim();
  let derivedLastName = lastName?.trim();
  if (!derivedFirstName && fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    derivedFirstName = parts[0];
    if (parts.length > 1 && !derivedLastName) {
      derivedLastName = parts.slice(1).join(' ');
    }
  }

  // we use firstName as required "name"
  if (!phone || !derivedFirstName) {
    return res
      .status(400)
      .json({ message: 'Phone and Name are required' });
  }

  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) {
    return res.status(400).json({ message: 'Invalid phone number' });
  }

  let normalizedSecondaryPhone: string | null = null;
  if (secondaryPhone && String(secondaryPhone).trim()) {
    normalizedSecondaryPhone = normalizePhone(secondaryPhone);
    if (!normalizedSecondaryPhone || normalizedSecondaryPhone.length < 10) {
      return res.status(400).json({ message: 'Invalid secondary phone number' });
    }
    if (normalizedSecondaryPhone === normalizedPhone) {
      return res.status(400).json({ message: 'Secondary phone cannot be the same as primary phone' });
    }
  }

  try {
    // We treat normalizedPhone as canonical, with fallback variants to match placeholder stubs
    let existing = await prisma.user.findUnique({
      where: { phone: normalizedPhone },
    });
    if (!existing && normalizedPhone.length === 12 && normalizedPhone.startsWith('91')) {
      existing = await prisma.user.findUnique({
        where: { phone: normalizedPhone.slice(2) },
      });
    }
    if (!existing && normalizedPhone.length === 10) {
      existing = await prisma.user.findUnique({
        where: { phone: `91${normalizedPhone}` },
      });
    }

    // Validate secondary phone uniqueness against existing registered accounts
    if (normalizedSecondaryPhone) {
      const existingSec = await prisma.user.findFirst({
        where: {
          OR: [
            { phone: normalizedSecondaryPhone },
            { secondaryPhone: normalizedSecondaryPhone },
          ],
          profileCompleted: true,
          id: { not: existing?.id || 'none' },
        },
      });
      if (existingSec) {
        return res.status(409).json({ message: 'Secondary phone is already registered to another account' });
      }

      // If a placeholder user exists with this secondaryPhone, delete it so unique constraint succeeds
      const placeholderWithSecPhone = await prisma.user.findFirst({
        where: {
          phone: normalizedSecondaryPhone,
          profileCompleted: false,
          id: { not: existing?.id || 'none' },
        },
      });
      if (placeholderWithSecPhone) {
        // Re-link incoming relations to existing or new user
        const targetUserId = existing?.id;
        if (targetUserId) {
          await prisma.relation.updateMany({
            where: { toUserId: placeholderWithSecPhone.id },
            data: { toUserId: targetUserId },
          });
          await prisma.relation.updateMany({
            where: { fromUserId: placeholderWithSecPhone.id },
            data: { fromUserId: targetUserId },
          });
        }
        await prisma.user.delete({ where: { id: placeholderWithSecPhone.id } }).catch(() => {});
      }
    }

    const normalizedEmail =
      typeof email === 'string' && email.trim().length > 0
        ? email.trim().toLowerCase()
        : null;

    if (normalizedEmail) {
      const existingEmail = await prisma.user.findFirst({
        where: {
          email: normalizedEmail,
          profileCompleted: true,
          id: { not: existing?.id || 'none' },
        },
      });
      if (existingEmail) {
        return res.status(409).json({ message: 'Email is already registered to another account' });
      }
    }

    const acceptedAt = new Date();
    const userData = {
      email: normalizedEmail,
      firstName: derivedFirstName ?? null,
      middleName: middleName?.trim() ?? null,
      lastName: derivedLastName ?? null,
      religion: religion ?? null,
      community: community ?? caste ?? null,
      caste: caste ?? null,
      subcaste: subcaste ?? null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: normalizeGender(gender),
      secondaryPhone: normalizedSecondaryPhone ?? null,
      appLanguage: appLanguage ?? 'en',
      relationLanguage: relationLanguage ?? 'en',
      profileCompleted: true,
      isRegistered: true,
      termsPrivacyAcceptedAt: acceptedAt,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      worldX: (Math.random() - 0.5) * 100000,
      worldY: (Math.random() - 0.5) * 100000,
      // Address & Location fields
      address: address?.trim() ?? null,
      societyName: societyName?.trim() ?? society?.trim() ?? null,
      pincode: pincode?.trim() ?? null,
      area: area?.trim() ?? (societyName?.trim() || society?.trim() || null),
    };

    if (existing) {
      if (existing.profileCompleted) {
        return res
          .status(409)
          .json({ message: 'User with this phone already exists' });
      }

      // Claim the stub user
      const user = await prisma.user.update({
        where: { id: existing.id },
        data: userData,
      });

      // Sync & claim pending relations and notify user for approval on both numbers
      await syncPendingRelationsForUser(user.id, user.phone || normalizedPhone).catch((err) => {
        console.error('Error syncing pending relations for user:', err);
      });
      if (normalizedSecondaryPhone) {
        await syncPendingRelationsForUser(user.id, normalizedSecondaryPhone).catch((err) => {
          console.error('Error syncing pending relations for secondary phone:', err);
        });
      }

      const token = signAuthToken({ userId: user.id, phone: user.phone || normalizedPhone });
      return res.status(200).json({ token, user });
    }

    const user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        ...userData,
      },
    });

    // Sync & claim pending relations and notify user for approval on both numbers
    await syncPendingRelationsForUser(user.id, user.phone || normalizedPhone).catch((err) => {
      console.error('Error syncing pending relations for user:', err);
    });
    if (normalizedSecondaryPhone) {
      await syncPendingRelationsForUser(user.id, normalizedSecondaryPhone).catch((err) => {
        console.error('Error syncing pending relations for secondary phone:', err);
      });
    }

    const token = signAuthToken({ userId: user.id, phone: user.phone || normalizedPhone });

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error('register error', error);
    return res.status(500).json({ message: 'Internal server error' });
  }
};


/**
 * POST /api/auth/request-otp
 * Body: { phone, type }
 */
export const requestOtp = async (req: Request, res: Response) => {
  const { phone, type } = req.body;
  const normalized = normalizePhone(phone);
  if (!normalized) return res.status(400).json({ message: 'Invalid phone' });

  if (config.isDevelopment || isTestBypassPhone(normalized)) {
    return res.json({
      message: isTestBypassPhone(normalized) ? 'Test review account OTP bypassed' : 'OTP bypassed in development',
      bypass: true,
      developmentOtp: config.testBypass.otp,
    });
  }

  const otpResult = await OtpService.sendOtp(normalized, type || 'RESEND');
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
    message: 'OTP sent',
    ...(config.isDevelopment && otpResult.developmentOtp
      ? { developmentOtp: otpResult.developmentOtp }
      : {}),
  });
};

/**
 * POST /api/auth/verify-otp
 * Body: { phone, code }
 */
export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, code, isSecondary } = req.body;
  const normalized = normalizePhone(phone);
  if (!normalized) return res.status(400).json({ message: 'Invalid phone' });

  const isBypass = config.isDevelopment || isTestBypassPhone(normalized);
  const isValid = isBypass
    ? (config.isDevelopment || code === config.testBypass.otp || code === '1234' || code === '1111')
    : await OtpService.verifyOtp(normalized, code);

  if (!isValid) return res.status(401).json({ message: 'Invalid OTP code' });

  if (isSecondary) {
    const existingCompleted = await prisma.user.findFirst({
      where: {
        OR: [
          { phone: normalized },
          { secondaryPhone: normalized },
        ],
        profileCompleted: true,
      },
    });
    if (existingCompleted) {
      return res.status(409).json({ message: 'This phone number is already registered to another account' });
    }
    return res.json({ verified: true, isSecondary: true, phone: normalized });
  }

  const phoneVariants = [normalized];
  if (normalized.length === 12 && normalized.startsWith('91')) {
    phoneVariants.push(normalized.slice(2));
  }
  if (normalized.length === 10) {
    phoneVariants.push(`91${normalized}`);
  }

  let user = await prisma.user.findFirst({
    where: {
      OR: [
        { phone: { in: phoneVariants } },
        { secondaryPhone: { in: phoneVariants } },
      ],
    },
    orderBy: [
      { profileCompleted: 'desc' },
      { isRegistered: 'desc' },
    ],
  });

  if (isTestBypassPhone(normalized) && (!user || !user.profileCompleted)) {
    user = await getOrCreateTestReviewUser(normalized);
    const token = signAuthToken({ userId: user.id, phone: user.phone || normalized });
    return res.json({ verified: true, exists: true, token, user });
  }

  if (user) {
    if (!user.isRegistered) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { isRegistered: true },
      });
    }
    if (user.profileCompleted) {
      await syncPendingRelationsForUser(user.id, user.phone || normalized).catch((err) => {
        console.error('Error syncing pending relations for user on login:', err);
      });
      const token = signAuthToken({ userId: user.id, phone: user.phone || normalized });
      return res.json({ verified: true, exists: true, token, user });
    }
  } else {
    // Create new registered stub user
    user = await prisma.user.create({
      data: {
        phone: normalized,
        isRegistered: true,
        profileCompleted: false,
        worldX: (Math.random() - 0.5) * 100000,
        worldY: (Math.random() - 0.5) * 100000,
      },
    });
  }

  return res.json({ verified: true, exists: false, message: 'Phone verified, proceed to registration' });
};

/**
 * GET /api/auth/geocode?pincode=411001
 * GET /api/auth/geocode?lat=18.5204&lng=73.8567
 *
 * Uses Google Geocoding API to resolve a pincode or GPS coordinates to a
 * structured area name (locality, district, state).
 * No auth required — called during the registration flow before the user has a token.
 */
export const geocodeLocation = async (req: Request, res: Response): Promise<Response | void> => {
  const { pincode, lat, lng, address } = req.query as {
    pincode?: string;
    lat?: string;
    lng?: string;
    address?: string;
  };

  const apiKey = config.google.mapsApiKey;

  // ─── Free-form Address Validation (Google Geocoding API + Robust Fallbacks) ───
  if (address) {
    const cleanAddress = address.trim();
    if (cleanAddress.length < 3) {
      return res.status(400).json({
        isValid: false,
        message: 'Please provide at least 3 characters for the address',
      });
    }

    const pinMatch = cleanAddress.match(/\b\d{6}\b/)?.[0];

    try {
      let googleData: any = null;
      if (apiKey) {
        try {
          const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleanAddress)}&region=IN&key=${apiKey}`;
          const gRes = await fetch(gUrl);
          googleData = await gRes.json();
        } catch (gErr) {
          console.warn('Google geocode error:', gErr);
        }
      }

      // Check if Google explicitly returned ZERO_RESULTS
      if (googleData && googleData.status === 'ZERO_RESULTS') {
        return res.json({
          isValid: false,
          provider: 'google',
          message: 'Google Maps could not verify this address. Please check your street, area, city, and 6-digit pincode.',
        });
      }

      // If Google returned OK with valid results
      if (googleData && googleData.status === 'OK' && Array.isArray(googleData.results) && googleData.results.length > 0) {
        const result = googleData.results[0];
        const components: { long_name: string; short_name: string; types: string[] }[] =
          result.address_components ?? [];

        const get = (type: string): string | null =>
          components.find((c) => c.types.includes(type))?.long_name ?? null;

        const sublocality =
          get('sublocality_level_1') ||
          get('sublocality_level_2') ||
          get('sublocality') ||
          get('neighborhood');

        const city =
          get('locality') ||
          get('administrative_area_level_2') ||
          get('administrative_area_level_3');

        const district =
          get('administrative_area_level_2') ||
          get('administrative_area_level_3') ||
          city;

        const state = get('administrative_area_level_1');
        const country = get('country') || 'India';
        const postalCode = get('postal_code') || pinMatch || null;

        const primaryLocality = sublocality || city;
        const areaParts: string[] = [];
        if (primaryLocality) areaParts.push(primaryLocality);
        if (city && city !== primaryLocality) areaParts.push(city);
        if (state && state !== city && state !== primaryLocality) areaParts.push(state);

        const area = areaParts.join(', ') || result.formatted_address;

        return res.json({
          isValid: true,
          provider: 'google',
          formattedAddress: result.formatted_address,
          area,
          locality: primaryLocality,
          city,
          district,
          state,
          country,
          postalCode,
          lat: result.geometry?.location?.lat ?? null,
          lng: result.geometry?.location?.lng ?? null,
          locationType: result.geometry?.location_type ?? null,
        });
      }

      // Fallback: If Google was restricted or offline, query Nominatim Geocoding API
      try {
        const nomUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanAddress)}&format=json&addressdetails=1&countrycodes=in&limit=1`;
        const nomRes = await fetch(nomUrl, {
          headers: { 'User-Agent': 'SamajUnati/1.0' },
        });
        const nomData = (await nomRes.json()) as any[];

        if (Array.isArray(nomData) && nomData.length > 0 && nomData[0].address) {
          const item = nomData[0];
          const addr = item.address;
          const locality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.city_district ||
            addr.residential ||
            addr.town ||
            addr.village ||
            addr.city;
          const city = addr.city || addr.town || addr.village || addr.county;
          const district = addr.county || addr.state_district || city;
          const state = addr.state;
          const country = addr.country || 'India';
          const postalCode = addr.postcode || pinMatch || null;

          const areaParts = [locality, city, state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
          const area = areaParts.join(', ') || item.display_name;

          return res.json({
            isValid: true,
            provider: 'nominatim',
            formattedAddress: item.display_name,
            area,
            locality: locality || city,
            city,
            district,
            state,
            country,
            postalCode,
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
          });
        }
      } catch (nomErr) {
        console.warn('Nominatim fallback error:', nomErr);
      }

      // Fallback: India Post validation if pincode is embedded in the address
      if (pinMatch) {
        try {
          const pinRes = await fetch(`https://api.postalpincode.in/pincode/${pinMatch}`).then((r) => r.json());
          if (Array.isArray(pinRes) && pinRes[0]?.Status === 'Success' && Array.isArray(pinRes[0]?.PostOffice) && pinRes[0].PostOffice.length > 0) {
            const po = pinRes[0].PostOffice[0];
            const primaryLocality = po.Name.replace(/\s+(S\.O|B\.O|H\.O)$/i, '').trim();
            const district = po.District;
            const state = po.State;
            const country = po.Country || 'India';
            const area = `${primaryLocality}, ${district}, ${state}`;

            return res.json({
              isValid: true,
              provider: 'postalpincode',
              formattedAddress: `${cleanAddress}, ${district}, ${state} - ${pinMatch}`,
              area,
              locality: primaryLocality,
              city: district,
              district,
              state,
              country,
              postalCode: pinMatch,
              lat: null,
              lng: null,
            });
          }
        } catch (pinErr) {
          console.warn('India Post fallback error:', pinErr);
        }
      }

      return res.json({
        isValid: false,
        provider: apiKey ? 'google' : 'fallback',
        message: 'Could not verify this address with Google Maps. Please ensure locality, city, and 6-digit pincode are accurate.',
      });
    } catch (err: any) {
      console.error('address validation error', err);
      return res.status(500).json({
        isValid: false,
        message: 'Failed to validate address due to server error',
      });
    }
  }

  if (!apiKey && !pincode && !(lat && lng)) {
    return res.status(503).json({ message: 'Geocoding is not configured on this server' });
  }

  let geocodeUrl = '';

  if (pincode) {
    const cleaned = pincode.replace(/\D/g, '');
    if (cleaned.length < 4 || cleaned.length > 10) {
      return res.status(400).json({ message: 'Please enter a valid pincode (4–10 digits)' });
    }
    if (apiKey) {
      geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleaned)}&region=IN&key=${apiKey}`;
    }
  } else if (lat && lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    if (apiKey) {
      geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${apiKey}`;
    }
  } else {
    return res.status(400).json({ message: 'Provide either ?address=, ?pincode=, or ?lat=&lng=' });
  }

  try {
    const cleaned = pincode ? pincode.replace(/\D/g, '') : '';

    // Concurrently query Google Geocoding AND India Post API when pincode is provided
    const [googleRes, pinRes] = await Promise.allSettled([
      geocodeUrl ? fetch(geocodeUrl).then((r) => r.json()) : Promise.resolve(null),
      cleaned ? fetch(`https://api.postalpincode.in/pincode/${cleaned}`).then((r) => r.json()) : Promise.resolve(null),
    ]);

    const data: any = googleRes.status === 'fulfilled' ? googleRes.value : null;
    const pinData: any = pinRes.status === 'fulfilled' ? pinRes.value : null;

    // Collect all unique sub-localities / neighborhoods
    const localitiesSet = new Set<string>();

    // 1. Add post offices from India Post (often the most localized names, e.g. "Guruwar Peth")
    if (Array.isArray(pinData) && pinData[0]?.Status === 'Success' && Array.isArray(pinData[0]?.PostOffice)) {
      for (const po of pinData[0].PostOffice) {
        if (po?.Name && typeof po.Name === 'string') {
          const cleanName = po.Name.replace(/\s+(S\.O|B\.O|H\.O)$/i, '').trim();
          if (cleanName) localitiesSet.add(cleanName);
        }
      }
    }

    // 2. Add postcode_localities from Google Geocoding
    if (data && data.status === 'OK' && data.results && data.results.length > 0) {
      if (Array.isArray(data.results[0].postcode_localities)) {
        for (const loc of data.results[0].postcode_localities) {
          if (loc && typeof loc === 'string') localitiesSet.add(loc.trim());
        }
      }
    }

    if (data && data.status === 'OK' && data.results && data.results.length > 0) {
      // Extract address components from Google result
      const components: { long_name: string; short_name: string; types: string[] }[] =
        data.results[0].address_components ?? [];

      const get = (type: string): string | null =>
        components.find((c) => c.types.includes(type))?.long_name ?? null;

      // Check sublocality components across results
      const sublocality =
        get('sublocality_level_1') ||
        get('sublocality_level_2') ||
        get('sublocality') ||
        get('neighborhood');

      if (sublocality) localitiesSet.add(sublocality.trim());

      const city =
        get('locality') ||
        get('administrative_area_level_3') ||
        get('administrative_area_level_2');

      const district =
        get('administrative_area_level_2') ||
        get('administrative_area_level_3') ||
        city;

      const state = get('administrative_area_level_1');
      const country = get('country') || 'India';
      const postalCode = get('postal_code') || cleaned;

      const localitiesList = Array.from(localitiesSet);

      // Choose primary locality: specific sub-locality/neighborhood if available, fallback to city
      const primaryLocality = localitiesList.length > 0 ? localitiesList[0] : (sublocality || city);

      // Build structured area without duplicate names (e.g. "Guruwar Peth, Pune, Maharashtra")
      const areaParts: string[] = [];
      if (primaryLocality) areaParts.push(primaryLocality);
      if (city && city !== primaryLocality) areaParts.push(city);
      if (state && state !== city && state !== primaryLocality) areaParts.push(state);

      const area = areaParts.join(', ') || data.results[0].formatted_address;

      return res.json({
        area,
        locality: primaryLocality,
        city,
        district,
        state,
        country,
        postalCode,
        localities: localitiesList,
        formattedAddress: data.results[0].formatted_address,
        provider: 'google',
      });
    }

    // ─── Fallback 1: Indian Postal Pincode API (Free, no billing required) ───
    if (Array.isArray(pinData) && pinData[0]?.Status === 'Success' && Array.isArray(pinData[0]?.PostOffice) && pinData[0].PostOffice.length > 0) {
      const po = pinData[0].PostOffice[0];
      const localitiesList = Array.from(localitiesSet);
      const primaryLocality = localitiesList[0] || po.Name.replace(/\s+(S\.O|B\.O|H\.O)$/i, '').trim();
      const district = po.District;
      const state = po.State;
      const country = po.Country || 'India';

      const areaParts: string[] = [];
      if (primaryLocality) areaParts.push(primaryLocality);
      if (district && district !== primaryLocality) areaParts.push(district);
      if (state && state !== district && state !== primaryLocality) areaParts.push(state);

      const area = areaParts.join(', ');

      return res.json({
        area,
        locality: primaryLocality,
        city: district,
        district,
        state,
        country,
        postalCode: cleaned,
        localities: localitiesList,
        formattedAddress: `${primaryLocality}, ${district}, ${state} - ${cleaned}`,
        provider: 'postalpincode',
      });
    }

    // ─── Fallback 2: Nominatim GPS Reverse Geocoding (Free, open) ───
    if (lat && lng) {
      try {
        const nomRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
          { headers: { 'User-Agent': 'SamajUnati/1.0' } }
        );
        const nomData = (await nomRes.json()) as any;
        if (nomData && nomData.address) {
          const addr = nomData.address;
          const locality =
            addr.suburb ||
            addr.neighbourhood ||
            addr.city_district ||
            addr.residential ||
            addr.town ||
            addr.village ||
            addr.city;
          const district = addr.city || addr.state_district || addr.county;
          const state = addr.state;
          const country = addr.country;
          const postalCode = addr.postcode;
          const areaParts = [locality, district, state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i);
          const area = areaParts.join(', ') || nomData.display_name;

          return res.json({
            area,
            locality,
            city: district,
            district,
            state,
            country,
            postalCode,
            localities: locality ? [locality] : [],
            formattedAddress: nomData.display_name,
            provider: 'nominatim',
          });
        }
      } catch (nomErr) {
        console.warn('Nominatim fallback error:', nomErr);
      }
    }

    return res.status(404).json({ message: 'No location found for the given input' });
  } catch (error) {
    console.error('geocodeLocation error', error);
    return res.status(500).json({ message: 'Failed to fetch location data' });
  }
};

