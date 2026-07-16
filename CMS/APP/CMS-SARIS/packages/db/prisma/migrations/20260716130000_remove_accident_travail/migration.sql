-- Nettoyage : « Accident du travail » n'a jamais été relié à un contrôleur/service
-- (aucune route de création/lecture n'a jamais existé) — schéma dormant depuis la
-- migration initiale, retiré avec ses tables vides.

-- DropForeignKey (implicite via DROP TABLE, listé pour traçabilité)
-- SuiviAccidentTravail_accidentId_fkey, AccidentTravail_consultationId_fkey

-- DropTable
DROP TABLE "SuiviAccidentTravail";

-- DropTable
DROP TABLE "AccidentTravail";
