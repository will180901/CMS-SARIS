/*
  Warnings:

  - You are about to drop the `AccidentTravail` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SuiviAccidentTravail` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "AccidentTravail_updatedAt_idx";

-- DropIndex
DROP INDEX "AccidentTravail_consultationId_key";

-- AlterTable
ALTER TABLE "ConstanteVitale" ADD COLUMN "coloration" TEXT;
ALTER TABLE "ConstanteVitale" ADD COLUMN "etatConscience" TEXT;
ALTER TABLE "ConstanteVitale" ADD COLUMN "etatGeneral" TEXT;
ALTER TABLE "ConstanteVitale" ADD COLUMN "frequenceRespiratoire" INTEGER;
ALTER TABLE "ConstanteVitale" ADD COLUMN "hydratation" TEXT;
ALTER TABLE "ConstanteVitale" ADD COLUMN "scoreGlasgow" INTEGER;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN "description" TEXT;
ALTER TABLE "Conversation" ADD COLUMN "photoUrl" TEXT;

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN "photoUrl" TEXT;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "AccidentTravail";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "SuiviAccidentTravail";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "RapportGenere" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "periodeDebut" DATETIME NOT NULL,
    "periodeFin" DATETIME NOT NULL,
    "contenuJson" TEXT NOT NULL,
    "genereLe" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "TypeConsultation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF'
);

-- CreateTable
CREATE TABLE "TypeCertificat" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "modeleTexte" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF'
);

-- CreateTable
CREATE TABLE "EmployeSaris" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" DATETIME,
    "sexe" TEXT,
    "fonction" TEXT,
    "sectionPaie" TEXT,
    "service" TEXT,
    "departement" TEXT,
    "categorie" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "DonneesEmploi" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "fonction" TEXT,
    "sectionPaie" TEXT,
    "service" TEXT,
    "departement" TEXT,
    CONSTRAINT "DonneesEmploi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ModeViePatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "tabac" TEXT,
    "alcool" TEXT,
    "drogues" TEXT,
    "activitePhysique" TEXT,
    "alimentation" TEXT,
    "sommeil" TEXT,
    "troublesSommeil" TEXT,
    "sedentarite" TEXT,
    "portCharges" TEXT,
    "automedication" TEXT,
    "observations" TEXT,
    CONSTRAINT "ModeViePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BonPharmacie" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "prescripteurId" TEXT NOT NULL,
    "ordonnanceId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "observations" TEXT,
    "delivreLe" DATETIME,
    "delivrePar" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonPharmacie_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BonPharmacie_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LigneBonPharmacie" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "bonId" TEXT NOT NULL,
    "medicamentId" TEXT,
    "libelle" TEXT NOT NULL,
    "posologie" TEXT,
    "quantite" TEXT,
    CONSTRAINT "LigneBonPharmacie_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonPharmacie" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LigneBonPharmacie_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CertificatMedical" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "typeCertificatId" TEXT NOT NULL,
    "dateApplication" DATETIME,
    "dureeJours" INTEGER,
    "dateFin" DATETIME,
    "contenu" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EMIS',
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CertificatMedical_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CertificatMedical_typeCertificatId_fkey" FOREIGN KEY ("typeCertificatId") REFERENCES "TypeCertificat" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuiviTraitement" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "motifCloture" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "SuiviTraitement_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FicheSuiviTraitement" (
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

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_AntecedentPatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "pathologieId" TEXT,
    "description" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    CONSTRAINT "AntecedentPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AntecedentPatient_pathologieId_fkey" FOREIGN KEY ("pathologieId") REFERENCES "PathologieReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_AntecedentPatient" ("deletedAt", "description", "id", "patientId", "statut", "type", "updatedAt") SELECT "deletedAt", "description", "id", "patientId", "statut", "type", "updatedAt" FROM "AntecedentPatient";
DROP TABLE "AntecedentPatient";
ALTER TABLE "new_AntecedentPatient" RENAME TO "AntecedentPatient";
CREATE INDEX "AntecedentPatient_updatedAt_idx" ON "AntecedentPatient"("updatedAt");
CREATE TABLE "new_BonExamen" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "ordonnanceId" TEXT,
    "indicationClinik" TEXT NOT NULL,
    "etablissementId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonExamen_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BonExamen_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BonExamen" ("consultationId", "createdAt", "deletedAt", "etablissementId", "id", "indicationClinik", "motifAnnulation", "statut", "updatedAt") SELECT "consultationId", "createdAt", "deletedAt", "etablissementId", "id", "indicationClinik", "motifAnnulation", "statut", "updatedAt" FROM "BonExamen";
DROP TABLE "BonExamen";
ALTER TABLE "new_BonExamen" RENAME TO "BonExamen";
CREATE INDEX "BonExamen_updatedAt_idx" ON "BonExamen"("updatedAt");
CREATE TABLE "new_Consultation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "visiteId" TEXT NOT NULL,
    "soignantId" TEXT NOT NULL,
    "delegationId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "anamneseDateDebut" DATETIME,
    "anamneseDuree" TEXT,
    "anamneseModeDebut" TEXT,
    "anamneseSymptomes" TEXT,
    "examenClinique" TEXT,
    "conclusion" TEXT,
    "decisionMedicale" TEXT,
    "motifAnnulation" TEXT,
    "typeConsultationId" TEXT,
    "reposJours" INTEGER,
    "reposInclutJour" BOOLEAN DEFAULT false,
    "dateReprise" DATETIME,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "pickedUpById" TEXT,
    "pickedUpAt" DATETIME,
    CONSTRAINT "Consultation_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "Visite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consultation_soignantId_fkey" FOREIGN KEY ("soignantId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consultation_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Consultation_typeConsultationId_fkey" FOREIGN KEY ("typeConsultationId") REFERENCES "TypeConsultation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Consultation" ("closedAt", "conclusion", "createdAt", "decisionMedicale", "delegationId", "deletedAt", "examenClinique", "id", "pickedUpAt", "pickedUpById", "soignantId", "statut", "updatedAt", "version", "visiteId") SELECT "closedAt", "conclusion", "createdAt", "decisionMedicale", "delegationId", "deletedAt", "examenClinique", "id", "pickedUpAt", "pickedUpById", "soignantId", "statut", "updatedAt", "version", "visiteId" FROM "Consultation";
DROP TABLE "Consultation";
ALTER TABLE "new_Consultation" RENAME TO "Consultation";
CREATE INDEX "Consultation_updatedAt_idx" ON "Consultation"("updatedAt");
CREATE TABLE "new_ConversationParticipant" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "estAdmin" BOOLEAN NOT NULL DEFAULT false,
    "muted" BOOLEAN NOT NULL DEFAULT false,
    "lastReadAt" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ConversationParticipant" ("conversationId", "id", "joinedAt", "lastReadAt", "updatedAt", "utilisateurId") SELECT "conversationId", "id", "joinedAt", "lastReadAt", "updatedAt", "utilisateurId" FROM "ConversationParticipant";
DROP TABLE "ConversationParticipant";
ALTER TABLE "new_ConversationParticipant" RENAME TO "ConversationParticipant";
CREATE INDEX "ConversationParticipant_updatedAt_idx" ON "ConversationParticipant"("updatedAt");
CREATE INDEX "ConversationParticipant_utilisateurId_idx" ON "ConversationParticipant"("utilisateurId");
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_utilisateurId_key" ON "ConversationParticipant"("conversationId", "utilisateurId");
CREATE TABLE "new_IdentitePatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" DATETIME,
    "sexe" TEXT,
    "telephone" TEXT,
    "adresse" TEXT,
    "photoUrl" TEXT,
    CONSTRAINT "IdentitePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_IdentitePatient" ("adresse", "dateNaissance", "deletedAt", "id", "nom", "patientId", "photoUrl", "prenom", "sexe", "telephone", "updatedAt") SELECT "adresse", "dateNaissance", "deletedAt", "id", "nom", "patientId", "photoUrl", "prenom", "sexe", "telephone", "updatedAt" FROM "IdentitePatient";
DROP TABLE "IdentitePatient";
ALTER TABLE "new_IdentitePatient" RENAME TO "IdentitePatient";
CREATE UNIQUE INDEX "IdentitePatient_patientId_key" ON "IdentitePatient"("patientId");
CREATE INDEX "IdentitePatient_updatedAt_idx" ON "IdentitePatient"("updatedAt");
CREATE TABLE "new_LigneOrdonnance" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordonnanceId" TEXT NOT NULL,
    "medicamentId" TEXT,
    "posologie" TEXT,
    "duree" TEXT,
    "voieAdmin" TEXT,
    "quantite" TEXT,
    "instructions" TEXT,
    "justification" TEXT,
    "typeExamenId" TEXT,
    CONSTRAINT "LigneOrdonnance_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LigneOrdonnance_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "LigneOrdonnance_typeExamenId_fkey" FOREIGN KEY ("typeExamenId") REFERENCES "TypeExamen" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_LigneOrdonnance" ("deletedAt", "duree", "id", "instructions", "justification", "medicamentId", "ordonnanceId", "posologie", "updatedAt", "voieAdmin") SELECT "deletedAt", "duree", "id", "instructions", "justification", "medicamentId", "ordonnanceId", "posologie", "updatedAt", "voieAdmin" FROM "LigneOrdonnance";
DROP TABLE "LigneOrdonnance";
ALTER TABLE "new_LigneOrdonnance" RENAME TO "LigneOrdonnance";
CREATE INDEX "LigneOrdonnance_updatedAt_idx" ON "LigneOrdonnance"("updatedAt");
CREATE TABLE "new_Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "expediteurId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'TEXTE',
    "contenuChiffre" TEXT NOT NULL,
    "replyToId" TEXT,
    "epingle" BOOLEAN NOT NULL DEFAULT false,
    "transfere" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Message" ("contenuChiffre", "conversationId", "createdAt", "deletedAt", "editedAt", "expediteurId", "id", "replyToId", "updatedAt") SELECT "contenuChiffre", "conversationId", "createdAt", "deletedAt", "editedAt", "expediteurId", "id", "replyToId", "updatedAt" FROM "Message";
DROP TABLE "Message";
ALTER TABLE "new_Message" RENAME TO "Message";
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");
CREATE TABLE "new_MotifConsultation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "triageAllege" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_MotifConsultation" ("code", "deletedAt", "id", "libelle", "statut", "updatedAt") SELECT "code", "deletedAt", "id", "libelle", "statut", "updatedAt" FROM "MotifConsultation";
DROP TABLE "MotifConsultation";
ALTER TABLE "new_MotifConsultation" RENAME TO "MotifConsultation";
CREATE UNIQUE INDEX "MotifConsultation_code_key" ON "MotifConsultation"("code");
CREATE INDEX "MotifConsultation_updatedAt_idx" ON "MotifConsultation"("updatedAt");
CREATE TABLE "new_Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destinataireId" TEXT,
    "siteId" TEXT,
    "requiredPermission" TEXT,
    "type" TEXT NOT NULL,
    "niveau" TEXT NOT NULL DEFAULT 'INFO',
    "titre" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entiteType" TEXT,
    "entiteId" TEXT,
    "lien" TEXT,
    "createdById" TEXT,
    "concernedPersonnelIds" TEXT NOT NULL DEFAULT '[]'
);
INSERT INTO "new_Notification" ("createdAt", "createdById", "destinataireId", "entiteId", "entiteType", "id", "lien", "message", "niveau", "requiredPermission", "siteId", "titre", "type") SELECT "createdAt", "createdById", "destinataireId", "entiteId", "entiteType", "id", "lien", "message", "niveau", "requiredPermission", "siteId", "titre", "type" FROM "Notification";
DROP TABLE "Notification";
ALTER TABLE "new_Notification" RENAME TO "Notification";
CREATE INDEX "Notification_destinataireId_idx" ON "Notification"("destinataireId");
CREATE INDEX "Notification_siteId_idx" ON "Notification"("siteId");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");
CREATE TABLE "new_Ordonnance" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "prescripteurId" TEXT NOT NULL,
    "delegationId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "typeOrdonnance" TEXT,
    "indicationClinik" TEXT,
    "etablissementId" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ordonnance_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ordonnance_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Ordonnance_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "EtablissementReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Ordonnance" ("consultationId", "createdAt", "delegationId", "deletedAt", "id", "motifAnnulation", "prescripteurId", "statut", "updatedAt") SELECT "consultationId", "createdAt", "delegationId", "deletedAt", "id", "motifAnnulation", "prescripteurId", "statut", "updatedAt" FROM "Ordonnance";
DROP TABLE "Ordonnance";
ALTER TABLE "new_Ordonnance" RENAME TO "Ordonnance";
CREATE INDEX "Ordonnance_updatedAt_idx" ON "Ordonnance"("updatedAt");
CREATE TABLE "new_PathologieReference" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "chronique" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "confidentialiteRenforcee" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_PathologieReference" ("chronique", "code", "deletedAt", "id", "libelle", "statut", "updatedAt") SELECT "chronique", "code", "deletedAt", "id", "libelle", "statut", "updatedAt" FROM "PathologieReference";
DROP TABLE "PathologieReference";
ALTER TABLE "new_PathologieReference" RENAME TO "PathologieReference";
CREATE UNIQUE INDEX "PathologieReference_code_key" ON "PathologieReference"("code");
CREATE INDEX "PathologieReference_updatedAt_idx" ON "PathologieReference"("updatedAt");
CREATE TABLE "new_Patient" (
    "siteId" TEXT,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "numeroPatient" TEXT NOT NULL,
    "matricule" TEXT,
    "employeId" TEXT,
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
    CONSTRAINT "Patient_categoriePatientId_fkey" FOREIGN KEY ("categoriePatientId") REFERENCES "CategoriePatient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Patient_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "EmployeSaris" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Patient" ("categoriePatientId", "createdAt", "createdBy", "deletedAt", "id", "numeroPatient", "siteCreationId", "siteId", "statut", "updatedAt", "updatedBy", "version") SELECT "categoriePatientId", "createdAt", "createdBy", "deletedAt", "id", "numeroPatient", "siteCreationId", "siteId", "statut", "updatedAt", "updatedBy", "version" FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_numeroPatient_key" ON "Patient"("numeroPatient");
CREATE UNIQUE INDEX "Patient_matricule_key" ON "Patient"("matricule");
CREATE INDEX "Patient_siteId_updatedAt_idx" ON "Patient"("siteId", "updatedAt");
CREATE INDEX "Patient_updatedAt_idx" ON "Patient"("updatedAt");
CREATE TABLE "new_PosteLocal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "dernierUtilisateurId" TEXT,
    "derniereSyncAt" DATETIME,
    "masque" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_PosteLocal" ("createdAt", "derniereSyncAt", "id", "libelle", "siteId") SELECT "createdAt", "derniereSyncAt", "id", "libelle", "siteId" FROM "PosteLocal";
DROP TABLE "PosteLocal";
ALTER TABLE "new_PosteLocal" RENAME TO "PosteLocal";
CREATE TABLE "new_RattachementAyantDroitCdi" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "cdiId" TEXT,
    "employeId" TEXT,
    "typeLien" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME,
    CONSTRAINT "RattachementAyantDroitCdi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RattachementAyantDroitCdi_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "EmployeSaris" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_RattachementAyantDroitCdi" ("cdiId", "dateDebut", "dateFin", "deletedAt", "id", "patientId", "statut", "typeLien", "updatedAt") SELECT "cdiId", "dateDebut", "dateFin", "deletedAt", "id", "patientId", "statut", "typeLien", "updatedAt" FROM "RattachementAyantDroitCdi";
DROP TABLE "RattachementAyantDroitCdi";
ALTER TABLE "new_RattachementAyantDroitCdi" RENAME TO "RattachementAyantDroitCdi";
CREATE INDEX "RattachementAyantDroitCdi_updatedAt_idx" ON "RattachementAyantDroitCdi"("updatedAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "RapportGenere_type_periodeDebut_idx" ON "RapportGenere"("type", "periodeDebut");

-- CreateIndex
CREATE UNIQUE INDEX "TypeConsultation_code_key" ON "TypeConsultation"("code");

-- CreateIndex
CREATE INDEX "TypeConsultation_updatedAt_idx" ON "TypeConsultation"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TypeCertificat_code_key" ON "TypeCertificat"("code");

-- CreateIndex
CREATE INDEX "TypeCertificat_updatedAt_idx" ON "TypeCertificat"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeSaris_matricule_key" ON "EmployeSaris"("matricule");

-- CreateIndex
CREATE INDEX "EmployeSaris_updatedAt_idx" ON "EmployeSaris"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonneesEmploi_patientId_key" ON "DonneesEmploi"("patientId");

-- CreateIndex
CREATE INDEX "DonneesEmploi_updatedAt_idx" ON "DonneesEmploi"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ModeViePatient_patientId_key" ON "ModeViePatient"("patientId");

-- CreateIndex
CREATE INDEX "ModeViePatient_updatedAt_idx" ON "ModeViePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "BonPharmacie_updatedAt_idx" ON "BonPharmacie"("updatedAt");

-- CreateIndex
CREATE INDEX "LigneBonPharmacie_updatedAt_idx" ON "LigneBonPharmacie"("updatedAt");

-- CreateIndex
CREATE INDEX "CertificatMedical_updatedAt_idx" ON "CertificatMedical"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuiviTraitement_consultationId_key" ON "SuiviTraitement"("consultationId");

-- CreateIndex
CREATE INDEX "SuiviTraitement_updatedAt_idx" ON "SuiviTraitement"("updatedAt");
