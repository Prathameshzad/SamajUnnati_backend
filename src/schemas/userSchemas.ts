// src/schemas/userSchemas.ts
import { z } from 'zod';
import { boundedText, dateStringField, uuidString, TEXT_LIMITS } from './common';

const photoUrlField = z
  .string()
  .trim()
  .max(TEXT_LIMITS.url)
  .url('must be a valid URL')
  .refine((value) => /^https?:\/\//i.test(value), { message: 'must be an http(s) URL' })
  .optional();

/**
 * Profile update.
 *
 * Two deliberate omissions from the previous handler's accepted fields:
 *
 * 1. `phone` — it was editable here with no verification. Phone is the login
 *    identity (auth is phone + OTP), so allowing an unverified change means a
 *    user can point their account at a number they do not control, and it can
 *    strand the account if the new number is wrong. Because the schema strips
 *    unknown keys, a client that still sends `phone` is ignored rather than
 *    erroring. Changing a phone number needs its own OTP-verified flow.
 *
 * 2. `isPrivate` / `profileCompleted` / `isRegistered` / `worldX` / `worldY` —
 *    never part of the destructured list, but worth stating: privacy is changed
 *    through `PATCH /api/follow/privacy`, which is the owner-checked path.
 *
 * `email` is validated as an email; it was previously stored unchecked, and it
 * has a unique constraint, so junk values caused an unhandled P2002 -> 500.
 */
export const updateMeSchema = {
  body: z
    .object({
      whatsapp: z
        .string()
        .trim()
        .max(20)
        .regex(/^[0-9+\-()\s]*$/, 'whatsapp contains invalid characters')
        .transform((value) => (value.length === 0 ? undefined : value))
        .optional(),
      email: z.string().trim().toLowerCase().email('must be a valid email').max(255).optional(),

      firstName: boundedText(TEXT_LIMITS.name),
      middleName: boundedText(TEXT_LIMITS.name),
      lastName: boundedText(TEXT_LIMITS.name),

      religion: boundedText(TEXT_LIMITS.shortField),
      community: boundedText(TEXT_LIMITS.shortField),
      caste: boundedText(TEXT_LIMITS.shortField),
      subcaste: boundedText(TEXT_LIMITS.shortField),
      dateOfBirth: dateStringField,
      bloodGroup: boundedText(16),
      gender: z.enum(['MALE', 'FEMALE', 'male', 'female']).optional(),

      appLanguage: z.string().trim().max(10).optional(),
      relationLanguage: z.string().trim().max(10).optional(),

      education: boundedText(TEXT_LIMITS.shortField),
      occupation: boundedText(TEXT_LIMITS.shortField),
      occupationDetails: boundedText(TEXT_LIMITS.bio),

      maritalStatus: boundedText(TEXT_LIMITS.shortField),
      matrimonialStatus: boundedText(TEXT_LIMITS.shortField),

      address: boundedText(TEXT_LIMITS.address),
      pincode: boundedText(16),
      area: boundedText(TEXT_LIMITS.shortField),

      bio: boundedText(TEXT_LIMITS.bio),
      designation: boundedText(TEXT_LIMITS.shortField),

      photoUrl: photoUrlField,
    })
    .strip(),
};

export const userIdParamSchema = {
  params: z.object({ id: uuidString }).strip(),
};
