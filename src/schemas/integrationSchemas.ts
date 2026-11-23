// src/schemas/integrationSchemas.ts
import { z } from 'zod';
import { uuidParam } from './common';

export const reportListUsersSchema = {
  query: z
    .object({
      search: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).max(100_000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
      online: z.enum(['true', 'false']).optional(),
      /** `registered` = completed sign-up; `all` also includes relatives added by others. */
      status: z.enum(['registered', 'all']).default('all'),
    })
    .strip(),
};

export const reportUserTreeSchema = {
  params: uuidParam('id'),
  query: z
    .object({
      depth: z.coerce.number().int().min(1).max(25).default(20),
      lang: z.string().trim().min(2).max(10).optional(),
    })
    .strip(),
};

export const reportRelationConfigSchema = {
  query: z.object({ lang: z.string().trim().min(2).max(10).optional() }).strip(),
};

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD');

export const reportOverviewSchema = {
  query: z
    .object({
      range: z.enum(['today', '7d', '30d', 'custom']).default('7d'),
      from: ymd.optional(),
      to: ymd.optional(),
    })
    .strip()
    .refine((q) => q.range !== 'custom' || (q.from && q.to && q.from <= q.to), {
      message: 'custom range needs from <= to',
    }),
};

export const reportDeletedUsersSchema = {
  query: z
    .object({
      search: z.string().trim().max(100).optional(),
      page: z.coerce.number().int().min(1).max(100_000).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    })
    .strip(),
};

export const reportUserDetailsSchema = { params: uuidParam('id') };
