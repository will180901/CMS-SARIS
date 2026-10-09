-- Suppression du registre des employés — pendant SQLite (postes de bureau) de la
-- migration PostgreSQL du même nom.
--
-- La recopie du registre dans les dossiers et la création des dossiers manquants se font
-- UNE FOIS, sur le serveur central, qui ré-horodate les lignes corrigées : le poste les
-- reçoit à sa prochaine synchronisation. Ici, avant la suppression, on réoriente seulement
-- les rattachements d'ayants droit vers le dossier du travailleur — une saisie faite hors
-- ligne, pas encore envoyée au serveur, garde ainsi son lien.

-- Matricule du travailleur repris dans son dossier s'il n'y figure pas.
UPDATE "Patient"
SET "matricule" = (SELECT e."matricule" FROM "EmployeSaris" e WHERE e."id" = "Patient"."employeId")
WHERE "employeId" IS NOT NULL
  AND "matricule" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "Patient" q
    JOIN "EmployeSaris" e ON e."id" = "Patient"."employeId"
    WHERE q."matricule" = e."matricule"
  );

-- Ayants droit rattachés au DOSSIER du travailleur (lien registre, sinon matricule).
UPDATE "RattachementAyantDroitCdi"
SET "cdiId" = (
  SELECT p."id" FROM "Patient" p
  WHERE p."employeId" = "RattachementAyantDroitCdi"."employeId"
  ORDER BY (p."deletedAt" IS NULL) DESC, p."createdAt"
  LIMIT 1)
WHERE "employeId" IS NOT NULL AND "cdiId" IS NULL;

UPDATE "RattachementAyantDroitCdi"
SET "cdiId" = (
  SELECT p."id" FROM "Patient" p
  JOIN "EmployeSaris" e ON e."matricule" = p."matricule"
  WHERE e."id" = "RattachementAyantDroitCdi"."employeId"
  LIMIT 1)
WHERE "employeId" IS NOT NULL AND "cdiId" IS NULL;

-- DropIndex
DROP INDEX "EmployeSaris_matricule_key";

-- DropIndex
DROP INDEX "EmployeSaris_updatedAt_idx";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "EmployeSaris";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_RattachementAyantDroitCdi" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "cdiId" TEXT,
    "typeLien" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME,
    CONSTRAINT "RattachementAyantDroitCdi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_RattachementAyantDroitCdi" ("cdiId", "dateDebut", "dateFin", "deletedAt", "id", "patientId", "statut", "typeLien", "updatedAt") SELECT "cdiId", "dateDebut", "dateFin", "deletedAt", "id", "patientId", "statut", "typeLien", "updatedAt" FROM "RattachementAyantDroitCdi";
DROP TABLE "RattachementAyantDroitCdi";
ALTER TABLE "new_RattachementAyantDroitCdi" RENAME TO "RattachementAyantDroitCdi";
CREATE INDEX "RattachementAyantDroitCdi_updatedAt_idx" ON "RattachementAyantDroitCdi"("updatedAt");
CREATE TABLE "new_Patient" (
    "siteId" TEXT,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "numeroPatient" TEXT NOT NULL,
    "matricule" TEXT,
    "siteCreationId" TEXT NOT NULL,
    "categoriePatientId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "version" INTEGER NOT NULL DEFAULT 1,
    "verrouille" BOOLEAN NOT NULL DEFAULT false,
    "verrouilleParId" TEXT,
    "verrouilleLe" DATETIME,
    "motifVerrou" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "Patient_siteCreationId_fkey" FOREIGN KEY ("siteCreationId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Patient_categoriePatientId_fkey" FOREIGN KEY ("categoriePatientId") REFERENCES "CategoriePatient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("categoriePatientId", "createdAt", "createdBy", "deletedAt", "id", "matricule", "motifVerrou", "numeroPatient", "siteCreationId", "siteId", "statut", "updatedAt", "updatedBy", "verrouille", "verrouilleLe", "verrouilleParId", "version") SELECT "categoriePatientId", "createdAt", "createdBy", "deletedAt", "id", "matricule", "motifVerrou", "numeroPatient", "siteCreationId", "siteId", "statut", "updatedAt", "updatedBy", "verrouille", "verrouilleLe", "verrouilleParId", "version" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_numeroPatient_key" ON "Patient"("numeroPatient");
CREATE UNIQUE INDEX "Patient_matricule_key" ON "Patient"("matricule");
CREATE INDEX "Patient_siteId_updatedAt_idx" ON "Patient"("siteId", "updatedAt");
CREATE INDEX "Patient_updatedAt_idx" ON "Patient"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

