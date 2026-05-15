// scripts/init_coords_v3.js
const prisma = require('../dist/lib/prisma').default;

async function main() {
  console.log('Fetching users...');
  const users = await prisma.user.findMany();
  console.log(`Updating ${users.length} users...`);

  for (const user of users) {
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
