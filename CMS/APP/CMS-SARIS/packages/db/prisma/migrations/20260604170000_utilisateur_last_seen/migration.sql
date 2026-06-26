-- Présence : horodatage de dernière activité de l'utilisateur. Additif, non destructif.
ALTER TABLE "Utilisateur" ADD COLUMN "lastSeenAt" TIMESTAMP(3);
