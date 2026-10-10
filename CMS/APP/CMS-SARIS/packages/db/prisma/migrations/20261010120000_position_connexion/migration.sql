-- Position de l'APPAREIL relevee par le navigateur a chaque connexion web (jamais deduite de
-- l'adresse IP) : statut, coordonnees, marge d'erreur, heure du releve. Colonnes optionnelles.
-- AlterTable
ALTER TABLE "JournalAuthentification" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "positionLe" TIMESTAMP(3),
ADD COLUMN     "positionStatut" TEXT,
ADD COLUMN     "precisionM" DOUBLE PRECISION;

