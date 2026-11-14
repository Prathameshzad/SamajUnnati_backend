// src/schemas/matrimonySchemas.ts
import { z } from 'zod';
import { boundedText, requiredText } from './common';
import { FAMILY_TYPES, MARRIAGE_TIMELINES, MATRIMONY_VIBES } from '../constants/matrimonyData';

const VIBE_VALUES = MATRIMONY_VIBES.map((v) => v.value) as [string, ...string[]];

const shortTag = z.string().trim().min(1).max(48);

/** Photo URL as returned by POST /upload. */
const photoUrl = z
  .string()
  .trim()
  .max(1024)
  .refine((u) => /^https?:\/\//i.test(u), { message: 'must be an uploaded image URL' });

/**
 * POST /api/matrimony/register
 *
 * One request carries the whole quick-registration form. Every field is
 * whitelisted here; the old POST /profile spread req.body straight into Prisma.
 */
export const matrimonyRegisterSchema = {
  body: z
    .object({
      // Core facts. gender / dateOfBirth / religion were collected at signup,
      // so they are optional: when omitted the stored user values are used.
      // When sent, they are also written back to the main profile.
      gender: z.enum(['MALE', 'FEMALE']).optional(),
      dateOfBirth: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
        .optional(),
      maritalStatus: requiredText(48),
      religion: boundedText(64),
      caste: boundedText(64),
      community: boundedText(64),
      motherTongue: boundedText(48),

      // Birth details (for patrika / kundli). Time may be unknown.
      // State from a fixed list, city picked via Google Places (or typed if
      // search is unavailable), taluka auto-filled from the place / editable.
      birthState: requiredText(60, 2),
      birthCity: requiredText(100, 2),
      birthTaluka: boundedText(100),
      birthDistrict: boundedText(100),
      birthPlaceId: z.string().trim().regex(/^[A-Za-z0-9_-]{10,300}$/).optional(),
      birthLat: z.number().min(-90).max(90).optional(),
      birthLng: z.number().min(-180).max(180).optional(),
      birthTime: z
        .string()
        .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'must be HH:mm (24h)')
        .optional(),
      birthTimeUnknown: z.boolean().default(false),

      // About
      height: z.number().int().min(120).max(230),
      education: requiredText(80),
      occupation: requiredText(120),
      income: boundedText(32),

      // Lifestyle
      diet: boundedText(48),
      drinking: boundedText(32),
      smoking: boundedText(32),
      familyType: z.enum(FAMILY_TYPES as [string, ...string[]]).optional(),
      marriageTimeline: z.enum(MARRIAGE_TIMELINES as [string, ...string[]]).optional(),

      // Personality
      hobbies: z.array(shortTag).min(1).max(10),
      vibes: z.array(z.enum(VIBE_VALUES)).min(1).max(3),
      bio: requiredText(300, 20),

      photos: z.array(photoUrl).min(2, 'add at least 2 photos').max(6),

      // Partner preference
      partnerAgeMin: z.number().int().min(18).max(80),
      partnerAgeMax: z.number().int().min(18).max(80),
      partnerReligion: z.enum(['SAME', 'ANY']).default('ANY'),
    })
    .strip()
    .refine((b) => b.birthTimeUnknown || !!b.birthTime, {
      message: 'birthTime is required unless birthTimeUnknown is true',
      path: ['birthTime'],
    })
    .refine((b) => b.partnerAgeMin <= b.partnerAgeMax, {
      message: 'partnerAgeMin must be ≤ partnerAgeMax',
      path: ['partnerAgeMin'],
    }),
};
