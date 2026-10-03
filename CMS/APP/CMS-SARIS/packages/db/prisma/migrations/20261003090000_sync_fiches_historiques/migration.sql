-- Synchronisation multi-postes des fiches de suivi, du suivi d'évacuation, des
-- historiques (catégorie, rattachements) et du journal des visites.
--
-- Ces tables n'avaient pas de colonne "updatedAt" : le moteur de synchronisation,
-- qui avance par curseur sur cette colonne, ne pouvait pas les transporter. Une fiche
-- saisie sur un poste n'existait nulle part ailleurs.
--
-- Aucune donnée existante n'est modifiée ni supprimée. Les lignes déjà présentes
-- prennent l'heure de la migration comme "updatedAt" (et non leur date de création) :
-- c'est voulu, elles seront ainsi transmises à la prochaine synchronisation de chaque
-- poste, même à ceux dont le curseur est postérieur à leur création.
--
-- "deletedAt" (fiches, suivi d'évacuation) : ces lignes sont supprimées à la ré-saisie
-- d'un suivi annulé ou avec leur consultation ; la suppression devient logique pour
-- qu'elle se propage aux autres postes.

-- AlterTable
ALTER TABLE "HistoriqueRattachementAyantDroit" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "HistoriqueRattachementSousTraitant" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "HistoriqueCategoriePatient" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "VisiteEvenement" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "SuiviEvacuation" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "FicheSuiviTraitement" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "HistoriqueRattachementAyantDroit_updatedAt_idx" ON "HistoriqueRattachementAyantDroit"("updatedAt");

-- CreateIndex
CREATE INDEX "HistoriqueRattachementSousTraitant_updatedAt_idx" ON "HistoriqueRattachementSousTraitant"("updatedAt");

-- CreateIndex
CREATE INDEX "HistoriqueCategoriePatient_updatedAt_idx" ON "HistoriqueCategoriePatient"("updatedAt");

-- CreateIndex
CREATE INDEX "VisiteEvenement_updatedAt_idx" ON "VisiteEvenement"("updatedAt");

-- CreateIndex
CREATE INDEX "SuiviEvacuation_updatedAt_idx" ON "SuiviEvacuation"("updatedAt");

-- CreateIndex
CREATE INDEX "FicheSuiviTraitement_updatedAt_idx" ON "FicheSuiviTraitement"("updatedAt");

