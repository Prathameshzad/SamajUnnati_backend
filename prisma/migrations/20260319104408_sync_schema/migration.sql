/*
  Warnings:

  - You are about to drop the column `createdBy` on the `Relation` table. All the data in the column will be lost.
  - You are about to drop the column `relationLabel` on the `Relation` table. All the data in the column will be lost.
  - Added the required column `category` to the `Relation` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "RelationCategory" AS ENUM ('FAMILY', 'FRIEND');

-- AlterTable
ALTER TABLE "Relation" DROP COLUMN "createdBy",
DROP COLUMN "relationLabel",
ADD COLUMN     "category" "RelationCategory" NOT NULL,
ADD COLUMN     "createdById" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "RelationType" (
    "code" TEXT NOT NULL,
    "category" "RelationCategory" NOT NULL,
    "targetGender" "Gender",
    "treeLevel" INTEGER,
    "reciprocalCode" TEXT,

    CONSTRAINT "RelationType_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "RelationTranslation" (
    "id" TEXT NOT NULL,
    "relationTypeCode" TEXT NOT NULL,
    "languageCode" TEXT NOT NULL,
    "community" TEXT,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RelationTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RelationType_category_idx" ON "RelationType"("category");

-- CreateIndex
CREATE INDEX "RelationTranslation_languageCode_idx" ON "RelationTranslation"("languageCode");

-- CreateIndex
CREATE UNIQUE INDEX "RelationTranslation_relationTypeCode_languageCode_community_key" ON "RelationTranslation"("relationTypeCode", "languageCode", "community");

-- CreateIndex
CREATE INDEX "Notification_relationId_idx" ON "Notification"("relationId");

-- CreateIndex
CREATE INDEX "Relation_fromUserId_idx" ON "Relation"("fromUserId");

-- CreateIndex
CREATE INDEX "Relation_toUserId_idx" ON "Relation"("toUserId");

-- CreateIndex
CREATE INDEX "Relation_relationTypeCode_idx" ON "Relation"("relationTypeCode");

-- CreateIndex
CREATE INDEX "Relation_category_idx" ON "Relation"("category");

-- CreateIndex
CREATE INDEX "Relation_status_idx" ON "Relation"("status");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "RelationTranslation" ADD CONSTRAINT "RelationTranslation_relationTypeCode_fkey" FOREIGN KEY ("relationTypeCode") REFERENCES "RelationType"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relation" ADD CONSTRAINT "Relation_relationTypeCode_fkey" FOREIGN KEY ("relationTypeCode") REFERENCES "RelationType"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Relation" ADD CONSTRAINT "Relation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
