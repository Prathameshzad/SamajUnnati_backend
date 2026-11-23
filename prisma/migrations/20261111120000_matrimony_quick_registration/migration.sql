-- Quick (Bumble-style) matrimony registration + waitlist.
ALTER TABLE "MatrimonyProfile" ADD COLUMN "maritalStatus" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "motherTongue" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "diet" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "drinking" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "smoking" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "familyType" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "marriageTimeline" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "vibes" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "MatrimonyProfile" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'WAITLIST';
ALTER TABLE "MatrimonyProfile" ADD COLUMN "waitlistedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "registrationCompletedAt" TIMESTAMP(3);

-- Waitlist position = count of WAITLIST rows joined before me.
CREATE INDEX "MatrimonyProfile_status_waitlistedAt_idx" ON "MatrimonyProfile"("status", "waitlistedAt");
