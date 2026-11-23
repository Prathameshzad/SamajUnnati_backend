-- Birthdays where the year is unknown: keep day and month on their own.
ALTER TABLE "User" ADD COLUMN "birthDay" INTEGER;
ALTER TABLE "User" ADD COLUMN "birthMonth" INTEGER;
ALTER TABLE "DeletedUser" ADD COLUMN "birthDay" INTEGER;
ALTER TABLE "DeletedUser" ADD COLUMN "birthMonth" INTEGER;

-- Existing full dates already carry the day and month. dateOfBirth is a
-- timestamp without time zone written as UTC midnight, so EXTRACT is exact.
UPDATE "User"
SET "birthDay" = EXTRACT(DAY FROM "dateOfBirth")::INTEGER,
    "birthMonth" = EXTRACT(MONTH FROM "dateOfBirth")::INTEGER
WHERE "dateOfBirth" IS NOT NULL;

UPDATE "DeletedUser"
SET "birthDay" = EXTRACT(DAY FROM "dateOfBirth")::INTEGER,
    "birthMonth" = EXTRACT(MONTH FROM "dateOfBirth")::INTEGER
WHERE "dateOfBirth" IS NOT NULL;

-- The daily reminder job looks people up by month and day.
CREATE INDEX "User_birthMonth_birthDay_idx" ON "User"("birthMonth", "birthDay");
