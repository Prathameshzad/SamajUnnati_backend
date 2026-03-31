
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const types = await prisma.relationType.findMany({
    select: { code: true, category: true }
  });
  console.log(JSON.stringify(types, null, 2));
  process.exit(0);
}
check();
