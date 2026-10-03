-- Résultats d'examens par examen, correction tracée, compte rendu joint — pendant
-- SQLite de la migration PostgreSQL du même nom. La table ResultatExamen est recréée
-- à l'identique (SQLite n'ajoute pas de clé étrangère à une table existante), ses
-- lignes recopiées : aucune donnée perdue.

-- CreateTable
CREATE TABLE "PieceJointeResultat" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "bonId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "contenuChiffre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "PieceJointeResultat_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonExamen" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ResultatExamen" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "bonId" TEXT NOT NULL,
    "laboratoire" TEXT,
    "contenu" TEXT NOT NULL,
    "interpretation" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'RECU',
    "saisiePar" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ligneExamenId" TEXT,
    "dateRealisation" DATETIME,
    "anormal" BOOLEAN,
    "corrigeId" TEXT,
    "motifCorrection" TEXT,
    CONSTRAINT "ResultatExamen_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonExamen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ResultatExamen_ligneExamenId_fkey" FOREIGN KEY ("ligneExamenId") REFERENCES "LigneExamen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_ResultatExamen" ("bonId", "contenu", "createdAt", "deletedAt", "id", "interpretation", "laboratoire", "saisiePar", "statut", "updatedAt") SELECT "bonId", "contenu", "createdAt", "deletedAt", "id", "interpretation", "laboratoire", "saisiePar", "statut", "updatedAt" FROM "ResultatExamen";
DROP TABLE "ResultatExamen";
ALTER TABLE "new_ResultatExamen" RENAME TO "ResultatExamen";
CREATE INDEX "ResultatExamen_updatedAt_idx" ON "ResultatExamen"("updatedAt");
CREATE INDEX "ResultatExamen_ligneExamenId_idx" ON "ResultatExamen"("ligneExamenId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "PieceJointeResultat_updatedAt_idx" ON "PieceJointeResultat"("updatedAt");

-- CreateIndex
CREATE INDEX "PieceJointeResultat_bonId_idx" ON "PieceJointeResultat"("bonId");

