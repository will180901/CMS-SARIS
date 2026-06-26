-- CreateEnum
CREATE TYPE "TypeEvenementVisite" AS ENUM ('STATUT_CHANGE', 'PRIORITE_CHANGE', 'SOIGNANT_CHANGE', 'NOTES_UPDATE');

-- AlterTable
ALTER TABLE "Visite" ADD COLUMN     "motifAnnulation" TEXT,
ADD COLUMN     "notesAccueil" TEXT;

-- CreateTable
CREATE TABLE "VisiteEvenement" (
    "id" TEXT NOT NULL,
    "visiteId" TEXT NOT NULL,
    "type" "TypeEvenementVisite" NOT NULL,
    "ancienneVal" TEXT,
    "nouvelleVal" TEXT,
    "acteurId" TEXT NOT NULL,
    "commentaire" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisiteEvenement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisiteEvenement_visiteId_createdAt_idx" ON "VisiteEvenement"("visiteId", "createdAt");

-- AddForeignKey
ALTER TABLE "VisiteEvenement" ADD CONSTRAINT "VisiteEvenement_visiteId_fkey" FOREIGN KEY ("visiteId") REFERENCES "Visite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
