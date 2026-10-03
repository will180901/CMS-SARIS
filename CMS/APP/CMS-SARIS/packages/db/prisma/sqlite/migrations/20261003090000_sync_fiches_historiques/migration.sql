-- Synchronisation multi-postes des fiches de suivi, du suivi d'évacuation, des
-- historiques et du journal des visites — pendant SQLite de la migration PostgreSQL
-- du même nom (cf. prisma/migrations/20261003090000_sync_fiches_historiques).
--
-- SQLite refuse ADD COLUMN avec une valeur par défaut non constante (CURRENT_TIMESTAMP) :
-- chaque table est donc recréée à l'identique, colonnes "updatedAt" (et "deletedAt")
-- en plus, puis ses lignes recopiées. Aucune donnée perdue ; les lignes existantes
-- prennent l'heure de la migration comme "updatedAt", pour être transmises à la
-- prochaine synchronisation.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_HistoriqueRattachementAyantDroit" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "rattachementId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "HistoriqueRattachementAyantDroit_rattachementId_fkey" FOREIGN KEY ("rattachementId") REFERENCES "RattachementAyantDroitCdi" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HistoriqueRattachementAyantDroit" ("createdAt", "createdBy", "evenement", "id", "rattachementId") SELECT "createdAt", "createdBy", "evenement", "id", "rattachementId" FROM "HistoriqueRattachementAyantDroit";
DROP TABLE "HistoriqueRattachementAyantDroit";
ALTER TABLE "new_HistoriqueRattachementAyantDroit" RENAME TO "HistoriqueRattachementAyantDroit";
CREATE INDEX "HistoriqueRattachementAyantDroit_updatedAt_idx" ON "HistoriqueRattachementAyantDroit"("updatedAt");
CREATE TABLE "new_HistoriqueRattachementSousTraitant" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "rattachementId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "HistoriqueRattachementSousTraitant_rattachementId_fkey" FOREIGN KEY ("rattachementId") REFERENCES "RattachementSousTraitant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HistoriqueRattachementSousTraitant" ("createdAt", "createdBy", "evenement", "id", "rattachementId") SELECT "createdAt", "createdBy", "evenement", "id", "rattachementId" FROM "HistoriqueRattachementSousTraitant";
DROP TABLE "HistoriqueRattachementSousTraitant";
ALTER TABLE "new_HistoriqueRattachementSousTraitant" RENAME TO "HistoriqueRattachementSousTraitant";
CREATE INDEX "HistoriqueRattachementSousTraitant_updatedAt_idx" ON "HistoriqueRattachementSousTraitant"("updatedAt");
CREATE TABLE "new_HistoriqueCategoriePatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "ancienneCategId" TEXT,
    "nouvelleCategId" TEXT NOT NULL,
    "dateEffet" DATETIME NOT NULL,
    "motif" TEXT,
    "createdBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HistoriqueCategoriePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HistoriqueCategoriePatient_nouvelleCategId_fkey" FOREIGN KEY ("nouvelleCategId") REFERENCES "CategoriePatient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_HistoriqueCategoriePatient" ("ancienneCategId", "createdAt", "createdBy", "dateEffet", "id", "motif", "nouvelleCategId", "patientId") SELECT "ancienneCategId", "createdAt", "createdBy", "dateEffet", "id", "motif", "nouvelleCategId", "patientId" FROM "HistoriqueCategoriePatient";
DROP TABLE "HistoriqueCategoriePatient";
ALTER TABLE "new_HistoriqueCategoriePatient" RENAME TO "HistoriqueCategoriePatient";
CREATE INDEX "HistoriqueCategoriePatient_updatedAt_idx" ON "HistoriqueCategoriePatient"("updatedAt");
CREATE TABLE "new_VisiteEvenement" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "visiteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "ancienneVal" TEXT,
    "nouvelleVal" TEXT,
    "acteurId" TEXT NOT NULL,
    "commentaire" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VisiteEvenement_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "Visite" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_VisiteEvenement" ("acteurId", "ancienneVal", "commentaire", "createdAt", "id", "nouvelleVal", "type", "visiteId") SELECT "acteurId", "ancienneVal", "commentaire", "createdAt", "id", "nouvelleVal", "type", "visiteId" FROM "VisiteEvenement";
DROP TABLE "VisiteEvenement";
ALTER TABLE "new_VisiteEvenement" RENAME TO "VisiteEvenement";
CREATE INDEX "VisiteEvenement_visiteId_createdAt_idx" ON "VisiteEvenement"("visiteId", "createdAt");
CREATE INDEX "VisiteEvenement_updatedAt_idx" ON "VisiteEvenement"("updatedAt");
CREATE TABLE "new_SuiviEvacuation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "evacuationId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "SuiviEvacuation_evacuationId_fkey" FOREIGN KEY ("evacuationId") REFERENCES "Evacuation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SuiviEvacuation" ("createdAt", "createdBy", "evacuationId", "id", "notes", "statut") SELECT "createdAt", "createdBy", "evacuationId", "id", "notes", "statut" FROM "SuiviEvacuation";
DROP TABLE "SuiviEvacuation";
ALTER TABLE "new_SuiviEvacuation" RENAME TO "SuiviEvacuation";
CREATE INDEX "SuiviEvacuation_updatedAt_idx" ON "SuiviEvacuation"("updatedAt");
CREATE TABLE "new_FicheSuiviTraitement" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "suiviTraitementId" TEXT NOT NULL,
    "temperature" REAL,
    "tensionSystolique" INTEGER,
    "tensionDiastolique" INTEGER,
    "frequenceCardiaque" INTEGER,
    "frequenceRespiratoire" INTEGER,
    "saturationO2" INTEGER,
    "poids" REAL,
    "noteEvolution" TEXT,
    "medicamentsAdministres" TEXT,
    "resultatExamen" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "FicheSuiviTraitement_suiviTraitementId_fkey" FOREIGN KEY ("suiviTraitementId") REFERENCES "SuiviTraitement" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_FicheSuiviTraitement" ("createdAt", "createdBy", "frequenceCardiaque", "frequenceRespiratoire", "id", "medicamentsAdministres", "noteEvolution", "poids", "resultatExamen", "saturationO2", "suiviTraitementId", "temperature", "tensionDiastolique", "tensionSystolique") SELECT "createdAt", "createdBy", "frequenceCardiaque", "frequenceRespiratoire", "id", "medicamentsAdministres", "noteEvolution", "poids", "resultatExamen", "saturationO2", "suiviTraitementId", "temperature", "tensionDiastolique", "tensionSystolique" FROM "FicheSuiviTraitement";
DROP TABLE "FicheSuiviTraitement";
ALTER TABLE "new_FicheSuiviTraitement" RENAME TO "FicheSuiviTraitement";
CREATE INDEX "FicheSuiviTraitement_updatedAt_idx" ON "FicheSuiviTraitement"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

