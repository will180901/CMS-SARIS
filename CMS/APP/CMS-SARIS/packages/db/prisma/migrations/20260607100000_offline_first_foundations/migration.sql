-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "NotificationLecture" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Role" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "UtilisateurRole" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "RolePermission" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Site" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "CategoriePatient" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DroitCategoriePatient" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MotifConsultation" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PathologieReference" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MedicamentReference" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ContreIndicationMedicament" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "TypeExamen" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "EtablissementReference" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SocieteSousTraitante" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PersonnelMedical" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "HabilitationPersonnel" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PlanningPermutation" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PresenceJournaliere" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AbsencePersonnel" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DelegationPrescription" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DelegationMedicamentAutorise" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "RattachementAyantDroitCdi" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "RattachementSousTraitant" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "siteId" TEXT;

-- AlterTable
ALTER TABLE "IdentitePatient" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ContactUrgence" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AllergiePatient" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AntecedentPatient" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AlerteMedicale" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "PreSaisieMedicale" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SuiviGrossesse" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ConsultationPrenatale" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Visite" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConstanteVitale" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "DiagnosticConsultation" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Ordonnance" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "LigneOrdonnance" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "BonExamen" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "LigneExamen" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "ResultatExamen" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SuiviChronique" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Evacuation" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "AccidentTravail" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN     "deletedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConversationParticipant" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MessageMasque" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MessageReaction" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "MessagePieceJointe" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL,
    "posteLocalId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "lastPulledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPushedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncState_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SyncState_siteId_idx" ON "SyncState"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_posteLocalId_siteId_key" ON "SyncState"("posteLocalId", "siteId");

-- CreateIndex
CREATE INDEX "Utilisateur_updatedAt_idx" ON "Utilisateur"("updatedAt");

-- CreateIndex
CREATE INDEX "NotificationLecture_updatedAt_idx" ON "NotificationLecture"("updatedAt");

-- CreateIndex
CREATE INDEX "Role_updatedAt_idx" ON "Role"("updatedAt");

-- CreateIndex
CREATE INDEX "Permission_updatedAt_idx" ON "Permission"("updatedAt");

-- CreateIndex
CREATE INDEX "UtilisateurRole_updatedAt_idx" ON "UtilisateurRole"("updatedAt");

-- CreateIndex
CREATE INDEX "RolePermission_updatedAt_idx" ON "RolePermission"("updatedAt");

-- CreateIndex
CREATE INDEX "Site_updatedAt_idx" ON "Site"("updatedAt");

-- CreateIndex
CREATE INDEX "CategoriePatient_updatedAt_idx" ON "CategoriePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "DroitCategoriePatient_updatedAt_idx" ON "DroitCategoriePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "MotifConsultation_updatedAt_idx" ON "MotifConsultation"("updatedAt");

-- CreateIndex
CREATE INDEX "PathologieReference_updatedAt_idx" ON "PathologieReference"("updatedAt");

-- CreateIndex
CREATE INDEX "MedicamentReference_updatedAt_idx" ON "MedicamentReference"("updatedAt");

-- CreateIndex
CREATE INDEX "ContreIndicationMedicament_updatedAt_idx" ON "ContreIndicationMedicament"("updatedAt");

-- CreateIndex
CREATE INDEX "TypeExamen_updatedAt_idx" ON "TypeExamen"("updatedAt");

-- CreateIndex
CREATE INDEX "EtablissementReference_updatedAt_idx" ON "EtablissementReference"("updatedAt");

-- CreateIndex
CREATE INDEX "SocieteSousTraitante_updatedAt_idx" ON "SocieteSousTraitante"("updatedAt");

-- CreateIndex
CREATE INDEX "PersonnelMedical_updatedAt_idx" ON "PersonnelMedical"("updatedAt");

-- CreateIndex
CREATE INDEX "HabilitationPersonnel_updatedAt_idx" ON "HabilitationPersonnel"("updatedAt");

-- CreateIndex
CREATE INDEX "PlanningPermutation_updatedAt_idx" ON "PlanningPermutation"("updatedAt");

-- CreateIndex
CREATE INDEX "PresenceJournaliere_updatedAt_idx" ON "PresenceJournaliere"("updatedAt");

-- CreateIndex
CREATE INDEX "AbsencePersonnel_updatedAt_idx" ON "AbsencePersonnel"("updatedAt");

-- CreateIndex
CREATE INDEX "DelegationPrescription_updatedAt_idx" ON "DelegationPrescription"("updatedAt");

-- CreateIndex
CREATE INDEX "DelegationMedicamentAutorise_updatedAt_idx" ON "DelegationMedicamentAutorise"("updatedAt");

-- CreateIndex
CREATE INDEX "RattachementAyantDroitCdi_updatedAt_idx" ON "RattachementAyantDroitCdi"("updatedAt");

-- CreateIndex
CREATE INDEX "RattachementSousTraitant_updatedAt_idx" ON "RattachementSousTraitant"("updatedAt");

-- CreateIndex
CREATE INDEX "Patient_siteId_updatedAt_idx" ON "Patient"("siteId", "updatedAt");

-- CreateIndex
CREATE INDEX "Patient_updatedAt_idx" ON "Patient"("updatedAt");

-- CreateIndex
CREATE INDEX "IdentitePatient_updatedAt_idx" ON "IdentitePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "ContactUrgence_updatedAt_idx" ON "ContactUrgence"("updatedAt");

-- CreateIndex
CREATE INDEX "AllergiePatient_updatedAt_idx" ON "AllergiePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "AntecedentPatient_updatedAt_idx" ON "AntecedentPatient"("updatedAt");

-- CreateIndex
CREATE INDEX "AlerteMedicale_updatedAt_idx" ON "AlerteMedicale"("updatedAt");

-- CreateIndex
CREATE INDEX "PreSaisieMedicale_updatedAt_idx" ON "PreSaisieMedicale"("updatedAt");

-- CreateIndex
CREATE INDEX "SuiviGrossesse_updatedAt_idx" ON "SuiviGrossesse"("updatedAt");

-- CreateIndex
CREATE INDEX "ConsultationPrenatale_updatedAt_idx" ON "ConsultationPrenatale"("updatedAt");

-- CreateIndex
CREATE INDEX "Visite_updatedAt_idx" ON "Visite"("updatedAt");

-- CreateIndex
CREATE INDEX "ConstanteVitale_updatedAt_idx" ON "ConstanteVitale"("updatedAt");

-- CreateIndex
CREATE INDEX "Consultation_updatedAt_idx" ON "Consultation"("updatedAt");

-- CreateIndex
CREATE INDEX "DiagnosticConsultation_updatedAt_idx" ON "DiagnosticConsultation"("updatedAt");

-- CreateIndex
CREATE INDEX "Ordonnance_updatedAt_idx" ON "Ordonnance"("updatedAt");

-- CreateIndex
CREATE INDEX "LigneOrdonnance_updatedAt_idx" ON "LigneOrdonnance"("updatedAt");

-- CreateIndex
CREATE INDEX "BonExamen_updatedAt_idx" ON "BonExamen"("updatedAt");

-- CreateIndex
CREATE INDEX "LigneExamen_updatedAt_idx" ON "LigneExamen"("updatedAt");

-- CreateIndex
CREATE INDEX "ResultatExamen_updatedAt_idx" ON "ResultatExamen"("updatedAt");

-- CreateIndex
CREATE INDEX "SuiviChronique_updatedAt_idx" ON "SuiviChronique"("updatedAt");

-- CreateIndex
CREATE INDEX "Evacuation_updatedAt_idx" ON "Evacuation"("updatedAt");

-- CreateIndex
CREATE INDEX "AccidentTravail_updatedAt_idx" ON "AccidentTravail"("updatedAt");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_updatedAt_idx" ON "ConversationParticipant"("updatedAt");

-- CreateIndex
CREATE INDEX "MessageMasque_updatedAt_idx" ON "MessageMasque"("updatedAt");

-- CreateIndex
CREATE INDEX "MessageReaction_updatedAt_idx" ON "MessageReaction"("updatedAt");

-- CreateIndex
CREATE INDEX "MessagePieceJointe_updatedAt_idx" ON "MessagePieceJointe"("updatedAt");

-- Backfill du scope par site : Patient.siteId hérite du site de création (offline-first).
UPDATE "Patient" SET "siteId" = "siteCreationId" WHERE "siteId" IS NULL;

