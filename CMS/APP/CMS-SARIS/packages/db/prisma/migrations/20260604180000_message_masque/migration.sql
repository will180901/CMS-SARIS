-- « Supprimer pour moi » : masque un message pour un utilisateur. Additif, non destructif.

-- CreateTable
CREATE TABLE "MessageMasque" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageMasque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MessageMasque_utilisateurId_idx" ON "MessageMasque"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMasque_messageId_utilisateurId_key" ON "MessageMasque"("messageId", "utilisateurId");

-- AddForeignKey
ALTER TABLE "MessageMasque" ADD CONSTRAINT "MessageMasque_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
