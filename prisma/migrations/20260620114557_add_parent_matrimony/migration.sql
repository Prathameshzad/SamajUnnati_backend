-- CreateEnum
CREATE TYPE "InterestStatus" AS ENUM ('INTERESTED', 'SUPER_INTERESTED', 'REJECTED');

-- AlterEnum
ALTER TYPE "RelationCategory" ADD VALUE 'MATRIMONY';

-- CreateTable
CREATE TABLE "MatrimonyProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLookingForMarriage" BOOLEAN NOT NULL DEFAULT true,
    "photos" TEXT[],
    "height" DOUBLE PRECISION,
    "complexion" TEXT,
    "education" TEXT,
    "occupation" TEXT,
    "income" TEXT,
    "lifestyle" TEXT,
    "languages" TEXT[],
    "religion" TEXT,
    "community" TEXT,
    "bio" TEXT,
    "hobbies" TEXT[],
    "interests" TEXT[],
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "visibility" TEXT NOT NULL DEFAULT 'PUBLIC',
    "profileType" TEXT NOT NULL DEFAULT 'SELF',
    "relationLabel" TEXT,
    "managedByUserId" TEXT,
    "isClaimed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrimonyProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyPreference" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "ageMin" INTEGER,
    "ageMax" INTEGER,
    "heightMin" DOUBLE PRECISION,
    "heightMax" DOUBLE PRECISION,
    "education" TEXT[],
    "occupation" TEXT[],
    "incomeMin" TEXT,
    "religion" TEXT[],
    "community" TEXT[],
    "maritalStatus" TEXT[],
    "diet" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrimonyPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyInterest" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "status" "InterestStatus" NOT NULL DEFAULT 'INTERESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrimonyInterest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyMatch" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "conversationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatrimonyMatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyShortlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatrimonyShortlist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyBlock" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatrimonyBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatrimonyReport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MatrimonyReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GraphRecommendationCache" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "connectionPath" TEXT NOT NULL,
    "trustScore" DOUBLE PRECISION NOT NULL,
    "compatibilityScore" DOUBLE PRECISION NOT NULL,
    "overallScore" DOUBLE PRECISION NOT NULL,
    "isViewed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GraphRecommendationCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConnectionPathCache" (
    "id" TEXT NOT NULL,
    "userAId" TEXT NOT NULL,
    "userBId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "distance" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionPathCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyProfile_userId_key" ON "MatrimonyProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyPreference_profileId_key" ON "MatrimonyPreference"("profileId");

-- CreateIndex
CREATE INDEX "MatrimonyInterest_senderId_idx" ON "MatrimonyInterest"("senderId");

-- CreateIndex
CREATE INDEX "MatrimonyInterest_receiverId_idx" ON "MatrimonyInterest"("receiverId");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyInterest_senderId_receiverId_key" ON "MatrimonyInterest"("senderId", "receiverId");

-- CreateIndex
CREATE INDEX "MatrimonyMatch_userAId_idx" ON "MatrimonyMatch"("userAId");

-- CreateIndex
CREATE INDEX "MatrimonyMatch_userBId_idx" ON "MatrimonyMatch"("userBId");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyMatch_userAId_userBId_key" ON "MatrimonyMatch"("userAId", "userBId");

-- CreateIndex
CREATE INDEX "MatrimonyShortlist_userId_idx" ON "MatrimonyShortlist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyShortlist_userId_targetId_key" ON "MatrimonyShortlist"("userId", "targetId");

-- CreateIndex
CREATE INDEX "MatrimonyBlock_userId_idx" ON "MatrimonyBlock"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MatrimonyBlock_userId_targetId_key" ON "MatrimonyBlock"("userId", "targetId");

-- CreateIndex
CREATE INDEX "MatrimonyReport_userId_idx" ON "MatrimonyReport"("userId");

-- CreateIndex
CREATE INDEX "GraphRecommendationCache_userId_idx" ON "GraphRecommendationCache"("userId");

-- CreateIndex
CREATE INDEX "GraphRecommendationCache_overallScore_idx" ON "GraphRecommendationCache"("overallScore" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "GraphRecommendationCache_userId_targetId_key" ON "GraphRecommendationCache"("userId", "targetId");

-- CreateIndex
CREATE INDEX "ConnectionPathCache_userAId_idx" ON "ConnectionPathCache"("userAId");

-- CreateIndex
CREATE UNIQUE INDEX "ConnectionPathCache_userAId_userBId_key" ON "ConnectionPathCache"("userAId", "userBId");

-- AddForeignKey
ALTER TABLE "MatrimonyProfile" ADD CONSTRAINT "MatrimonyProfile_managedByUserId_fkey" FOREIGN KEY ("managedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyProfile" ADD CONSTRAINT "MatrimonyProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyPreference" ADD CONSTRAINT "MatrimonyPreference_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyInterest" ADD CONSTRAINT "MatrimonyInterest_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyInterest" ADD CONSTRAINT "MatrimonyInterest_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyMatch" ADD CONSTRAINT "MatrimonyMatch_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyMatch" ADD CONSTRAINT "MatrimonyMatch_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyShortlist" ADD CONSTRAINT "MatrimonyShortlist_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyShortlist" ADD CONSTRAINT "MatrimonyShortlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyBlock" ADD CONSTRAINT "MatrimonyBlock_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyBlock" ADD CONSTRAINT "MatrimonyBlock_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyReport" ADD CONSTRAINT "MatrimonyReport_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatrimonyReport" ADD CONSTRAINT "MatrimonyReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphRecommendationCache" ADD CONSTRAINT "GraphRecommendationCache_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GraphRecommendationCache" ADD CONSTRAINT "GraphRecommendationCache_userId_fkey" FOREIGN KEY ("userId") REFERENCES "MatrimonyProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

