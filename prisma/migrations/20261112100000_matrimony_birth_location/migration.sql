-- Structured birth place: state (dropdown) → city (Google Places) → taluka.
-- "birthPlace" stays as the human-readable "City, Taluka, State" string.
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthState" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthCity" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthTaluka" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthDistrict" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthPlaceId" TEXT;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthLat" DOUBLE PRECISION;
ALTER TABLE "MatrimonyProfile" ADD COLUMN "birthLng" DOUBLE PRECISION;
