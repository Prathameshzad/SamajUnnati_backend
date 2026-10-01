-- Make relation score mutations idempotent and reversals traceable.
-- Existing events remain valid with NULL keys; PostgreSQL unique indexes allow
-- multiple NULL values, while all new lifecycle writes use deterministic keys.
ALTER TABLE "ScoreEvent"
ADD COLUMN "operationKey" TEXT,
ADD COLUMN "reversesEventId" TEXT;

CREATE UNIQUE INDEX "ScoreEvent_operationKey_key"
ON "ScoreEvent"("operationKey");

CREATE UNIQUE INDEX "ScoreEvent_reversesEventId_key"
ON "ScoreEvent"("reversesEventId");

CREATE INDEX "ScoreEvent_relationId_idx"
ON "ScoreEvent"("relationId");
