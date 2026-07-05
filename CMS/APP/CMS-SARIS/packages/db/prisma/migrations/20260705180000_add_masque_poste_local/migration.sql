-- Retrait dynamique d'un poste de la liste de supervision (dismiss), sans toucher à la
-- synchro réelle : le poste redevient visible automatiquement à son prochain cycle de
-- synchro (record() remet masque=false).

-- AlterTable
ALTER TABLE "PosteLocal" ADD COLUMN     "masque" BOOLEAN NOT NULL DEFAULT false;
