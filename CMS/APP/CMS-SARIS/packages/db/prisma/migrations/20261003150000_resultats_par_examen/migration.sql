-- Résultats d'examens PAR examen prescrit, correction tracée, compte rendu joint.
--
-- Avant : un seul texte libre par bon d'examen, quel que soit le nombre d'examens
-- prescrits — impossible de savoir quel résultat allait avec quel examen, ni ce qui
-- manquait encore. Désormais chaque résultat peut viser une ligne du bon
-- ("ligneExamenId"), porte la date de réalisation de l'examen et la mention
-- normal / anormal. Corriger un résultat en crée un nouveau ("corrigeId") et passe
-- l'ancien au statut REMPLACE : rien n'est effacé.
--
-- Aucune donnée existante n'est modifiée : les anciens résultats gardent
-- "ligneExamenId" à NULL et restent lus comme un résultat global du bon.
--
-- "PieceJointeResultat" : compte rendu du laboratoire (photo ou PDF), chiffré comme
-- les pièces jointes de la messagerie.

-- AlterTable
ALTER TABLE "ResultatExamen" ADD COLUMN     "anormal" BOOLEAN,
ADD COLUMN     "corrigeId" TEXT,
ADD COLUMN     "dateRealisation" TIMESTAMP(3),
ADD COLUMN     "ligneExamenId" TEXT,
ADD COLUMN     "motifCorrection" TEXT;

-- CreateTable
CREATE TABLE "PieceJointeResultat" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "bonId" TEXT NOT NULL,
    "nomFichier" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "taille" INTEGER NOT NULL,
    "contenuChiffre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "PieceJointeResultat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PieceJointeResultat_updatedAt_idx" ON "PieceJointeResultat"("updatedAt");

-- CreateIndex
CREATE INDEX "PieceJointeResultat_bonId_idx" ON "PieceJointeResultat"("bonId");

-- CreateIndex
CREATE INDEX "ResultatExamen_ligneExamenId_idx" ON "ResultatExamen"("ligneExamenId");

-- AddForeignKey
ALTER TABLE "ResultatExamen" ADD CONSTRAINT "ResultatExamen_ligneExamenId_fkey" FOREIGN KEY ("ligneExamenId") REFERENCES "LigneExamen"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PieceJointeResultat" ADD CONSTRAINT "PieceJointeResultat_bonId_fkey" FOREIGN KEY ("bonId") REFERENCES "BonExamen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

