-- AlterTable
ALTER TABLE "ConstanteVitale" ADD COLUMN     "coloration" TEXT,
ADD COLUMN     "etatConscience" TEXT,
ADD COLUMN     "etatGeneral" TEXT,
ADD COLUMN     "hydratation" TEXT,
ADD COLUMN     "scoreGlasgow" INTEGER;

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "dateReprise" TIMESTAMP(3),
ADD COLUMN     "reposInclutJour" BOOLEAN DEFAULT false,
ADD COLUMN     "reposJours" INTEGER,
ADD COLUMN     "typeConsultationId" TEXT;

-- CreateTable
CREATE TABLE "TypeConsultation" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',

    CONSTRAINT "TypeConsultation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TypeCertificat" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "libelle" TEXT NOT NULL,
    "modeleTexte" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'ACTIF',

    CONSTRAINT "TypeCertificat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CertificatMedical" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "consultationId" TEXT NOT NULL,
    "typeCertificatId" TEXT NOT NULL,
    "dateApplication" TIMESTAMP(3),
    "dureeJours" INTEGER,
    "dateFin" TIMESTAMP(3),
    "contenu" TEXT,
    "statut" TEXT NOT NULL DEFAULT 'EMIS',
    "motifAnnulation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CertificatMedical_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TypeConsultation_code_key" ON "TypeConsultation"("code");

-- CreateIndex
CREATE INDEX "TypeConsultation_updatedAt_idx" ON "TypeConsultation"("updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TypeCertificat_code_key" ON "TypeCertificat"("code");

-- CreateIndex
CREATE INDEX "TypeCertificat_updatedAt_idx" ON "TypeCertificat"("updatedAt");

-- CreateIndex
CREATE INDEX "CertificatMedical_updatedAt_idx" ON "CertificatMedical"("updatedAt");

-- AddForeignKey
ALTER TABLE "Consultation" ADD CONSTRAINT "Consultation_typeConsultationId_fkey" FOREIGN KEY ("typeConsultationId") REFERENCES "TypeConsultation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificatMedical" ADD CONSTRAINT "CertificatMedical_consultationId_fkey" FOREIGN KEY ("consultationId") REFERENCES "Consultation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CertificatMedical" ADD CONSTRAINT "CertificatMedical_typeCertificatId_fkey" FOREIGN KEY ("typeCertificatId") REFERENCES "TypeCertificat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
