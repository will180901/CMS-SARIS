-- CreateEnum
CREATE TYPE "StatutCompte" AS ENUM ('ACTIF', 'DESACTIVE', 'BLOQUE');

-- CreateEnum
CREATE TYPE "StatutPatient" AS ENUM ('ACTIF', 'ARCHIVE', 'DECEDE', 'FUSIONNE');

-- CreateEnum
CREATE TYPE "StatutVisite" AS ENUM ('EN_ATTENTE', 'EN_COURS', 'CLOTUREE', 'ANNULEE');

-- CreateEnum
CREATE TYPE "StatutConsultation" AS ENUM ('OUVERTE', 'CLOTUREE', 'ANNULEE');

-- CreateTable
CREATE TABLE "Utilisateur" (
    "id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "statut" "StatutCompte" NOT NULL DEFAULT 'ACTIF',
    "motDePasseTemp" BOOLEAN NOT NULL DEFAULT false,
    "tentativesEchec" INTEGER NOT NULL DEFAULT 0,
    "blocageJusquA" TIMESTAMP(3),
    "siteId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Utilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UtilisateurRole" (
    "utilisateurId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    CONSTRAINT "UtilisateurRole_pkey" PRIMARY KEY ("utilisateurId","roleId")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "SessionUtilisateur" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "posteLocalId" TEXT,
    "refreshTokenHash" TEXT NOT NULL,
    "ipAdresse" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "SessionUtilisateur_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConfigurationTotp" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "secretChiffre" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "ConfigurationTotp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CodeSecoursTotp" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "utilise" BOOLEAN NOT NULL DEFAULT false,
    "utilisedAt" TIMESTAMP(3),

    CONSTRAINT "CodeSecoursTotp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAudit" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entiteType" TEXT,
    "entiteId" TEXT,
    "avantJson" JSONB,
    "apresJson" JSONB,
    "ipAdresse" TEXT,
    "statut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalAuthentification" (
    "id" TEXT NOT NULL,
    "utilisateurId" TEXT,
    "login" TEXT NOT NULL,
    "resultat" TEXT NOT NULL,
    "ipAdresse" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalAuthentification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlerteAnomalie" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "investigPar" TEXT,
    "investigAt" TIMESTAMP(3),
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlerteAnomalie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametreSysteme" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ParametreSysteme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SauvegardeSysteme" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "declenchePar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SauvegardeSysteme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "localisation" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategoriePatient" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "CategoriePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DroitCategoriePatient" (
    "id" TEXT NOT NULL,
    "categorieId" TEXT NOT NULL,
    "typePrestation" TEXT NOT NULL,
    "couvert" BOOLEAN NOT NULL DEFAULT true,
    "plafondConsultations" INTEGER,
    "periode" TEXT,

    CONSTRAINT "DroitCategoriePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MotifConsultation" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "priorite" INTEGER NOT NULL DEFAULT 3,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',

    CONSTRAINT "MotifConsultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathologieReference" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "chronique" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',

    CONSTRAINT "PathologieReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicamentReference" (
    "id" TEXT NOT NULL,
    "nomGenerique" TEXT NOT NULL,
    "nomCommercial" TEXT,
    "familleThera" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',

    CONSTRAINT "MedicamentReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContreIndicationMedicament" (
    "id" TEXT NOT NULL,
    "medicamentId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "typeCondition" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,

    CONSTRAINT "ContreIndicationMedicament_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeExamen" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "domaine" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',

    CONSTRAINT "TypeExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EtablissementReference" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "localisation" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',

    CONSTRAINT "EtablissementReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SocieteSousTraitante" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SocieteSousTraitante_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonnelMedical" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "siteId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonnelMedical_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HabilitationPersonnel" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "HabilitationPersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanningPermutation" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningPermutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresenceJournaliere" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "present" BOOLEAN NOT NULL,

    CONSTRAINT "PresenceJournaliere_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AbsencePersonnel" (
    "id" TEXT NOT NULL,
    "personnelId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "motif" TEXT NOT NULL,

    CONSTRAINT "AbsencePersonnel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegationPrescription" (
    "id" TEXT NOT NULL,
    "medecinChefId" TEXT NOT NULL,
    "infirmierId" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "perimetre" TEXT,

    CONSTRAINT "DelegationPrescription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DelegationMedicamentAutorise" (
    "id" TEXT NOT NULL,
    "delegationId" TEXT NOT NULL,
    "medicamentId" TEXT NOT NULL,

    CONSTRAINT "DelegationMedicamentAutorise_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RattachementAyantDroitCdi" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "cdiId" TEXT NOT NULL,
    "typeLien" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "RattachementAyantDroitCdi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueRattachementAyantDroit" (
    "id" TEXT NOT NULL,
    "rattachementId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "HistoriqueRattachementAyantDroit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RattachementSousTraitant" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3),

    CONSTRAINT "RattachementSousTraitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueRattachementSousTraitant" (
    "id" TEXT NOT NULL,
    "rattachementId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "HistoriqueRattachementSousTraitant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Patient" (
    "id" TEXT NOT NULL,
    "numeroPatient" TEXT NOT NULL,
    "siteCreationId" TEXT NOT NULL,
    "categoriePatientId" TEXT NOT NULL,
    "statut" "StatutPatient" NOT NULL DEFAULT 'ACTIF',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IdentitePatient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3) NOT NULL,
    "sexe" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,

    CONSTRAINT "IdentitePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactUrgence" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "lien" TEXT NOT NULL,

    CONSTRAINT "ContactUrgence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AllergiePatient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "substance" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    "confirme" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AllergiePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AntecedentPatient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',

    CONSTRAINT "AntecedentPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlerteMedicale" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AlerteMedicale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueCategoriePatient" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "ancienneCategId" TEXT,
    "nouvelleCategId" TEXT NOT NULL,
    "dateEffet" TIMESTAMP(3) NOT NULL,
    "motif" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoriqueCategoriePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FusionDossierPatient" (
    "id" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "cibleId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FusionDossierPatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreSaisieMedicale" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visiteId" TEXT,
    "type" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "valide" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PreSaisieMedicale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviGrossesse" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "datePrevueAccouch" TIMESTAMP(3) NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "devenir" TEXT,
    "dateFinReelle" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuiviGrossesse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsultationPrenatale" (
    "id" TEXT NOT NULL,
    "suiviId" TEXT NOT NULL,
    "consultationId" TEXT,
    "termeSemaines" INTEGER NOT NULL,
    "poids" DOUBLE PRECISION,
    "tension" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationPrenatale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Visite" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "motifPrincipalId" TEXT NOT NULL,
    "statut" "StatutVisite" NOT NULL DEFAULT 'EN_ATTENTE',
    "priorite" INTEGER NOT NULL DEFAULT 3,
    "soignantId" TEXT,
    "dateOuverture" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCloture" TIMESTAMP(3),
    "creerHorsLigne" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Visite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConstanteVitale" (
    "id" TEXT NOT NULL,
    "visiteId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "tensionSystolique" INTEGER,
    "tensionDiastolique" INTEGER,
    "frequenceCardiaque" INTEGER,
    "saturationO2" DOUBLE PRECISION,
    "poids" DOUBLE PRECISION,
    "taille" DOUBLE PRECISION,
    "imc" DOUBLE PRECISION,
    "glycemie" DOUBLE PRECISION,
    "saisiePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConstanteVitale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consultation" (
    "id" TEXT NOT NULL,
    "visiteId" TEXT NOT NULL,
    "soignantId" TEXT NOT NULL,
    "delegationId" TEXT,
    "statut" "StatutConsultation" NOT NULL DEFAULT 'OUVERTE',
    "examenClinique" TEXT,
    "conclusion" TEXT,
    "decisionMedicale" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "Consultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiagnosticConsultation" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "pathologieId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "certitude" TEXT NOT NULL DEFAULT 'CONFIRME',

    CONSTRAINT "DiagnosticConsultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Ordonnance" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "prescripteurId" TEXT NOT NULL,
    "delegationId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Ordonnance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneOrdonnance" (
    "id" TEXT NOT NULL,
    "ordonnanceId" TEXT NOT NULL,
    "medicamentId" TEXT NOT NULL,
    "posologie" TEXT NOT NULL,
    "duree" TEXT NOT NULL,
    "voieAdmin" TEXT NOT NULL,
    "instructions" TEXT,
    "justification" TEXT,

    CONSTRAINT "LigneOrdonnance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonExamen" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "indicationClinik" TEXT NOT NULL,
    "etablissementId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneExamen" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "typeExamenId" TEXT NOT NULL,

    CONSTRAINT "LigneExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResultatExamen" (
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "laboratoire" TEXT,
    "contenu" TEXT NOT NULL,
    "interpretation" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'RECU',
    "saisiePar" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResultatExamen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviChronique" (
    "id" TEXT NOT NULL,
    "patientId" TEXT,
    "consultationId" TEXT,
    "pathologieId" TEXT NOT NULL,
    "frequenceSuivi" TEXT,
    "objectifs" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "motifCloture" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SuiviChronique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evacuation" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "motifId" TEXT,
    "niveauUrgence" TEXT NOT NULL,
    "etablissementId" TEXT,
    "infosCliniques" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Evacuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviEvacuation" (
    "id" TEXT NOT NULL,
    "evacuationId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "SuiviEvacuation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccidentTravail" (
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "dateAccident" TIMESTAMP(3) NOT NULL,
    "heureAccident" TEXT,
    "lieu" TEXT NOT NULL,
    "circonstances" TEXT NOT NULL,
    "lesions" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    "temoins" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccidentTravail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuiviAccidentTravail" (
    "id" TEXT NOT NULL,
    "accidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dateDebut" TIMESTAMP(3),
    "dateFin" TIMESTAMP(3),
    "dateReevaluation" TIMESTAMP(3),
    "sequelles" BOOLEAN,
    "descriptionSeq" TEXT,
    "tauxIncapacite" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "SuiviAccidentTravail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosteLocal" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "derniereSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosteLocal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FileMutation" (
    "id" TEXT NOT NULL,
    "mutationUuid" TEXT NOT NULL,
    "posteLocalId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entiteType" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'PENDING',
    "ordreLocal" BIGINT NOT NULL,
    "createdLocalAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "serverAckedAt" TIMESTAMP(3),
    "errorMessage" TEXT,

    CONSTRAINT "FileMutation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalSynchronisation" (
    "id" TEXT NOT NULL,
    "posteLocalId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "nbMutations" INTEGER NOT NULL DEFAULT 0,
    "nbConflits" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "JournalSynchronisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConflitSynchronisation" (
    "id" TEXT NOT NULL,
    "journalId" TEXT NOT NULL,
    "mutationUuid" TEXT NOT NULL,
    "entiteType" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "typeConflit" TEXT NOT NULL,
    "valeurLocale" JSONB NOT NULL,
    "valeurServeur" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConflitSynchronisation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResolutionConflit" (
    "id" TEXT NOT NULL,
    "conflitId" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "auteur" TEXT NOT NULL,
    "justification" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResolutionConflit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlerteTechnique" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "siteId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AlerteTechnique_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParametreMetier" (
    "id" TEXT NOT NULL,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ParametreMetier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoriqueParametreMetier" (
    "id" TEXT NOT NULL,
    "parametreId" TEXT NOT NULL,
    "ancienneVal" TEXT NOT NULL,
    "nouvelleVal" TEXT NOT NULL,
    "motif" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "HistoriqueParametreMetier_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_login_key" ON "Utilisateur"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationTotp_utilisateurId_key" ON "ConfigurationTotp"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametreSysteme_cle_key" ON "ParametreSysteme"("cle");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriePatient_code_key" ON "CategoriePatient"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MotifConsultation_code_key" ON "MotifConsultation"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PathologieReference_code_key" ON "PathologieReference"("code");

-- CreateIndex
CREATE UNIQUE INDEX "TypeExamen_code_key" ON "TypeExamen"("code");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelMedical_matricule_key" ON "PersonnelMedical"("matricule");

-- CreateIndex
CREATE UNIQUE INDEX "Patient_numeroPatient_key" ON "Patient"("numeroPatient");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitePatient_patientId_key" ON "IdentitePatient"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "ContactUrgence_patientId_key" ON "ContactUrgence"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "FusionDossierPatient_sourceId_key" ON "FusionDossierPatient"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FusionDossierPatient_cibleId_key" ON "FusionDossierPatient"("cibleId");

-- CreateIndex
CREATE UNIQUE INDEX "Evacuation_consultationId_key" ON "Evacuation"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "AccidentTravail_consultationId_key" ON "AccidentTravail"("consultationId");

-- CreateIndex
CREATE UNIQUE INDEX "FileMutation_mutationUuid_key" ON "FileMutation"("mutationUuid");

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionConflit_conflitId_key" ON "ResolutionConflit"("conflitId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametreMetier_cle_key" ON "ParametreMetier"("cle");

-- AddForeignKey
ALTER TABLE "Utilisateur" ADD CONSTRAINT "Utilisateur_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisateurRole" ADD CONSTRAINT "UtilisateurRole_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UtilisateurRole" ADD CONSTRAINT "UtilisateurRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionUtilisateur" ADD CONSTRAINT "SessionUtilisateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConfigurationTotp" ADD CONSTRAINT "ConfigurationTotp_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeSecoursTotp" ADD CONSTRAINT "CodeSecoursTotp_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ConfigurationTotp"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAudit" ADD CONSTRAINT "JournalAudit_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalAuthentification" ADD CONSTRAINT "JournalAuthentification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DroitCategoriePatient" ADD CONSTRAINT "DroitCategoriePatient_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategoriePatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContreIndicationMedicament" ADD CONSTRAINT "ContreIndicationMedicament_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HabilitationPersonnel" ADD CONSTRAINT "HabilitationPersonnel_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanningPermutation" ADD CONSTRAINT "PlanningPermutation_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresenceJournaliere" ADD CONSTRAINT "PresenceJournaliere_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AbsencePersonnel" ADD CONSTRAINT "AbsencePersonnel_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationPrescription" ADD CONSTRAINT "DelegationPrescription_medecinChefId_fkey" FOREIGN KEY ("medecinChefId") REFERENCES "PersonnelMedical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationPrescription" ADD CONSTRAINT "DelegationPrescription_infirmierId_fkey" FOREIGN KEY ("infirmierId") REFERENCES "PersonnelMedical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DelegationMedicamentAutorise" ADD CONSTRAINT "DelegationMedicamentAutorise_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RattachementAyantDroitCdi" ADD CONSTRAINT "RattachementAyantDroitCdi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueRattachementAyantDroit" ADD CONSTRAINT "HistoriqueRattachementAyantDroit_rattachementId_fkey" FOREIGN KEY ("rattachementId") REFERENCES "RattachementAyantDroitCdi"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RattachementSousTraitant" ADD CONSTRAINT "RattachementSousTraitant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RattachementSousTraitant" ADD CONSTRAINT "RattachementSousTraitant_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteSousTraitante"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueRattachementSousTraitant" ADD CONSTRAINT "HistoriqueRattachementSousTraitant_rattachementId_fkey" FOREIGN KEY ("rattachementId") REFERENCES "RattachementSousTraitant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_siteCreationId_fkey" FOREIGN KEY ("siteCreationId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_categoriePatientId_fkey" FOREIGN KEY ("categoriePatientId") REFERENCES "CategoriePatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IdentitePatient" ADD CONSTRAINT "IdentitePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactUrgence" ADD CONSTRAINT "ContactUrgence_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AllergiePatient" ADD CONSTRAINT "AllergiePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntecedentPatient" ADD CONSTRAINT "AntecedentPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlerteMedicale" ADD CONSTRAINT "AlerteMedicale_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueCategoriePatient" ADD CONSTRAINT "HistoriqueCategoriePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueCategoriePatient" ADD CONSTRAINT "HistoriqueCategoriePatient_nouvelleCategId_fkey" FOREIGN KEY ("nouvelleCategId") REFERENCES "CategoriePatient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FusionDossierPatient" ADD CONSTRAINT "FusionDossierPatient_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FusionDossierPatient" ADD CONSTRAINT "FusionDossierPatient_cibleId_fkey" FOREIGN KEY ("cibleId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreSaisieMedicale" ADD CONSTRAINT "PreSaisieMedicale_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviGrossesse" ADD CONSTRAINT "SuiviGrossesse_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationPrenatale" ADD CONSTRAINT "ConsultationPrenatale_suiviId_fkey" FOREIGN KEY ("suiviId") REFERENCES "SuiviGrossesse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConsultationPrenatale" ADD CONSTRAINT "ConsultationPrenatale_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visite" ADD CONSTRAINT "Visite_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visite" ADD CONSTRAINT "Visite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Visite" ADD CONSTRAINT "Visite_motifPrincipalId_fkey" FOREIGN KEY ("motifPrincipalId") REFERENCES "MotifConsultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConstanteVitale" ADD CONSTRAINT "ConstanteVitale_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "Visite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "Visite"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_soignantId_fkey" FOREIGN KEY ("soignantId") REFERENCES "PersonnelMedical"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticConsultation" ADD CONSTRAINT "DiagnosticConsultation_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiagnosticConsultation" ADD CONSTRAINT "DiagnosticConsultation_pathologieId_fkey" FOREIGN KEY ("pathologieId") REFERENCES "PathologieReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ordonnance" ADD CONSTRAINT "Ordonnance_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ordonnance" ADD CONSTRAINT "Ordonnance_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneOrdonnance" ADD CONSTRAINT "LigneOrdonnance_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneOrdonnance" ADD CONSTRAINT "LigneOrdonnance_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonExamen" ADD CONSTRAINT "BonExamen_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneExamen" ADD CONSTRAINT "LigneExamen_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonExamen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneExamen" ADD CONSTRAINT "LigneExamen_typeExamenId_fkey" FOREIGN KEY ("typeExamenId") REFERENCES "TypeExamen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResultatExamen" ADD CONSTRAINT "ResultatExamen_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonExamen"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviChronique" ADD CONSTRAINT "SuiviChronique_pathologieId_fkey" FOREIGN KEY ("pathologieId") REFERENCES "PathologieReference"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviChronique" ADD CONSTRAINT "SuiviChronique_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evacuation" ADD CONSTRAINT "Evacuation_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evacuation" ADD CONSTRAINT "Evacuation_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "EtablissementReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviEvacuation" ADD CONSTRAINT "SuiviEvacuation_evacuationId_fkey" FOREIGN KEY ("evacuationId") REFERENCES "Evacuation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccidentTravail" ADD CONSTRAINT "AccidentTravail_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuiviAccidentTravail" ADD CONSTRAINT "SuiviAccidentTravail_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "AccidentTravail"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FileMutation" ADD CONSTRAINT "FileMutation_posteLocalId_fkey" FOREIGN KEY ("posteLocalId") REFERENCES "PosteLocal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalSynchronisation" ADD CONSTRAINT "JournalSynchronisation_posteLocalId_fkey" FOREIGN KEY ("posteLocalId") REFERENCES "PosteLocal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ConflitSynchronisation" ADD CONSTRAINT "ConflitSynchronisation_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalSynchronisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResolutionConflit" ADD CONSTRAINT "ResolutionConflit_conflitId_fkey" FOREIGN KEY ("conflitId") REFERENCES "ConflitSynchronisation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoriqueParametreMetier" ADD CONSTRAINT "HistoriqueParametreMetier_parametreId_fkey" FOREIGN KEY ("parametreId") REFERENCES "ParametreMetier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
