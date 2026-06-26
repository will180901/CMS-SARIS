-- Module 1 sécurité — Lien Utilisateur ↔ PersonnelMedical
-- + champs d'audit createdBy/updatedBy sur Utilisateur
--
-- Opération purement additive : tous les champs sont nullable, aucune donnée
-- existante n'est affectée. La contrainte UNIQUE permet une relation 1-1.

-- AlterTable
ALTER TABLE "Utilisateur"
  ADD COLUMN "createdBy"          TEXT,
  ADD COLUMN "personnelMedicalId" TEXT,
  ADD COLUMN "updatedBy"          TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Utilisateur_personnelMedicalId_key"
  ON "Utilisateur"("personnelMedicalId");

-- AddForeignKey
ALTER TABLE "Utilisateur"
  ADD CONSTRAINT "Utilisateur_personnelMedicalId_fkey"
  FOREIGN KEY ("personnelMedicalId") REFERENCES "PersonnelMedical"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
