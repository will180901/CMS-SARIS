-- AlterTable
ALTER TABLE "AntecedentPatient" ADD COLUMN     "pathologieId" TEXT;

-- AlterTable
ALTER TABLE "ConstanteVitale" ADD COLUMN     "frequenceRespiratoire" INTEGER;

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "anamneseDateDebut" TIMESTAMP(3),
ADD COLUMN     "anamneseDuree" TEXT,
ADD COLUMN     "anamneseModeDebut" TEXT,
ADD COLUMN     "anamneseSymptomes" TEXT;

-- AlterTable
ALTER TABLE "ModeViePatient" ADD COLUMN     "automedication" TEXT;

-- AlterTable
ALTER TABLE "MotifConsultation" ADD COLUMN     "triageAllege" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "PathologieReference" ADD COLUMN     "confidentialiteRenforcee" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "RapportGenere" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "periodeDebut" TIMESTAMP(3) NOT NULL,
    "periodeFin" TIMESTAMP(3) NOT NULL,
    "contenuJson" TEXT NOT NULL,
    "genereLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RapportGenere_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RapportGenere_siteId_type_periodeDebut_idx" ON "RapportGenere"("siteId", "type", "periodeDebut");

-- AddForeignKey
ALTER TABLE "RapportGenere" ADD CONSTRAINT "RapportGenere_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AntecedentPatient" ADD CONSTRAINT "AntecedentPatient_pathologieId_fkey" FOREIGN KEY ("pathologieId") REFERENCES "PathologieReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

