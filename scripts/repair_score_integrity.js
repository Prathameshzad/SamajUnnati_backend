/* eslint-disable no-console */
/**
 * Repairs legacy relation-score corruption without deleting audit history.
 *
 * Dry run: npm run repair:scores
 * Apply:   npm run repair:scores -- --apply
 *
 * For each logical relation award, the earliest unreversed event is retained and
 * every duplicate is compensated by a linked negative event. All UserScore
 * balances and levels are then rebuilt from the event ledger.
 */
require('dotenv/config');
const { randomUUID } = require('crypto');
const { Client } = require('pg');

const APPLY = process.argv.includes('--apply');
const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 2000, 3000, 5000];

function calculateLevel(total) {
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i -= 1) {
    if (total >= LEVEL_THRESHOLDS[i]) return i + 1;
  }
  return 1;
}

function reversalReason(reason) {
  if (reason === 'ADD_ALIVE') return 'REMOVE_ALIVE';
  if (reason === 'ADD_DECEASED') return 'REMOVE_DECEASED';
  return 'REMOVE_RELATION';
}

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    const positives = await client.query(`
      SELECT positive.id, positive."userId", positive."relationId",
             positive.points, positive.reason, positive."createdAt"
      FROM "ScoreEvent" positive
      LEFT JOIN "ScoreEvent" reversal ON reversal."reversesEventId" = positive.id
      WHERE positive."relationId" IS NOT NULL
        AND positive.points > 0
        AND reversal.id IS NULL
        AND positive.reason IN ('ADD_ALIVE', 'ADD_DECEASED', 'RELATION_APPROVED')
      ORDER BY positive."createdAt" ASC, positive.id ASC
    `);

    const groups = new Map();
    for (const event of positives.rows) {
      // Living/deceased are variants of one logical add action. Treat a mixed
      // pair as duplicate too (it can arise after an isAlive profile edit).
      const kind = event.reason === 'RELATION_APPROVED' ? 'APPROVED' : 'ADD';
      const key = `${event.userId}:${event.relationId}:${kind}`;
      const list = groups.get(key) ?? [];
      list.push(event);
      groups.set(key, list);
    }
    const duplicates = [...groups.values()].flatMap((events) => events.slice(1));

    console.log(JSON.stringify({
      mode: APPLY ? 'apply' : 'dry-run',
      duplicateEventsToReverse: duplicates.map((event) => ({
        id: event.id,
        relationId: event.relationId,
        reason: event.reason,
        points: event.points,
      })),
    }, null, 2));

    if (!APPLY) {
      console.log('Dry run only. Re-run with --apply to write compensating events and rebuild balances.');
      return;
    }

    await client.query('BEGIN');
    try {
      for (const event of duplicates) {
        await client.query(`
          INSERT INTO "ScoreEvent"
            (id, "userId", points, reason, "relationId", "operationKey", "reversesEventId", "createdAt")
          VALUES ($1, $2, $3, $4::"ScoreReason", $5, $6, $7, NOW())
          ON CONFLICT ("reversesEventId") DO NOTHING
        `, [
          randomUUID(),
          event.userId,
          -event.points,
          reversalReason(event.reason),
          event.relationId,
          `score:repair-reverse:${event.id}`,
          event.id,
        ]);
      }

      const scores = await client.query(`
        SELECT us.id, GREATEST(0, COALESCE(SUM(se.points), 0))::int AS total
        FROM "UserScore" us
        LEFT JOIN "ScoreEvent" se ON se."userId" = us.id
        GROUP BY us.id
      `);
      for (const score of scores.rows) {
        const total = Number(score.total);
        await client.query(`
          UPDATE "UserScore"
          SET total = $1, level = $2, "updatedAt" = NOW()
          WHERE id = $3
        `, [total, calculateLevel(total), score.id]);
      }

      await client.query('COMMIT');
      console.log(`Applied ${duplicates.length} compensating event(s); rebuilt ${scores.rows.length} score balance(s).`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
