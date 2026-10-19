-- CreateTable
CREATE TABLE "DeletedUser" (
    "id" TEXT NOT NULL,
    "originalUserId" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "photoUrl" TEXT,
    "bannerUrl" TEXT,
    "address" TEXT,
    "pincode" TEXT,
    "designation" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "dateOfDeath" TIMESTAMP(3),
    "gender" "Gender",
    "area" TEXT,
    "bloodGroup" TEXT,
    "community" TEXT,
    "caste" TEXT,
    "subcaste" TEXT,
    "education" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "middleName" TEXT,
    "maritalStatus" TEXT,
    "matrimonialStatus" TEXT,
    "occupation" TEXT,
    "occupationDetails" TEXT,
    "religion" TEXT,
    "whatsapp" TEXT,
    "bio" TEXT,
    "appLanguage" TEXT DEFAULT 'en',
    "relationLanguage" TEXT DEFAULT 'en',
    "worldX" DOUBLE PRECISION,
    "worldY" DOUBLE PRECISION,
    "userCreatedAt" TIMESTAMP(3),
    "userUpdatedAt" TIMESTAMP(3),
    "reason" TEXT,
    "metadata" JSONB,
    "deletedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeletedUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DeletedUser_phone_idx" ON "DeletedUser"("phone");

-- CreateIndex
CREATE INDEX "DeletedUser_deletedAt_idx" ON "DeletedUser"("deletedAt");

-- CreateIndex
CREATE INDEX "DeletedUser_originalUserId_idx" ON "DeletedUser"("originalUserId");
