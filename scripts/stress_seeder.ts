import prisma from '../src/lib/prisma';
import { Gender, RelationStatus, RelationCategory } from '@prisma/client';
import { faker } from '@faker-js/faker';
import { RELATION_AXIS_CONFIG } from '../src/utils/relationMetadata';

// Configuration
let FAMILY_TARGET = 800;
let FRIEND_TARGET = 2500;
let COMMUNITY_COUNT = 40;
let DENSITY_MULTIPLIER = 1;
let POST_TARGET = 1200;
let MESSAGE_TARGET = 1500;

function applyScaling(mode: string) {
  if (mode === 'seed:dense') {
    DENSITY_MULTIPLIER = 5;
    FRIEND_TARGET = 5000;
    POST_TARGET = 3000;
  } else if (mode === 'seed:huge') {
    FAMILY_TARGET = 5000;
    FRIEND_TARGET = 20000;
    COMMUNITY_COUNT = 150;
    POST_TARGET = 10000;
    MESSAGE_TARGET = 20000;
  }
}

interface RelationDef {
  code: string;
  category: RelationCategory;
  reciprocalCode: string | null;
  treeLevel: number | null;
  targetGender: Gender | null;
}

async function clearData() {
  console.log('Clearing existing graph data...');
  // Delete in order to satisfy FK constraints
  await prisma.notification.deleteMany({});
  await prisma.relation.deleteMany({});
  await prisma.messageRead.deleteMany({});
  await prisma.message.deleteMany({});
  await prisma.conversationMember.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.storyView.deleteMany({});
  await prisma.story.deleteMany({});
  await prisma.postLike.deleteMany({});
  await prisma.postComment.deleteMany({});
  await prisma.postShare.deleteMany({});
  await prisma.postMedia.deleteMany({});
  await prisma.post.deleteMany({});
  await prisma.follow.deleteMany({});
  await prisma.userBlock.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('Data cleared.');
}

async function getRelationDefs(): Promise<Map<string, RelationDef>> {
  const types = await prisma.relationType.findMany();
  const map = new Map<string, RelationDef>();
  types.forEach(t => {
    map.set(t.code, {
      code: t.code,
      category: t.category as RelationCategory,
      reciprocalCode: t.reciprocalCode,
      treeLevel: t.treeLevel,
      targetGender: t.targetGender as Gender | null,
    });
  });
  return map;
}

function getRandomStatus(): RelationStatus {
  // For stress testing, we want all relations visible immediately
  return 'CONFIRMED';
}

let userCounter = 0;

async function createFakeUser(overrides: any = {}) {
  const gender = overrides.gender || (Math.random() > 0.5 ? 'MALE' : 'FEMALE');
  
  // Destructure custom fields that aren't in Prisma schema
  const { treeLevel, relationTypeCode, ...prismaData } = overrides;

  userCounter++;
  // Ensure a unique phone number by appending a counter
  const phoneSuffix = userCounter.toString().padStart(6, '0');
  const basePhone = overrides.phone || `900${phoneSuffix}`;

  const user = await prisma.user.create({
    data: {
      firstName: faker.person.firstName(gender.toLowerCase() as any),
      lastName: faker.person.lastName(),
      phone: basePhone,
      email: `test${userCounter}@samajunati.com`,
      gender: gender as Gender,
      profileCompleted: true,
      isRegistered: true,
      isAlive: Math.random() > 0.1,
      community: 'Test Community',
      religion: 'Hindu',
      worldX: 0,
      worldY: 0,
      ...prismaData
    }
  });

  // Attach virtual fields for seeder logic
  return { ...user, treeLevel, relationTypeCode };
}

async function seedFamily(rootUser: any, relDefs: Map<string, RelationDef>) {
  console.log('Generating Family Graph...');
  const familyUsers = [rootUser];
  let processedCount = 0;
  
  const familyDefs = Array.from(relDefs.values()).filter(d => d.category === 'FAMILY');
  
  // Levels map to track counts for X positioning
  const levelCounts: Record<number, number> = { 0: 1 };

  while (familyUsers.length < FAMILY_TARGET && processedCount < familyUsers.length) {
    const currentUser = familyUsers[processedCount++];
    const currentLevel = (currentUser as any).treeLevel || 0;
    
    // Decide number of relatives to add
    const numToCreate = Math.floor(Math.random() * 4) + 1;
    
    for (let i = 0; i < numToCreate; i++) {
      if (familyUsers.length >= FAMILY_TARGET) break;

      // Pick a random family relation that's valid for this user's axis
      const axis = RELATION_AXIS_CONFIG[currentUser.relationTypeCode || 'ROOT'] || RELATION_AXIS_CONFIG['ROOT'];
      const allOptions = [...axis.xAxis.left, ...axis.xAxis.right, ...axis.yAxis.top, ...axis.yAxis.bottom];
      const familyOptions = allOptions.filter(o => {
        const def = relDefs.get(o.code);
        return def && def.category === 'FAMILY';
      });

      if (familyOptions.length === 0) continue;
      const option = familyOptions[Math.floor(Math.random() * familyOptions.length)];
      const def = relDefs.get(option.code)!;

      // Determine level and position
      let nextLevel = currentLevel;
      if (option.direction === 'UP') nextLevel += 1;
      if (option.direction === 'DOWN') nextLevel -= 1;

      levelCounts[nextLevel] = (levelCounts[nextLevel] || 0) + 1;
      
      const newUser = await createFakeUser({
        gender: def.targetGender || (Math.random() > 0.5 ? 'MALE' : 'FEMALE'),
        worldX: (levelCounts[nextLevel] - 1) * 600 - 2000, // Spread siblings
        worldY: nextLevel * -1000, // Generational vertical gap
        treeLevel: nextLevel
      });

      await prisma.relation.create({
        data: {
          fromUserId: currentUser.id,
          toUserId: newUser.id,
          relationTypeCode: def.code,
          category: 'FAMILY',
          status: getRandomStatus(),
          createdById: rootUser.id
        }
      });

      (newUser as any).treeLevel = nextLevel;
      (newUser as any).relationTypeCode = def.code;
      familyUsers.push(newUser);
    }
  }
  console.log(`Family graph generated with ${familyUsers.length} users.`);
}

async function seedFriends(rootUser: any, relDefs: Map<string, RelationDef>) {
  console.log('Generating Deep Friend Graph (Mutuals of Mutuals)...');
  const friendUsers: any[] = [rootUser];
  const queue: any[] = [rootUser];
  let processedCount = 0;

  // Target 2000+ friends
  while (friendUsers.length < FRIEND_TARGET && queue.length > 0) {
    const currentUser = queue.shift();
    processedCount++;

    // Each user has 1-4 friends
    const numFriends = Math.floor(Math.random() * (4 * DENSITY_MULTIPLIER)) + 1;
    
    for (let i = 0; i < numFriends; i++) {
      if (friendUsers.length >= FRIEND_TARGET) break;

      // Positioning: Move slightly away from the current user to create a "social path"
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * 1500 + 800;
      
      const newUser = await createFakeUser({
        worldX: currentUser.worldX + Math.cos(angle) * dist,
        worldY: currentUser.worldY + Math.sin(angle) * dist,
      });

      await prisma.relation.create({
        data: {
          fromUserId: currentUser.id,
          toUserId: newUser.id,
          relationTypeCode: 'MITRA',
          category: 'FRIEND',
          status: 'CONFIRMED',
          createdById: rootUser.id
        }
      });

      friendUsers.push(newUser);
      queue.push(newUser); // Add to queue for "mutual's friends"
    }

    // Occasionally create a "Mutual Connection" (Triangle)
    if (Math.random() > 0.6 && friendUsers.length > 10) {
      const u1 = friendUsers[friendUsers.length - 1];
      const u2 = friendUsers[friendUsers.length - 5];
      if (u1 && u2 && u1.id !== u2.id) {
        await prisma.relation.upsert({
          where: {
            fromUserId_toUserId_relationTypeCode: {
              fromUserId: u1.id,
              toUserId: u2.id,
              relationTypeCode: 'MITRA'
            }
          },
          update: {},
          create: {
            fromUserId: u1.id,
            toUserId: u2.id,
            relationTypeCode: 'MITRA',
            category: 'FRIEND',
            status: 'CONFIRMED',
            createdById: rootUser.id
          }
        });
      }
    }
  }

  // Final Pass: Create Hubs/Connectors for "Long-range" mutuals
  console.log('Creating long-range community links...');
  for (let i = 0; i < 300 * DENSITY_MULTIPLIER; i++) {
    const u1 = friendUsers[Math.floor(Math.random() * friendUsers.length)];
    const u2 = friendUsers[Math.floor(Math.random() * friendUsers.length)];
    if (!u1 || !u2 || u1.id === u2.id) continue;

    await prisma.relation.upsert({
      where: {
        fromUserId_toUserId_relationTypeCode: {
          fromUserId: u1.id,
          toUserId: u2.id,
          relationTypeCode: 'MITRA'
        }
      },
      update: {},
      create: {
        fromUserId: u1.id,
        toUserId: u2.id,
        relationTypeCode: 'MITRA',
        category: 'FRIEND',
        status: 'CONFIRMED',
        createdById: rootUser.id
      }
    });
  }

  console.log(`Friend graph generated with ${friendUsers.length} users and deep paths.`);
}

async function seedSocialContent(users: any[]) {
  console.log(`Generating Social Content (${POST_TARGET} posts, ${MESSAGE_TARGET} messages)...`);
  
  // 1. Posts, Likes, Comments
  for (let i = 0; i < POST_TARGET; i++) {
    const author = users[Math.floor(Math.random() * users.length)];
    const post = await prisma.post.create({
      data: {
        userId: author.id,
        caption: faker.lorem.sentence(),
        location: faker.location.city(),
        media: {
          create: [
            {
              url: `https://picsum.photos/seed/${Math.random()}/800/800`,
              type: 'PHOTO',
              order: 0
            }
          ]
        }
      }
    });

    // Add 0-10 likes
    const numLikes = Math.floor(Math.random() * 10);
    for (let j = 0; j < numLikes; j++) {
      const liker = users[Math.floor(Math.random() * users.length)];
      await prisma.postLike.upsert({
        where: { postId_userId: { postId: post.id, userId: liker.id } },
        update: {},
        create: { userId: liker.id, postId: post.id }
      });
    }

    // Add 0-5 comments
    const numComments = Math.floor(Math.random() * 5);
    for (let j = 0; j < numComments; j++) {
      const commenter = users[Math.floor(Math.random() * users.length)];
      await prisma.postComment.create({
        data: {
          userId: commenter.id,
          postId: post.id,
          content: faker.lorem.paragraph().slice(0, 200)
        }
      });
    }
  }

  // 2. Messaging (Conversations & Messages)
  // Create ~200 conversations
  const convs: any[] = [];
  for (let i = 0; i < 200; i++) {
    const u1 = users[Math.floor(Math.random() * users.length)];
    const u2 = users[Math.floor(Math.random() * users.length)];
    if (u1.id === u2.id) continue;

    const conv = await prisma.conversation.create({
      data: {
        category: Math.random() > 0.5 ? 'FAMILY' : 'FRIEND',
        createdById: u1.id,
        members: {
          create: [
            { userId: u1.id, role: 'ADMIN' },
            { userId: u2.id, role: 'MEMBER' }
          ]
        }
      }
    });
    convs.push({ id: conv.id, u1Id: u1.id, u2Id: u2.id });
  }

  // Generate 1500+ messages across these conversations
  for (let i = 0; i < MESSAGE_TARGET; i++) {
    const conv = convs[Math.floor(Math.random() * convs.length)];
    const senderId = Math.random() > 0.5 ? conv.u1Id : conv.u2Id;
    
    await prisma.message.create({
      data: {
        conversationId: conv.id,
        senderId: senderId,
        content: faker.lorem.sentence()
      }
    });
  }

  console.log('Social content generated.');
}

async function logStats() {
  const userCount = await prisma.user.count();
  const relCount = await prisma.relation.count();
  const famCount = await prisma.relation.count({ where: { category: 'FAMILY' } });
  const friCount = await prisma.relation.count({ where: { category: 'FRIEND' } });
  const postCount = await prisma.post.count();
  const commCount = await prisma.postComment.count();
  const msgCount = await prisma.message.count();

  console.log('\n--- GRAPH STATISTICS ---');
  console.log(`Total Users: ${userCount}`);
  console.log(`Total Relations: ${relCount}`);
  console.log(`  Family: ${famCount}`);
  console.log(`  Friend: ${friCount}`);
  console.log(`Social Activity:`);
  console.log(`  Posts: ${postCount}`);
  console.log(`  Comments: ${commCount}`);
  console.log(`  Messages: ${msgCount}`);
  console.log(`Memory Estimate: ~${(userCount * 0.5 + relCount * 0.2).toFixed(2)} KB (Client Side)`);
  console.log('------------------------\n');
}

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'seed:all';

  if (command === 'seed:clear') {
    await clearData();
    return;
  }

  applyScaling(command);

  const relDefs = await getRelationDefs();
  
  let root = await prisma.user.findFirst({ where: { phone: '9999999999' } });
  if (!root) {
    root = await createFakeUser({
      firstName: 'Graph',
      lastName: 'Root',
      phone: '9999999999',
      worldX: 0,
      worldY: 0
    });
  }

  if (command === 'seed:family' || command === 'seed:all' || command === 'seed:dense' || command === 'seed:huge') {
    await seedFamily(root, relDefs);
  }
  
  if (command === 'seed:friends' || command === 'seed:all' || command === 'seed:dense' || command === 'seed:huge') {
    await seedFriends(root, relDefs);
  }

  // Social content for all users
  if (command === 'seed:all' || command === 'seed:dense' || command === 'seed:huge') {
    const allUsers = await prisma.user.findMany();
    await seedSocialContent(allUsers);
  }

  await logStats();
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
