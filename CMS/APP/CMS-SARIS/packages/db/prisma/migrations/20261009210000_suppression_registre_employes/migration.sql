-- Suppression du registre des employés (EmployeSaris).
--
-- Décision de l'utilisateur (2026-10-09) : les seuls « employés » du système sont les
-- membres du personnel (utilisateurs). Un travailleur de la SARIS qui vient se soigner est
-- un patient : ses informations professionnelles vivent dans SON dossier (matricule +
-- DonneesEmploi), et ses ayants droit sont rattachés à ce dossier (cdiId).
--
-- Rien n'est perdu : le contenu du registre est d'abord recopié dans les dossiers, puis
-- les rattachements sont réorientés vers le dossier du travailleur ; la table n'est
-- supprimée qu'ensuite. Les lignes modifiées sont ré-horodatées pour que les postes de
-- bureau les reçoivent à leur prochaine synchronisation. Le script s'exécute d'un bloc
-- (transaction implicite de PostgreSQL) : une erreur annule tout.

-- 1. Dossiers des travailleurs : matricule et données professionnelles complétés depuis
--    le registre quand le dossier ne les a pas.
UPDATE "Patient" p
SET "matricule" = e."matricule", "updatedAt" = now()
FROM "EmployeSaris" e
WHERE p."employeId" = e."id"
  AND p."matricule" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "Patient" q WHERE q."matricule" = e."matricule");

INSERT INTO "DonneesEmploi" ("id", "patientId", "fonction", "sectionPaie", "service", "departement", "updatedAt")
SELECT gen_random_uuid()::text, p."id", e."fonction", e."sectionPaie", e."service", e."departement", now()
FROM "Patient" p
JOIN "EmployeSaris" e ON e."id" = p."employeId"
WHERE NOT EXISTS (SELECT 1 FROM "DonneesEmploi" d WHERE d."patientId" = p."id");

UPDATE "DonneesEmploi" d
SET "fonction"    = COALESCE(d."fonction", e."fonction"),
    "sectionPaie" = COALESCE(d."sectionPaie", e."sectionPaie"),
    "service"     = COALESCE(d."service", e."service"),
    "departement" = COALESCE(d."departement", e."departement"),
    "updatedAt"   = now()
FROM "Patient" p
JOIN "EmployeSaris" e ON e."id" = p."employeId"
WHERE d."patientId" = p."id"
  AND ((d."fonction" IS NULL AND e."fonction" IS NOT NULL)
    OR (d."sectionPaie" IS NULL AND e."sectionPaie" IS NOT NULL)
    OR (d."service" IS NULL AND e."service" IS NOT NULL)
    OR (d."departement" IS NULL AND e."departement" IS NOT NULL));

-- 2. Travailleur rattaché à un ayant droit mais SANS dossier (données antérieures à la
--    création automatique du dossier du CDI) : son dossier est créé, sur le site de
--    l'ayant droit, avec le même format de numéro que l'application (PAT-XXX-00000).
DO $$
DECLARE
  t RECORD;
  prefixe TEXT;
  dernier INTEGER;
  nouveau_id TEXT;
  categorie_id TEXT;
BEGIN
  FOR t IN
    SELECT DISTINCT ON (e."id") e.*, ad."siteCreationId" AS "siteId"
    FROM "RattachementAyantDroitCdi" r
    JOIN "EmployeSaris" e ON e."id" = r."employeId"
    JOIN "Patient" ad ON ad."id" = r."patientId"
    WHERE r."cdiId" IS NULL
      AND NOT EXISTS (SELECT 1 FROM "Patient" p WHERE p."employeId" = e."id" OR p."matricule" = e."matricule")
    ORDER BY e."id", r."dateDebut"
  LOOP
    SELECT upper(substr(s."code", 1, 3)) INTO prefixe FROM "Site" s WHERE s."id" = t."siteId";
    SELECT COALESCE(max(substr(p."numeroPatient", length(p."numeroPatient") - 4)::INTEGER), 0)
      INTO dernier
      FROM "Patient" p
      WHERE p."numeroPatient" LIKE 'PAT-' || prefixe || '-%'
        AND substr(p."numeroPatient", length(p."numeroPatient") - 4) ~ '^[0-9]{5}$';
    SELECT c."id" INTO categorie_id FROM "CategoriePatient" c
      WHERE c."code" = COALESCE(NULLIF(t."categorie", ''), 'ASSURE_CDI');
    IF categorie_id IS NULL THEN
      SELECT c."id" INTO categorie_id FROM "CategoriePatient" c WHERE c."code" = 'ASSURE_CDI';
    END IF;
    nouveau_id := gen_random_uuid()::text;
    INSERT INTO "Patient" ("id", "numeroPatient", "matricule", "siteCreationId", "categoriePatientId", "statut", "createdAt", "createdBy", "updatedAt")
    VALUES (nouveau_id, 'PAT-' || prefixe || '-' || lpad((dernier + 1)::text, 5, '0'), t."matricule", t."siteId", categorie_id,
            'ACTIF', now(), 'migration-registre-employes', now());
    INSERT INTO "IdentitePatient" ("id", "patientId", "nom", "prenom", "dateNaissance", "sexe", "updatedAt")
    VALUES (gen_random_uuid()::text, nouveau_id, t."nom", t."prenom", t."dateNaissance", t."sexe", now());
    INSERT INTO "DonneesEmploi" ("id", "patientId", "fonction", "sectionPaie", "service", "departement", "updatedAt")
    VALUES (gen_random_uuid()::text, nouveau_id, t."fonction", t."sectionPaie", t."service", t."departement", now());
    UPDATE "Patient" SET "employeId" = t."id" WHERE "id" = nouveau_id;
  END LOOP;
END $$;

-- 3. Ayants droit : rattachés au DOSSIER du travailleur (par le lien registre, sinon par
--    le matricule).
UPDATE "RattachementAyantDroitCdi" r
SET "cdiId" = (
      SELECT p."id" FROM "Patient" p
      WHERE p."employeId" = r."employeId"
      ORDER BY (p."deletedAt" IS NULL) DESC, p."createdAt"
      LIMIT 1),
    "updatedAt" = now()
WHERE r."employeId" IS NOT NULL AND r."cdiId" IS NULL;

UPDATE "RattachementAyantDroitCdi" r
SET "cdiId" = (
      SELECT p."id" FROM "Patient" p
      JOIN "EmployeSaris" e ON e."matricule" = p."matricule"
      WHERE e."id" = r."employeId"
      LIMIT 1),
    "updatedAt" = now()
WHERE r."employeId" IS NOT NULL AND r."cdiId" IS NULL;

-- 4. Garde-fou : aucun ayant droit ne doit perdre son travailleur. Sinon, tout est annulé.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "RattachementAyantDroitCdi" WHERE "employeId" IS NOT NULL AND "cdiId" IS NULL) THEN
    RAISE EXCEPTION 'Suppression du registre annulée : un rattachement d''ayant droit n''a pas pu être relié au dossier de son travailleur CDI.';
  END IF;
END $$;

-- 5. Suppression du registre et des liens vers lui.
ALTER TABLE "RattachementAyantDroitCdi" DROP CONSTRAINT "RattachementAyantDroitCdi_employeId_fkey";
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_employeId_fkey";
ALTER TABLE "RattachementAyantDroitCdi" DROP COLUMN "employeId";
ALTER TABLE "Patient" DROP COLUMN "employeId";
DROP TABLE "EmployeSaris";
