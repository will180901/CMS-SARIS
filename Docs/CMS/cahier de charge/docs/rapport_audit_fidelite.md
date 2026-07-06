# Rapport d'audit — Fidélité au code & conformité méthodologique

**Version** 1.1 · **Date** 2026-07-06 · **Statut** Validé (audit initial) + addendum · **Historique** : v1.0 création (2026-06-29) · v1.1 (2026-07-06) : addendum §7 — delta d'alignement post-audit
**Portée** : cahier des charges `Docs/CMS/cahier de charge/docs` (42 documents) · **Référence de vérité** : le code du monorepo `CMS/APP/CMS-SARIS/` + les deux prompts méthodologiques (`generic_prompt_v2`, `methodologie_creation_systeme`).

> Ce rapport répond à une exigence précise du porteur : **prouver** (et non affirmer) que le
> cahier des charges est un **miroir fidèle de l'application construite** et qu'il **respecte les
> deux prompts**. L'audit a été mené en mode **adverse** (chercher les écarts, pas les confirmer),
> doc par doc, contre le code réel. Complément du [[rapport_revue_coherence]] (cohérence interne) :
> celui-ci porte sur la **fidélité externe** (doc ↔ code) et la **conformité aux prompts**.

---

## 1. Méthode

- **Axe 1 — Fidélité (20 documents)** : un vérificateur indépendant par document (16 modules + `modele_donnees_global`, `parametres_metier`, `plan_modules`, `glossaire`), chacun relisant le doc **puis le code réel** (controllers = endpoints/exigences, services = règles, DTO = validations, frontend = parcours) et classant chaque écart : **inventé** (affirmé, absent du code), **manquant** (présent dans le code, non documenté), **inexact** (détail erroné).
- **Axe 2 — Conformité aux prompts (2 contrôles)** : structure/identifiants/traçabilité/acyclicité/contrats vs `generic_prompt_v2` ; qualité (zéro chiffre en dur, critères d'acceptation CU, anti-périmètre, écarts assumés) vs les deux prompts.
- **Total** : 22 vérifications, ~1,8 M tokens, aucune modification pendant l'audit (constat pur). Les corrections ont été appliquées **ensuite**, puis re-vérifiées.

---

## 2. Verdict de fidélité (doc ↔ code)

**Conclusion : le cahier des charges est un miroir fidèle du code.** Verdicts bruts avant correction :

| Verdict | Documents |
|---------|-----------|
| **Fidèle** (miroir exact) | MODULE_06, MODULE_08, MODULE_12, plan_modules |
| **Écarts mineurs** (précisions) | MODULE_01, 02, 03, 04, 05, 07, 09, 10, 11, 13, 16, modele_donnees_global |
| **Écarts majeurs** (corrigés, cf. §3) | MODULE_14, MODULE_15, parametres_metier, glossaire |

Les vérificateurs ont confirmé indépendamment : endpoints, permissions par rôle, codes HTTP, règles métier (clôture, verrou, cloisonnement site, droits-catégorie), validations DTO, machines d'états, chiffres (15 min messagerie, 16 Mio × 10 PJ, throttles, TTL, cron 03 h 00, rétention…). **Aucune invention massive**, et les documents **signalent eux-mêmes** la plupart de leurs zones « à confirmer ».

---

## 3. Écarts MAJEURS trouvés — et corrigés

| # | Document(s) | Écart constaté (vs code) | Correction appliquée |
|---|-------------|--------------------------|----------------------|
| **E-01** | glossaire, parametres_metier (PM-46), MODULE_14, **+ ~35 docs** | **« 4 rôles »** (avec un rôle `MEDECIN`) — FAUX. Le code (`permissions.ts` ROLE_CATALOG + DEFAULT_ROLE_PERMISSIONS ; `seed.ts` « réduit à 3 rôles ») ne définit que **3 rôles** : ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER. `MEDECIN` est une **profession** (`TypePersonnel`) mappée au rôle MEDECIN_CHEF (`seed.ts:379`). | **3 rôles** partout ; `MEDECIN` requalifié en profession → MEDECIN_CHEF. ~35 docs + README + mémoire projet corrigés. 0 résidu vérifié. |
| **E-02** | MODULE_01, parametres_metier | PM-02 (refresh 7 j) et PM-03 (token TOTP 5 min) présentés comme **configurables** alors qu'ils sont des **constantes codées en dur** (`REFRESH_TOKEN_TTL`, `TEMP_TOKEN_TTL`). Seul PM-01 (TTL d'accès) est configurable. | PM-02/PM-03 marqués « valeur fixe, codée en dur » ; EF-01-11/21 + RM-01-05 reformulés. |
| **E-03** | MODULE_15 | Statistiques décrites sur les consultations **« clôturées »**, mais `getStatistiques` **ne filtre pas le statut** → compte **toutes** les consultations créées sur la période. Le label UI « clôturée » est trompeur. | Reformulé « toutes consultations créées, quel que soit le statut » ; label UI signalé en dette (PO-8). |
| **E-04** | MODULE_14 | §2 « Acteurs » inventait une ligne de rôle **MEDECIN** (4ᵉ rôle inexistant). | Ligne retirée ; alignée sur les 3 rôles réels. |

> Note d'honnêteté : l'écart E-01 venait d'une **mémoire projet périmée** (« 4 rôles ») que l'audit a
> renversée en relisant le code. **Le code fait foi** ; la mémoire a été corrigée en conséquence.

Les ~50 écarts **mineurs** (précisions d'endpoint, « à confirmer » en réalité tranchés, champs omis dans un tableau de données) ont été traités lors des passes de correction par module.

---

## 4. Verdict de conformité aux prompts

### 4.1 Structure (`generic_prompt_v2`) — **CONFORME**
Arborescence Phase 0→4 + traçabilité présente ; en-têtes version/date/statut/historique ; **tous** les identifiants utilisés (D-xxx, PM-xx, EF-NN-xx, CU-NN-xx, RM-NN-xx, C-x) ; traçabilité exigences↔modules↔releases vérifiée mécaniquement (**363 EF / 111 CU**) ; `plan_modules` = **DAG acyclique prouvé + 13 contrats nommés (C-1→C-13)** ; **modèle de menaces santé** complet.

### 4.2 Qualité (les deux prompts) — **4,3 / 5 → corrigé**
- **Critères d'acceptation CU** : 44/44 (100 %) au format « Étant donné / Quand / Alors » + scénarios d'erreur ; **hors-ligne 37/44 → 44/44** après comblement des 5 blocs manquants (MODULE_07 CU-07-04/05/07/08, MODULE_01 CU-01-07).
- **EF atomiques** : 363 EF, IDs uniques/contigus, aucune EF vague. Les 2-3 EF « fourre-tout » (EF-15-01/10, EF-01-10/29) **éclatées** en sous-EF atomiques.
- **Anti-périmètre** : **16/16 modules** ✅.
- **Zéro chiffre en dur** : discipline réelle (12/16 modules propres). Écarts corrigés : **référentiel étendu PM-50→PM-62** (rate-limits messagerie, seuils d'alerte clinique, supervision/rétention sync, CGU, soft-delete) ; ENF type-A **recâblés** vers PM-01..06 ; **collision d'identifiants PM-01/PM-02** dans `cadre_reglementaire` résolue (→ PM-61/PM-62).
- **Statut documentaire** : aligné — `00_HOME` ne prétend plus « Complet » mais « **contenu complet, fidélité vérifiée ; statut Brouillon (validation porteur en attente)** ».

---

## 5. Écarts ASSUMÉS (non bloquants, à acter par le porteur)

Ces deux points relèvent d'un **choix de contexte** (soutenance de stage), traités dans les règles de l'honnêteté méthodologique (jamais d'invention) :

1. **Recherche web non faite** pour l'étude de concurrence ([[etude_existant]]) et le cadre réglementaire ([[cadre_reglementaire]]) : aucune source externe ; chaque affirmation sensible porte **« à vérifier auprès d'un juriste »** / **« à vérifier »**. Le prompt l'exige sur le fond ; c'est un **manque connu**, pas une invention.
2. **Statut « Brouillon »** : la méthodologie réserve « Validé » à une **validation par le porteur via checklist**, non encore faite. Les documents sont complets et vérifiés ; le passage à « Validé » appartient au porteur.

---

## 6. État final (vérifié)

- **Fidélité** : miroir confirmé doc ↔ code ; 4 écarts majeurs + ~50 mineurs **corrigés**.
- **Chiffres canoniques** : **87 tables · 110 permissions · 3 rôles · 16 modules · 2 sites · 62 paramètres (PM-01→PM-62) · 363 EF · 111 CU · 23 décisions · 13 contrats**.
- **Liens `[[...]]`** : 42 docs, **0 cassé** (re-vérifié après corrections).
- **Cohérence** : 0 résidu « 4 rôles » ; 0 collision d'identifiant PM ; statut HOME cohérent avec le corps.
- **Reste (porteur)** : recherche web concurrence/réglementaire ; passage des statuts en « Validé » après relecture.

> **Verdict global** : le cahier des charges est un **miroir fidèle et méthodologiquement conforme**
> de l'application construite, avec deux manques **assumés et documentés** (recherche web, statut de
> validation) qui relèvent d'une décision du porteur, pas d'un défaut de fidélité.

---

## 7. Addendum — Delta d'alignement du 2026-07-06

> Cet addendum ne reprend **pas** l'audit adverse complet (§1-6, toujours valable pour le périmètre qu'il
> couvrait au 2026-06-29) : il documente le **delta** apparu entre cette date et le 2026-07-06, soit **20
> commits** applicatifs + les travaux de la session en cours, tous **plus ciblés** que l'audit initial.
> Méthode : relecture du code réel des zones touchées (commits + travail en cours), correction directe des
> documents concernés, pas de vérificateur indépendant séparé pour ce delta (proportionné à sa taille).

### 7.1 Écarts trouvés et corrigés

| # | Document(s) | Écart constaté | Correction appliquée |
|---|-------------|-----------------|------------------------|
| **E-05** | [[MODULE_01_securite_authentification]] | La **photo de profil self-service** (upload, suppression, annuaire léger `/me/annuaire`) n'était **pas documentée** — fonctionnalité ajoutée au code après le 2026-06-26 (migration `add_photo_url_utilisateur`, 2026-07-05) puis enrichie en session (recadrage client façon WhatsApp, avatar perpétuel affiché partout). | +5 EF (EF-01-36→40), +1 CU (CU-01-08), +1 RM (RM-01-16), §1.2/§5/§9 mis à jour. |
| **E-06** | [[MODULE_16_synchronisation]], [[specifications_ecrans]] | L'écran de supervision synchronisation documentait une version **antérieure** à sa refonte (pas de sous-onglets/filtres/pagination/détail de poste) ; le bouton « Lancer une sauvegarde » était documenté comme présent dans l'en-tête alors qu'il a été **retiré du frontend** (l'endpoint backend et le cron automatique restent actifs, sans consommateur UI). | +5 EF (EF-16-28→32), +1 CU (CU-16-07), +1 RM (RM-16-17) ; §1.3/§9 de MODULE_16 clarifiés (périmètre sauvegardes résolu) ; EU-06-01 de specifications_ecrans corrigé. |
| **E-07** | [[specifications_ecrans]] | La sidebar documentait **quatre** groupes de navigation (« Administration système », « Système » inclus) alors que ces deux groupes ont été **retirés** (leurs écrans sont désormais accessibles via Paramètres) — code actuel : deux groupes (`clinique`, `administration_medicale`). | EU-00-02 corrigé ; avatar de la carte utilisateur (footer sidebar) précisé — un seul des deux avatars visibles y est cliquable (l'autre imbriqué dans le déclencheur du menu). |
| **E-08** | [[MODULE_15_dashboard]] | La salutation du tableau de bord affiche désormais le **nom** de l'utilisateur (résolu via l'annuaire) plutôt que son **rôle** — non documenté. | +1 EF (EF-15-20). |
| **E-09** | [[charte_graphique]] | Aucune trace du nouveau pattern **avatar perpétuel + recadrage avant envoi** (composants `UserAvatar`/`PhotoCropModal`), pourtant un pattern transverse au même titre que le rideau de confidentialité ou les documents A4. | +UI-07-06. |
| **E-10** | [[tracabilite]] | Version desktop citée (**1.4.1**) obsolète (build **1.5.0** au 2026-07-06) ; comptages EF/CU (363/111) à re-décompter après E-05/E-06/E-08. | Version corrigée ; comptages re-décomptés mécaniquement → **374 EF / 113 CU** ; tableaux §1 et §4 mis à jour. |

### 7.2 Points vérifiés qui N'ONT PAS bougé (pour éviter une correction inutile)

- **Chiffres canoniques** (87 tables, 110 permissions, **3 rôles**, 62 paramètres) : re-vérifiés dans le code au 2026-07-06, **identiques** à l'audit du 2026-06-29. En particulier, la mémoire projet de session avait provisoirement ré-affirmé « 4 rôles » (confusion avec l'état intermédiaire de la réduction 7→4→3 décrite dans `project_reduction_3_roles`) — **infirmé** par re-lecture directe de `permissions.ts`/`seed.ts` : le système reste à **3 rôles**, aucun résidu introduit dans la doc.
- **Module 02 (Accès & habilitations)** et **EU-05** (specifications_ecrans) : déjà à jour (4 onglets Utilisateurs/Rôles/Personnel soignant/Délégations vérifiés identiques au code actuel) — aucune correction nécessaire.
- **Catalogue `PARAMETRES_CATALOGUE`** (MODULE_03) : toujours 3 groupes / 12 paramètres côté backend ; seul le **regroupement d'affichage** frontend a changé (précision apportée à EF-03-13, pas de nouvel EF).

### 7.3 État final (vérifié) après addendum

- **374 EF · 113 CU** sur 16 modules (detail : [[tracabilite]] §1).
- **0 nouveau lien `[[...]]` cassé** (vérifié sur les 7 fichiers modifiés).
- **0 régression** sur les chiffres canoniques déjà validés (87 tables / 110 permissions / 3 rôles / 16 modules / 62 paramètres).
- Desktop : version applicative buildée et référencée **1.5.0** (installeur régénéré le 2026-07-06).
