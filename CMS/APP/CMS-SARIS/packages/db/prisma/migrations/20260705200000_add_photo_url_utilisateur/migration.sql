-- Photo de profil utilisateur (auto-service), même convention que
-- IdentitePatient.photoUrl : data URL base64, aucun fichier sur disque.

-- AlterTable
ALTER TABLE "Utilisateur" ADD COLUMN     "photoUrl" TEXT;
