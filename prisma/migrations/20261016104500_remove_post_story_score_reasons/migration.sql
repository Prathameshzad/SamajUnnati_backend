-- 1. Delete legacy score events with POST_CREATE or STORY_CREATE
DELETE FROM "ScoreEvent" WHERE reason::text IN ('POST_CREATE', 'STORY_CREATE');

-- 2. Re-sync UserScore totals and levels for affected scorecards from ledger
UPDATE "UserScore" us
SET total = GREATEST(0, COALESCE(sub.ledger_total, 0)),
    level = CASE
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 5000 THEN 10
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 3000 THEN 9
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 2000 THEN 8
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 1200 THEN 7
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 800 THEN 6
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 500 THEN 5
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 300 THEN 4
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 150 THEN 3
      WHEN GREATEST(0, COALESCE(sub.ledger_total, 0)) >= 50 THEN 2
      ELSE 1
    END
FROM (
  SELECT "userId", SUM(points)::int AS ledger_total
  FROM "ScoreEvent"
  GROUP BY "userId"
) sub
WHERE us.id = sub."userId";

-- 3. Replace enum ScoreReason with only tree-relation reasons
CREATE TYPE "ScoreReason_new" AS ENUM (
  'ADD_ALIVE',
  'ADD_DECEASED',
  'RELATION_APPROVED',
  'REMOVE_ALIVE',
  'REMOVE_DECEASED',
  'REMOVE_RELATION'
);

ALTER TABLE "ScoreEvent" ALTER COLUMN reason TYPE "ScoreReason_new" USING (reason::text::"ScoreReason_new");

DROP TYPE "ScoreReason";
ALTER TYPE "ScoreReason_new" RENAME TO "ScoreReason";
