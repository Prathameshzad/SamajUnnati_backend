import prisma from '../src/lib/prisma';

async function main() {
  const users = await prisma.user.findMany({ where: { firstName: { contains: 'Vinesh' } } });
  console.log('Users found:', users.map((u: any) => ({ id: u.id, name: u.firstName + ' ' + u.lastName })));
  if (users.length > 0) {
    const rootId = users[0].id;
    const relations = await prisma.relation.findMany({
      where: { OR: [{ fromUserId: rootId }, { toUserId: rootId }] },
      include: { relationType: true, fromUser: true, toUser: true }
    });
    console.log('Total relations for root:', relations.length);
    for (const r of relations) {
      console.log(`rel: ${r.fromUser?.firstName} -> ${r.toUser?.firstName} (${r.relationType?.code}) sourceUserId=${r.sourceUserId}`);
    }
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
