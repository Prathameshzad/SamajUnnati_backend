// src/schemas/authSchemas.ts
import { z } from 'zod';
import { phoneField, otpCodeField, requiredText, boundedText, dateStringField, TEXT_LIMITS } from './common';

export const checkPhoneSchema = {
  body: z.object({ phone: phoneField }).strip(),
};

export const requestOtpSchema = {
  body: z
    .object({
      phone: phoneField,
      // Controller already defaults this to 'RESEND'.
      type: z.enum(['LOGIN', 'REGISTER', 'RESEND']).optional(),
    })
    .strip(),
};

export const verifyOtpSchema = {
  body: z.object({ phone: phoneField, code: otpCodeField }).strip(),
};

/**
 * Registration is multipart (an optional profile photo is attached), so every
 * value arrives as a string.
 *
 * `.strip()` matters here: the handler previously destructured a fixed set of
 * fields, but any extra field in the body was simply ignored rather than
 * rejected. Stripping makes that explicit and keeps unexpected input out of the
 * Prisma payload.
 */
export const registerSchema = {
  body: z
    .object({
      phone: phoneField,
      firstName: requiredText(TEXT_LIMITS.name),
      middleName: boundedText(TEXT_LIMITS.name),
      lastName: boundedText(TEXT_LIMITS.name),
      email: z.string().trim().toLowerCase().email('must be a valid email').max(255).optional(),
      religion: boundedText(TEXT_LIMITS.shortField),
      community: boundedText(TEXT_LIMITS.shortField),
      dateOfBirth: dateStringField,
      gender: z.enum(['MALE', 'FEMALE', 'male', 'female']).optional(),
      appLanguage: z.string().trim().max(10).optional(),
      relationLanguage: z.string().trim().max(10).optional(),
    })
    .strip(),
};
