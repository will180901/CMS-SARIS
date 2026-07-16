-- Pivot multi-site sans restriction : RapportGenere devient GLOBAL (un seul
-- rapport par période, plus de génération dupliquée par site).

-- DropForeignKey
ALTER TABLE "RapportGenere" DROP CONSTRAINT "RapportGenere_siteId_fkey";

-- DropIndex
DROP INDEX "RapportGenere_siteId_type_periodeDebut_idx";

-- AlterTable
ALTER TABLE "RapportGenere" DROP COLUMN "siteId";

-- CreateIndex
CREATE INDEX "RapportGenere_type_periodeDebut_idx" ON "RapportGenere"("type", "periodeDebut");
