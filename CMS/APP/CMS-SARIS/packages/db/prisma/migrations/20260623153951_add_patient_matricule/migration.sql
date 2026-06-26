-- AlterTable : matricule employeur du patient CDI (nullable, unique parmi les non-NULL)
ALTER TABLE "Patient" ADD COLUMN "matricule" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Patient_matricule_key" ON "Patient"("matricule");
