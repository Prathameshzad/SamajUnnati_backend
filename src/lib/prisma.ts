// src/lib/prisma.ts
import 'dotenv/config';
import { PrismaClient } from '../../generated/prisma/client'; // ⬅️ IMPORTANT
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Use your DATABASE_URL from .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set in .env');
}

// Create a pg pool and Prisma adapter
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool as any); // type fix if TS complains

// Singleton pattern (optional but good in dev to avoid multiple clients)
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === 'development'
        ? ['error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
