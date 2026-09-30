-- Store per-viewer tree visibility without deleting the shared relation.
ALTER TABLE "Relation"
ADD COLUMN IF NOT EXISTS "hiddenByUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
