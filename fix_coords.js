const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixNullCoords() {
  console.log('Fixing null world coordinates...');
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { worldX: null },
        { worldY: null }
      ]
    }
  });

  console.log(`Found ${users.length} users with missing coordinates.`);

  for (const user of users) {
    const x = (Math.random() - 0.5) * 50000;
    const y = (Math.random() - 0.5) * 50000;
    await prisma.user.update({
      where: { id: user.id },
      data: { worldX: x, worldY: y }
    });
    console.log(`Updated user ${user.phone || user.id}`);
  }

  console.log('Done!');
}

fixNullCoords()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
