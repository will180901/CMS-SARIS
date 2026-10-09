-- Pendant SQLite de la migration PostgreSQL du même nom.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PersonnelMedical" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "siteId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "dateNaissance" DATETIME,
    "sexe" TEXT,
    "typeContrat" TEXT NOT NULL DEFAULT 'CDI',
    "sectionPaie" TEXT,
    "service" TEXT NOT NULL DEFAULT 'Centre Médico-Sanitaire',
    "departement" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PersonnelMedical" ("createdAt", "deletedAt", "id", "matricule", "nom", "prenom", "role", "siteId", "statut", "updatedAt") SELECT "createdAt", "deletedAt", "id", "matricule", "nom", "prenom", "role", "siteId", "statut", "updatedAt" FROM "PersonnelMedical";
DROP TABLE "PersonnelMedical";
ALTER TABLE "new_PersonnelMedical" RENAME TO "PersonnelMedical";
CREATE UNIQUE INDEX "PersonnelMedical_matricule_key" ON "PersonnelMedical"("matricule");
CREATE INDEX "PersonnelMedical_updatedAt_idx" ON "PersonnelMedical"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

