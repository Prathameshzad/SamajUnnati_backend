-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'BIRTHDAY_REMINDER';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'DEATH_ANNIVERSARY';

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "subjectUserId" TEXT;

-- CreateIndex
CREATE INDEX "Notification_subjectUserId_type_createdAt_idx" ON "Notification"("subjectUserId", "type", "createdAt");
