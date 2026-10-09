-- Durée des connexions — pendant SQLite de la migration PostgreSQL du même nom.
-- Colonnes ajoutées (aucune table recréée, aucune donnée touchée).

-- AlterTable
ALTER TABLE "SessionUtilisateur" ADD COLUMN "connexionId" TEXT;

-- AlterTable
ALTER TABLE "JournalAuthentification" ADD COLUMN "connexionId" TEXT;
ALTER TABLE "JournalAuthentification" ADD COLUMN "posteLocalId" TEXT;

-- CreateIndex
CREATE INDEX "SessionUtilisateur_connexionId_idx" ON "SessionUtilisateur"("connexionId");

