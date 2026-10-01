-- Persist whether CONFIRMED came from an explicit approval. Deceased and
-- reciprocal/manual relations start confirmed with approvedAt = NULL and must not
-- receive the +20 approval score.
ALTER TABLE "Relation"
ADD COLUMN "approvedAt" TIMESTAMP(3);

-- Backfill only where the historical score ledger proves an approval occurred.
-- This avoids guessing from mutable timestamps or status alone.
UPDATE "Relation" relation
SET "approvedAt" = proof."approvedAt"
FROM (
  SELECT se."relationId", MIN(se."createdAt") AS "approvedAt"
  FROM "ScoreEvent" se
  WHERE se.reason = 'RELATION_APPROVED'
    AND se.points > 0
    AND se."relationId" IS NOT NULL
  GROUP BY se."relationId"
) proof
WHERE relation.id = proof."relationId";

CREATE INDEX "Relation_approvedAt_idx"
ON "Relation"("approvedAt");
