# 🏠 CMS SARIS — Cahier des charges (as-built)

**Version** 1.0 · **Date** 2026-06-26 · **Statut global** : Complet v1.0 — revu · **Méthodologie** : `generic_prompt_v2` + `methodologie_creation_systeme` (ULAMU)

> Coffre Obsidian documentant le système **tel que construit** (web + API + desktop, offline-first). Source de vérité technique : le code (`CMS/APP/CMS-SARIS`) + la mémoire projet. Brief canonique : [[_SOURCE_systeme]].

---

## Chiffres clés (vérifiés dans le code)
- **87 tables** Prisma · **110 permissions** · **4 rôles** (ADMIN_SYSTEME, MEDECIN_CHEF, MEDECIN, INFIRMIER) · **2 sites** (Moutela, Nkayi).
- **16 modules** métier · ~**363 exigences fonctionnelles (EF)** · ~**111 cas d'usage (CU)** · **23 décisions (D-001→D-023)** · **49 paramètres (PM)**.
- **Stack** : React 19 / NestJS 11 / Prisma 6 / PostgreSQL + SQLite / Electron 33. Monorepo pnpm.
- **Déploiement** : API **Render**, base **Neon**, site web **Render**, desktop **installeur Windows**.

---

## Phase 0 — Cadrage & faisabilité  ✅
- [[vision]] — problème, valeur, anti-périmètre, objectifs soutenance
- [[personas_parcours]] — 6 personas, parcours actuel vs cible
- [[etude_existant]] — Excel/papier « Jeannette » + comparables + différenciateurs
- [[cadre_reglementaire]] — données de santé, secret médical, dispositifs as-built
- [[modele_economique]] — outil interne, coûts d'hébergement
- [[registre_risques]] — 12 risques (R-01→R-12) + mitigations
- [[registre_decisions]] — **23 décisions structurantes (D-001→D-023)** ⭐

## Phase 1 — Architecture fonctionnelle  ✅
- [[glossaire]] — langage ubiquitaire (33 termes)
- [[carte_domaines]] — 11 domaines (bounded contexts)
- [[plan_modules]] — 16 modules, dépendances acycliques, contrats **C-1→C-13** ⭐
- [[modele_donnees_global]] — entités + dictionnaire (87 tables)
- [[parametres_metier]] — **référentiel des chiffres (PM-01→PM-49)** ⭐
- [[exigences_non_fonctionnelles]] — ENF quantifiées (sécurité, offline, perf…)
- [[plan_releases]] — MVP / V1 / V2, MoSCoW

## Phase 2 — Spécifications par module  ✅
| # | Module | EF | CU |
|---|--------|----|----|
| 01 | [[MODULE_01_securite_authentification]] | 35 | 7 |
| 02 | [[MODULE_02_acces_habilitations]] | 20 | 9 |
| 03 | [[MODULE_03_parametres]] | 15 | 5 |
| 04 | [[MODULE_04_audit_supervision]] | 25 | 10 |
| 05 | [[MODULE_05_referentiels]] | 15 | 7 |
| 06 | [[MODULE_06_personnel]] | 27 | 4 |
| 07 | [[MODULE_07_dossier_patient]] | 29 | 8 |
| 08 | [[MODULE_08_triage]] | 22 | 8 |
| 09 | [[MODULE_09_consultation]] | 34 | 7 |
| 10 | [[MODULE_10_bon_examen]] | 18 | 6 |
| 11 | [[MODULE_11_bon_pharmacie]] | 15 | 6 |
| 12 | [[MODULE_12_evacuations]] | 19 | 7 |
| 13 | [[MODULE_13_messagerie]] | 22 | 8 |
| 14 | [[MODULE_14_notifications]] | 21 | 8 |
| 15 | [[MODULE_15_dashboard]] | 19 | 5 |
| 16 | [[MODULE_16_synchronisation]] | 27 | 6 |

## Phase 3 — Conception transverse  ✅
- [[decisions_architecture]] — ADR (contexte/options/choix/conséquences)
- [[modele_menaces]] — actifs, scénarios d'attaque, contre-mesures (données de santé)
- [[strategie_offline_sync]] — cache, file de rejeu, LWW, purge
- [[strategie_tests]] — typecheck, unit, intégration, E2E
- [[modele_operationnel]] — exploitation, sauvegardes, incidents, mises à jour
- [[checklist_mise_en_production]] — ⭐ runbook de déploiement (état franc : prêt démo / écarts prod)

## Phase 4 — UX / UI  ✅
- [[charte_graphique]] — design system SARIS (tokens, palette, composants)
- [[specifications_ecrans]] — parcours critiques, états, responsive, accessibilité

## Traçabilité  ✅
- [[tracabilite]] — matrice exigences ↔ modules ↔ releases ↔ ENF ↔ décisions

---

## Conventions
- **Une seule source de vérité** : un chiffre = [[parametres_metier]] (PM-xx) ; une décision = [[registre_decisions]] (D-xxx) ; un terme = [[glossaire]]. Référencés `[[...]]` ailleurs, jamais redéfinis.
- **Identifiants** : EF-NN-xx (exigence), CU-NN-xx (cas d'usage), RM-NN-xx (règle métier), C-x (contrat d'interface), ENF-xx (non-fonctionnel), R-xx (risque), D-xxx (décision), PM-xx (paramètre).
- **Honnêteté as-built** : on documente ce qui EXISTE ; « à confirmer » si non vérifié ; jamais d'invention.

> ✅ Revue de cohérence effectuée : tous les liens `[[...]]` résolvent, chiffres uniformisés (**87 tables / 110 permissions / 4 rôles / 16 modules**), liens copiés de la mémoire dé-liés. Détails : [[rapport_revue_coherence]].
