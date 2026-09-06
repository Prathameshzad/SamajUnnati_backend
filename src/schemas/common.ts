// src/schemas/common.ts
/**
 * Shared validation building blocks.
 *
 * Defaults deliberately mirror the previous inline behaviour so no endpoint
 * changes its response for a valid request. What changes is that *invalid* input
 * is now rejected with a 400 instead of reaching Prisma, and that every numeric
 * bound has a ceiling.
 */
import { z } from 'zod';

/** UUID path parameter. Rejects malformed IDs before they reach Postgres. */
export const uuidParam = (field = 'id') =>
  z.object({
    [field]: z.string().uuid(`${field} must be a valid UUID`),
  } as Record<string, z.ZodTypeAny>);

/**
 * Relation IDs and user IDs are `@default(uuid())` in the schema, so UUID is the
 * correct shape. Previously a value like `'; DROP` was passed to Prisma, which
 * safely rejected it but as an unhandled P2023 -> 500 rather than a 400.
 */
export const uuidString = z.string().uuid();

/** Free text with a hard ceiling, trimmed, empty coerced to undefined. */
export const boundedText = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .max(max, `must be at most ${max} characters`)
    .refine((value) => value.length >= min, { message: `must be at least ${min} characters` })
    .transform((value) => (value.length === 0 ? undefined : value))
    .optional();

/** Required trimmed text. */
export const requiredText = (max: number, min = 1) =>
  z.string().trim().min(min, `must be at least ${min} characters`).max(max, `must be at most ${max} characters`);

/**
 * Phone number.
 *
 * Intentionally permissive about formatting: the controllers each run their own
 * `normalizePhone` (authController strips to digits; relationController keeps the
 * last 10), and changing that normalisation would alter lookup behaviour. This
 * only rejects input that could not be a phone number at all.
 */
export const phoneField = z
  .string()
  .trim()
  .min(6, 'phone is too short')
  .max(20, 'phone is too long')
  .regex(/^[0-9+\-()\s]+$/, 'phone contains invalid characters')
  .refine((value) => value.replace(/\D/g, '').length >= 6, { message: 'phone must contain at least 6 digits' });

/** OTP code: digits only, length range covers configurable code lengths. */
export const otpCodeField = z
  .string()
  .trim()
  .regex(/^\d{4,10}$/, 'code must be 4 to 10 digits');

/** Language tag. Defaults are supplied per-endpoint to preserve prior behaviour. */
export const langQuery = (defaultLang: string) =>
  z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z]{2}(-[a-z0-9]{2,8})?$/i, 'lang must be a language code')
    .default(defaultLang);

/**
 * Cursor pagination limit.
 * Every list endpoint now has an explicit maximum — `getMessages` previously had
 * none at all.
 */
export const limitQuery = (defaultLimit: number, maxLimit: number) =>
  z.coerce
    .number()
    .int('limit must be an integer')
    .min(1, 'limit must be at least 1')
    .max(maxLimit, `limit must be at most ${maxLimit}`)
    .default(defaultLimit);

/** ISO datetime cursor, as produced by `createdAt.toISOString()`. */
export const cursorQuery = z
  .string()
  .datetime({ offset: true, message: 'cursor must be an ISO-8601 timestamp' })
  .optional();

export const genderField = z
  .enum(['MALE', 'FEMALE', 'OTHER'])
  .optional();

export const relationCategoryField = z.enum(['FAMILY', 'FRIEND', 'MATRIMONY']);

/** Accepts the string booleans that multipart form data produces. */
export const booleanish = z
  .union([z.boolean(), z.enum(['true', 'false', '1', '0', 'yes', 'no'])])
  .transform((value) => {
    if (typeof value === 'boolean') return value;
    return ['true', '1', 'yes'].includes(value.toLowerCase());
  });

/** Optional date string that must parse to a real date. */
export const dateStringField = z
  .string()
  .trim()
  .refine((value) => value === '' || !Number.isNaN(new Date(value).getTime()), {
    message: 'must be a valid date',
  })
  .transform((value) => (value === '' ? undefined : value))
  .optional();

/** Bounded list of UUIDs, for batch operations like group creation. */
export const uuidArray = (max: number) =>
  z.array(uuidString).min(1, 'at least one ID is required').max(max, `at most ${max} IDs allowed`);

/** Text field lengths, matching the client-side `maxLength` attributes. */
export const TEXT_LIMITS = {
  /** mobile/app/create-post.tsx uses maxLength={2200} */
  postCaption: 2200,
  /** mobile/app/post-detail.tsx uses maxLength={500} */
  comment: 500,
  /** mobile/app/chat.tsx uses maxLength={2000} */
  message: 2000,
  /** mobile/app/create-group.tsx uses maxLength={80} */
  groupName: 80,
  /** mobile/app/story-create.tsx uses maxLength={200} */
  storyCaption: 200,
  name: 100,
  bio: 500,
  address: 300,
  location: 120,
  shortField: 100,
  url: 2048,
} as const;
