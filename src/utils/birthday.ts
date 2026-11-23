// src/utils/birthday.ts
/**
 * Birthdays where the year is often unknown.
 *
 * Families usually know a relative's birthday (day and month) but not the year
 * they were born. `dateOfBirth` is a full date, so the day and month are stored
 * separately in `birthDay` / `birthMonth`:
 *
 *   - Full date known   -> dateOfBirth = that date, birthDay/birthMonth derived from it.
 *   - Only day + month  -> dateOfBirth = null, birthDay/birthMonth set.
 *   - Nothing           -> all three null.
 *
 * Reminders match on birthDay/birthMonth, so both cases get a birthday wish.
 * Anything needing an age (matrimony, "turns 60 today") still reads dateOfBirth
 * and simply has no age when the year is unknown.
 */

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export interface BirthdayFields {
  dateOfBirth: Date | null;
  birthDay: number | null;
  birthMonth: number | null;
}

function toInt(value: unknown): number | null {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

/** Day and month form a real calendar day (Feb 29 allowed, as some birthdays are). */
export function isValidDayMonth(day: number | null, month: number | null): boolean {
  if (day === null || month === null) return false;
  if (month < 1 || month > 12) return false;
  return day >= 1 && day <= DAYS_IN_MONTH[month - 1];
}

/**
 * Reads the birthday from a request body. Returns `undefined` when the body says
 * nothing about it, so an update leaves the stored value alone; an explicit empty
 * value (`null` / `''` on any of the three keys) clears it.
 */
export function resolveBirthday(body: {
  dateOfBirth?: unknown;
  birthDay?: unknown;
  birthMonth?: unknown;
}): BirthdayFields | undefined {
  const touched = ['dateOfBirth', 'birthDay', 'birthMonth'].some(
    (key) => Object.prototype.hasOwnProperty.call(body, key) && (body as Record<string, unknown>)[key] !== undefined
  );
  if (!touched) return undefined;

  if (body.dateOfBirth) {
    const d = new Date(String(body.dateOfBirth));
    if (!Number.isNaN(d.getTime())) {
      return { dateOfBirth: d, birthDay: d.getUTCDate(), birthMonth: d.getUTCMonth() + 1 };
    }
  }

  const day = toInt(body.birthDay);
  const month = toInt(body.birthMonth);
  if (isValidDayMonth(day, month)) {
    return { dateOfBirth: null, birthDay: day, birthMonth: month };
  }

  return { dateOfBirth: null, birthDay: null, birthMonth: null };
}
