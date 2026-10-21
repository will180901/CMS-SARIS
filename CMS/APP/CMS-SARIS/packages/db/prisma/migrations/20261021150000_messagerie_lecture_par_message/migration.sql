-- Messagerie : lecture message par message, suppression logique des participants,
-- « supprimer la conversation » pour soi, archivage, identifiant d'envoi, favoris.

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "archivee" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "viderLe" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "clientId" TEXT;

-- CreateTable
CREATE TABLE "MessageLecture" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "luLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageLecture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageFavori" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageFavori_pkey" PRIMARY KEY ("id")
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

-- AddForeignKey
ALTER TABLE "MessageLecture" ADD CONSTRAINT "MessageLecture_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFavori" ADD CONSTRAINT "MessageFavori_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Reprise de l'existant : ce que chacun avait deja lu (jusqu'a sa derniere ouverture du fil)
-- devient un accuse par message. L'identifiant est DETERMINISTE, comme celui que calcule
-- l'application : md5 de « message|lecteur », mis en forme 8-4-4-4-12.
INSERT INTO "MessageLecture" ("id", "messageId", "utilisateurId", "luLe", "updatedAt")
SELECT substr(t."h", 1, 8) || '-' || substr(t."h", 9, 4) || '-' || substr(t."h", 13, 4) || '-' ||
       substr(t."h", 17, 4) || '-' || substr(t."h", 21, 12),
       t."mid", t."uid", t."lu", CURRENT_TIMESTAMP
FROM (
  SELECT md5(m."id" || '|' || cp."utilisateurId") AS "h", m."id" AS "mid",
         cp."utilisateurId" AS "uid", cp."lastReadAt" AS "lu"
  FROM "Message" m
  JOIN "ConversationParticipant" cp ON cp."conversationId" = m."conversationId"
  WHERE cp."lastReadAt" IS NOT NULL
    AND m."expediteurId" <> cp."utilisateurId"
    AND m."createdAt" <= cp."lastReadAt"
) t
ON CONFLICT DO NOTHING;
