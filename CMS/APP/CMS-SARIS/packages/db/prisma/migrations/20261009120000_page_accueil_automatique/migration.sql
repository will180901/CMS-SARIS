-- Page d'arrivée « Automatique » (selon la fonction) pour les comptes existants.
--
-- Leur préférence a été enregistrée à « dashboard » quand c'était la valeur par défaut,
-- avant l'option « Automatique » (Infirmier → Triage, Médecin Chef → Tableau de bord,
-- cf. ACCUEIL_PAR_ROLE). Ils n'arrivaient donc jamais sur leur poste de travail.
-- Décision de l'utilisateur (2026-10-09) : ceux restés sur « dashboard » passent en
-- « auto » ; chacun peut rechoisir dans ses Paramètres. Les autres choix (triage,
-- patients, consultations…) ne sont pas touchés. Aucune structure modifiée.
UPDATE "PreferenceUtilisateur" SET "pageAccueil" = 'auto' WHERE "pageAccueil" = 'dashboard';
