-- CreateEnum
CREATE TYPE "VerticalGroup" AS ENUM ('UP', 'DOWN', 'SAME');

-- AlterTable
ALTER TABLE "RelationType" ADD COLUMN     "verticalGroup" "VerticalGroup";
