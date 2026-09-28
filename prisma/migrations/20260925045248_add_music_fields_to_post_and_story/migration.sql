-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "musicArtist" TEXT,
ADD COLUMN     "musicHookDuration" INTEGER,
ADD COLUMN     "musicHookStart" INTEGER,
ADD COLUMN     "musicThumbnail" TEXT,
ADD COLUMN     "musicTitle" TEXT,
ADD COLUMN     "musicVideoId" TEXT;

-- AlterTable
ALTER TABLE "Story" ADD COLUMN     "musicArtist" TEXT,
ADD COLUMN     "musicHookDuration" INTEGER,
ADD COLUMN     "musicHookStart" INTEGER,
ADD COLUMN     "musicThumbnail" TEXT,
ADD COLUMN     "musicTitle" TEXT,
ADD COLUMN     "musicVideoId" TEXT;

-- CreateIndex
CREATE INDEX "Post_musicVideoId_idx" ON "Post"("musicVideoId");

-- CreateIndex
CREATE INDEX "Story_musicVideoId_idx" ON "Story"("musicVideoId");
