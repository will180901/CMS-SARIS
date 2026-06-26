-- Étape 3.4 — Différencier les types de clôture des visites
-- AVEC_CONSULTATION (transition vers le module Consultation)
-- SANS_CONSULTATION (clôture du triage uniquement)
-- L'annulation reste portée par le champ statut = 'ANNULEE'.

ALTER TABLE "Visite"
  ADD COLUMN "typeCloture" TEXT;
