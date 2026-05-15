// scripts/init_world_coords.ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany();
  console.log(`Updating ${users.length} users...`);

  for (const user of users) {
    // Assign a semi-random position in a 100k x 100k grid
    const worldX = (Math.random() - 0.5) * 50000;
    const worldY = (Math.random() - 0.5) * 50000;

    await prisma.user.update({
      where: { id: user.id },
      data: { worldX, worldY }
    });
  }

  console.log('Done!');
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());
