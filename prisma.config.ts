// prisma.config.ts (ROOT pe)
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  // schema ka path
  schema: 'prisma/schema.prisma',

  // migrations + seed setup
  migrations: {
    path: 'prisma/migrations',
    seed: 'node ./prisma/seed.js',
  },

  // Prisma 7: datasource URL yahan se aayega
  datasource: {
    url: env('DATABASE_URL'),
  },
});
