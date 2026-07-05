-- Traçabilité du dernier utilisateur connecté ayant synchronisé depuis un poste (affichage
-- nom + rôle dans l'écran de supervision, au lieu de l'identifiant machine). Simple colonne
-- de traçabilité, SANS relation FK Prisma déclarée (même motif que createdBy/updatedBy
-- ailleurs au schéma) — jointure faite manuellement côté service.

-- AlterTable
ALTER TABLE "PosteLocal" ADD COLUMN     "dernierUtilisateurId" TEXT;
