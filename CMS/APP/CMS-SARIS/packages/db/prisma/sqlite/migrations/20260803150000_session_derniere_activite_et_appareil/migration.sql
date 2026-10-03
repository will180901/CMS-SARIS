-- Dernière activité et appareil d'une session — pendant SQLite de la migration
-- PostgreSQL du même nom (cf. prisma/migrations/20260803150000_session_derniere_activite_et_appareil).
--
-- Elle manquait à la chaîne SQLite : un poste installé avant août gardait une table
-- SessionUtilisateur sans ces colonnes. Deux colonnes facultatives et un index ;
-- aucune donnée existante touchée.

-- AlterTable
ALTER TABLE "SessionUtilisateur" ADD COLUMN "appareilId" TEXT;
ALTER TABLE "SessionUtilisateur" ADD COLUMN "derniereActiviteAt" DATETIME;

-- CreateIndex
CREATE INDEX "SessionUtilisateur_utilisateurId_revokedAt_idx" ON "SessionUtilisateur"("utilisateurId", "revokedAt");

