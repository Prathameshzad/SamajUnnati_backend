// src/lib/prisma.ts
import 'dotenv/config';
import { PrismaClient } from '../../generated/prisma/client'; // ⬅️ IMPORTANT
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const { Pool } = pg;

// Use your DATABASE_URL from .env
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('CRITICAL: DATABASE_URL is not set in .env or environment variables. Database operations will fail.');
}

// Create a pg pool and Prisma adapter
const poolConfig: any = {
  connectionString: connectionString || '',
  max: 5, // Keep small to avoid max connection limits on free tiers
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
};

// Render postgres databases require SSL for external connections
// Also check RENDER environment variable which is automatically set on Render
if (connectionString?.includes('render.com') || process.env.RENDER) {
  poolConfig.ssl = { rejectUnauthorized: false };
}

const pool = new Pool(poolConfig);
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
