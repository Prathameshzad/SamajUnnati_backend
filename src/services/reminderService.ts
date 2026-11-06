// src/services/reminderService.ts
/**
 * Daily birthday and death-anniversary reminders.
 *
 * Runs once a day (see `startReminderScheduler`). For every person whose birthday,
 * or recorded date of death, falls on today's calendar day, each registered person
 * connected to them by a confirmed relation (family or friend) gets a notification.
 *
 * Idempotent: a notification is skipped if one for the same recipient, subject and
 * type was already created today. That makes the startup catch-up run, a manual
 * re-run, and multiple server instances all safe.
 *
 * "Today" is the calendar day in `REMINDER_TIMEZONE`, not the server's — a
 * container in UTC would otherwise announce birthdays 5.5 hours late.
 */
import cron, { type ScheduledTask } from 'node-cron';
import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';
import { createNotification } from './notificationService';

const log = createLogger('reminders');

const REMINDER_TIMEZONE = 'Asia/Kolkata';
const SEND_HOUR = 8;

interface Subject {
  id: string;
  firstName: string | null;
  lastName: string | null;
  photoUrl: string | null;
  dateOfBirth: Date | null;
  dateOfDeath: Date | null;
}

const BIRTHDAY_LINES: Array<(name: string, age: number | null) => string> = [
  (n, a) => `🎂 It's ${n}'s birthday${a ? ` — ${a} today` : ''}! Wish them before the cake is gone.`,
  (n) => `🎉 ${n} is a year wiser today. Go say Happy Birthday — free to send, priceless to receive!`,
  (n) => `🥳 Psst... it's ${n}'s birthday! A quick wish will make their day.`,
  (n, a) => `🎈 ${n} ${a ? `turns ${a}` : 'has a birthday'} today. Don't be the last one to wish!`,
];

const fullName = (u: Subject) => [u.firstName, u.lastName].filter(Boolean).join(' ') || 'Your relative';

/** Today's month/day/year in the reminder timezone. */
function todayParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REMINDER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** Midnight (reminder timezone) at the start of today, as a UTC instant. IST has no DST. */
function startOfToday(now = new Date()): Date {
  const { year, month, day } = todayParts(now);
  return new Date(Date.parse(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00+05:30`));
}

const SUBJECT_SELECT = `"id", "firstName", "lastName", "photoUrl", "dateOfBirth", "dateOfDeath"`;

async function findBirthdaySubjects(month: number, day: number, year: number): Promise<Subject[]> {
  // Feb 29 birthdays are celebrated on Feb 28 in non-leap years.
  const leapDayToo = month === 2 && day === 28 && !isLeap(year);
  return prisma.$queryRawUnsafe<Subject[]>(
    `SELECT ${SUBJECT_SELECT} FROM "User"
     WHERE "deletedAt" IS NULL AND "isAlive" = true AND "dateOfBirth" IS NOT NULL
       AND ((EXTRACT(MONTH FROM "dateOfBirth") = $1 AND EXTRACT(DAY FROM "dateOfBirth") = $2)
            ${leapDayToo ? `OR (EXTRACT(MONTH FROM "dateOfBirth") = 2 AND EXTRACT(DAY FROM "dateOfBirth") = 29)` : ''})`,
    month,
    day
  );
}

async function findAnniversarySubjects(month: number, day: number, year: number): Promise<Subject[]> {
  const leapDayToo = month === 2 && day === 28 && !isLeap(year);
  // Year < current: the day someone passes away is not yet an anniversary.
  return prisma.$queryRawUnsafe<Subject[]>(
    `SELECT ${SUBJECT_SELECT} FROM "User"
     WHERE "deletedAt" IS NULL AND "isAlive" = false AND "dateOfDeath" IS NOT NULL
       AND EXTRACT(YEAR FROM "dateOfDeath") < $3
       AND ((EXTRACT(MONTH FROM "dateOfDeath") = $1 AND EXTRACT(DAY FROM "dateOfDeath") = $2)
            ${leapDayToo ? `OR (EXTRACT(MONTH FROM "dateOfDeath") = 2 AND EXTRACT(DAY FROM "dateOfDeath") = 29)` : ''})`,
    month,
    day,
    year
  );
}

/** subjectId -> ids of registered users who should hear about them. */
async function findRecipients(subjectIds: string[]): Promise<Map<string, Set<string>>> {
  const out = new Map<string, Set<string>>();
  if (subjectIds.length === 0) return out;

  const relations = await prisma.relation.findMany({
    where: {
      status: 'CONFIRMED',
      deletedAt: null,
      category: { in: ['FAMILY', 'FRIEND'] },
      OR: [{ fromUserId: { in: subjectIds } }, { toUserId: { in: subjectIds } }],
    },
    select: {
      fromUserId: true,
      toUserId: true,
      hiddenByUserIds: true,
      fromUser: { select: { isRegistered: true, isAlive: true, deletedAt: true } },
      toUser: { select: { isRegistered: true, isAlive: true, deletedAt: true } },
    },
  });

  const subjects = new Set(subjectIds);
  const add = (subjectId: string, recipientId: string, r: (typeof relations)[number], who: 'fromUser' | 'toUser') => {
    const recipient = r[who];
    if (!recipient.isRegistered || !recipient.isAlive || recipient.deletedAt) return;
    if (r.hiddenByUserIds.includes(recipientId)) return;
    if (!out.has(subjectId)) out.set(subjectId, new Set());
    out.get(subjectId)!.add(recipientId);
  };

  for (const r of relations) {
    if (subjects.has(r.fromUserId)) add(r.fromUserId, r.toUserId, r, 'toUser');
    if (subjects.has(r.toUserId)) add(r.toUserId, r.fromUserId, r, 'fromUser');
  }
  return out;
}

async function alreadySent(type: 'BIRTHDAY_REMINDER' | 'DEATH_ANNIVERSARY', subjectIds: string[], since: Date) {
  const rows = await prisma.notification.findMany({
    where: { type, subjectUserId: { in: subjectIds }, createdAt: { gte: since } },
    select: { userId: true, subjectUserId: true },
  });
  return new Set(rows.map((r) => `${r.userId}:${r.subjectUserId}`));
}

async function dispatch(
  type: 'BIRTHDAY_REMINDER' | 'DEATH_ANNIVERSARY',
  subjects: Subject[],
  build: (s: Subject) => { title: string; message: string },
  since: Date
): Promise<number> {
  if (subjects.length === 0) return 0;
  const recipients = await findRecipients(subjects.map((s) => s.id));
  const sent = await alreadySent(type, subjects.map((s) => s.id), since);

  let count = 0;
  for (const subject of subjects) {
    const { title, message } = build(subject);
    for (const userId of recipients.get(subject.id) ?? []) {
      if (userId === subject.id || sent.has(`${userId}:${subject.id}`)) continue;
      const created = await createNotification({
        userId,
        type,
        title,
        message,
        subjectUserId: subject.id,
        imageUrl: subject.photoUrl,
      });
      if (created) count += 1;
    }
  }
  return count;
}

export async function sendDailyReminders(now = new Date()): Promise<{ birthdays: number; anniversaries: number }> {
  const { year, month, day } = todayParts(now);
  const since = startOfToday(now);

  const birthdaySubjects = await findBirthdaySubjects(month, day, year);
  const birthdays = await dispatch(
    'BIRTHDAY_REMINDER',
    birthdaySubjects,
    (s) => {
      const name = fullName(s);
      const age = s.dateOfBirth ? year - s.dateOfBirth.getUTCFullYear() : null;
      const line = BIRTHDAY_LINES[Math.floor(Math.random() * BIRTHDAY_LINES.length)];
      return { title: 'Birthday today 🎂', message: line(name, age && age > 0 ? age : null) };
    },
    since
  );

  const anniversarySubjects = await findAnniversarySubjects(month, day, year);
  const anniversaries = await dispatch(
    'DEATH_ANNIVERSARY',
    anniversarySubjects,
    (s) => {
      const years = year - s.dateOfDeath!.getUTCFullYear();
      return {
        title: 'Remembrance day 🕯️',
        message: `Today is the ${years === 1 ? 'first' : `${years}-year`} death anniversary of ${fullName(s)}. Take a moment to remember and pay your respects.`,
      };
    },
    since
  );

  log.info({ birthdays, anniversaries }, 'daily reminders sent');
  return { birthdays, anniversaries };
}

let task: ScheduledTask | null = null;

export function startReminderScheduler(): void {
  if (task) return;
  const run = () =>
    sendDailyReminders().catch((err) => log.error({ err }, 'daily reminders failed'));

  task = cron.schedule(`0 ${SEND_HOUR} * * *`, run, { timezone: REMINDER_TIMEZONE });

  // Catch-up if the server was down at the send time. Dedupe makes this safe.
  if (todayParts().hour >= SEND_HOUR) void run();
}

export async function stopReminderScheduler(): Promise<void> {
  await task?.stop();
  task = null;
}
