-- Capture des changements appliqués en `db push` hors migrations (100% additif) :
-- EmployeSaris, DonneesEmploi, ModeViePatient, BonPharmacie/LigneBonPharmacie,
-- liens employeId (Patient / RattachementAyantDroitCdi), verrou de confidentialité (Patient).

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "employeId" TEXT,
ADD COLUMN     "motifVerrou" TEXT,
ADD COLUMN     "verrouille" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verrouilleLe" TIMESTAMP(3),
ADD COLUMN     "verrouilleParId" TEXT;

-- AlterTable
ALTER TABLE "RattachementAyantDroitCdi" ADD COLUMN     "employeId" TEXT,
ALTER COLUMN "cdiId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "EmployeSaris" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "matricule" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "prenom" TEXT NOT NULL,
    "dateNaissance" TIMESTAMP(3),
    "sexe" TEXT,
    "fonction" TEXT,
    "sectionPaie" TEXT,
    "service" TEXT,
    "departement" TEXT,
    "categorie" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeSaris_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonneesEmploi" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "fonction" TEXT,
    "sectionPaie" TEXT,
    "service" TEXT,
    "departement" TEXT,

    CONSTRAINT "DonneesEmploi_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModeViePatient" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
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
    "observations" TEXT,

    CONSTRAINT "ModeViePatient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BonPharmacie" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "prescripteurId" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'EN_ATTENTE',
    "observations" TEXT,
    "delivreLe" TIMESTAMP(3),
    "delivrePar" TEXT,
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BonPharmacie_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LigneBonPharmacie" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "medicamentId" TEXT,
    "libelle" TEXT NOT NULL,
    "posologie" TEXT,
    "quantite" TEXT,

    CONSTRAINT "LigneBonPharmacie_pkey" PRIMARY KEY ("id")
);

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

-- AddForeignKey
ALTER TABLE "RattachementAyantDroitCdi" ADD CONSTRAINT "RattachementAyantDroitCdi_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "EmployeSaris"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_employeId_fkey" FOREIGN KEY ("employeId") REFERENCES "EmployeSaris"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonneesEmploi" ADD CONSTRAINT "DonneesEmploi_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModeViePatient" ADD CONSTRAINT "ModeViePatient_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonPharmacie" ADD CONSTRAINT "BonPharmacie_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonPharmacie" ADD CONSTRAINT "LigneBonPharmacie_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonPharmacie"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneBonPharmacie" ADD CONSTRAINT "LigneBonPharmacie_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
