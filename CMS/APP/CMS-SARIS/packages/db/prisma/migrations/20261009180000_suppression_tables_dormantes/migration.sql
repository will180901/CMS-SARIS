-- Suppression des 16 tables dormantes.
--
-- Plus aucun code ne les lit ni ne les écrit (vérifié le 2026-10-09 sur l'API, le web, le
-- desktop et les scripts) ; elles étaient vides en développement. Décision validée par
-- l'utilisateur le 2026-10-09.
--
-- Pas de CASCADE, volontairement : si un objet inattendu dépendait encore de l'une
-- d'elles, la migration échouerait au lieu d'emporter autre chose avec elle.
-- Ordre : tables « enfants » avant leurs « parents ».

-- Certificats (retirés en juin 2026 ; le repos maladie vit sur la consultation)
DROP TABLE IF EXISTS "CertificatMedical";
DROP TABLE IF EXISTS "TypeCertificat";

-- Suivi de grossesse (retiré en juin 2026)
DROP TABLE IF EXISTS "ConsultationPrenatale";
DROP TABLE IF EXISTS "SuiviGrossesse";

-- Pré-saisie médicale (jamais branchée)
DROP TABLE IF EXISTS "PreSaisieMedicale";

-- Ancien module RH (retiré en juin 2026)
DROP TABLE IF EXISTS "HabilitationPersonnel";
DROP TABLE IF EXISTS "AbsencePersonnel";
DROP TABLE IF EXISTS "PlanningPermutation";
DROP TABLE IF EXISTS "PresenceJournaliere";

-- Délégation par médicament (retirée : la délégation couvre la prescription)
DROP TABLE IF EXISTS "DelegationMedicamentAutorise";

-- Tables jamais utilisées
DROP TABLE IF EXISTS "AlerteAnomalie";
DROP TABLE IF EXISTS "AlerteTechnique";
DROP TABLE IF EXISTS "FileMutation";
DROP TABLE IF EXISTS "ResolutionConflit";
DROP TABLE IF EXISTS "HistoriqueParametreMetier";
DROP TABLE IF EXISTS "ParametreMetier";
