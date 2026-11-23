// src/services/phoneIdentityService.ts
/**
 * One definition of "does this phone number already belong to someone?".
 *
 * The same person's number can reach the API as `9876543210`, `919876543210`,
 * `+91 98765 43210` or `09876543210`, and an account can hold it as its primary
 * (`phone`) or its secondary (`secondaryPhone`). Checks that compared the raw
 * string against a single column let duplicates through (a `91`-prefixed copy of
 * someone's secondary number, or a new account whose PRIMARY is another account's
 * secondary). Every uniqueness check now goes through here.
 */
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { phoneLookupVariants, syncPendingRelationsForUser } from './relationReconnectService';

/** National 10-digit form where possible; shorter inputs are returned digits-only. */
export function canonicalPhone(raw?: string | null): string {
  const digits = (raw ?? '').replace(/\D/g, '');
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export const samePhone = (a?: string | null, b?: string | null): boolean => {
  const ca = canonicalPhone(a);
  return ca.length > 0 && ca === canonicalPhone(b);
};

/** `where` fragment matching a number in either column, in any stored format. */
export function phoneMatchWhere(raw: string): Prisma.UserWhereInput {
  const variants = phoneLookupVariants(canonicalPhone(raw));
  return { OR: [{ phone: { in: variants } }, { secondaryPhone: { in: variants } }] };
}

/**
 * The completed (registered) account that owns `raw` as its primary or secondary
 * number, ignoring `excludeUserId` (the caller's own account / the stub they are
 * claiming). Unfinished placeholder rows are not "owners": they are claimed or
 * merged on registration instead.
 */
export function findRegisteredOwner(raw: string, excludeUserId?: string | null) {
  return prisma.user.findFirst({
    where: {
      AND: [
        phoneMatchWhere(raw),
        { profileCompleted: true },
        ...(excludeUserId ? [{ id: { not: excludeUserId } }] : []),
      ],
    },
    select: { id: true, phone: true, secondaryPhone: true },
  });
}

/** User-facing message for a number that is already taken. */
export const numberTakenMessage = (raw: string, kind: 'primary' | 'secondary' = 'primary'): string => {
  const shown = canonicalPhone(raw) || raw;
  return kind === 'secondary'
    ? `The secondary mobile number ${shown} is already registered with another account. Please use a different number.`
    : `The mobile number ${shown} is already registered with another account. Please log in or use a different number.`;
};

/** Prisma unique-constraint violations (P2002) -> the field that clashed. */
export function uniqueViolationField(err: unknown): 'phone' | 'secondaryPhone' | 'email' | null {
  const e = err as { code?: string; meta?: { target?: unknown; driverAdapterError?: { cause?: { constraint?: unknown } } } };
  if (e?.code !== 'P2002') return null;
  const target = JSON.stringify(e.meta?.target ?? e.meta?.driverAdapterError?.cause?.constraint ?? '').toLowerCase();
  if (target.includes('secondaryphone')) return 'secondaryPhone';
  if (target.includes('email')) return 'email';
  if (target.includes('phone')) return 'phone';
  return null;
}

/**
 * Hands a number to the user who has just proven (by OTP) that they own it.
 *
 * Relatives are stored as placeholder accounts that may hold this number in
 * `phone` or `secondaryPhone` (both unique). They are merged into the user, which
 * also delivers the pending relation requests, and any copy that survives is
 * cleared so saving the number on the user cannot hit a unique-constraint error.
 */
export async function claimPlaceholdersForNumber(userId: string, raw: string): Promise<void> {
  await syncPendingRelationsForUser(userId, canonicalPhone(raw)).catch(() => undefined);
  const stubs = { AND: [phoneMatchWhere(raw), { profileCompleted: false }, { id: { not: userId } }] };
  const variants = phoneLookupVariants(canonicalPhone(raw));
  await prisma.user.updateMany({ where: { ...stubs, phone: { in: variants } }, data: { phone: null } });
  await prisma.user.updateMany({ where: { ...stubs, secondaryPhone: { in: variants } }, data: { secondaryPhone: null } });
}
