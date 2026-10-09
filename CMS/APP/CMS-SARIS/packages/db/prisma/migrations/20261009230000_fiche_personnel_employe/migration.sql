-- Fiche du personnel = fiche d'employé de la SARIS (décision du 2026-10-09) : naissance,
-- sexe, contrat, section de paie, service, département. Elles ouvriront son dossier
-- patient sans ressaisie le jour où il passe à l'accueil.
-- AlterTable
ALTER TABLE "PersonnelMedical" ADD COLUMN     "dateNaissance" TIMESTAMP(3),
ADD COLUMN     "departement" TEXT,
ADD COLUMN     "sectionPaie" TEXT,
ADD COLUMN     "service" TEXT NOT NULL DEFAULT 'Centre Médico-Sanitaire',
ADD COLUMN     "sexe" TEXT,
ADD COLUMN     "typeContrat" TEXT NOT NULL DEFAULT 'CDI';

