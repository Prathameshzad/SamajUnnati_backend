/* eslint-disable no-console */
/**
 * Read-only score ledger integrity audit.
 *
 * Usage: npm run audit:scores
 * Exits non-zero if a balance differs from its event ledger, a relation has more
 * than one unreversed positive award of the same type, or a positive event was
 * reversed more than once.
 */
require('dotenv/config');
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  try {
    // Keep queries sequential: node-postgres deprecates concurrent query calls on
    // one Client. This command is an offline audit, so parallelism adds no value.
    const columns = await client.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'ScoreEvent'
        AND column_name IN ('operationKey', 'reversesEventId')
      ORDER BY column_name
    `);
    const mismatches = await client.query(`
      SELECT us."userId", us.total, GREATEST(0, COALESCE(SUM(se.points), 0))::int AS "ledgerTotal"
      FROM "UserScore" us
      LEFT JOIN "ScoreEvent" se ON se."userId" = us.id
      GROUP BY us.id, us."userId", us.total
      HAVING us.total <> GREATEST(0, COALESCE(SUM(se.points), 0))
    `);
    const duplicateAwards = await client.query(`
      SELECT positive."userId", positive."relationId",
             CASE WHEN positive.reason = 'RELATION_APPROVED' THEN 'APPROVED' ELSE 'ADD' END AS "awardType",
             COUNT(*)::int AS count
      FROM "ScoreEvent" positive
      LEFT JOIN "ScoreEvent" reversal ON reversal."reversesEventId" = positive.id
      WHERE positive."relationId" IS NOT NULL
        AND positive.points > 0
        AND reversal.id IS NULL
        AND positive.reason IN ('ADD_ALIVE', 'ADD_DECEASED', 'RELATION_APPROVED')
      GROUP BY positive."userId", positive."relationId",
               CASE WHEN positive.reason = 'RELATION_APPROVED' THEN 'APPROVED' ELSE 'ADD' END
      HAVING COUNT(*) > 1
    `);
    const duplicateReversals = await client.query(`
      SELECT "reversesEventId", COUNT(*)::int AS count
      FROM "ScoreEvent"
      WHERE "reversesEventId" IS NOT NULL
      GROUP BY "reversesEventId"
      HAVING COUNT(*) > 1
    `);

    const result = {
      idempotencyColumns: columns.rows.map((row) => row.column_name),
      balanceMismatches: mismatches.rows,
      duplicateRelationAwards: duplicateAwards.rows,
      duplicateReversals: duplicateReversals.rows,
    };
    console.log(JSON.stringify(result, null, 2));

    const valid =
      result.idempotencyColumns.length === 2 &&
      result.balanceMismatches.length === 0 &&
      result.duplicateRelationAwards.length === 0 &&
      result.duplicateReversals.length === 0;
    if (!valid) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
