-- Notification : liste des PersonnelMedical.id directement impliqués dans le
-- dossier concerné (ex. soignant assigné à la visite/consultation) — sert à
-- distinguer, côté feed, « me concerne personnellement » de la diffusion
-- large par permission/site.

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "concernedPersonnelIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
