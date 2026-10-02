/* eslint-disable no-console */
require('dotenv').config({ quiet: true });
const { Pool } = require('pg');

const DEMO_PHONE = '9999900001';
const DEMO_EMAIL_SUFFIX = '@screenshot-demo.samajunnati.invalid';
const ALLOW_REMOTE = process.argv.includes('--allow-remote');

function classifyDatabase(connectionString) {
  const url = new URL(connectionString);
  const host = url.hostname.toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '0.0.0.0' ||
    /^127\./.test(host);
  return { host, isLocal, protocol: url.protocol };
}

function ago({ minutes = 0, hours = 0, days = 0 }) {
  return new Date(Date.now() - (((days * 24 + hours) * 60 + minutes) * 60 * 1000));
}

function ahead(hours) {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// Direct image URLs avoid the redirect-based placeholders that some Android image
// loaders fail to display. These are public demo assets and contain no user data.
const DEMO_IMAGES = {
  'samaj-aarav': 'https://randomuser.me/api/portraits/men/32.jpg',
  'samaj-rajesh': 'https://randomuser.me/api/portraits/men/52.jpg',
  'samaj-sunita': 'https://randomuser.me/api/portraits/women/44.jpg',
  'samaj-rohan': 'https://randomuser.me/api/portraits/men/65.jpg',
  'samaj-ananya': 'https://randomuser.me/api/portraits/women/65.jpg',
  'samaj-mahesh': 'https://randomuser.me/api/portraits/men/75.jpg',
  'samaj-kavita': 'https://randomuser.me/api/portraits/women/68.jpg',
  'samaj-aditya': 'https://randomuser.me/api/portraits/men/46.jpg',
  'samaj-isha': 'https://randomuser.me/api/portraits/women/47.jpg',
  'samaj-neha': 'https://randomuser.me/api/portraits/women/58.jpg',
  'samaj-banner': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1400&h=600&q=85',
  'samaj-community-gathering': 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-festival-lights': 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-festival-family': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-festival-food': 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-fort-sunrise': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-family-evening': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-heritage-one': 'https://images.unsplash.com/photo-1533929736458-ca588d08c8be?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-heritage-two': 'https://images.unsplash.com/photo-1524230572899-a752b3835840?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-garden-bloom': 'https://images.unsplash.com/photo-1490750967868-88aa4486c946?auto=format&fit=crop&w=1200&h=900&q=85',
  'samaj-story-aarav-morning': 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=720&h=1280&q=85',
  'samaj-story-aarav-meetup': 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?auto=format&fit=crop&w=720&h=1280&q=85',
  'samaj-story-ananya-sketch': 'https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=720&h=1280&q=85',
  'samaj-story-aditya-photo': 'https://images.unsplash.com/photo-1452780212940-6f5c0d14d848?auto=format&fit=crop&w=720&h=1280&q=85',
  'samaj-story-sunita-class': 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=720&h=1280&q=85',
  'samaj-family-group': 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=600&h=600&q=85',
  'samaj-chat-family': 'https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1000&h=800&q=85',
  'samaj-aarav-matrimony': 'https://randomuser.me/api/portraits/men/33.jpg',
};

function resolveDemoImage(url) {
  if (!url) return url;
  const seed = url.match(/\/seed\/([^/]+)/)?.[1];
  return (seed && DEMO_IMAGES[seed]) || url;
}

const users = [
  {
    key: 'main', id: '10000000-0000-4000-8000-000000000001', phone: DEMO_PHONE,
    firstName: 'Aarav', lastName: 'Deshmukh', gender: 'MALE', occupation: 'Product Designer',
    occupationDetails: 'Building digital products for communities', dateOfBirth: '1996-05-18',
    area: 'Kothrud, Pune', pincode: '411038', bio: 'Designer, traveller, and community volunteer. Always happy to reconnect with family and friends.',
    photo: 'https://picsum.photos/seed/samaj-aarav/600/600',
    banner: 'https://picsum.photos/seed/samaj-banner/1400/600', worldX: 0, worldY: 0,
  },
  {
    key: 'father', id: '10000000-0000-4000-8000-000000000002', phone: '9999900011',
    firstName: 'Rajesh', lastName: 'Deshmukh', gender: 'MALE', occupation: 'Civil Engineer',
    area: 'Pune', bio: 'Family first. Engineer by profession and gardener by passion.',
    photo: 'https://picsum.photos/seed/samaj-rajesh/600/600', worldX: -450, worldY: -800,
  },
  {
    key: 'mother', id: '10000000-0000-4000-8000-000000000003', phone: '9999900012',
    firstName: 'Sunita', lastName: 'Deshmukh', gender: 'FEMALE', occupation: 'Teacher',
    area: 'Pune', bio: 'Teacher, reader, and the happiest host at every family gathering.',
    photo: 'https://picsum.photos/seed/samaj-sunita/600/600', worldX: 450, worldY: -800,
  },
  {
    key: 'brother', id: '10000000-0000-4000-8000-000000000004', phone: '9999900013',
    firstName: 'Rohan', lastName: 'Deshmukh', gender: 'MALE', occupation: 'Software Engineer',
    area: 'Bengaluru', bio: 'Code, cricket, and weekend road trips.',
    photo: 'https://picsum.photos/seed/samaj-rohan/600/600', worldX: -500, worldY: 0,
  },
  {
    key: 'sister', id: '10000000-0000-4000-8000-000000000005', phone: '9999900014',
    firstName: 'Ananya', lastName: 'Kulkarni', gender: 'FEMALE', occupation: 'Architect',
    area: 'Mumbai', bio: 'Architect with a love for heritage spaces and sketching.',
    photo: 'https://picsum.photos/seed/samaj-ananya/600/600', worldX: 500, worldY: 0,
  },
  {
    key: 'uncle', id: '10000000-0000-4000-8000-000000000006', phone: '9999900015',
    firstName: 'Mahesh', lastName: 'Deshmukh', gender: 'MALE', occupation: 'Business Owner',
    area: 'Nashik', bio: 'Entrepreneur and enthusiastic family historian.',
    photo: 'https://picsum.photos/seed/samaj-mahesh/600/600', worldX: -900, worldY: -650,
  },
  {
    key: 'aunt', id: '10000000-0000-4000-8000-000000000007', phone: '9999900016',
    firstName: 'Kavita', lastName: 'Patil', gender: 'FEMALE', occupation: 'Doctor',
    area: 'Kolhapur', bio: 'Doctor, classical music listener, and proud aunt.',
    photo: 'https://picsum.photos/seed/samaj-kavita/600/600', worldX: 900, worldY: -650,
  },
  {
    key: 'friendMale', id: '10000000-0000-4000-8000-000000000008', phone: '9999900017',
    firstName: 'Aditya', lastName: 'Joshi', gender: 'MALE', occupation: 'Photographer',
    area: 'Pune', bio: 'Capturing people, places, and honest moments.',
    photo: 'https://picsum.photos/seed/samaj-aditya/600/600', worldX: -900, worldY: 600,
  },
  {
    key: 'friendFemale', id: '10000000-0000-4000-8000-000000000009', phone: '9999900018',
    firstName: 'Isha', lastName: 'Shah', gender: 'FEMALE', occupation: 'Marketing Consultant',
    area: 'Mumbai', bio: 'Brand storyteller, foodie, and long-time friend.',
    photo: 'https://picsum.photos/seed/samaj-isha/600/600', worldX: 900, worldY: 600,
  },
  {
    key: 'requester', id: '10000000-0000-4000-8000-000000000010', phone: '9999900019',
    firstName: 'Neha', lastName: 'Deshpande', gender: 'FEMALE', occupation: 'Researcher',
    area: 'Nagpur', bio: 'Researcher interested in local history and community archives.',
    photo: 'https://picsum.photos/seed/samaj-neha/600/600', worldX: 1200, worldY: 250,
  },
];

const relationFixtures = [
  { key: 'father', from: 'main', to: 'father', preferredCodes: ['VADIL'], status: 'CONFIRMED' },
  { key: 'mother', from: 'main', to: 'mother', preferredCodes: ['AAI'], status: 'CONFIRMED' },
  { key: 'brother', from: 'main', to: 'brother', preferredCodes: ['BHAU'], status: 'CONFIRMED' },
  { key: 'sister', from: 'main', to: 'sister', preferredCodes: ['BAHIN'], status: 'CONFIRMED' },
  { key: 'uncle', from: 'main', to: 'uncle', preferredCodes: ['KAKA', 'CHULTA'], status: 'CONFIRMED' },
  { key: 'aunt', from: 'main', to: 'aunt', preferredCodes: ['AATYA', 'MAVSHI'], status: 'CONFIRMED' },
  { key: 'friendMale', from: 'main', to: 'friendMale', preferredCodes: ['MITRA'], status: 'CONFIRMED' },
  { key: 'friendFemale', from: 'main', to: 'friendFemale', preferredCodes: ['MAITRIN', 'MITRA'], status: 'CONFIRMED' },
  { key: 'pending', from: 'requester', to: 'main', preferredCodes: ['MAMBAHIN', 'CHULAT_BAHIN', 'BAHIN'], status: 'PENDING' },
];

const postFixtures = [
  { key: 'welcome', author: 'main', caption: 'Grateful for a beautiful community meet-up filled with stories, laughter, and new connections. 💙', location: 'Pune, Maharashtra', hours: 2, media: ['community-gathering'] },
  { key: 'festival', author: 'main', caption: 'Celebrating traditions with the people who make every moment special. ✨', location: 'Kothrud, Pune', hours: 26, media: ['festival-lights', 'festival-family', 'festival-food'] },
  { key: 'travel', author: 'main', caption: 'A quiet sunrise, fresh air, and a reminder to slow down.', location: 'Sinhagad Fort', hours: 74, media: ['fort-sunrise'] },
  { key: 'family', author: 'sister', caption: 'Nothing beats an unplanned family evening and old stories around the table.', location: 'Mumbai', hours: 8, media: ['family-evening'] },
  { key: 'photo', author: 'friendMale', caption: 'Frames from this weekend’s heritage walk. Which one is your favourite?', location: 'Shaniwar Wada, Pune', hours: 18, media: ['heritage-one', 'heritage-two'] },
  { key: 'garden', author: 'father', caption: 'The first flowers of the season are finally here. 🌿', location: 'Pune', hours: 45, media: ['garden-bloom'] },
];

const messageFixtures = [
  { conversation: 'friend', sender: 'friendMale', minutes: 190, text: 'Hey Aarav! The photos from the community event turned out really well.' },
  { conversation: 'friend', sender: 'main', minutes: 186, text: 'That is great! Send me your favourites when you get a chance.' },
  { conversation: 'friend', sender: 'friendMale', minutes: 180, text: 'Absolutely. I especially liked the candid family-tree discussion.' },
  { conversation: 'friend', sender: 'main', minutes: 174, text: 'Perfect for our next post. Let us shortlist a few tonight.' },
  { conversation: 'friend', sender: 'friendMale', minutes: 12, text: 'Shared the final selection. Take a look when you are free 👍' },
  { conversation: 'sister', sender: 'sister', minutes: 95, text: 'Are you coming home for dinner this weekend?' },
  { conversation: 'sister', sender: 'main', minutes: 91, text: 'Yes! Saturday evening works perfectly for me.' },
  { conversation: 'sister', sender: 'sister', minutes: 88, text: 'Great, Aai is already planning the menu 😄' },
  { conversation: 'sister', sender: 'main', minutes: 83, text: 'Tell her I requested puran poli!' },
  { conversation: 'sister', sender: 'sister', minutes: 6, text: 'Done. See you Saturday!' },
  { conversation: 'family', sender: 'main', minutes: 70, text: 'Welcome everyone! Let us use this group for family updates and photos.' },
  { conversation: 'family', sender: 'mother', minutes: 65, text: 'Lovely idea. It will be much easier to stay connected here.' },
  { conversation: 'family', sender: 'father', minutes: 61, text: 'I have added the dates for our next get-together.' },
  { conversation: 'family', sender: 'brother', minutes: 55, text: 'Count me in. I will be travelling from Bengaluru on Friday.' },
  { conversation: 'family', sender: 'sister', minutes: 50, text: 'I can help with the invitations and photos.' },
  { conversation: 'family', sender: 'main', minutes: 43, text: 'Wonderful. I will create a shared post after the event.' },
  { conversation: 'family', sender: 'mother', minutes: 22, text: 'Looking forward to seeing everyone together ❤️' },
];

async function upsertUser(client, fixture) {
  const email = `${fixture.key}${DEMO_EMAIL_SUFFIX}`;
  const result = await client.query(
    `INSERT INTO "User" (
      "id", "phone", "email", "photoUrl", "bannerUrl", "address", "pincode",
      "designation", "dateOfBirth", "createdAt", "updatedAt", "gender", "area",
      "bloodGroup", "community", "caste", "subcaste", "education", "firstName",
      "lastName", "maritalStatus", "occupation", "occupationDetails", "religion",
      "whatsapp", "profileCompleted", "bio", "isAlive", "isPrivate", "isRegistered",
      "appLanguage", "relationLanguage", "worldX", "worldY"
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$2,true,$24,true,false,true,'en','en',$25,$26
    )
    ON CONFLICT ("phone") DO UPDATE SET
      "email"=EXCLUDED."email", "photoUrl"=EXCLUDED."photoUrl", "bannerUrl"=EXCLUDED."bannerUrl",
      "address"=EXCLUDED."address", "pincode"=EXCLUDED."pincode", "designation"=EXCLUDED."designation",
      "dateOfBirth"=EXCLUDED."dateOfBirth", "updatedAt"=EXCLUDED."updatedAt", "gender"=EXCLUDED."gender",
      "area"=EXCLUDED."area", "bloodGroup"=EXCLUDED."bloodGroup", "community"=EXCLUDED."community",
      "caste"=EXCLUDED."caste", "subcaste"=EXCLUDED."subcaste", "education"=EXCLUDED."education",
      "firstName"=EXCLUDED."firstName", "lastName"=EXCLUDED."lastName", "maritalStatus"=EXCLUDED."maritalStatus",
      "occupation"=EXCLUDED."occupation", "occupationDetails"=EXCLUDED."occupationDetails",
      "religion"=EXCLUDED."religion", "whatsapp"=EXCLUDED."whatsapp", "profileCompleted"=true,
      "bio"=EXCLUDED."bio", "isAlive"=true, "isPrivate"=false, "isRegistered"=true,
      "appLanguage"='en', "relationLanguage"='en', "worldX"=EXCLUDED."worldX", "worldY"=EXCLUDED."worldY"
    RETURNING "id"`,
    [
      fixture.id, fixture.phone, email, resolveDemoImage(fixture.photo), resolveDemoImage(fixture.banner) || null,
      fixture.area ? `${fixture.area}, Maharashtra, India` : null, fixture.pincode || '411038',
      fixture.occupation, fixture.dateOfBirth ? new Date(fixture.dateOfBirth) : new Date('1990-01-01'),
      ago({ days: 120 }), fixture.gender, fixture.area, fixture.key === 'main' ? 'B+' : null,
      'Maratha', 'Maratha', '96 Kuli', fixture.key === 'main' ? 'Bachelor of Design' : 'Graduate',
      fixture.firstName, fixture.lastName, fixture.key === 'main' ? 'Single' : 'Married',
      fixture.occupation, fixture.occupationDetails || null, 'Hindu', fixture.bio,
      fixture.worldX, fixture.worldY,
    ]
  );
  return result.rows[0].id;
}

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured');
  const target = classifyDatabase(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Screenshot seeder requires PostgreSQL');
  }
  if (!target.isLocal && !ALLOW_REMOTE) {
    throw new Error(`Refusing to seed non-local database host "${target.host}". Use --allow-remote only after explicit review.`);
  }

  console.log(`Database target: ${target.isLocal ? 'local' : 'remote override'} (${target.host})`);
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const phones = users.map((user) => user.phone);
    const existing = await client.query(
      `SELECT "phone", "email" FROM "User" WHERE "phone" = ANY($1::text[])`,
      [phones]
    );
    for (const row of existing.rows) {
      if (!row.email || !row.email.endsWith(DEMO_EMAIL_SUFFIX)) {
        throw new Error(`Phone ${row.phone} already belongs to a non-demo account; no data was changed.`);
      }
    }

    const relationTypesResult = await client.query(
      `SELECT "code", "category" FROM "RelationType"`
    );
    const relationTypes = new Map(relationTypesResult.rows.map((row) => [row.code, row.category]));

    const userIds = {};
    for (const fixture of users) {
      userIds[fixture.key] = await upsertUser(client, fixture);
    }

    const relationIds = {};
    for (let index = 0; index < relationFixtures.length; index += 1) {
      const fixture = relationFixtures[index];
      const code = fixture.preferredCodes.find((candidate) => relationTypes.has(candidate));
      if (!code) {
        throw new Error(`No supported relation type found for ${fixture.key}: ${fixture.preferredCodes.join(', ')}`);
      }
      const category = relationTypes.get(code);
      const approvedAt = fixture.status === 'CONFIRMED' ? ago({ days: 30 - index }) : null;
      const result = await client.query(
        `INSERT INTO "Relation" (
          "id", "fromUserId", "toUserId", "status", "createdAt", "updatedAt",
          "relationTypeCode", "category", "visualSide", "createdById", "hiddenByUserIds", "approvedAt"
        ) VALUES ($1,$2,$3,$4,$5,$5,$6,$7,$8,$9,'{}'::text[],$10)
        ON CONFLICT ("fromUserId", "toUserId", "relationTypeCode") DO UPDATE SET
          "status"=EXCLUDED."status", "updatedAt"=EXCLUDED."updatedAt", "category"=EXCLUDED."category",
          "visualSide"=EXCLUDED."visualSide", "createdById"=EXCLUDED."createdById",
          "hiddenByUserIds"='{}'::text[], "deletedAt"=NULL, "approvedAt"=EXCLUDED."approvedAt"
        RETURNING "id"`,
        [
          `20000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
          userIds[fixture.from], userIds[fixture.to], fixture.status, ago({ days: 35 - index }),
          code, category, index % 2 === 0 ? 'LEFT' : 'RIGHT',
          fixture.status === 'PENDING' ? userIds.requester : userIds.main, approvedAt,
        ]
      );
      relationIds[fixture.key] = result.rows[0].id;
    }

    const postIds = {};
    for (let index = 0; index < postFixtures.length; index += 1) {
      const fixture = postFixtures[index];
      const id = `30000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      const createdAt = ago({ hours: fixture.hours });
      await client.query(
        `INSERT INTO "Post" ("id","userId","caption","location","privacy","taggedUserIds","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'BOTH','{}'::text[],$5,$5)
         ON CONFLICT ("id") DO UPDATE SET "userId"=EXCLUDED."userId", "caption"=EXCLUDED."caption",
           "location"=EXCLUDED."location", "privacy"='BOTH', "deletedAt"=NULL,
           "createdAt"=EXCLUDED."createdAt", "updatedAt"=EXCLUDED."updatedAt"`,
        [id, userIds[fixture.author], fixture.caption, fixture.location, createdAt]
      );
      postIds[fixture.key] = id;

      for (let mediaIndex = 0; mediaIndex < fixture.media.length; mediaIndex += 1) {
        const mediaId = `31000000-0000-4000-${String(index + 1).padStart(4, '0')}-${String(mediaIndex + 1).padStart(12, '0')}`;
        await client.query(
          `INSERT INTO "PostMedia" ("id","postId","url","type","order") VALUES ($1,$2,$3,'PHOTO',$4)
           ON CONFLICT ("id") DO UPDATE SET "postId"=EXCLUDED."postId", "url"=EXCLUDED."url", "type"='PHOTO', "order"=EXCLUDED."order"`,
          [mediaId, id, resolveDemoImage(`https://picsum.photos/seed/samaj-${fixture.media[mediaIndex]}/1200/900`), mediaIndex]
        );
      }
    }

    const likePairs = [
      ['welcome', 'father'], ['welcome', 'mother'], ['welcome', 'sister'], ['welcome', 'friendMale'], ['welcome', 'friendFemale'],
      ['festival', 'father'], ['festival', 'mother'], ['festival', 'brother'], ['festival', 'sister'], ['festival', 'aunt'],
      ['travel', 'friendMale'], ['travel', 'friendFemale'], ['family', 'main'], ['family', 'mother'], ['photo', 'main'], ['garden', 'main'],
    ];
    for (let index = 0; index < likePairs.length; index += 1) {
      const [postKey, userKey] = likePairs[index];
      await client.query(
        `INSERT INTO "PostLike" ("id","postId","userId","createdAt") VALUES ($1,$2,$3,$4)
         ON CONFLICT ("postId","userId") DO UPDATE SET "createdAt"=EXCLUDED."createdAt"`,
        [`32000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, postIds[postKey], userIds[userKey], ago({ minutes: 30 + index * 7 })]
      );
    }

    const comments = [
      ['welcome', 'mother', 'Such a wonderful day. Proud of everyone who helped organise it!', null],
      ['welcome', 'friendFemale', 'Beautiful memories and such warm photographs 💙', null],
      ['festival', 'sister', 'This carousel captures the celebration perfectly!', null],
      ['festival', 'father', 'A tradition becomes more meaningful when the whole family joins.', null],
      ['travel', 'friendMale', 'That sunrise was worth the early start.', null],
      ['family', 'main', 'Already looking forward to the next family evening!', null],
      ['photo', 'main', 'The second frame is my favourite. Excellent work!', null],
      ['garden', 'mother', 'Your patience with the garden has paid off beautifully.', null],
    ];
    const commentIds = [];
    for (let index = 0; index < comments.length; index += 1) {
      const [postKey, userKey, content] = comments[index];
      const id = `33000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      commentIds.push(id);
      await client.query(
        `INSERT INTO "PostComment" ("id","postId","userId","content","createdAt") VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT ("id") DO UPDATE SET "postId"=EXCLUDED."postId", "userId"=EXCLUDED."userId",
           "content"=EXCLUDED."content", "deletedAt"=NULL, "createdAt"=EXCLUDED."createdAt"`,
        [id, postIds[postKey], userIds[userKey], content, ago({ minutes: 20 + index * 9 })]
      );
    }
    await client.query(
      `INSERT INTO "PostComment" ("id","postId","userId","content","parentId","createdAt") VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT ("id") DO UPDATE SET "content"=EXCLUDED."content", "parentId"=EXCLUDED."parentId", "deletedAt"=NULL`,
      ['33000000-0000-4000-8000-000000000009', postIds.welcome, userIds.main,
        'Thank you! It was truly a team effort.', commentIds[0], ago({ minutes: 8 })]
    );

    const storyFixtures = [
      ['main-one', 'main', 'Morning walk and a fresh start to the day.', 'story-aarav-morning', 1, true],
      ['main-two', 'main', 'A quick glimpse from our community meetup.', 'story-aarav-meetup', 3, false],
      ['sister', 'sister', 'Sketching details from a heritage building.', 'story-ananya-sketch', 4, false],
      ['friend', 'friendMale', 'Behind the scenes from today’s photo walk.', 'story-aditya-photo', 5, false],
      ['mother', 'mother', 'Today’s classroom activity was full of creativity.', 'story-sunita-class', 7, false],
    ];
    const storyIds = {};
    for (let index = 0; index < storyFixtures.length; index += 1) {
      const [key, author, caption, seedName, hours, treePin] = storyFixtures[index];
      const id = `34000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      storyIds[key] = id;
      await client.query(
        `INSERT INTO "Story" ("id","userId","mediaUrl","mediaType","caption","audience","treePin","mentions","expiresAt","createdAt")
         VALUES ($1,$2,$3,'PHOTO',$4,'BOTH',$5,'{}'::text[],$6,$7)
         ON CONFLICT ("id") DO UPDATE SET "userId"=EXCLUDED."userId", "mediaUrl"=EXCLUDED."mediaUrl",
           "mediaType"='PHOTO', "caption"=EXCLUDED."caption", "audience"='BOTH', "treePin"=EXCLUDED."treePin",
           "deletedAt"=NULL, "expiresAt"=EXCLUDED."expiresAt", "createdAt"=EXCLUDED."createdAt"`,
        [id, userIds[author], resolveDemoImage(`https://picsum.photos/seed/samaj-${seedName}/720/1280`), caption, treePin, ahead(48), ago({ hours })]
      );
    }

    const storyViews = [
      ['main-one', 'father'], ['main-one', 'mother'], ['main-one', 'friendFemale'],
      ['main-two', 'sister'], ['main-two', 'friendMale'], ['sister', 'main'], ['mother', 'main'],
    ];
    for (let index = 0; index < storyViews.length; index += 1) {
      const [storyKey, viewerKey] = storyViews[index];
      await client.query(
        `INSERT INTO "StoryView" ("id","storyId","userId","viewedAt") VALUES ($1,$2,$3,$4)
         ON CONFLICT ("storyId","userId") DO UPDATE SET "viewedAt"=EXCLUDED."viewedAt"`,
        [`35000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, storyIds[storyKey], userIds[viewerKey], ago({ minutes: 15 + index * 3 })]
      );
    }

    const conversationFixtures = {
      friend: { id: '40000000-0000-4000-8000-000000000001', name: null, category: 'FRIEND', members: ['main', 'friendMale'], updatedMinutes: 12 },
      sister: { id: '40000000-0000-4000-8000-000000000002', name: null, category: 'FAMILY', members: ['main', 'sister'], updatedMinutes: 6 },
      family: { id: '40000000-0000-4000-8000-000000000003', name: 'Deshmukh Family Circle', category: 'FAMILY', members: ['main', 'father', 'mother', 'brother', 'sister'], updatedMinutes: 22 },
    };
    let conversationIndex = 0;
    for (const fixture of Object.values(conversationFixtures)) {
      conversationIndex += 1;
      await client.query(
        `INSERT INTO "Conversation" ("id","name","photoUrl","isGroup","category","createdById","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT ("id") DO UPDATE SET "name"=EXCLUDED."name", "photoUrl"=EXCLUDED."photoUrl",
           "isGroup"=EXCLUDED."isGroup", "category"=EXCLUDED."category", "createdById"=EXCLUDED."createdById",
           "updatedAt"=EXCLUDED."updatedAt"`,
        [fixture.id, fixture.name, fixture.name ? resolveDemoImage('https://picsum.photos/seed/samaj-family-group/600/600') : null,
          fixture.members.length > 2, fixture.category, userIds.main, ago({ days: 45 }), ago({ minutes: fixture.updatedMinutes })]
      );
      for (let memberIndex = 0; memberIndex < fixture.members.length; memberIndex += 1) {
        const memberKey = fixture.members[memberIndex];
        await client.query(
          `INSERT INTO "ConversationMember" ("id","conversationId","userId","role","joinedAt","lastReadAt")
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT ("conversationId","userId") DO UPDATE SET "role"=EXCLUDED."role", "lastReadAt"=EXCLUDED."lastReadAt"`,
          [`41000000-0000-4000-${String(conversationIndex).padStart(4, '0')}-${String(memberIndex + 1).padStart(12, '0')}`,
            fixture.id, userIds[memberKey], memberKey === 'main' ? 'ADMIN' : 'MEMBER', ago({ days: 45 }),
            memberKey === 'main' && fixture.id.endsWith('0001') ? ago({ minutes: 20 }) : ago({ minutes: 2 })]
        );
      }
    }

    const messageIds = [];
    for (let index = 0; index < messageFixtures.length; index += 1) {
      const fixture = messageFixtures[index];
      const id = `42000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`;
      messageIds.push(id);
      await client.query(
        `INSERT INTO "Message" ("id","conversationId","senderId","content","type","createdAt","updatedAt")
         VALUES ($1,$2,$3,$4,'TEXT',$5,$5)
         ON CONFLICT ("id") DO UPDATE SET "conversationId"=EXCLUDED."conversationId", "senderId"=EXCLUDED."senderId",
           "content"=EXCLUDED."content", "type"='TEXT', "deletedAt"=NULL, "createdAt"=EXCLUDED."createdAt", "updatedAt"=EXCLUDED."updatedAt"`,
        [id, conversationFixtures[fixture.conversation].id, userIds[fixture.sender], fixture.text, ago({ minutes: fixture.minutes })]
      );
    }
    await client.query(
      `INSERT INTO "Message" ("id","conversationId","senderId","content","mediaUrl","mediaType","type","createdAt","updatedAt")
       VALUES ($1,$2,$3,$4,$5,'PHOTO','MEDIA',$6,$6)
       ON CONFLICT ("id") DO UPDATE SET "content"=EXCLUDED."content", "mediaUrl"=EXCLUDED."mediaUrl",
         "mediaType"='PHOTO', "type"='MEDIA', "deletedAt"=NULL, "createdAt"=EXCLUDED."createdAt", "updatedAt"=EXCLUDED."updatedAt"`,
      ['42000000-0000-4000-8000-000000000018', conversationFixtures.family.id, userIds.sister,
        'A favourite photo from our last get-together', resolveDemoImage('https://picsum.photos/seed/samaj-chat-family/1000/800'), ago({ minutes: 35 })]
    );

    for (let index = 0; index < messageIds.length - 2; index += 1) {
      await client.query(
        `INSERT INTO "MessageRead" ("id","messageId","userId","readAt") VALUES ($1,$2,$3,$4)
         ON CONFLICT ("messageId","userId") DO UPDATE SET "readAt"=EXCLUDED."readAt"`,
        [`43000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, messageIds[index], userIds.main, ago({ minutes: 2 })]
      );
    }

    const follows = [
      ['main', 'friendMale', 'ACCEPTED'], ['friendFemale', 'main', 'ACCEPTED'], ['requester', 'main', 'PENDING'],
    ];
    for (let index = 0; index < follows.length; index += 1) {
      const [follower, following, status] = follows[index];
      await client.query(
        `INSERT INTO "Follow" ("id","followerId","followingId","status","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$5)
         ON CONFLICT ("followerId","followingId") DO UPDATE SET "status"=EXCLUDED."status", "updatedAt"=EXCLUDED."updatedAt"`,
        [`44000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, userIds[follower], userIds[following], status, ago({ days: 12 - index })]
      );
    }

    const notifications = [
      ['RELATION_REQUEST', 'New relation request', 'Neha Deshpande wants to connect as your cousin.', relationIds.pending, null, 'UNREAD', 4],
      ['POST_COMMENT', 'New comment', 'Sunita commented on your community meetup post.', null, postIds.welcome, 'UNREAD', 18],
      ['POST_LIKE', 'Your post is getting attention', 'Isha and 4 others liked your recent post.', null, postIds.welcome, 'UNREAD', 35],
      ['RELATION_APPROVED', 'Relation confirmed', 'Kavita Patil confirmed your family relation.', relationIds.aunt, null, 'READ', 90],
      ['FOLLOW_ACCEPTED', 'Follow request accepted', 'Aditya Joshi accepted your follow request.', null, null, 'READ', 160],
      ['POST_COMMENT', 'New comment', 'Ananya commented on your festival post.', null, postIds.festival, 'READ', 260],
    ];
    for (let index = 0; index < notifications.length; index += 1) {
      const [type, title, message, relationId, postId, state, minutes] = notifications[index];
      const createdAt = ago({ minutes });
      await client.query(
        `INSERT INTO "Notification" ("id","userId","type","title","message","relationId","state","createdAt","readAt","postId")
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT ("id") DO UPDATE SET "type"=EXCLUDED."type", "title"=EXCLUDED."title",
           "message"=EXCLUDED."message", "relationId"=EXCLUDED."relationId", "state"=EXCLUDED."state",
           "createdAt"=EXCLUDED."createdAt", "readAt"=EXCLUDED."readAt", "postId"=EXCLUDED."postId"`,
        [`45000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, userIds.main, type, title, message,
          relationId, state, createdAt, state === 'READ' ? ago({ minutes: Math.max(1, minutes - 5) }) : null, postId]
      );
    }

    await client.query(
      `INSERT INTO "MatrimonyProfile" (
        "id","userId","isLookingForMarriage","photos","height","complexion","education","occupation","income",
        "lifestyle","languages","religion","community","caste","subcaste","bio","hobbies","interests",
        "isVerified","visibility","profileType","isClaimed","createdAt","updatedAt"
      ) VALUES ($1,$2,true,$3::text[],178,'Wheatish','Bachelor of Design','Product Designer','₹12–18 LPA',
        'Active, non-smoker',$4::text[],'Hindu','Maratha','Maratha','96 Kuli',$5,$6::text[],$7::text[],true,'PUBLIC','SELF',true,$8,$8)
      ON CONFLICT ("userId") DO UPDATE SET "photos"=EXCLUDED."photos", "height"=EXCLUDED."height",
        "complexion"=EXCLUDED."complexion", "education"=EXCLUDED."education", "occupation"=EXCLUDED."occupation",
        "income"=EXCLUDED."income", "lifestyle"=EXCLUDED."lifestyle", "languages"=EXCLUDED."languages",
        "religion"=EXCLUDED."religion", "community"=EXCLUDED."community", "caste"=EXCLUDED."caste",
        "subcaste"=EXCLUDED."subcaste", "bio"=EXCLUDED."bio", "hobbies"=EXCLUDED."hobbies",
        "interests"=EXCLUDED."interests", "isVerified"=true, "visibility"='PUBLIC', "profileType"='SELF',
        "isClaimed"=true, "updatedAt"=EXCLUDED."updatedAt"`,
      ['46000000-0000-4000-8000-000000000001', userIds.main,
        [resolveDemoImage(users[0].photo), resolveDemoImage('https://picsum.photos/seed/samaj-aarav-matrimony/900/1100')],
        ['Marathi', 'Hindi', 'English'],
        'Curious, grounded, and close to family. Looking for a kind and ambitious life partner.',
        ['Photography', 'Trekking', 'Cooking'], ['Design', 'Travel', 'Community service'], ago({ days: 90 })]
    );

    const scoreResult = await client.query(
      `INSERT INTO "UserScore" ("id","userId","total","level","updatedAt") VALUES ($1,$2,180,3,$3)
       ON CONFLICT ("userId") DO UPDATE SET "total"=180, "level"=3, "updatedAt"=EXCLUDED."updatedAt"
       RETURNING "id"`,
      ['47000000-0000-4000-8000-000000000001', userIds.main, new Date()]
    );
    const scoreId = scoreResult.rows[0].id;
    const scoreEvents = [
      ['ADD_ALIVE', 40], ['RELATION_APPROVED', 40], ['POST_CREATE', 35], ['STORY_CREATE', 25], ['POST_CREATE', 40],
    ];
    for (let index = 0; index < scoreEvents.length; index += 1) {
      const [reason, points] = scoreEvents[index];
      const operationKey = `screenshot-demo-v1-${index + 1}`;
      await client.query(
        `INSERT INTO "ScoreEvent" ("id","userId","points","reason","operationKey","createdAt") VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT ("operationKey") DO UPDATE SET "userId"=EXCLUDED."userId", "points"=EXCLUDED."points",
           "reason"=EXCLUDED."reason", "createdAt"=EXCLUDED."createdAt"`,
        [`48000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, scoreId, points, reason, operationKey, ago({ days: 20 - index })]
      );
    }

    await client.query('COMMIT');

    const summary = await pool.query(
      `SELECT
        (SELECT count(*)::int FROM "Relation" r WHERE (r."fromUserId"=$1 OR r."toUserId"=$1) AND r."status"='CONFIRMED' AND r."deletedAt" IS NULL) AS "confirmedRelations",
        (SELECT count(*)::int FROM "Relation" r WHERE r."toUserId"=$1 AND r."status"='PENDING' AND r."deletedAt" IS NULL) AS "pendingRelations",
        (SELECT count(*)::int FROM "Post" p WHERE p."userId"=$1 AND p."deletedAt" IS NULL) AS "ownPosts",
        (SELECT count(*)::int FROM "Story" s WHERE (s."userId"=$1 OR s."userId" IN ($2,$3,$4)) AND s."expiresAt">now() AND s."deletedAt" IS NULL) AS "visibleDemoStories",
        (SELECT count(*)::int FROM "ConversationMember" cm WHERE cm."userId"=$1) AS "conversations",
        (SELECT count(*)::int FROM "Message" m JOIN "ConversationMember" cm ON cm."conversationId"=m."conversationId" WHERE cm."userId"=$1 AND m."deletedAt" IS NULL) AS "messages",
        (SELECT count(*)::int FROM "Notification" n WHERE n."userId"=$1) AS "notifications",
        (SELECT count(*)::int FROM "User" u WHERE u."email" LIKE $5 AND u."photoUrl" LIKE 'https://randomuser.me/%') AS "avatarImages",
        (SELECT count(*)::int FROM "PostMedia" pm WHERE pm."id" LIKE '31000000-%' AND pm."url" LIKE 'https://images.unsplash.com/%') AS "feedImages",
        (SELECT count(*)::int FROM "Story" s WHERE s."id" LIKE '34000000-%' AND s."mediaUrl" LIKE 'https://images.unsplash.com/%') AS "storyImages",
        ((SELECT count(*)::int FROM "User" u WHERE u."email" LIKE $5 AND u."photoUrl" LIKE 'https://picsum.photos/%') +
         (SELECT count(*)::int FROM "PostMedia" pm WHERE pm."id" LIKE '31000000-%' AND pm."url" LIKE 'https://picsum.photos/%') +
         (SELECT count(*)::int FROM "Story" s WHERE s."id" LIKE '34000000-%' AND s."mediaUrl" LIKE 'https://picsum.photos/%')) AS "unresolvedPlaceholders",
        (SELECT "isVerified" FROM "MatrimonyProfile" mp WHERE mp."userId"=$1) AS "matrimonyVerified"`,
      [userIds.main, userIds.sister, userIds.friendMale, userIds.mother, `%${DEMO_EMAIL_SUFFIX}`]
    );

    console.log('\nScreenshot demo account is ready.');
    console.log(`Login number: ${DEMO_PHONE}`);
    console.table(summary.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((error) => {
  console.error(`Screenshot demo seed failed: ${error.message}`);
  process.exitCode = 1;
});
