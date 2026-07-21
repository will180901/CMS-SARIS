-- DropForeignKey
ALTER TABLE "LigneOrdonnance" DROP CONSTRAINT "LigneOrdonnance_medicamentId_fkey";

-- AlterTable
ALTER TABLE "BonExamen" ADD COLUMN     "ordonnanceId" TEXT;

-- AlterTable
ALTER TABLE "BonPharmacie" ADD COLUMN     "ordonnanceId" TEXT;

-- AlterTable
ALTER TABLE "LigneOrdonnance" ADD COLUMN     "quantite" TEXT,
ADD COLUMN     "typeExamenId" TEXT,
ALTER COLUMN "medicamentId" DROP NOT NULL,
ALTER COLUMN "posologie" DROP NOT NULL,
ALTER COLUMN "duree" DROP NOT NULL,
ALTER COLUMN "voieAdmin" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Ordonnance" ADD COLUMN     "etablissementId" TEXT,
ADD COLUMN     "indicationClinik" TEXT,
ADD COLUMN     "typeOrdonnance" TEXT;

-- AddForeignKey
ALTER TABLE "Ordonnance" ADD CONSTRAINT "Ordonnance_etablissementId_fkey" FOREIGN KEY ("etablissementId") REFERENCES "EtablissementReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneOrdonnance" ADD CONSTRAINT "LigneOrdonnance_medicamentId_fkey" FOREIGN KEY ("medicamentId") REFERENCES "MedicamentReference"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LigneOrdonnance" ADD CONSTRAINT "LigneOrdonnance_typeExamenId_fkey" FOREIGN KEY ("typeExamenId") REFERENCES "TypeExamen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonExamen" ADD CONSTRAINT "BonExamen_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BonPharmacie" ADD CONSTRAINT "BonPharmacie_ordonnanceId_fkey" FOREIGN KEY ("ordonnanceId") REFERENCES "Ordonnance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
