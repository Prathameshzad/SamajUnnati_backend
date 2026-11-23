// src/services/relativePhoneService.ts
/**
 * Up to two phone numbers for a relative who is added to a tree.
 *
 * The person adding a relative often does not know which of the relative's
 * numbers they will register with, so they may enter two. The relation request
 * then reaches the relative on whichever one they sign up or log in with.
 *
 * No schema change: a not-yet-registered relative is a placeholder `User` row,
 * and its numbers use the same columns a registered user's do:
 *
 *   1st number -> `phone`
 *   2nd number -> `secondaryPhone`
 *
 * (`whatsapp` keeps its existing meaning and just mirrors the primary number.)
 * `relationReconnectService.syncPendingRelationsForUser` matches placeholders on
 * both columns, so when the relative registers with either number the placeholder
 * is merged into their account and the pending request is delivered to them.
 */
import prisma from '../lib/prisma';
import { badRequest } from '../lib/errors';
import { phoneLookupVariants } from './relationReconnectService';

export const MAX_RELATIVE_PHONES = 2;

const last10 = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
};

/**
 * Normalises `phones` (and the legacy single `phone`) into 0..2 distinct 10-digit
 * numbers. Throws a 400 for an invalid number or for more than two.
 */
export function normalizeRelativePhones(input: { phone?: unknown; phones?: unknown }): string[] {
  const raw: unknown[] = [];
  if (Array.isArray(input.phones)) raw.push(...input.phones);
  if (input.phone !== undefined && input.phone !== null) raw.push(input.phone);

  const out: string[] = [];
  for (const value of raw) {
    if (typeof value !== 'string' || value.trim() === '') continue;
    const normalized = last10(value);
    if (normalized.length < 10) throw badRequest(`Invalid phone number: ${value}`);
    if (!out.includes(normalized)) out.push(normalized);
  }

  if (out.length > MAX_RELATIVE_PHONES) {
    throw badRequest(`You can add at most ${MAX_RELATIVE_PHONES} phone numbers for a person`);
  }
  return out;
}

/**
 * Finds an existing user owning ANY of the numbers as their primary or secondary
 * number. Real accounts are preferred over placeholders.
 */
export async function findUserByAnyPhone(phones: string[]) {
  if (phones.length === 0) return null;
  const variants = Array.from(new Set(phones.flatMap((p) => phoneLookupVariants(p))));
  return prisma.user.findFirst({
    where: { OR: [{ phone: { in: variants } }, { secondaryPhone: { in: variants } }] },
    orderBy: [{ profileCompleted: 'desc' }, { isRegistered: 'desc' }],
  });
}

/** Column values for a brand-new placeholder holding up to two numbers. */
export function placeholderPhoneFields(phones: string[]) {
  return {
    phone: phones[0] ?? null,
    secondaryPhone: phones[1] ?? null,
    whatsapp: phones[0] ?? null,
  };
}

/**
 * For an existing placeholder, returns the column updates that store a number it
 * does not already know about in its empty slot. Registered accounts are never
 * modified: their numbers belong to them. A number already owned by a different
 * account is skipped rather than risking a unique-constraint clash.
 */
export async function placeholderPhoneUpdates(
  user: {
    id: string;
    profileCompleted: boolean;
    phone: string | null;
    secondaryPhone: string | null;
  },
  phones: string[]
): Promise<{ phone?: string; secondaryPhone?: string }> {
  if (user.profileCompleted) return {};

  const known = new Set([user.phone, user.secondaryPhone].filter(Boolean).map((p) => last10(p!)));
  const updates: { phone?: string; secondaryPhone?: string } = {};

  for (const number of phones) {
    if (known.has(number)) continue;

    const owned = await prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [
          { phone: { in: phoneLookupVariants(number) } },
          { secondaryPhone: { in: phoneLookupVariants(number) } },
        ],
      },
      select: { id: true },
    });
    if (owned) continue;

    if (!user.phone && !updates.phone) updates.phone = number;
    else if (!user.secondaryPhone && !updates.secondaryPhone) updates.secondaryPhone = number;
    else continue;

    known.add(number);
  }
  return updates;
}
