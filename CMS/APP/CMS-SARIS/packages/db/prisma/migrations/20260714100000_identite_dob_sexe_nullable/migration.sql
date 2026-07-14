-- Un dossier CDI peut désormais être créé "vide" (registre employé, ou en
-- arrière-plan lors de l'enregistrement de son ayant droit) avant que le
-- travailleur ne se présente lui-même et complète sa propre identité.
ALTER TABLE "IdentitePatient" ALTER COLUMN "dateNaissance" DROP NOT NULL;
ALTER TABLE "IdentitePatient" ALTER COLUMN "sexe" DROP NOT NULL;
