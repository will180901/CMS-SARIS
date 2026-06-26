-- Acceptation des conditions d'utilisation par utilisateur (date + version).
ALTER TABLE "PreferenceUtilisateur" ADD COLUMN "cguAccepteeLe" TIMESTAMP(3);
ALTER TABLE "PreferenceUtilisateur" ADD COLUMN "cguVersion" TEXT;
