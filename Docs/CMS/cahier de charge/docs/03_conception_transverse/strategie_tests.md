# Stratégie de tests — CMS SARIS (as-built)

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Ce document décrit la **stratégie de tests telle que construite** (le système est développé et
> déployé pour la soutenance). Il documente les niveaux de test **réellement présents** dans le
> monorepo `CMS/APP/CMS-SARIS/`, leur couverture, et leurs **limites honnêtement assumées**. Chaque
> fait cite le chemin de code de référence ; aucun chiffre n'est inventé. Les valeurs non vérifiées à
> la source sont marquées « à confirmer ».
>
> Chiffres et choix canoniques définis ailleurs (non redéfinis ici) : voir [[_SOURCE_systeme]],
> [[registre_decisions]], [[exigences_non_fonctionnelles]]. Les cas d'usage (CU) et exigences
> fonctionnelles (EF) référencés sont portés par les fiches de [[plan_modules]] (`02_modules/`).

---

## 1. Objet et portée

L'objectif de la stratégie de tests est de **prouver que les comportements critiques** du système
(authentification, sécurité, flux cliniques, synchronisation hors-ligne, messagerie temps réel)
fonctionnent **de bout en bout**, et que le code reste typé strictement. La pyramide de test du
projet est volontairement **pragmatique et reproductible** (contexte de soutenance) : elle repose
sur du typecheck strict, des tests unitaires de logique pure, des tests d'intégration HTTP contre
l'API réelle, et des tests « E2E maison » scriptés, complétés par une **vérification navigateur
manuelle** pour l'UI.

Ce document ne réécrit pas les critères d'acceptation : ceux-ci sont portés, au format
« Étant donné / Quand / Alors », par les **cas d'usage (CU-NN-xx)** des fiches de module
(`02_modules/MODULE_*`). La présente stratégie **renvoie** à ces CU et précise **comment** ils sont
couverts.

---

## 2. Niveaux de test (réels)

### 2.1 ST-01 — Typecheck strict (porte de qualité de base)

- **ST-01-01** — Le typage TypeScript strict est la **première barrière** : `tsc` doit retourner
  **0 erreur** sur les trois applications (API, WEB, DESKTOP). Référence : commande racine
  `pnpm typecheck` (`turbo typecheck`), `apps/web/package.json` (`typecheck: tsc --noEmit`),
  `apps/desktop/package.json` (`build:main: tsc -p tsconfig.json`).
- **ST-01-02** — La validation des entrées est typée et stricte à l'exécution : `ValidationPipe`
  global avec `whitelist` + `forbidNonWhitelisted` (rejet des champs inconnus → 400). Référence :
  `apps/api/src/main.ts`. Ce contrôle est exercé par les tests d'intégration (cas « validation → 400 »).
- **ST-01-03** — Le typecheck est exécuté **séparément** des tests `tsx` : certains fichiers de test
  (ex. `packages/types/test/sync-conflict.test.ts`) sont **hors du typecheck du paquet** et exécutés
  directement par `tsx`. Référence : en-tête `sync-conflict.test.ts` (« Exécuté par tsx (hors
  typecheck du paquet) »).

### 2.2 ST-02 — Tests unitaires (logique pure)

Tests de **logique pure** (sans réseau, sans base), exécutés par `tsx` avec un mini-harnais
`test(name, fn)` qui compte `passed/failed` et assertions via `node:assert/strict`.

- **ST-02-01 (soft-delete)** — Logique pure du soft-delete offline-first : appartenance à
  l'allow-list (`isSoftDeletable`), transformation `delete → update {deletedAt}`
  (`toSoftDeleteUpdate`), ajout du filtre `not deleted` (`addNotDeletedFilter`), résolution du nom de
  délégué. Référence : `apps/api/test/soft-delete-core.test.ts` → `src/prisma/soft-delete-core`.
  Couvre [[registre_decisions]] D-015.
- **ST-02-02 (résolution de conflit LWW)** — Réconciliation de synchronisation : `resolveConflict`
  (Last-Write-Wins sur `updatedAt` + détection via `baseUpdatedAt`), `mergeTombstone`, `diffFields`,
  `isTombstone`. Référence : `packages/types/test/sync-conflict.test.ts` →
  `packages/types/src/sync-conflict.ts`. Couvre D-016 et [[exigences_non_fonctionnelles]] ENF-01-05.
  *La mémoire projet mentionne « 17 tests de conflit » (cf. mémoire offline-first) — nombre exact
  à confirmer à l'exécution.*
- **ST-02-03 (chiffrement messagerie AES-256-GCM)** — Chiffrement/déchiffrement du contenu et des
  pièces jointes, versioning de clé (`v2:keyId`) et rétro-compatibilité v1. Référence :
  `apps/api/test/message-crypto.test.ts` → `src/common/crypto/message-crypto.ts`. Couvre D-012,
  ENF-04-05.
- **ST-02-04 (TOTP at-rest)** — Chiffrement at-rest du secret TOTP en AES-256-GCM et déchiffrement.
  Référence : `apps/api/test/totp-secret.test.ts` → `src/common/crypto/totp-secret.ts`. Couvre D-013,
  ENF-04-04.
- **ST-02-05 (validation partagée frontend)** — Règles de validation des champs (noms, téléphone,
  date de naissance, code, matricule, mot de passe, plages vitales). Référence :
  `apps/web/test/validation.test.ts` (36 cas) → `apps/web/src/lib/validation.ts`. Voir
  référence validation partagée des champs.
- **Commande** : `pnpm --filter @cms-saris/api test` lance le sous-ensemble unitaire API
  (`soft-delete-core` + `message-crypto` + `totp-secret`). Référence :
  `apps/api/package.json` (script `test`).

### 2.3 ST-03 — Tests d'intégration (HTTP contre l'API réelle)

Tests qui **tapent la vraie API en cours d'exécution** (HTTP) : ils prouvent la pile **complète**
contrôleur → guards (JWT + permissions) → DTO/validation → service → Prisma → base.

- **ST-03-01 (CRUD)** — Sur un référentiel représentatif (« pathologies », sans chaîne de FK) :
  login (bcrypt → JWT), **sécurité** (accès sans token → 401), création, lecture, mise à jour,
  changement de statut, **validation** (400 sur entrée invalide), suppression, vérification d'absence.
  Référence : `apps/api/test/crud-integration.test.ts`. Prérequis : API sur `http://localhost:3000`
  + base seedée (`admin / Admin123!`).
- **ST-03-02 (messagerie + notifications + « typing »)** — Deux comptes réels : ouverture d'une
  conversation, envoi multipart **chiffré au repos**, réception côté destinataire (compteur de
  non-lus = notification d'un message d'un autre utilisateur), lecture déchiffrée, événement TYPING
  (façon WhatsApp) et sa sécurité. Référence : `apps/api/test/messaging-integration.test.ts`.
  Prérequis : comptes seedés (`admin/Admin123!` et un compte à `Saris2026!`).
- **ST-03-03 (premier message / création de conversation)** — Cas du tout premier message d'une
  conversation. Référence : `apps/api/test/conversation-firstmessage.test.ts`.
- **ST-03-04 (soft-delete + résurrection)** — Soft-delete bi-cible et `revive` (résurrection via
  l'accesseur `raw`). Référence : `apps/api/test/soft-delete-revive.test.ts`. Couvre D-015.
- **Commande** : `pnpm --filter @cms-saris/api test:integration`. Référence : `apps/api/package.json`
  (script `test:integration` : `crud-integration` + `messaging-integration` +
  `conversation-firstmessage` + `soft-delete-revive`).
- **ST-03-05 (harnais E2E NestJS résiduel)** — Un squelette Jest E2E existe
  (`apps/api/test/app.e2e-spec.ts`, config `jest-e2e.json`, script `test:e2e`) mais n'est pas le
  vecteur principal de couverture (le projet privilégie les scripts `tsx` ci-dessus). *État
  d'usage : à confirmer.*

### 2.4 ST-04 — Tests E2E « maison » (scripts `tsx` orientés flux)

En complément des tests d'intégration committés, le projet s'appuie sur des **scripts E2E « maison »**
(TypeScript exécutés par `tsx`) qui suivent le même schéma : `login → Bearer → assertions`. Ils
exercent les **flux métier de bout en bout** contre l'API réelle.

- **ST-04-01** — Flux cliniques (triage → consultation → documents), flux infirmier / @mention,
  annonces admin + retrait, certificat de repos. Référence : mémoire audit pré-déploiement
  (« E2E clinique 40/40 + infirmier/mention 19/19 + annonce/personnel 14/14 + certificat 11/11 »).
- **ST-04-02** — Synchronisation multi-poste, verrou de confidentialité, scope d'activité par
  soignant. Référence : mémoires offline-first, audit pré-déploiement
  (Phase B « E2E 19/19 », Phase C « E2E 10/10 »), refonte des workflows (« E2E 126/126 »).
- **ST-04-03** — Rotation de clé de chiffrement messagerie, CGU bloquante, sauvegarde/restauration.
  Référence : mémoires système robuste, refonte synchronisation.
- **Réserve d'honnêteté** : ces scripts de flux sont **ad-hoc** et **non tous committés** dans le
  dépôt (seuls les tests des §2.2/§2.3 le sont). Les compteurs « N/N » proviennent de la mémoire
  projet et **valent constat d'exécution daté**, pas garantie rejouable en l'état sans les scripts.
  *À régulariser : versionner les scripts E2E de flux dans `apps/api/test/`.*

---

## 3. Couverture des critères d'acceptation

Les critères d'acceptation sont exprimés au format **« Étant donné / Quand / Alors »** dans les
**cas d'usage (CU-NN-xx)** des fiches de [[plan_modules]] (`02_modules/`). Le tableau ci-dessous relie
les **parcours critiques** aux niveaux de test qui les couvrent.

| Parcours critique | Modules / CU concernés | Couvert par |
| --- | --- | --- |
| Authentification + 2FA + session unique + révocation | [[MODULE_01_securite_authentification]] | ST-02-04 (TOTP), ST-03-01 (login/401), ST-04 (révocation SSE) |
| Triage → consultation → documents imprimables | [[MODULE_08_triage]], [[MODULE_09_consultation]], [[MODULE_10_bon_examen]], [[MODULE_11_bon_pharmacie]] | ST-04-01 (E2E clinique 40/40) |
| Catégorie patient pilote les droits aux bons (403 si non couvert) | [[MODULE_07_dossier_patient]], [[MODULE_11_bon_pharmacie]] (D-009) | ST-04-01 (E2E Phase 3) |
| Délégation de prescription infirmier | [[MODULE_09_consultation]] (D-011) | ST-04-01 (infirmier 19/19) |
| Verrou de confidentialité médecin-chef (masquage hors supervision) | [[MODULE_07_dossier_patient]] (D-006) | ST-04-02 (Phase B 19/19) |
| Activité scopée à l'initiateur (consultations / historique triage) | [[MODULE_09_consultation]] (D-007) | ST-04-02 (Phase C 10/10) |
| Synchronisation 2-postes (LWW + tombstones) | [[MODULE_16_synchronisation]] (D-015, D-016) | ST-02-01, ST-02-02, ST-03-04, ST-04-02 |
| Messagerie chiffrée temps réel (accusés, notifications) | [[MODULE_13_messagerie]] (D-012) | ST-02-03, ST-03-02, ST-03-03 |
| CRUD + permissions (tous référentiels) | [[MODULE_05_referentiels]] | ST-03-01 |
| Annonces admin + diffusion installeur | [[MODULE_14_notifications]] (D-017) | ST-04-01 (annonce 14/14) |

---

## 4. Parcours critiques détaillés

- **PC-01 — Triage → consultation → documents** : recherche patient globale (non-recréation,
  D-005), création de visite scopée site, consultation pilotée par la décision
  (CLOTURE_SIMPLE / PRESCRIPTION / EXAMEN_COMPLEMENTAIRE / EVACUATION, cf. D-023), génération
  d'ordonnance / bon d'examen / bon de pharmacie avec garde catégorie (D-009) et garde de
  prescription (D-011), impression A4. Couvert ST-04-01.
- **PC-02 — Synchro 2-postes** : un poste hors-ligne crée/modifie, puis pousse au central ;
  conflit résolu LWW ; tombstone propagé ; pull delta sur l'autre poste. Couvert ST-02-02
  (unitaire) + ST-03-04 (revive) + ST-04-02 (E2E « ≈ 542 reçus »).
- **PC-03 — Verrou de confidentialité** : un médecin-chef verrouille un dossier ; un appelant hors
  supervision reçoit le contenu clinique **dépouillé** et la bannière « Verrouillé », y compris sur
  le backend local. Couvert ST-04-02 (Phase B).
- **PC-04 — Messagerie temps réel** : envoi chiffré entre deux comptes, accusés 3 états
  (envoyé / remis / lu), notification du destinataire, présence SSE. Couvert ST-03-02 + ST-02-03.

---

## 5. Données et environnement de test

- **ST-05-01 (comptes de test seedés)** — Compte admin `admin / Admin123!` et comptes cliniques à
  mot de passe `Saris2026!` (ex. `moukanda` = MEDECIN_CHEF, `batchi`/`ndinga` = INFIRMIER).
  Référence : en-têtes des tests d'intégration, mémoire audit pré-déploiement.
- **ST-05-02 (base seedée)** — Les tests d'intégration exigent une base **seedée** (référentiels +
  comptes). La 2FA peut **bloquer** le login admin dans un test (le test CRUD le détecte et s'arrête
  proprement). Référence : `crud-integration.test.ts` (« TOTP actif sur admin ? »).
- **ST-05-03 (cibles back)** — Variable `API_URL` (défaut `http://localhost:3000`). Les tests
  unitaires de logique pure n'ont **aucun prérequis réseau**. Référence : en-têtes des fichiers de test.
- **ST-05-04 (mode E2E TOTP)** — Le seed **préserve** la 2FA sauf en mode E2E dédié (sinon le test ne
  pourrait pas se loguer). Référence : D-013, mémoire TOTP persistance.

---

## 6. Limites et risques connus (honnêteté)

- **ST-06-01 (UI = vérification manuelle)** — L'interface (React) est validée par **vérification
  navigateur manuelle**, pas par des tests UI automatisés committés. Pièges navigateur documentés :
  hover réel à deux mouvements pour React 19, `.click()` synthétique inopérant sur contenu portalé
  (Radix), pool SSE (un seul onglet propre). Référence : mémoire messagerie interne.
- **ST-06-02 (rogneur vidéo non automatisable)** — Le rogneur vidéo de la messagerie **n'est pas
  testable en automatisation** : dans un onglet caché, le décodage vidéo est suspendu
  (`readyState 0`). Il doit être validé par l'utilisateur au premier plan. Référence : mémoire
  mémoire messagerie interne (v6.4).
- **ST-06-03 (E2E de flux non versionnés)** — cf. réserve ST-04 : les scripts E2E « maison » de flux
  ne sont pas tous committés ; leurs compteurs sont des **constats datés**.
- **ST-06-04 (pas de SLA de latence mesuré)** — Aucune mesure de latence p95 sur un réseau SARIS
  réel ; tests de performance/charge **non réalisés**. Référence : [[exigences_non_fonctionnelles]]
  ENF-02 (« à confirmer »).
- **ST-06-05 (WCAG non audité)** — Conformité accessibilité formelle non vérifiée par test. Référence :
  ENF-07-03.
- **ST-06-06 (couverture de code non mesurée)** — Aucun seuil de couverture (`coverage`) n'est
  configuré ; la stratégie vise la **couverture des comportements critiques**, pas un pourcentage de
  lignes. *À confirmer si un objectif chiffré est souhaité.*
- **ST-06-07 (script de permissions obsolète)** — `test-permissions.ps1` référence encore des
  comptes/rôles supprimés (cf. D-003) et **doit être aligné** sur les 3 rôles actuels avant usage.

---

## 7. Conditions de sortie (definition of done des tests)

Avant une version validée, les conditions minimales sont :

1. `pnpm typecheck` = **0 erreur** (API + WEB + DESKTOP) — ST-01.
2. `pnpm --filter @cms-saris/api test` = **tous verts** (unitaires) + tests `tsx` de logique pure
   (`sync-conflict`, `validation`) — ST-02.
3. `pnpm --filter @cms-saris/api test:integration` = **tous verts** sur API seedée — ST-03.
4. Parcours critiques PC-01 à PC-04 rejoués (ST-04) avec constat « N/N » archivé.
5. Vérification navigateur manuelle des écrans modifiés (ST-06-01), rogneur vidéo validé au premier
   plan le cas échéant (ST-06-02).

> Toute valeur « à confirmer » de ce document doit être levée avant la version 1.0 finale (validée).

---

## 8. Renvois

- Exigences non fonctionnelles testées : [[exigences_non_fonctionnelles]] (ENF-01 sync, ENF-04
  sécurité, ENF-09 SSE).
- Décisions couvertes : [[registre_decisions]] (D-009, D-011, D-012, D-013, D-015, D-016, D-017).
- Cas d'usage / EF par module : [[plan_modules]] et fiches `02_modules/MODULE_*`.
- Brief canonique : [[_SOURCE_systeme]].
