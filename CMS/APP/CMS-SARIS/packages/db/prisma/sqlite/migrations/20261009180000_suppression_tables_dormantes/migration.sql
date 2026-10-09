-- Suppression des 16 tables dormantes — pendant SQLite (postes desktop) de la migration
-- PostgreSQL du même nom. Mêmes tables, même ordre (enfants avant parents).

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
