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
    // First, try with normalized phone (new standard)
    let user = await prisma.user.findUnique({
      where: { phone: normalized },
    });

    // Fallback: Indian numbers with/without 91 prefix
    if (!user && normalized.length === 12 && normalized.startsWith('91')) {
      user = await prisma.user.findUnique({
        where: { phone: normalized.slice(2) },
      });
    }
    if (!user && normalized.length === 10) {
      user = await prisma.user.findUnique({
        where: { phone: `91${normalized}` },
      });
    }

    // Fallback: if not found and normalized !== phone, try raw phone
    if (!user && normalized !== phone) {
      user = await prisma.user.findUnique({
        where: { phone },
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

    if (!user) {
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
    bloodGroup,
    occupation,
    fullName,
    appLanguage,
    relationLanguage,
    pincode,
    area,
    latitude,
    longitude,
    acceptedTermsAndPrivacy,
  } = req.body as {
    phone?: string;
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
    bloodGroup?: string;
    occupation?: string;
    appLanguage?: string;
    relationLanguage?: string;
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

    const acceptedAt = new Date();
    const userData = {
      email: email ?? null,
      firstName: derivedFirstName ?? null,
      middleName: middleName?.trim() ?? null,
      lastName: derivedLastName ?? null,
      religion: religion ?? null,
      community: community ?? caste ?? null,
      caste: caste ?? null,
      subcaste: subcaste ?? null,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
      gender: normalizeGender(gender),
      bloodGroup: bloodGroup ?? null,
      occupation: occupation ?? null,
      appLanguage: appLanguage ?? 'en',
      relationLanguage: relationLanguage ?? 'en',
      profileCompleted: true,
      isRegistered: true,
      termsPrivacyAcceptedAt: acceptedAt,
      termsVersion: CURRENT_TERMS_VERSION,
      privacyVersion: CURRENT_PRIVACY_VERSION,
      worldX: (Math.random() - 0.5) * 100000,
      worldY: (Math.random() - 0.5) * 100000,
      // Location fields from the new registration step
      pincode: pincode?.trim() ?? null,
      area: area?.trim() ?? null,
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

      // Sync & claim pending relations and notify user for approval
      await syncPendingRelationsForUser(user.id, user.phone || normalizedPhone).catch((err) => {
        console.error('Error syncing pending relations for user:', err);
      });

      const token = signAuthToken({ userId: user.id, phone: user.phone || normalizedPhone });
      return res.status(200).json({ token, user });
    }

    const user = await prisma.user.create({
      data: {
        phone: normalizedPhone,
        ...userData,
      },
    });

    // Sync & claim pending relations and notify user for approval
    await syncPendingRelationsForUser(user.id, user.phone || normalizedPhone).catch((err) => {
      console.error('Error syncing pending relations for user:', err);
    });

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
  const { phone, code } = req.body;
  const normalized = normalizePhone(phone);
  if (!normalized) return res.status(400).json({ message: 'Invalid phone' });

  const isBypass = config.isDevelopment || isTestBypassPhone(normalized);
  const isValid = isBypass
    ? (config.isDevelopment || code === config.testBypass.otp || code === '1234' || code === '1111')
    : await OtpService.verifyOtp(normalized, code);

  if (!isValid) return res.status(401).json({ message: 'Invalid OTP code' });

  // If valid, ensure user exists and is marked as registered (verified phone)
  let user = await prisma.user.findUnique({ where: { phone: normalized } });
  if (!user && normalized.length === 12 && normalized.startsWith('91')) {
    user = await prisma.user.findUnique({ where: { phone: normalized.slice(2) } });
  }
  if (!user && normalized.length === 10) {
    user = await prisma.user.findUnique({ where: { phone: `91${normalized}` } });
  }

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
  const { pincode, lat, lng } = req.query as {
    pincode?: string;
    lat?: string;
    lng?: string;
  };

  const apiKey = config.google.mapsApiKey;
  if (!apiKey) {
    return res.status(503).json({ message: 'Geocoding is not configured on this server' });
  }

  let geocodeUrl = '';

  if (pincode) {
    const cleaned = pincode.replace(/\D/g, '');
    if (cleaned.length < 4 || cleaned.length > 10) {
      return res.status(400).json({ message: 'Please enter a valid pincode (4–10 digits)' });
    }
    geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(cleaned)}&region=IN&key=${apiKey}`;
  } else if (lat && lng) {
    const latNum = parseFloat(lat);
    const lngNum = parseFloat(lng);
    if (isNaN(latNum) || isNaN(lngNum)) {
      return res.status(400).json({ message: 'Invalid coordinates' });
    }
    geocodeUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latNum},${lngNum}&key=${apiKey}`;
  } else {
    return res.status(400).json({ message: 'Provide either ?pincode= or ?lat=&lng=' });
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

