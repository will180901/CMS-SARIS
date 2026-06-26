-- Sauvegarde système : contenu réel (snapshot JSON de configuration) + métadonnées.
-- Colonnes nullable → migration non destructive (anciennes entrées conservées).
ALTER TABLE "SauvegardeSysteme" ADD COLUMN     "contenuJson" TEXT,
ADD COLUMN     "finishedAt" TIMESTAMP(3),
ADD COLUMN     "message" TEXT,
ADD COLUMN     "perimetre" TEXT,
ADD COLUMN     "taille" INTEGER;
