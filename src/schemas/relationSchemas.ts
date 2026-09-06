// src/schemas/relationSchemas.ts
import { z } from 'zod';
import {
  langQuery,
  phoneField,
  requiredText,
  boundedText,
  dateStringField,
  uuidString,
  TEXT_LIMITS,
} from './common';

/** RelationType.code is an uppercase snake-case identifier. */
const relationTypeCode = z
  .string()
  .trim()
  .min(1, 'relationTypeCode is required')
  .max(64)
  .regex(/^[A-Z][A-Z0-9_]*$/, 'relationTypeCode must be uppercase snake case');

/**
 * `isAlive` arrives as a boolean (JSON) or a string (multipart).
 *
 * Deliberately *not* normalised here. The controller does
 * `String(isAlive) === 'true'`, and converting it in the schema would change
 * which inputs count as truthy. This validates the type only.
 */
const isAliveField = z.union([z.boolean(), z.string().trim().max(10)]).optional();

/**
 * Only accept absolute http(s) URLs for a custom photo.
 * This was previously an unchecked string written straight to the database and
 * then rendered by both clients, so `javascript:` and `data:` URLs were storable.
 */
const photoUrlField = z
  .string()
  .trim()
  .max(TEXT_LIMITS.url)
  .url('must be a valid URL')
  .refine((value) => /^https?:\/\//i.test(value), { message: 'must be an http(s) URL' })
  .optional();

/**
 * Invalid values collapse to undefined rather than erroring, matching the old
 * `normalizeVisualSide` which returned null for anything unexpected.
 */
const visualSideField = z
  .enum(['top', 'bottom', 'left', 'right'])
  .optional()
  .catch(undefined);

export const listRelationsSchema = {
  query: z.object({ lang: langQuery('mr') }).strip(),
};

export const getTreeSchema = {
  query: z.object({ lang: langQuery('mr') }).strip(),
};

/**
 * `depth` previously came from `Number(req.query.depth) || 10` with no ceiling,
 * so `?depth=100000` would drive an unbounded BFS. Capped at 25; the web client
 * requests 20 (web/components/FamilyTree.tsx), so the existing maximum still fits.
 */
export const getFullTreeSchema = {
  query: z
    .object({
      lang: langQuery('mr'),
      depth: z.coerce.number().int().min(1).max(25).default(10),
      category: z.enum(['FAMILY', 'FRIEND', 'MATRIMONY']).optional(),
    })
    .strip(),
};

/**
 * `radius` was `parseFloat(...) || 5000` with no ceiling, and the handler selects
 * every user inside the bounding box plus all of their relations. A large radius
 * was effectively "dump the whole graph".
 */
export const getGraphChunkSchema = {
  query: z
    .object({
      lang: langQuery('mr'),
      x: z.coerce.number().finite().default(0),
      y: z.coerce.number().finite().default(0),
      radius: z.coerce.number().finite().min(1).max(20_000).default(5000),
    })
    .strip(),
};

export const createRelationSchema = {
  query: z.object({ lang: langQuery('mr') }).strip(),
  body: z
    .object({
      relationTypeCode,
      firstName: requiredText(TEXT_LIMITS.name),
      lastName: boundedText(TEXT_LIMITS.name),
      // Absent for deceased relatives, who have no phone.
      phone: phoneField.optional(),
      gender: z.enum(['MALE', 'FEMALE', 'male', 'female', 'OTHER']).optional(),
      sourceUserId: uuidString.optional(),
      customName: boundedText(TEXT_LIMITS.name),
      customPhotoUrl: photoUrlField,
      isAlive: isAliveField,
      dateOfBirth: dateStringField,
      bloodGroup: boundedText(16),
      education: boundedText(TEXT_LIMITS.shortField),
      occupation: boundedText(TEXT_LIMITS.shortField),
      maritalStatus: boundedText(TEXT_LIMITS.shortField),
      pincode: boundedText(16),
      address: boundedText(TEXT_LIMITS.address),
      area: boundedText(TEXT_LIMITS.shortField),
      visualSide: visualSideField,
    })
    .strip(),
};

export const updateRelationSchema = {
  params: z.object({ id: uuidString }).strip(),
  body: z
    .object({
      targetUserId: uuidString.optional(),
      customName: boundedText(TEXT_LIMITS.name),
      customPhotoUrl: photoUrlField,
      relationTypeCode: relationTypeCode.optional(),
      phone: phoneField.optional(),
      isAlive: isAliveField,
      dateOfBirth: dateStringField,
      bloodGroup: boundedText(16),
      education: boundedText(TEXT_LIMITS.shortField),
      occupation: boundedText(TEXT_LIMITS.shortField),
      maritalStatus: boundedText(TEXT_LIMITS.shortField),
      pincode: boundedText(16),
      address: boundedText(TEXT_LIMITS.address),
      area: boundedText(TEXT_LIMITS.shortField),
    })
    .strip(),
};

export const relationIdSchema = {
  params: z.object({ id: uuidString }).strip(),
};

export const checkAcceptedByPhoneSchema = {
  // This endpoint defaulted to 'en' rather than 'mr'; preserved.
  query: z.object({ phone: phoneField, lang: langQuery('en') }).strip(),
};

export const relationLangOnlySchema = {
  query: z.object({ lang: langQuery('mr') }).strip(),
};
