import { getFullTree } from '../src/controllers/relationController';
import prisma from '../src/lib/prisma';
import {
  COUSIN_CODES,
  COUSIN_PARENT_MAP,
  RELATION_AXIS_CONFIG,
  RELATION_LEVEL_MAP,
  RELATION_X_ORDER,
  SPOUSE_PAIRS,
} from '../src/utils/relationMetadata';
import { buildLayout } from '../../mobile/components/layoutEngine';
import { NODE_WIDTH } from '../../mobile/components/layoutEngine/types';

function displayName(user: any) {
  return `${user?.firstName || ''} ${user?.lastName || ''}`.trim();
}

async function fetchFullTreeForUser(userId: string) {
  let statusCode = 200;
  let payload: any;

  const req: any = {
    user: { id: userId },
    query: { depth: '20', category: 'FAMILY' },
  };

  const res: any = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: any) {
      payload = body;
      return body;
    },
  };

  await getFullTree(req, res);
  if (statusCode >= 400) {
    throw new Error(`getFullTree failed with ${statusCode}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function main() {
  const phone = process.argv[2] || '9049817355';
  const user = await prisma.user.findUnique({
    where: { phone },
    select: { id: true, phone: true, firstName: true, lastName: true },
  });

  if (!user) {
    throw new Error(`No user found for phone ${phone}`);
  }

  const data = await fetchFullTreeForUser(user.id);
  const config = {
    metadata: Object.fromEntries(
      Object.entries(RELATION_LEVEL_MAP).map(([code, level]) => [
        code,
        {
          level,
          vg: level > 0 ? 'UP' : level < 0 ? 'DOWN' : 'SAME',
        },
      ])
    ),
    spousePairs: SPOUSE_PAIRS,
    axisConfig: RELATION_AXIS_CONFIG,
    cousinCodes: COUSIN_CODES,
    cousinParentMap: COUSIN_PARENT_MAP,
    xOrder: RELATION_X_ORDER,
  };

  const layout = buildLayout(data, config as any);
  const nodes = Object.values(layout.positions)
    .map((node: any) => ({
      id: node.userId,
      name: node.name,
      code: node.relationCode || 'ROOT',
      x: Math.round(node.x),
      centerX: Math.round(node.x + NODE_WIDTH / 2),
      y: Math.round(node.y),
      isAlive: node.isAlive,
    }))
    .sort((a, b) => a.y - b.y || a.x - b.x);

  const interesting = nodes.filter(node =>
    /Ashwini|Gayatri|Prakash Lal|Vasur|Ram Chavan|Kamal Chavan/i.test(node.name)
  );

  console.log(JSON.stringify({
    root: displayName(user),
    phone,
    interesting,
  }, null, 2));
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
