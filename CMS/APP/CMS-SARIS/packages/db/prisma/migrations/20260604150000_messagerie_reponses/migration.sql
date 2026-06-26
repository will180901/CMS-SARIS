-- Réponses/citations de messages (reply) — colonne auto-référencée sur Message.
-- Migration purement additive (colonne + index + FK) — non destructive.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "replyToId" TEXT;

-- CreateIndex
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message"("id") ON DELETE SET NULL ON UPDATE CASCADE;
