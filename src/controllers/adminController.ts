// src/controllers/adminController.ts
import crypto from 'crypto';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import prisma from '../lib/prisma';
import { config } from '../config/env';
import { signAdminToken } from '../lib/adminJwt';
import { getOnlineUserIds, isOnline } from '../lib/socket';
import { unauthenticated, notFound, badRequest } from '../lib/errors';
import { createLogger } from '../lib/logger';
import type { AdminRequest } from '../middleware/adminAuth';
import { loadFullTree } from './relationController';
import { getRelationConfig } from './relationTypeController';

const log = createLogger('admin');

/** Hash first so both buffers are equal length, then compare in constant time. */
const safeEqual = (a: string, b: string): boolean => {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
};

export const adminLogin = async (req: Request, res: Response) => {
  const { username, password } = req.body as { username: string; password: string };

  // Evaluate both so timing does not reveal which half was wrong.
  const userOk = safeEqual(username, config.admin.username ?? '');
  const passOk = safeEqual(password, config.admin.password ?? '');
  if (!userOk || !passOk) {
    log.warn({ ip: req.ip }, 'admin login failed');
    throw unauthenticated('Invalid username or password');
  }

  log.info({ ip: req.ip }, 'admin login succeeded');
  return res.json({ token: signAdminToken(config.admin.username!), username: config.admin.username });
};

export const adminMe = (req: AdminRequest, res: Response) => res.json({ username: req.admin!.username });

const notDeleted: Prisma.UserWhereInput = { deletedAt: null };
/** Someone who actually signed up (as opposed to a relative added to a tree by another user). */
const registered: Prisma.UserWhereInput = { deletedAt: null, isRegistered: true };

export const adminStats = async (_req: Request, res: Response) => {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [totalUsers, registeredUsers, newLast7Days] = await Promise.all([
    prisma.user.count({ where: notDeleted }),
    prisma.user.count({ where: registered }),
    prisma.user.count({ where: { ...registered, createdAt: { gte: since } } }),
  ]);
  return res.json({
    totalUsers,
    registeredUsers,
    newLast7Days,
    onlineUsers: getOnlineUserIds().length,
  });
};

const USER_LIST_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  phone: true,
  photoUrl: true,
  gender: true,
  area: true,
  isRegistered: true,
  profileCompleted: true,
  createdAt: true,
} as const;

export const adminListUsers = async (req: Request, res: Response) => {
  const { search, page, limit, online, status } = req.query as unknown as {
    search?: string;
    page: number;
    limit: number;
    online?: 'true' | 'false';
    status: 'registered' | 'all';
  };

  const where: Prisma.UserWhereInput = { ...(status === 'registered' ? registered : notDeleted) };
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search.replace(/\s+/g, '') } },
    ];
  }
  if (online === 'true') where.id = { in: getOnlineUserIds() };
  if (online === 'false') where.id = { notIn: getOnlineUserIds() };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: USER_LIST_SELECT,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return res.json({
    total,
    page,
    limit,
    users: users.map((u) => ({ ...u, online: isOnline(u.id) })),
  });
};

/** A user's family tree, built exactly as that user would see it in the app. */
export const adminUserTree = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const { depth, lang } = req.query as unknown as { depth: number; lang?: string };

  const user = await prisma.user.findFirst({
    where: { id, ...notDeleted },
    select: { ...USER_LIST_SELECT, relationLanguage: true, appLanguage: true },
  });
  if (!user) throw notFound('User not found');

  // Same language fallback the web app applies when it requests the tree.
  const treeLang = lang || user.relationLanguage || user.appLanguage || 'en';
  const { value: tree } = await loadFullTree(id, treeLang, depth, 'FAMILY');

  return res.json({
    lang: treeLang,
    user: { ...user, online: isOnline(user.id) },
    tree,
  });
};

/** Relation metadata the layout engine needs; identical to the app's /relation-types/config. */
export const adminRelationConfig = (req: Request, res: Response) => getRelationConfig(req, res);

export const adminDeletedUsers = async (req: Request, res: Response) => {
  const { search, page, limit } = req.query as unknown as { search?: string; page: number; limit: number };

  const where: Prisma.DeletedUserWhereInput = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { phone: { contains: search.replace(/\s+/g, '') } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.deletedUser.count({ where }),
    prisma.deletedUser.findMany({
      where,
      select: {
        id: true,
        originalUserId: true,
        firstName: true,
        lastName: true,
        phone: true,
        photoUrl: true,
        gender: true,
        area: true,
        reason: true,
        userCreatedAt: true,
        deletedAt: true,
      },
      orderBy: { deletedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return res.json({ total, page, limit, users: rows });
};

/* ── Overview ─────────────────────────────────────────────────────────────── */

/** Days are bucketed in IST, the timezone of the user base. */
const TZ = 'Asia/Kolkata';
const TZ_OFFSET = '+05:30';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RANGE_DAYS = 366;

const istDateString = (d: Date): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d); // YYYY-MM-DD

const istDayStart = (ymd: string): Date => new Date(`${ymd}T00:00:00${TZ_OFFSET}`);

/**
 * "Downloads" = distinct installed devices, counted on the day each device first
 * registered for push notifications. The schema has no store-download data, so
 * this is the closest install signal available without a schema change. It
 * undercounts: installs that never signed in or never granted notification
 * permission are not seen, and a deleted account's tokens are wiped.
 */
async function installsBetween(from: Date, to: Date): Promise<Map<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ day: string; count: number }>>`
    WITH installs AS (
      SELECT MIN("createdAt") AS first_seen
      FROM "PushToken"
      GROUP BY COALESCE("deviceId", "token")
    )
    SELECT to_char(first_seen AT TIME ZONE ${TZ}, 'YYYY-MM-DD') AS day, COUNT(*)::int AS count
    FROM installs
    WHERE first_seen >= ${from} AND first_seen < ${to}
    GROUP BY 1
  `;
  return new Map(rows.map((r) => [r.day, r.count]));
}

export const adminOverview = async (req: Request, res: Response) => {
  const q = req.query as unknown as { range: 'today' | '7d' | '30d' | 'custom'; from?: string; to?: string };

  const today = istDateString(new Date());
  const dayOffset = (n: number) => istDateString(new Date(istDayStart(today).getTime() + n * DAY_MS));

  let fromYmd: string;
  let toYmd = today;
  if (q.range === 'today') fromYmd = today;
  else if (q.range === '7d') fromYmd = dayOffset(-6);
  else if (q.range === '30d') fromYmd = dayOffset(-29);
  else {
    fromYmd = q.from!;
    toYmd = q.to!;
  }

  const spanDays = Math.round((istDayStart(toYmd).getTime() - istDayStart(fromYmd).getTime()) / DAY_MS) + 1;
  if (spanDays > MAX_RANGE_DAYS) throw badRequest(`Date range cannot exceed ${MAX_RANGE_DAYS} days`);

  // One query covers the selected range and the three fixed headline windows.
  const earliest = [fromYmd, dayOffset(-29)].sort()[0];
  const upper = new Date(Math.max(istDayStart(toYmd).getTime(), istDayStart(today).getTime()) + DAY_MS);
  const [byDay, registeredUsers, deletedUsers] = await Promise.all([
    installsBetween(istDayStart(earliest), upper),
    prisma.user.count({ where: registered }),
    prisma.deletedUser.count(),
  ]);

  const eachDay = (startYmd: string, endYmd: string): string[] => {
    const days: string[] = [];
    for (let t = istDayStart(startYmd).getTime(); t <= istDayStart(endYmd).getTime(); t += DAY_MS) {
      days.push(istDateString(new Date(t)));
    }
    return days;
  };
  const sumFrom = (startYmd: string, endYmd: string) =>
    eachDay(startYmd, endYmd).reduce((n, d) => n + (byDay.get(d) ?? 0), 0);

  const series = eachDay(fromYmd, toYmd).map((date) => ({ date, count: byDay.get(date) ?? 0 }));

  return res.json({
    range: { range: q.range, from: fromYmd, to: toYmd },
    downloads: {
      today: sumFrom(today, today),
      last7Days: sumFrom(dayOffset(-6), today),
      last30Days: sumFrom(dayOffset(-29), today),
      selectedTotal: series.reduce((n, p) => n + p.count, 0),
      series,
    },
    users: {
      registered: registeredUsers,
      deleted: deletedUsers,
      total: registeredUsers,
    },
  });
};

/** Everything a person filled in at registration (plus account status), and nothing else. */
const USER_DETAIL_SELECT = {
  id: true,
  firstName: true,
  middleName: true,
  lastName: true,
  photoUrl: true,
  gender: true,
  dateOfBirth: true,
  isAlive: true,
  dateOfDeath: true,
  bloodGroup: true,
  phone: true,
  secondaryPhone: true,
  phoneVerifiedAt: true,
  secondaryPhoneVerifiedAt: true,
  whatsapp: true,
  email: true,
  address: true,
  societyName: true,
  area: true,
  pincode: true,
  religion: true,
  community: true,
  caste: true,
  subcaste: true,
  education: true,
  occupation: true,
  occupationDetails: true,
  designation: true,
  maritalStatus: true,
  matrimonialStatus: true,
  bio: true,
  appLanguage: true,
  relationLanguage: true,
  isRegistered: true,
  profileCompleted: true,
  termsPrivacyAcceptedAt: true,
  termsVersion: true,
  privacyVersion: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const adminUserDetails = async (req: Request, res: Response) => {
  const { id } = req.params as { id: string };
  const user = await prisma.user.findFirst({ where: { id, ...notDeleted }, select: USER_DETAIL_SELECT });
  if (!user) throw notFound('User not found');
  return res.json({ ...user, online: isOnline(user.id) });
};
