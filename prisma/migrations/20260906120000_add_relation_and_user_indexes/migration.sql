-- Production hardening: missing indexes on hot query paths.
--
-- These are purely additive (CREATE INDEX, no column/table changes) and safe to
-- run against a live database without downtime. CONCURRENTLY is intentionally
-- NOT used here because Prisma migrations run inside a transaction and
-- CREATE INDEX CONCURRENTLY cannot run inside one; if this table is large in
-- production, run the CONCURRENTLY versions manually outside a transaction
-- before applying this migration, then this migration becomes a no-op
-- (CREATE INDEX IF NOT EXISTS skips already-created indexes).

-- Relation.createdById had no index at all, despite being filtered on directly
-- in listRelations / getRequests / getRelationCounts / badgeService
-- (`createdById: userId`). Every one of those was a sequential scan.
CREATE INDEX IF NOT EXISTS "Relation_createdById_idx" ON "Relation" ("createdById");

-- Composite indexes matching the exact (column, status) predicates used across
-- relationController and messageController.getEligibleContactIds, e.g.
-- `{ fromUserId: userId, status: 'CONFIRMED' }`. A single-column index on
-- fromUserId/toUserId/createdById still requires filtering status afterward;
-- these let Postgres satisfy the whole WHERE clause from the index.
CREATE INDEX IF NOT EXISTS "Relation_fromUserId_status_idx" ON "Relation" ("fromUserId", "status");
CREATE INDEX IF NOT EXISTS "Relation_toUserId_status_idx" ON "Relation" ("toUserId", "status");
CREATE INDEX IF NOT EXISTS "Relation_createdById_status_idx" ON "Relation" ("createdById", "status");

-- badgeService.getUserBadgeData filters `category IN (...) AND status = 'CONFIRMED'
-- AND deletedAt IS NULL`, run on every getMe / getUserById / getRelationCounts call.
CREATE INDEX IF NOT EXISTS "Relation_category_status_deletedAt_idx" ON "Relation" ("category", "status", "deletedAt");

-- getGraphChunk filters `worldX BETWEEN ... AND worldY BETWEEN ...` with no
-- index at all previously, forcing a full table scan on every spatial query.
CREATE INDEX IF NOT EXISTS "User_worldX_worldY_idx" ON "User" ("worldX", "worldY");
