/*
  Warnings:

  - You are about to drop the column `createdById` on the `Relation` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `Relation` table. All the data in the column will be lost.
  - You are about to drop the column `deletedAt` on the `User` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "Relation" DROP CONSTRAINT "Relation_createdById_fkey";

-- AlterTable
ALTER TABLE "Relation" DROP COLUMN "createdById",
DROP COLUMN "deletedAt",
ADD COLUMN     "createdBy" TEXT,
ALTER COLUMN "category" SET DEFAULT 'FAMILY';

-- AlterTable
ALTER TABLE "User" DROP COLUMN "deletedAt";

-- AddForeignKey
ALTER TABLE "Relation" ADD CONSTRAINT "Relation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
