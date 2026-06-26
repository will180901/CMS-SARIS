-- Pièces jointes de la messagerie interne (chiffrées) + index de pagination.
-- Migration purement additive (nouvelle table + nouvel index) — non destructive.

-- CreateTable
CREATE TABLE "MessagePieceJointe" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "contenuChiffre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessagePieceJointe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessagePieceJointe_messageId_idx" ON "MessagePieceJointe"("messageId");

-- CreateIndex (pagination : messages d'une conversation triés par date)
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- AddForeignKey
ALTER TABLE "MessagePieceJointe" ADD CONSTRAINT "MessagePieceJointe_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
