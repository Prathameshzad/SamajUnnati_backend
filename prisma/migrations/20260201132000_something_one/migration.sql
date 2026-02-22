/*
  Warnings:

  - You are about to drop the column `relationTypeId` on the `Relation` table. All the data in the column will be lost.
  - You are about to drop the `RelationType` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[fromUserId,toUserId,relationTypeCode]` on the table `Relation` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `relationTypeCode` to the `Relation` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Relation" DROP CONSTRAINT "Relation_relationTypeId_fkey";

-- DropIndex
DROP INDEX "Relation_fromUserId_toUserId_relationTypeId_key";

-- AlterTable
ALTER TABLE "Relation" DROP COLUMN "relationTypeId",
ADD COLUMN     "relationLabel" TEXT,
ADD COLUMN     "relationTypeCode" TEXT NOT NULL;

-- DropTable
DROP TABLE "RelationType";

-- DropEnum
DROP TYPE "VerticalGroup";

-- CreateIndex
CREATE UNIQUE INDEX "Relation_fromUserId_toUserId_relationTypeCode_key" ON "Relation"("fromUserId", "toUserId", "relationTypeCode");
