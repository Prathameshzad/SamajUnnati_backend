-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "secondaryPhone" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_secondaryPhone_key" ON "User"("secondaryPhone");

-- AlterTable
ALTER TABLE "DeletedUser" ADD COLUMN IF NOT EXISTS "secondaryPhone" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "DeletedUser_secondaryPhone_idx" ON "DeletedUser"("secondaryPhone");
