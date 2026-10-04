-- Épisodes de suivi et évolution des traitements — pendant SQLite de la migration
-- PostgreSQL du même nom. Colonnes ajoutées (aucune table recréée, aucune donnée touchée)
-- et nouvelle table des administrations.

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN "episodeSuiviId" TEXT;
ALTER TABLE "Consultation" ADD COLUMN "motifSeance" TEXT;

-- AlterTable
ALTER TABLE "LigneOrdonnance" ADD COLUMN "arreteLe" DATETIME;
ALTER TABLE "LigneOrdonnance" ADD COLUMN "arretePar" TEXT;
ALTER TABLE "LigneOrdonnance" ADD COLUMN "motifArret" TEXT;
ALTER TABLE "LigneOrdonnance" ADD COLUMN "remplaceParId" TEXT;

-- AlterTable
ALTER TABLE "SuiviTraitement" ADD COLUMN "prochainControle" DATETIME;

-- CreateTable
CREATE TABLE "AdministrationTraitement" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "ligneOrdonnanceId" TEXT NOT NULL,
    "suiviTraitementId" TEXT,
    "ficheId" TEXT,
    "administreLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dose" TEXT,
    "observation" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdministrationTraitement_ligneOrdonnanceId_fkey" FOREIGN KEY ("ligneOrdonnanceId") REFERENCES "LigneOrdonnance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "AdministrationTraitement_updatedAt_idx" ON "AdministrationTraitement"("updatedAt");

-- CreateIndex
CREATE INDEX "AdministrationTraitement_ligneOrdonnanceId_idx" ON "AdministrationTraitement"("ligneOrdonnanceId");

-- CreateIndex
CREATE INDEX "AdministrationTraitement_suiviTraitementId_idx" ON "AdministrationTraitement"("suiviTraitementId");

-- CreateIndex
CREATE INDEX "Consultation_episodeSuiviId_idx" ON "Consultation"("episodeSuiviId");
