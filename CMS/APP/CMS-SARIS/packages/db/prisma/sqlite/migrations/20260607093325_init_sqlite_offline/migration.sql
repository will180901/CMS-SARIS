-- CreateTable
CREATE TABLE "Utilisateur" (
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "login" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "motDePasseTemp" BOOLEAN NOT NULL DEFAULT false,
    "tentativesEchec" INTEGER NOT NULL DEFAULT 0,
    "blocageJusquA" DATETIME,
    "blocageMinutes" INTEGER NOT NULL DEFAULT 0,
    "siteId" TEXT NOT NULL,
    "personnelMedicalId" TEXT,
    "lastSeenAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,
    CONSTRAINT "Utilisateur_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Utilisateur_personnelMedicalId_fkey" FOREIGN KEY ("personnelMedicalId") REFERENCES "PersonnelMedical" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreferenceUtilisateur" (
    "utilisateurId" TEXT NOT NULL PRIMARY KEY,
    "theme" TEXT NOT NULL DEFAULT 'auto',
    "densite" TEXT NOT NULL DEFAULT 'confort',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "pageAccueil" TEXT NOT NULL DEFAULT 'dashboard',
    "lignesParPage" INTEGER NOT NULL DEFAULT 25,
    "notifEmail" BOOLEAN NOT NULL DEFAULT true,
    "notifApp" BOOLEAN NOT NULL DEFAULT true,
    "cguAccepteeLe" DATETIME,
    "cguVersion" TEXT,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PreferenceUtilisateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
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
    "createdById" TEXT
);

-- CreateTable
CREATE TABLE "NotificationLecture" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "notificationId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "readAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "masque" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "NotificationLecture_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Role" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "module" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "UtilisateurPermission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "utilisateurId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "motif" TEXT,
    "accordePar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UtilisateurPermission_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UtilisateurPermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UtilisateurRole" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "utilisateurId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,

    PRIMARY KEY ("utilisateurId", "roleId"),
    CONSTRAINT "UtilisateurRole_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UtilisateurRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SessionUtilisateur" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "utilisateurId" TEXT NOT NULL,
    "posteLocalId" TEXT,
    "refreshTokenHash" TEXT NOT NULL,
    "ipAdresse" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    CONSTRAINT "SessionUtilisateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConfigurationTotp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "utilisateurId" TEXT NOT NULL,
    "secretChiffre" TEXT NOT NULL,
    "actif" BOOLEAN NOT NULL DEFAULT false,
    "activatedAt" DATETIME,
    CONSTRAINT "ConfigurationTotp_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CodeSecoursTotp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "configId" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "utilise" BOOLEAN NOT NULL DEFAULT false,
    "utilisedAt" DATETIME,
    CONSTRAINT "CodeSecoursTotp_configId_fkey" FOREIGN KEY ("configId") REFERENCES "ConfigurationTotp" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalAudit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "utilisateurId" TEXT,
    "action" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entiteType" TEXT,
    "entiteId" TEXT,
    "avantJson" JSONB,
    "apresJson" JSONB,
    "ipAdresse" TEXT,
    "statut" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalAudit_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalAuthentification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "utilisateurId" TEXT,
    "login" TEXT NOT NULL,
    "resultat" TEXT NOT NULL,
    "ipAdresse" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "JournalAuthentification_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlerteAnomalie" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "investigPar" TEXT,
    "investigAt" DATETIME,
    "commentaire" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ParametreSysteme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- CreateTable
CREATE TABLE "SauvegardeSysteme" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "declenchePar" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "perimetre" TEXT,
    "contenuJson" TEXT,
    "taille" INTEGER,
    "finishedAt" DATETIME,
    "message" TEXT
);

-- CreateTable
CREATE TABLE "Site" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "localisation" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "CategoriePatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- CreateTable
CREATE TABLE "DroitCategoriePatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "categorieId" TEXT NOT NULL,
    "typePrestation" TEXT NOT NULL,
    "couvert" BOOLEAN NOT NULL DEFAULT true,
    "plafondConsultations" INTEGER,
    "periode" TEXT,
    CONSTRAINT "DroitCategoriePatient_categorieId_fkey" FOREIGN KEY ("categorieId") REFERENCES "CategoriePatient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MotifConsultation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF'
);

-- CreateTable
CREATE TABLE "PathologieReference" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "chronique" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE'
);

-- CreateTable
CREATE TABLE "MedicamentReference" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "nomGenerique" TEXT NOT NULL,
    "nomCommercial" TEXT,
    "familleThera" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF'
);

-- CreateTable
CREATE TABLE "ContreIndicationMedicament" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "medicamentId" TEXT NOT NULL,
    "condition" TEXT NOT NULL,
    "typeCondition" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    CONSTRAINT "ContreIndicationMedicament_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TypeExamen" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "domaine" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF'
);

-- CreateTable
CREATE TABLE "EtablissementReference" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "localisation" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF'
);

-- CreateTable
CREATE TABLE "SocieteSousTraitante" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "PersonnelMedical" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "siteId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "HabilitationPersonnel" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "personnelId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME,
    CONSTRAINT "HabilitationPersonnel_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PlanningPermutation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "personnelId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME NOT NULL,
    CONSTRAINT "PlanningPermutation_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PresenceJournaliere" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "personnelId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "present" BOOLEAN NOT NULL,
    CONSTRAINT "PresenceJournaliere_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AbsencePersonnel" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "personnelId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "motif" TEXT NOT NULL,
    CONSTRAINT "AbsencePersonnel_personnelId_fkey" FOREIGN KEY ("personnelId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DelegationPrescription" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "medecinChefId" TEXT NOT NULL,
    "infirmierId" TEXT NOT NULL,
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "perimetre" TEXT,
    CONSTRAINT "DelegationPrescription_medecinChefId_fkey" FOREIGN KEY ("medecinChefId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DelegationPrescription_infirmierId_fkey" FOREIGN KEY ("infirmierId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DelegationMedicamentAutorise" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "delegationId" TEXT NOT NULL,
    "medicamentId" TEXT NOT NULL,
    CONSTRAINT "DelegationMedicamentAutorise_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RattachementAyantDroitCdi" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "cdiId" TEXT NOT NULL,
    "typeLien" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME,
    CONSTRAINT "RattachementAyantDroitCdi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoriqueRattachementAyantDroit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rattachementId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "HistoriqueRattachementAyantDroit_rattachementId_fkey" FOREIGN KEY ("rattachementId") REFERENCES "RattachementAyantDroitCdi" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RattachementSousTraitant" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "societeId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "dateDebut" DATETIME NOT NULL,
    "dateFin" DATETIME,
    CONSTRAINT "RattachementSousTraitant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "RattachementSousTraitant_societeId_fkey" FOREIGN KEY ("societeId") REFERENCES "SocieteSousTraitante" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoriqueRattachementSousTraitant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "rattachementId" TEXT NOT NULL,
    "evenement" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "HistoriqueRattachementSousTraitant_rattachementId_fkey" FOREIGN KEY ("rattachementId") REFERENCES "RattachementSousTraitant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Patient" (
    "siteId" TEXT,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "numeroPatient" TEXT NOT NULL,
    "siteCreationId" TEXT NOT NULL,
    "categoriePatientId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT,
    CONSTRAINT "Patient_siteCreationId_fkey" FOREIGN KEY ("siteCreationId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Patient_categoriePatientId_fkey" FOREIGN KEY ("categoriePatientId") REFERENCES "CategoriePatient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "IdentitePatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" DATETIME NOT NULL,
    "sexe" TEXT NOT NULL,
    "telephone" TEXT,
    "adresse" TEXT,
    "photoUrl" TEXT,
    CONSTRAINT "IdentitePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContactUrgence" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "telephone" TEXT NOT NULL,
    "lien" TEXT NOT NULL,
    CONSTRAINT "ContactUrgence_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AllergiePatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "substance" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    "confirme" BOOLEAN NOT NULL DEFAULT false,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AllergiePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AntecedentPatient" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    CONSTRAINT "AntecedentPatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlerteMedicale" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "AlerteMedicale_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HistoriqueCategoriePatient" (
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

-- CreateTable
CREATE TABLE "FusionDossierPatient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" TEXT NOT NULL,
    "cibleId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FusionDossierPatient_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FusionDossierPatient_cibleId_fkey" FOREIGN KEY ("cibleId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PreSaisieMedicale" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "visiteId" TEXT,
    "type" TEXT NOT NULL,
    "contenu" JSONB NOT NULL,
    "valide" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PreSaisieMedicale_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuiviGrossesse" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "datePrevueAccouch" DATETIME NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "devenir" TEXT,
    "dateFinReelle" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SuiviGrossesse_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConsultationPrenatale" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "suiviId" TEXT NOT NULL,
    "consultationId" TEXT,
    "termeSemaines" INTEGER NOT NULL,
    "poids" REAL,
    "tension" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConsultationPrenatale_suiviId_fkey" FOREIGN KEY ("suiviId") REFERENCES "SuiviGrossesse" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ConsultationPrenatale_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Visite" (
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "motifPrincipalId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "soignantId" TEXT,
    "notesAccueil" TEXT,
    "motifAnnulation" TEXT,
    "typeCloture" TEXT,
    "dateOuverture" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCloture" DATETIME,
    "creerHorsLigne" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Visite_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Visite_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Visite_motifPrincipalId_fkey" FOREIGN KEY ("motifPrincipalId") REFERENCES "MotifConsultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VisiteEvenement" (
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

-- CreateTable
CREATE TABLE "ConstanteVitale" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "visiteId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "temperature" REAL,
    "tensionSystolique" INTEGER,
    "tensionDiastolique" INTEGER,
    "frequenceCardiaque" INTEGER,
    "saturationO2" REAL,
    "poids" REAL,
    "taille" REAL,
    "imc" REAL,
    "glycemie" REAL,
    "saisiePar" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConstanteVitale_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "Visite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Consultation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "visiteId" TEXT NOT NULL,
    "soignantId" TEXT NOT NULL,
    "delegationId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "examenClinique" TEXT,
    "conclusion" TEXT,
    "decisionMedicale" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "pickedUpById" TEXT,
    "pickedUpAt" DATETIME,
    CONSTRAINT "Consultation_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "Visite" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consultation_soignantId_fkey" FOREIGN KEY ("soignantId") REFERENCES "PersonnelMedical" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Consultation_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DiagnosticConsultation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "pathologieId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PRINCIPAL',
    "certitude" TEXT NOT NULL DEFAULT 'CONFIRME',
    CONSTRAINT "DiagnosticConsultation_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "DiagnosticConsultation_pathologieId_fkey" FOREIGN KEY ("pathologieId") REFERENCES "PathologieReference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Ordonnance" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "prescripteurId" TEXT NOT NULL,
    "delegationId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'BROUILLON',
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ordonnance_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Ordonnance_delegationId_fkey" FOREIGN KEY ("delegationId") REFERENCES "DelegationPrescription" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LigneOrdonnance" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "ordonnanceId" TEXT NOT NULL,
    "medicamentId" TEXT NOT NULL,
    "posologie" TEXT NOT NULL,
    "duree" TEXT NOT NULL,
    "voieAdmin" TEXT NOT NULL,
    "instructions" TEXT,
    "justification" TEXT,
    CONSTRAINT "LigneOrdonnance_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LigneOrdonnance_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BonExamen" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "indicationClinik" TEXT NOT NULL,
    "etablissementId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BonExamen_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LigneExamen" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "bonId" TEXT NOT NULL,
    "typeExamenId" TEXT NOT NULL,
    CONSTRAINT "LigneExamen_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonExamen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "LigneExamen_typeExamenId_fkey" FOREIGN KEY ("typeExamenId") REFERENCES "TypeExamen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResultatExamen" (
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
    CONSTRAINT "ResultatExamen_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonExamen" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuiviChronique" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "patientId" TEXT,
    "consultationId" TEXT,
    "pathologieId" TEXT NOT NULL,
    "frequenceSuivi" TEXT,
    "objectifs" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "motifCloture" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    CONSTRAINT "SuiviChronique_pathologieId_fkey" FOREIGN KEY ("pathologieId") REFERENCES "PathologieReference" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SuiviChronique_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Evacuation" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "motifId" TEXT,
    "niveauUrgence" TEXT NOT NULL,
    "etablissementId" TEXT,
    "infosCliniques" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Evacuation_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Evacuation_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "EtablissementReference" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuiviEvacuation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "evacuationId" TEXT NOT NULL,
    "notes" TEXT NOT NULL,
    "statut" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "SuiviEvacuation_evacuationId_fkey" FOREIGN KEY ("evacuationId") REFERENCES "Evacuation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AccidentTravail" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "consultationId" TEXT NOT NULL,
    "dateAccident" DATETIME NOT NULL,
    "heureAccident" TEXT,
    "lieu" TEXT NOT NULL,
    "circonstances" TEXT NOT NULL,
    "lesions" TEXT NOT NULL,
    "gravite" TEXT NOT NULL,
    "temoins" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'OUVERT',
    "motifAnnulation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccidentTravail_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SuiviAccidentTravail" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accidentId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "dateDebut" DATETIME,
    "dateFin" DATETIME,
    "dateReevaluation" DATETIME,
    "sequelles" BOOLEAN,
    "descriptionSeq" TEXT,
    "tauxIncapacite" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "SuiviAccidentTravail_accidentId_fkey" FOREIGN KEY ("accidentId") REFERENCES "AccidentTravail" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PosteLocal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "derniereSyncAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "FileMutation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mutationUuid" TEXT NOT NULL,
    "posteLocalId" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "entiteType" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "payloadJson" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'PENDING',
    "ordreLocal" BIGINT NOT NULL,
    "createdLocalAt" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "serverAckedAt" DATETIME,
    "errorMessage" TEXT,
    CONSTRAINT "FileMutation_posteLocalId_fkey" FOREIGN KEY ("posteLocalId") REFERENCES "PosteLocal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "JournalSynchronisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "posteLocalId" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "nbMutations" INTEGER NOT NULL DEFAULT 0,
    "nbConflits" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "JournalSynchronisation_posteLocalId_fkey" FOREIGN KEY ("posteLocalId") REFERENCES "PosteLocal" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ConflitSynchronisation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "journalId" TEXT NOT NULL,
    "mutationUuid" TEXT NOT NULL,
    "entiteType" TEXT NOT NULL,
    "entiteId" TEXT NOT NULL,
    "typeConflit" TEXT NOT NULL,
    "valeurLocale" JSONB NOT NULL,
    "valeurServeur" JSONB NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConflitSynchronisation_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "JournalSynchronisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ResolutionConflit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conflitId" TEXT NOT NULL,
    "resolution" TEXT NOT NULL,
    "auteur" TEXT NOT NULL,
    "justification" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResolutionConflit_conflitId_fkey" FOREIGN KEY ("conflitId") REFERENCES "ConflitSynchronisation" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlerteTechnique" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "siteId" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'OUVERTE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ParametreMetier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cle" TEXT NOT NULL,
    "valeur" TEXT NOT NULL,
    "description" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "updatedBy" TEXT
);

-- CreateTable
CREATE TABLE "HistoriqueParametreMetier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parametreId" TEXT NOT NULL,
    "ancienneVal" TEXT NOT NULL,
    "nouvelleVal" TEXT NOT NULL,
    "motif" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "HistoriqueParametreMetier_parametreId_fkey" FOREIGN KEY ("parametreId") REFERENCES "ParametreMetier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Conversation" (
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL DEFAULT 'DIRECT',
    "titre" TEXT,
    "siteId" TEXT,
    "createdById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ConversationParticipant" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "lastReadAt" DATETIME,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ConversationParticipant_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ConversationParticipant_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "expediteurId" TEXT NOT NULL,
    "contenuChiffre" TEXT NOT NULL,
    "replyToId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "editedAt" DATETIME,
    "deletedAt" DATETIME,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Message_expediteurId_fkey" FOREIGN KEY ("expediteurId") REFERENCES "Utilisateur" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Message_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "Message" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageMasque" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageMasque_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessageReaction" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "utilisateurId" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessageReaction_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MessagePieceJointe" (
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" DATETIME,
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "contenuChiffre" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MessagePieceJointe_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SyncState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "posteLocalId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "lastPulledAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastPushedAt" DATETIME,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_login_key" ON "Utilisateur"("login");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_email_key" ON "Utilisateur"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_personnelMedicalId_key" ON "Utilisateur"("personnelMedicalId");

-- CreateIndex
CREATE INDEX "Utilisateur_updatedAt_idx" ON "Utilisateur"("updatedAt");

-- CreateIndex
CREATE INDEX "Notification_destinataireId_idx" ON "Notification"("destinataireId");

-- CreateIndex
CREATE INDEX "Notification_siteId_idx" ON "Notification"("siteId");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "NotificationLecture_updatedAt_idx" ON "NotificationLecture"("updatedAt");

-- CreateIndex
CREATE INDEX "NotificationLecture_utilisateurId_idx" ON "NotificationLecture"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationLecture_notificationId_utilisateurId_key" ON "NotificationLecture"("notificationId", "utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "Role_updatedAt_idx" ON "Role"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_updatedAt_idx" ON "Permission"("updatedAt");

-- CreateIndex
CREATE INDEX "UtilisateurPermission_utilisateurId_idx" ON "UtilisateurPermission"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "UtilisateurPermission_utilisateurId_permissionId_key" ON "UtilisateurPermission"("utilisateurId", "permissionId");

-- CreateIndex
CREATE INDEX "UtilisateurRole_updatedAt_idx" ON "UtilisateurRole"("updatedAt");

-- CreateIndex
CREATE INDEX "RolePermission_updatedAt_idx" ON "RolePermission"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ConfigurationTotp_utilisateurId_key" ON "ConfigurationTotp"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametreSysteme_cle_key" ON "ParametreSysteme"("cle");

-- CreateIndex
CREATE UNIQUE INDEX "Site_code_key" ON "Site"("code");

-- CreateIndex
CREATE INDEX "Site_updatedAt_idx" ON "Site"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "CategoriePatient_code_key" ON "CategoriePatient"("code");

-- CreateIndex
CREATE INDEX "CategoriePatient_updatedAt_idx" ON "CategoriePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "DroitCategoriePatient_updatedAt_idx" ON "DroitCategoriePatient"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MotifConsultation_code_key" ON "MotifConsultation"("code");

-- CreateIndex
CREATE INDEX "MotifConsultation_updatedAt_idx" ON "MotifConsultation"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PathologieReference_code_key" ON "PathologieReference"("code");

-- CreateIndex
CREATE INDEX "PathologieReference_updatedAt_idx" ON "PathologieReference"("updatedAt");

-- CreateIndex
CREATE INDEX "MedicamentReference_updatedAt_idx" ON "MedicamentReference"("updatedAt");

-- CreateIndex
CREATE INDEX "ContreIndicationMedicament_updatedAt_idx" ON "ContreIndicationMedicament"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TypeExamen_code_key" ON "TypeExamen"("code");

-- CreateIndex
CREATE INDEX "TypeExamen_updatedAt_idx" ON "TypeExamen"("updatedAt");

-- CreateIndex
CREATE INDEX "EtablissementReference_updatedAt_idx" ON "EtablissementReference"("updatedAt");

-- CreateIndex
CREATE INDEX "SocieteSousTraitante_updatedAt_idx" ON "SocieteSousTraitante"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PersonnelMedical_matricule_key" ON "PersonnelMedical"("matricule");

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
CREATE UNIQUE INDEX "Patient_numeroPatient_key" ON "Patient"("numeroPatient");

-- CreateIndex
CREATE INDEX "Patient_siteId_updatedAt_idx" ON "Patient"("siteId", "updatedAt");

-- CreateIndex
CREATE INDEX "Patient_updatedAt_idx" ON "Patient"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdentitePatient_patientId_key" ON "IdentitePatient"("patientId");

-- CreateIndex
CREATE INDEX "IdentitePatient_updatedAt_idx" ON "IdentitePatient"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContactUrgence_patientId_key" ON "ContactUrgence"("patientId");

-- CreateIndex
CREATE INDEX "ContactUrgence_updatedAt_idx" ON "ContactUrgence"("updatedAt");

-- CreateIndex
CREATE INDEX "AllergiePatient_updatedAt_idx" ON "AllergiePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "AntecedentPatient_updatedAt_idx" ON "AntecedentPatient"("updatedAt");

-- CreateIndex
CREATE INDEX "AlerteMedicale_updatedAt_idx" ON "AlerteMedicale"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FusionDossierPatient_sourceId_key" ON "FusionDossierPatient"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FusionDossierPatient_cibleId_key" ON "FusionDossierPatient"("cibleId");

-- CreateIndex
CREATE INDEX "PreSaisieMedicale_updatedAt_idx" ON "PreSaisieMedicale"("updatedAt");

-- CreateIndex
CREATE INDEX "SuiviGrossesse_updatedAt_idx" ON "SuiviGrossesse"("updatedAt");

-- CreateIndex
CREATE INDEX "ConsultationPrenatale_updatedAt_idx" ON "ConsultationPrenatale"("updatedAt");

-- CreateIndex
CREATE INDEX "Visite_updatedAt_idx" ON "Visite"("updatedAt");

-- CreateIndex
CREATE INDEX "VisiteEvenement_visiteId_createdAt_idx" ON "VisiteEvenement"("visiteId", "createdAt");

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
CREATE UNIQUE INDEX "Evacuation_consultationId_key" ON "Evacuation"("consultationId");

-- CreateIndex
CREATE INDEX "Evacuation_updatedAt_idx" ON "Evacuation"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccidentTravail_consultationId_key" ON "AccidentTravail"("consultationId");

-- CreateIndex
CREATE INDEX "AccidentTravail_updatedAt_idx" ON "AccidentTravail"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileMutation_mutationUuid_key" ON "FileMutation"("mutationUuid");

-- CreateIndex
CREATE UNIQUE INDEX "ResolutionConflit_conflitId_key" ON "ResolutionConflit"("conflitId");

-- CreateIndex
CREATE UNIQUE INDEX "ParametreMetier_cle_key" ON "ParametreMetier"("cle");

-- CreateIndex
CREATE INDEX "Conversation_updatedAt_idx" ON "Conversation"("updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_updatedAt_idx" ON "ConversationParticipant"("updatedAt");

-- CreateIndex
CREATE INDEX "ConversationParticipant_utilisateurId_idx" ON "ConversationParticipant"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "ConversationParticipant_conversationId_utilisateurId_key" ON "ConversationParticipant"("conversationId", "utilisateurId");

-- CreateIndex
CREATE INDEX "Message_conversationId_idx" ON "Message"("conversationId");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_replyToId_idx" ON "Message"("replyToId");

-- CreateIndex
CREATE INDEX "MessageMasque_updatedAt_idx" ON "MessageMasque"("updatedAt");

-- CreateIndex
CREATE INDEX "MessageMasque_utilisateurId_idx" ON "MessageMasque"("utilisateurId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageMasque_messageId_utilisateurId_key" ON "MessageMasque"("messageId", "utilisateurId");

-- CreateIndex
CREATE INDEX "MessageReaction_updatedAt_idx" ON "MessageReaction"("updatedAt");

-- CreateIndex
CREATE INDEX "MessageReaction_messageId_idx" ON "MessageReaction"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "MessageReaction_messageId_utilisateurId_emoji_key" ON "MessageReaction"("messageId", "utilisateurId", "emoji");

-- CreateIndex
CREATE INDEX "MessagePieceJointe_updatedAt_idx" ON "MessagePieceJointe"("updatedAt");

-- CreateIndex
CREATE INDEX "MessagePieceJointe_messageId_idx" ON "MessagePieceJointe"("messageId");

-- CreateIndex
CREATE INDEX "SyncState_siteId_idx" ON "SyncState"("siteId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncState_posteLocalId_siteId_key" ON "SyncState"("posteLocalId", "siteId");
