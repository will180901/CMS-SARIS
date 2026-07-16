-- Suivi de traitement : épisode ouvert depuis une consultation clôturée
-- (décision SUIVI_TRAITEMENT, comme EVACUATION) + fiches datées ajoutées
-- ensuite depuis le dossier patient.

-- CreateTable
CREATE TABLE "SuiviTraitement" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_COURS',
    "motifCloture" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "SuiviTraitement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FicheSuiviTraitement" (
    "id" TEXT NOT NULL,
    "suiviTraitementId" TEXT NOT NULL,
    "temperature" DOUBLE PRECISION,
    "tensionSystolique" INTEGER,
    "tensionDiastolique" INTEGER,
    "frequenceCardiaque" INTEGER,
    "frequenceRespiratoire" INTEGER,
    "saturationO2" INTEGER,
    "poids" DOUBLE PRECISION,
    "noteEvolution" TEXT,
    "medicamentsAdministres" TEXT,
    "resultatExamen" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "FicheSuiviTraitement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SuiviTraitement_consultationId_key" ON "SuiviTraitement"("consultationId");

-- CreateIndex
CREATE INDEX "SuiviTraitement_updatedAt_idx" ON "SuiviTraitement"("updatedAt");

-- AddForeignKey
ALTER TABLE "SuiviTraitement" ADD CONSTRAINT "SuiviTraitement_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FicheSuiviTraitement" ADD CONSTRAINT "FicheSuiviTraitement_suiviTraitementId_fkey" FOREIGN KEY ("suiviTraitementId") REFERENCES "SuiviTraitement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
