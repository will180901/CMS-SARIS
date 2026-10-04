-- Épisodes de suivi qui prescrivent, et évolution des traitements.
--
-- "Consultation"."episodeSuiviId" / "motifSeance" : une SÉANCE DE SUIVI est une
-- consultation rattachée à l'épisode, lancée depuis le suivi sans repasser par le
-- triage — elle dispose des mêmes outils (ordonnances, examens, bons) qu'une
-- consultation, et chaque prescription reste attachée à une rencontre datée et signée.
-- "SuiviTraitement"."prochainControle" : date à laquelle revoir le patient.
--
-- "LigneOrdonnance" : arrêt d'un traitement avant sa fin prévue (date, motif, auteur)
-- et remplacement par une ligne prescrite plus tard. "AdministrationTraitement" :
-- chaque administration d'un traitement prescrit, notée au fil du suivi (remplace le
-- texte libre « médicaments administrés »).
--
-- "episodeSuiviId" est une référence SANS clé étrangère, volontairement : SuiviTraitement
-- pointe déjà vers sa consultation de départ ; une clé dans l'autre sens formerait une
-- boucle que la synchronisation des postes (parents avant enfants) ne sait pas ordonner.
--
-- Aucune donnée existante n'est modifiée : toutes les nouvelles colonnes sont vides.

-- AlterTable
ALTER TABLE "Consultation" ADD COLUMN     "episodeSuiviId" TEXT,
ADD COLUMN     "motifSeance" TEXT;

-- AlterTable
ALTER TABLE "LigneOrdonnance" ADD COLUMN     "arreteLe" TIMESTAMP(3),
ADD COLUMN     "arretePar" TEXT,
ADD COLUMN     "motifArret" TEXT,
ADD COLUMN     "remplaceParId" TEXT;

-- AlterTable
ALTER TABLE "SuiviTraitement" ADD COLUMN     "prochainControle" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AdministrationTraitement" (
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "id" TEXT NOT NULL,
    "ligneOrdonnanceId" TEXT NOT NULL,
    "suiviTraitementId" TEXT,
    "ficheId" TEXT,
    "administreLe" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dose" TEXT,
    "observation" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdministrationTraitement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdministrationTraitement_updatedAt_idx" ON "AdministrationTraitement"("updatedAt");

-- CreateIndex
CREATE INDEX "AdministrationTraitement_ligneOrdonnanceId_idx" ON "AdministrationTraitement"("ligneOrdonnanceId");

-- CreateIndex
CREATE INDEX "AdministrationTraitement_suiviTraitementId_idx" ON "AdministrationTraitement"("suiviTraitementId");

-- CreateIndex
CREATE INDEX "Consultation_episodeSuiviId_idx" ON "Consultation"("episodeSuiviId");

-- AddForeignKey
ALTER TABLE "AdministrationTraitement" ADD CONSTRAINT "AdministrationTraitement_ligneOrdonnanceId_fkey" FOREIGN KEY ("ligneOrdonnanceId") REFERENCES "LigneOrdonnance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
