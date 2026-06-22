require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const father = await prisma.relationType.findUnique({
    where: { code: 'FATHER' },
    include: { translations: true }
  });
  console.log("FATHER: ", JSON.stringify(father, null, 2));

  const vadil = await prisma.relationType.findUnique({
    where: { code: 'VADIL' },
    include: { translations: true }
  });
  console.log("VADIL: ", JSON.stringify(vadil, null, 2));
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
