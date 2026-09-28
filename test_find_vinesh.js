const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.user.findMany({ where: { firstName: { contains: 'Vinesh', mode: 'insensitive' } } }).then(u => {
  console.log('All Vinesh users:', u.map(x => ({ id: x.id, name: `${x.firstName} ${x.lastName}`, phone: x.phone })));
  p.$disconnect();
});
