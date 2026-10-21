-- Messagerie : lecture message par message, suppression logique des participants,
-- « supprimer la conversation » pour soi, archivage, identifiant d'envoi, favoris.
-- (Pas de reprise de l'existant ici : le serveur central a la sienne, et le poste la recoit
-- a la synchronisation — la recreer localement la ferait remonter en double.)

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN "deletedAt" DATETIME;
ALTER TABLE "ConversationParticipant" ADD COLUMN "viderLe" DATETIME;
ALTER TABLE "ConversationParticipant" ADD COLUMN "archivee" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "clientId" TEXT;

-- CreateTable
CREATE TABLE "MessageLecture" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "luLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageLecture_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageFavori" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageFavori_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "MessageLecture_updatedAt_idx" ON "MessageLecture"("updatedAt");

-- CreateIndex
CREATE INDEX "MessageLecture_utilisateurId_idx" ON "MessageLecture"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageLecture_messageId_utilisateurId_key" ON "MessageLecture"("messageId", "utilisateurId");

-- CreateIndex
CREATE INDEX "MessageFavori_updatedAt_idx" ON "MessageFavori"("updatedAt");

-- CreateIndex
CREATE INDEX "MessageFavori_utilisateurId_idx" ON "MessageFavori"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageFavori_messageId_utilisateurId_key" ON "MessageFavori"("messageId", "utilisateurId");

-- CreateIndex
CREATE INDEX "Message_updatedAt_idx" ON "Message"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Message_expediteurId_clientId_key" ON "Message"("expediteurId", "clientId");
