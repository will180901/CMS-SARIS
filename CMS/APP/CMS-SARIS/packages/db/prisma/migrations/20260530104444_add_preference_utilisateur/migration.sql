-- CreateTable
CREATE TABLE "PreferenceUtilisateur" (
    "utilisateurId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'auto',
    "densite" TEXT NOT NULL DEFAULT 'confort',
    "langue" TEXT NOT NULL DEFAULT 'fr',
    "pageAccueil" TEXT NOT NULL DEFAULT 'dashboard',
    "lignesParPage" INTEGER NOT NULL DEFAULT 25,
    "notifEmail" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreferenceUtilisateur_pkey" PRIMARY KEY ("utilisateurId")
);

-- AddForeignKey
ALTER TABLE "PreferenceUtilisateur" ADD CONSTRAINT "PreferenceUtilisateur_utilisateurId_fkey" FOREIGN KEY ("utilisateurId") REFERENCES "Utilisateur"("id") ON DELETE CASCADE ON UPDATE CASCADE;
