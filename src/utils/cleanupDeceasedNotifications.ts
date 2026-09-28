import prisma from '../lib/prisma';
import { createLogger } from '../lib/logger';

const log = createLogger('cleanup-deceased');

async function main() {
  log.info('Starting cleanup of deceased notifications and relations...');

  // 1. Delete notifications where target relative is deceased
  const deceasedNotifs = await prisma.notification.findMany({
    where: {
      relation: {
        toUser: {
          isAlive: false,
        },
      },
    },
    select: { id: true, title: true, message: true },
  });

  log.info({ count: deceasedNotifs.length }, 'Found deceased relation notifications to remove');

  if (deceasedNotifs.length > 0) {
    const notifIds = deceasedNotifs.map(n => n.id);
    const deleteResult = await prisma.notification.deleteMany({
      where: { id: { in: notifIds } },
    });
    log.info({ deleted: deleteResult.count }, 'Deleted deceased notifications successfully');
  }

  // 2. Update relations with deceased individuals from PENDING to CONFIRMED
  const pendingDeceasedRelations = await prisma.relation.updateMany({
    where: {
      toUser: {
        isAlive: false,
      },
      status: 'PENDING',
    },
    data: {
      status: 'CONFIRMED',
    },
  });

  log.info({ updated: pendingDeceasedRelations.count }, 'Updated pending deceased relations to CONFIRMED');
}

main()
  .catch((err) => {
    log.error({ err }, 'Error during cleanup');
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
