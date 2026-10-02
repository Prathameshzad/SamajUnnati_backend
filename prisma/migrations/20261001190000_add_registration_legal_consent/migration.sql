-- Existing users remain NULL because consent must never be inferred or backfilled.
ALTER TABLE "User"
  ADD COLUMN "termsPrivacyAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "termsVersion" TEXT,
  ADD COLUMN "privacyVersion" TEXT;
