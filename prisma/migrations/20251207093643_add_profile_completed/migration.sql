-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('RELATION_REQUEST', 'RELATION_APPROVED', 'RELATION_REJECTED');

-- CreateEnum
CREATE TYPE "NotificationState" AS ENUM ('UNREAD', 'READ');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "profileCompleted" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "relationId" TEXT,
    "state" "NotificationState" NOT NULL DEFAULT 'UNREAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_state_createdAt_idx" ON "Notification"("userId", "state", "createdAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_relationId_fkey" FOREIGN KEY ("relationId") REFERENCES "Relation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
