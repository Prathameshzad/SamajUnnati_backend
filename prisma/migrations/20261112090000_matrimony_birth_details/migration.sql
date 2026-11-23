-- Birth place / time of birth for patrika (kundli) creation.
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthPlace" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthTime" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthTimeUnknown" BOOLEAN NOT NULL DEFAULT false;
