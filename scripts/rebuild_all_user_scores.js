/* eslint-disable no-console */
/**
 * Backfills and synchronizes historical scores for all users who previously added relations,
 * posts, or stories before the gamification system was introduced or before events were recorded.
 * 
 * Features:
 * - Idempotent: Can be run multiple times safely without duplicate points.
 * - Respects living vs. deceased relatives (+5 for alive, +2 for deceased).
 * - Awards +20 for confirmed/approved relations.
 * - Awards +15 per post and story.
 * - Recomputes UserScore total and level based on LEVEL_THRESHOLDS.
 * - Works cross-platform on Windows, macOS, Linux, and Docker.
 * 
 * Usage:
 *   node scripts/rebuild_all_user_scores.js
 *   npm run rebuild:scores
 */

require('dotenv/config');
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 2000, 3000, 5000];

function calculateLevel(total) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (total >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is missing.');
    process.exit(1);
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  console.log('====================================================');
  console.log('🏆 Rebuilding & Backfilling Historical User Scores');
  console.log('====================================================\n');

  try {
    await client.query('BEGIN');

    // 1. Ensure all users have a UserScore row
    console.log('Step 1: Ensuring UserScore record exists for all users...');
    const userScoreInitRes = await client.query(`
      INSERT INTO "UserScore" (id, "userId", total, level, "updatedAt")
      SELECT gen_random_uuid(), u.id, 0, 1, NOW()
      FROM "User" u
      LEFT JOIN "UserScore" us ON us."userId" = u.id
      WHERE us.id IS NULL
      ON CONFLICT ("userId") DO NOTHING;
    `);
    console.log(`  Initialized ${userScoreInitRes.rowCount} new UserScore records.\n`);

    // 2. Fetch all active relations that may need score awards
    console.log('Step 2: Scanning relations for missing score events...');
    const relationsRes = await client.query(`
      SELECT 
        r.id AS "relationId",
        COALESCE(r."createdById", r."fromUserId") AS "ownerUserId",
        r.status,
        r."hiddenByUserIds",
        COALESCE(tu."isAlive", true) AS "targetIsAlive",
        us.id AS "userScoreId"
      FROM "Relation" r
      JOIN "User" tu ON tu.id = r."toUserId"
      JOIN "UserScore" us ON us."userId" = COALESCE(r."createdById", r."fromUserId")
      WHERE r."deletedAt" IS NULL
        AND r.category IN ('FAMILY', 'FRIEND')
      ORDER BY r."createdAt" ASC
    `);

    let addEventsCreated = 0;
    let approvalEventsCreated = 0;

    for (const row of relationsRes.rows) {
      const { relationId, userScoreId, status, hiddenByUserIds, targetIsAlive } = row;
      const isAlive = targetIsAlive === true;

      // Check if ADD award already exists for this relation
      const existingAdd = await client.query(`
        SELECT id FROM "ScoreEvent"
        WHERE "userId" = $1
          AND "relationId" = $2
          AND reason IN ('ADD_ALIVE', 'ADD_DECEASED')
        LIMIT 1
      `, [userScoreId, relationId]);

      if (existingAdd.rows.length === 0) {
        const points = isAlive ? 5 : 2;
        const reason = isAlive ? 'ADD_ALIVE' : 'ADD_DECEASED';
        const opKey = `relation:${relationId}:add`;

        await client.query(`
          INSERT INTO "ScoreEvent" (id, "userId", points, reason, "relationId", "operationKey", "createdAt")
          VALUES ($1, $2, $3, $4::"ScoreReason", $5, $6, NOW())
          ON CONFLICT ("operationKey") DO NOTHING
        `, [randomUUID(), userScoreId, points, reason, relationId, opKey]);

        addEventsCreated++;
      }

      // If relation is CONFIRMED, check if RELATION_APPROVED award exists (+20 pts)
      const isHidden = Array.isArray(hiddenByUserIds) && hiddenByUserIds.length > 0;
      if (status === 'CONFIRMED' && !isHidden) {
        const existingApproved = await client.query(`
          SELECT id FROM "ScoreEvent"
          WHERE "userId" = $1
            AND "relationId" = $2
            AND reason = 'RELATION_APPROVED'
          LIMIT 1
        `, [userScoreId, relationId]);

        if (existingApproved.rows.length === 0) {
          const opKey = `relation:${relationId}:approved`;
          await client.query(`
            INSERT INTO "ScoreEvent" (id, "userId", points, reason, "relationId", "operationKey", "createdAt")
            VALUES ($1, $2, 20, 'RELATION_APPROVED'::"ScoreReason", $3, $4, NOW())
            ON CONFLICT ("operationKey") DO NOTHING
          `, [randomUUID(), userScoreId, relationId, opKey]);

          approvalEventsCreated++;
        }
      }
    }

    console.log(`  Added ${addEventsCreated} missing ADD relation event(s).`);
    console.log(`  Added ${approvalEventsCreated} missing RELATION_APPROVED event(s).\n`);

    // 3. Scan posts for missing post creation awards (+15 pts per post)
    console.log('Step 3: Checking posts and stories awards...');
    const userPosts = await client.query(`
      SELECT p."userId", COUNT(*)::int AS "postCount", us.id AS "userScoreId"
      FROM "Post" p
      JOIN "UserScore" us ON us."userId" = p."userId"
      WHERE p."deletedAt" IS NULL
      GROUP BY p."userId", us.id
    `);

    let postEventsCreated = 0;
    for (const row of userPosts.rows) {
      const opKey = `score-rebuild:${row.userId}:posts`;
      const existing = await client.query(`
        SELECT id FROM "ScoreEvent" WHERE "operationKey" = $1 LIMIT 1
      `, [opKey]);

      if (existing.rows.length === 0 && row.postCount > 0) {
        const points = row.postCount * 15;
        await client.query(`
          INSERT INTO "ScoreEvent" (id, "userId", points, reason, "operationKey", "createdAt")
          VALUES ($1, $2, $3, 'POST_CREATE'::"ScoreReason", $4, NOW())
          ON CONFLICT ("operationKey") DO NOTHING
        `, [randomUUID(), row.userScoreId, points, opKey]);
        postEventsCreated++;
      }
    }

    // 4. Scan stories for missing story creation awards (+15 pts per story)
    const userStories = await client.query(`
      SELECT s."userId", COUNT(*)::int AS "storyCount", us.id AS "userScoreId"
      FROM "Story" s
      JOIN "UserScore" us ON us."userId" = s."userId"
      WHERE s."deletedAt" IS NULL
      GROUP BY s."userId", us.id
    `);

    let storyEventsCreated = 0;
    for (const row of userStories.rows) {
      const opKey = `score-rebuild:${row.userId}:stories`;
      const existing = await client.query(`
        SELECT id FROM "ScoreEvent" WHERE "operationKey" = $1 LIMIT 1
      `, [opKey]);

      if (existing.rows.length === 0 && row.storyCount > 0) {
        const points = row.storyCount * 15;
        await client.query(`
          INSERT INTO "ScoreEvent" (id, "userId", points, reason, "operationKey", "createdAt")
          VALUES ($1, $2, $3, 'STORY_CREATE'::"ScoreReason", $4, NOW())
          ON CONFLICT ("operationKey") DO NOTHING
        `, [randomUUID(), row.userScoreId, points, opKey]);
        storyEventsCreated++;
      }
    }
    console.log(`  Added ${postEventsCreated} post event batch(es) and ${storyEventsCreated} story event batch(es).\n`);

    // 5. Recalculate totals and levels for all UserScore rows based on the ledger
    console.log('Step 4: Recalculating totals & levels for all user scorecards...');
    const balances = await client.query(`
      SELECT us.id, us."userId", GREATEST(0, COALESCE(SUM(se.points), 0))::int AS "ledgerTotal"
      FROM "UserScore" us
      LEFT JOIN "ScoreEvent" se ON se."userId" = us.id
      GROUP BY us.id, us."userId"
    `);

    let updatedScorecards = 0;
    for (const row of balances.rows) {
      const total = Number(row.ledgerTotal);
      const level = calculateLevel(total);

      await client.query(`
        UPDATE "UserScore"
        SET total = $1, level = $2, "updatedAt" = NOW()
        WHERE id = $3
      `, [total, level, row.id]);

      updatedScorecards++;
    }

    await client.query('COMMIT');
    console.log(`  Successfully recalculated ${updatedScorecards} user scorecards.\n`);

    console.log('====================================================');
    console.log('🎉 Historical score backfill completed successfully!');
    console.log('====================================================');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error rebuilding scores:', error);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
