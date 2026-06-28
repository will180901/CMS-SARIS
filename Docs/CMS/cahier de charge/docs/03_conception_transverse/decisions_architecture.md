# Décisions d'architecture (ADR) — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Ce document recense les **décisions d'architecture structurantes** du système CMS SARIS **tel que
> construit** (le système est développé et déployé pour la soutenance). Chaque entrée suit le format
> ADR (contexte · options envisagées · choix retenu · conséquences) et **cite le code de référence**
> dans le monorepo `CMS/APP/CMS-SARIS/`. Les choix de périmètre/produit et leurs justifications
> détaillées vivent dans le [[registre_decisions]] (identifiants `D-xxx`) ; ce document en est la
> **traduction technique** et y renvoie systématiquement.
>
> Conventions : identifiant stable `ADR-NN`. **Honnêteté as-built** : on documente ce qui EXISTE ;
> tout point non vérifié à la source est marqué « à confirmer ». Aucun chiffre n'est inventé. Les
> chiffres canoniques (4 rôles, ~87 modèles Prisma, ~110 permissions, stack) sont définis dans
> [[_SOURCE_systeme]] et seulement référencés ici.

---

## Index des ADR

| ID | Décision d'architecture | Lien registre | Statut |
|----|--------------------------|---------------|--------|
| [ADR-01](#adr-01) | Offline-first multi-poste : backend NestJS + SQLite embarqués (vs client mince) | D-001, D-020 | Accepté · Appliqué |
| [ADR-02](#adr-02) | Monolithe modulaire NestJS + Prisma, double-cible PostgreSQL / SQLite | D-001 | Accepté · Appliqué |
| [ADR-03](#adr-03) | Frontend React unique partagé web + desktop | D-001 | Accepté · Appliqué |
| [ADR-04](#adr-04) | Auth JWT access/refresh + session unique + révocation en base | D-021 | Accepté · Appliqué |
| [ADR-05](#adr-05) | Chiffrement at-rest AES-256-GCM + rotation de clé versionnée | D-012, D-013 | Accepté · Appliqué |
| [ADR-06](#adr-06) | Synchronisation Last-Write-Wins (updatedAt + baseUpdatedAt + tombstones) | D-016 | Accepté · Appliqué |
| [ADR-07](#adr-07) | Soft-delete global bi-cible (tombstones) | D-015 | Accepté · Appliqué |
| [ADR-08](#adr-08) | Dossier patient en synchro GLOBALE cross-site (vs par-site) | D-005 | Accepté · Appliqué |
| [ADR-09](#adr-09) | Déploiement central Render + Neon ; URL hybride bakée + écran de secours | D-002, D-019 | Accepté · Déployé |
| [ADR-10](#adr-10) | Desktop Electron + installeur NSIS sur-mesure + auto-update | D-017, D-020 | Accepté · Appliqué |
| [ADR-11](#adr-11) | Temps réel par Server-Sent Events (SSE) (vs WebSocket) | D-012, D-020 | Accepté · Appliqué |

---

## ADR-01 — Offline-first multi-poste : backend + SQLite embarqués (vs client mince) {#adr-01}

- **Statut** : Accepté · Appliqué (runtime complet fusionné sur `main`). Renvoi : [[registre_decisions]] **D-001**, **D-020**.
- **Contexte** : les sites de Moutela et Nkayi ont une connectivité incertaine. Le besoin fort du
  recueil est la **continuité de service hors-ligne** et la synchronisation entre postes (le système
  remplace un suivi Excel + papier « façon Jeannette »).
- **Options envisagées** :
  1. **Client mince / mode `remote` seul** — le poste n'est qu'un navigateur/renderer parlant au
     central. Simple, mais **inopérant hors-ligne** (rejeté ; initialement envisagé par erreur).
  2. **PWA web seule** (cache + file de rejeu IndexedDB) — offline « léger » mais pas de base locale
     complète embarquée → insuffisant comme socle unique.
  3. **Backend NestJS + base SQLite embarqués dans Electron** (mode `local`) — chaque poste est
     autonome, fonctionne hors-ligne et se synchronise.
- **Choix retenu** : option 3 (modèle « ulamu »). Le poste de bureau lance un **backend NestJS
  embarqué** sur une base **SQLite** locale (écoute forcée sur `127.0.0.1`, port dynamique), qui
  synchronise en arrière-plan avec le central. La PWA (option 2) est **conservée comme client web
  complémentaire**, pas comme socle. Code : `apps/desktop/electron/backend.ts`,
  `apps/desktop/electron/main.ts`, `apps/desktop/electron/db-init.ts`,
  `apps/api/src/prisma/prisma.service.ts`.
- **Conséquences** :
  - (+) Travail clinique ininterrompu même central injoignable (mode dégradé local, cf.
    [[exigences_non_fonctionnelles]] ENF-03-02).
  - (+) « Online-first / offline-fallback » : en ligne le renderer parle directement au central
    pour la latence, hors-ligne il bascule sur le backend local (**D-020**, ENF-01-06).
  - (−) Empreinte poste : installeur ≈ 135 Mo, base seedée embarquée ≈ 1,24 Mo (ENF-10-03).
  - (−) Le backend embarqué doit charger des modules ESM via `require()` → flag Node 20.18
    `--experimental-require-module` (`apps/desktop/electron/backend.ts`, ENF-10-02).
  - (−) Crée la double-cible base de données (→ [[#adr-02]]) et impose une stratégie de synchro
    (→ [[#adr-06]]) et un soft-delete (→ [[#adr-07]]).

## ADR-02 — Monolithe modulaire NestJS + Prisma, double-cible PostgreSQL / SQLite {#adr-02}

- **Statut** : Accepté · Appliqué. Renvoi : [[registre_decisions]] **D-001** ; détail modules : [[plan_modules]].
- **Contexte** : un même code serveur doit s'exécuter à la fois sur le **central PostgreSQL (Neon)**
  et sur le **backend SQLite embarqué** du poste. Le périmètre est borné (un centre médico-social),
  l'équipe minimale (soutenance).
- **Options envisagées** :
  1. **Microservices** — séparation par domaine, déploiements indépendants. Surdimensionné pour le
     périmètre, complexifie l'embarquement dans Electron (rejeté).
  2. **Monolithe modulaire NestJS** (modules métier indépendants dans un seul processus) + **Prisma**
     comme ORM bi-provider.
  3. **ORM différent par cible** (un pour PG, un pour SQLite) — duplication et divergence de schéma
     (rejeté).
- **Choix retenu** : option 2 — un seul processus NestJS découpé en **16 modules métier** enregistrés
  dans `AppModule` + un module support `ParametresModule` (cf. [[plan_modules]]), graphe de
  dépendances **acyclique**. Persistance via **Prisma 6** avec **deux schémas** générés :
  `packages/db/prisma/schema.prisma` (PostgreSQL central) et `packages/db/prisma/sqlite/schema.prisma`
  (desktop). Code : `apps/api/src/app.module.ts`, `apps/api/src/prisma/prisma.service.ts`.
- **Conséquences** :
  - (+) Un seul code applicatif sert les deux cibles ; logique métier identique central/local.
  - (+) Découpage modulaire clair, dépendances tracées par les `imports` NestJS ([[plan_modules]] §4).
  - (−) Le schéma SQLite doit rester aligné sur le schéma PG (génération dédiée à maintenir).
  - (−) Certaines fonctionnalités PG ne sont pas disponibles en SQLite ; le soft-delete et les
    contraintes sont gérés au niveau applicatif (extension Prisma, cf. [[#adr-07]]).
  - **Réserve as-built** : développement sur `db push` ; **re-baseline** des migrations formelles à
    effectuer au déploiement ([[registre_decisions]] notes de cohérence).

## ADR-03 — Frontend React unique partagé web + desktop {#adr-03}

- **Statut** : Accepté · Appliqué. Renvoi : [[registre_decisions]] **D-001** ; détail desktop : [[#adr-10]].
- **Contexte** : il faut une interface web « de partout » **et** une application de bureau, sans
  maintenir deux interfaces distinctes.
- **Options envisagées** :
  1. **Deux frontends séparés** (web + UI native desktop) — double effort, dérive d'UX (rejeté).
  2. **Un seul frontend React** empaqueté à la fois en PWA (web) et dans Electron (desktop renderer).
- **Choix retenu** : option 2 — **React 19 + Vite + Tailwind v4**, stores **Zustand**, cache serveur
  **React Query**, i18n **react-i18next** (bilingue FR/EN strict), **VitePWA**. Le même bundle est
  servi en statique pour le web et chargé par le renderer Electron (schéma `app://cms-saris`). La
  bascule online/offline est portée par un store de connectivité côté renderer. Code :
  `apps/web/src` (frontend), `apps/desktop/electron/main.ts` (chargement renderer),
  `apps/web/src/stores/connectivity.store.ts`.
- **Conséquences** :
  - (+) Une seule base d'UI, design system « SARIS » unique, parité fonctionnelle web/desktop.
  - (+) En ligne, le renderer desktop consomme le central exactement comme le web (temps réel SSE).
  - (−) Le frontend doit gérer les **deux origines** (web HTTPS et `app://cms-saris`/loopback) → CORS
    et SSE doivent autoriser ces origines (cf. [[exigences_non_fonctionnelles]] ENF-04-07, ENF-09-02 ;
    `apps/api/src/main.ts`).
  - (−) Le service worker PWA n'a de sens que côté web ; côté desktop l'offline passe par le backend
    embarqué ([[#adr-01]]).

## ADR-04 — Auth JWT access/refresh + session unique + révocation en base {#adr-04}

- **Statut** : Accepté · Appliqué. Renvoi : [[registre_decisions]] **D-021** ; exigences : [[exigences_non_fonctionnelles]] ENF-04-01..04.
- **Contexte** : authentifier des soignants sur des postes **partagés et multi-sites**, avec révocation
  effective (déconnexion forcée par un admin, désactivation de compte) et un seul poste actif par
  compte. Le jeton doit aussi être accepté **localement** par le backend embarqué hors-ligne.
- **Options envisagées** :
  1. **JWT « pur » stateless** (sans état serveur) — léger, mais **révocation impossible** avant
     expiration et pas de session unique (rejeté).
  2. **Sessions en magasin externe Redis** — hors stack (le système est PG/SQLite uniquement) ;
     ajouterait une infrastructure (rejeté).
  3. **JWT access/refresh + session persistée en base** (table `Session`, `sid` dans le token,
     vérifiée à chaque requête).
- **Choix retenu** : option 3. Le token d'accès porte un **`sid`** ; la stratégie JWT **vérifie en
  base** que la session existe, n'est pas révoquée ni expirée. Durée de vie pilotée par le paramètre
  `auth.session_timeout_minutes` (défaut 480 min) ; refresh 7 jours ; token 2FA temporaire 5 min.
  **Session unique** : tout nouveau login révoque les autres sessions « app » du compte et pousse une
  déconnexion instantanée par SSE (`SESSION_REVOKED`). Code :
  `apps/api/src/modules/security/security.service.ts` (`creerSession`, `REFRESH_TOKEN_TTL`,
  `TEMP_TOKEN_TTL`), `apps/api/src/modules/security/strategies/jwt.strategy.ts`.
- **Conséquences** :
  - (+) Révocation **immédiate** (au prochain appel) et un seul poste actif par compte.
  - (−) Chaque requête fait une vérification DB du `sid` (coût assumé, négligeable vs sécurité).
  - **Exemptions critiques (as-built)** :
    - Les sessions de **synchronisation desktop** (`posteLocalId` présent) **ne sont pas révoquées**
      (sinon le login app du desktop casserait sa propre synchro).
    - En **backend embarqué (SQLite, loopback)**, la stratégie JWT **saute la vérification de session
      en base** : un token émis par le central est accepté localement hors-ligne ; la révocation
      immédiate reste effective **côté central** ([[registre_decisions]] D-020).
  - (−) Le refresh token porte un `sid` (UUID) pour éviter les collisions bcrypt (> 72 octets).

## ADR-05 — Chiffrement at-rest AES-256-GCM + rotation de clé versionnée {#adr-05}

- **Statut** : Accepté · Appliqué. Renvoi : [[registre_decisions]] **D-012** (messagerie), **D-013** (TOTP) ; exigences ENF-04-04, ENF-04-05.
- **Contexte** : des données sensibles sont stockées en base (secret **TOTP/2FA**, **contenu et pièces
  jointes** de la messagerie interne). Elles ne doivent jamais être en clair au repos, et la clé doit
  pouvoir **tourner** sans rendre l'historique illisible.
- **Options envisagées** :
  1. **Pas de chiffrement at-rest** (sécurité reposant sur TLS + ACL DB) — insuffisant (rejeté).
  2. **Chiffrement at-rest mono-clé fixe** — simple mais aucune rotation possible (rejeté pour la
     messagerie ; conservé pour le TOTP, voir conséquences).
  3. **AES-256-GCM avec format versionné + trousseau de clés** (rotation).
- **Choix retenu** : **AES-256-GCM** (clé dérivée via `scrypt`), avec **format de stockage versionné** :
  - **Messagerie** : `v2:<keyId>:<iv>:<tag>:<ct>` (clé identifiée → **rotation**), rétro-compatible
    avec le legacy `v1:<iv>:<tag>:<ct>`. Trousseau `MESSAGE_ENC_KEYS` (multi-clés) + clé courante
    `MESSAGE_ENC_KEY_CURRENT`, **Vault-ready** via `MESSAGE_ENC_KEYS_FILE`. Anciennes clés conservées
    pour **déchiffrer** après rotation. Code : `apps/api/src/common/crypto/message-crypto.ts`.
  - **TOTP** : secret chiffré at-rest, format `v1:…`, clé `TOTP_ENC_KEY`. Code :
    `apps/api/src/common/crypto/totp-secret.ts`.
  - La **file de rejeu IndexedDB** (web/desktop) est aussi chiffrée AES-256-GCM (`enc:v1:…`,
    `apps/web/src/lib/offlineCrypto.ts`).
- **Conséquences** :
  - (+) Confidentialité au repos ; rotation de clé messagerie sans casser l'historique (outil de
    ré-encryption `POST /synchronisation/messagerie/rechiffrer`, non destructif).
  - (−) **Ne jamais changer `TOTP_ENC_KEY` après enrôlement** (secrets TOTP indéchiffrables) ;
    `migrate reset` réinitialise par nature ([[registre_decisions]] D-013).
  - (−) Les builds de test sont bakés avec des clés `.env` de développement → re-packaging obligatoire
    avec les clés du central au déploiement réel (ENF-04 note honnêteté).
  - **Réserve as-built** : la **migration de masse v1→v2** existe (outillée) mais n'a **pas** été
    exécutée (à faire au jour d'une vraie rotation).

## ADR-06 — Synchronisation Last-Write-Wins (updatedAt + baseUpdatedAt + tombstones) {#adr-06}

- **Statut** : Accepté · Appliqué (moteur prouvé, 17 tests de conflit). Renvoi : [[registre_decisions]] **D-016** ; exigences ENF-01-05.
- **Contexte** : plusieurs postes modifient les mêmes données **hors-ligne** ; il faut une réconciliation
  **déterministe** et simple à la reconnexion, sans verrou distribué (impossible entre machines hors-ligne).
- **Options envisagées** :
  1. **CRDT / merge champ-à-champ généralisé** — convergence forte mais **complexité disproportionnée**
     au volume et au contexte (rejeté).
  2. **Résolution manuelle systématique** des conflits — non ergonomique (rejeté).
  3. **Last-Write-Wins** par horodatage, avec détection de conflit via `baseUpdatedAt`.
- **Choix retenu** : option 3 — **LWW** sur `updatedAt`, avec **`baseUpdatedAt`** (version sur laquelle
  le client a édité) pour distinguer une simple mise à jour d'un **vrai conflit concurrent** (le serveur
  a bougé depuis la base). Logique **pure, sans I/O, déterministe, partagée central/local** :
  `resolveConflict` renvoie `apply` / `skip` / `conflict{winner}` ; les **tombstones** (suppressions
  logiques) sont des mutations horodatées comme les autres (`mergeTombstone`). Pull delta + push
  idempotent, curseur `SyncState` par poste, pages de 500. Code :
  `packages/types/src/sync-conflict.ts`, `apps/api/src/modules/sync/sync.service.ts`,
  `apps/api/src/modules/sync/sync-client.service.ts`.
- **Conséquences** :
  - (+) Compromis simplicité/robustesse adapté au volume ; aucun blocage (on tranche toujours par LWW).
  - (+) Le central reste **source de vérité** ; conflits **journalisés** pour revue/supervision.
  - (−) **Pas d'UI client de résolution de conflits** : le serveur les journalise, la supervision les
    affiche ([[registre_decisions]] D-016 réserve).
  - (−) Dépend de la cohérence des horloges (LWW par horodatage) — risque accepté pour le contexte.
  - Dépend du soft-delete (→ [[#adr-07]]) et de la portée de synchro globale du dossier (→ [[#adr-08]]).

## ADR-07 — Soft-delete global bi-cible (tombstones) {#adr-07}

- **Statut** : Accepté · Appliqué (runtime branché, audité). Renvoi : [[registre_decisions]] **D-015**.
- **Contexte** : la synchro LWW ([[#adr-06]]) a besoin de **propager les suppressions** ; un hard-delete
  empêcherait de répliquer la suppression sur les autres postes (l'enregistrement « réapparaîtrait »).
- **Options envisagées** :
  1. **Hard-delete + journal séparé de suppressions** — plus fragile pour la réconciliation (rejeté).
  2. **Index uniques partiels** pour ignorer les supprimés — casseraient l'API typée `findUnique` de
     Prisma (rejeté).
  3. **Soft-delete global** (`deletedAt`) au niveau de l'accès Prisma, en PG **et** SQLite.
- **Choix retenu** : option 3 — **soft-delete global** branché dans `PrismaService` (extension par modèle
  via allow-list), valable **PostgreSQL et SQLite**. Le filtre exclut les tombstones des lectures ; un
  accesseur **`raw`** (client brut non filtré) sert la synchronisation et la « résurrection » (revive).
  Les modèles hors allow-list gardent le hard-delete. `GlobalExceptionFilter` mappe les contraintes
  Prisma (P2002→409, P2025→404, P2003→409). Code : `apps/api/src/prisma/prisma.service.ts`.
- **Conséquences** :
  - (+) Prérequis de la synchro LWW et de la cohérence multi-poste ; suppressions répliquées.
  - (−) **Conséquences systémiques connues** (à connaître pour tout nouveau modèle) : `findUnique`
    aveugle aux tombstones, `aggregate`/`groupBy` à filtrer, plus de cascade FK gérée par la DB.
  - (−) Croissance de la table → purge physique des tombstones (cron, > 90 jours, garde-fou
    `deletedAt < min(SyncState.lastPulledAt)`) : `apps/api/src/modules/sync/tombstone-purge.cron.ts`
    (ENF-03-04).

## ADR-08 — Dossier patient en synchro GLOBALE cross-site (vs par-site) {#adr-08}

- **Statut** : Accepté · Appliqué (prouvé E2E). Renvoi : [[registre_decisions]] **D-005** (+ D-006, D-007 confidentialité) ; exigences ENF-05-01..03.
- **Contexte** : un travailleur muté d'un site à l'autre voyait son **dossier recréé** (doublon, perte de
  continuité). En offline-first, un patient absent de la base locale d'un poste empêcherait sa prise en
  charge hors-ligne sur un autre site.
- **Options envisagées** :
  1. **Cloisonnement par site** (modèle initial) — chaque poste ne réplique que ses patients → doublons
     hors-ligne pour un patient muté, continuité cassée (rejeté).
  2. **Cloisonnement par médecin** (ancienne « décision verrouillée ») — cassait la continuité des soins
     (rejeté ; remplacé par le verrou de confidentialité D-006).
  3. **Portée de synchronisation GLOBALE** pour le dossier et le parcours de soin.
- **Choix retenu** : option 3 — **patient, dossier complet, parcours de soin et `PersonnelMedical` sont
  GLOBAUX** : chaque poste détient tous les patients de tous les sites (nécessaire pour le hors-ligne
  d'un patient muté). La recherche patient au triage est **globale** (pas de doublon). Restent
  **cloisonnés par site** : comptes `Utilisateur` (login hors-ligne), RH opérationnel, messagerie. La
  **visite** reste rattachée au site de l'utilisateur ; règle conservée : **une seule visite ouverte par
  patient** (globale). La confidentialité ponctuelle est portée par le **verrou médecin-chef** (D-006)
  et le **scope d'activité par initiateur** (D-007). Code : `apps/api/src/modules/sync/sync-models.ts`
  (portée par modèle), `apps/api/src/modules/patient`, `apps/api/src/modules/triage`.
- **Conséquences** :
  - (+) Continuité des soins sur tout le périmètre SARIS ; pas de doublon hors-ligne.
  - (−) Chaque poste réplique **tous** les patients → empreinte disque accrue (ENF-10-05 « à confirmer »).
  - (−) Impose un mécanisme de confidentialité **par-acte** (verrou + scope) plutôt que le cloisonnement
    structurel (cf. D-006/D-007, ENF-05-02/03).

## ADR-09 — Déploiement central Render + Neon ; URL hybride bakée + écran de secours {#adr-09}

- **Statut** : Accepté · Déployé et en ligne. Renvoi : [[registre_decisions]] **D-002** (hébergement), **D-019** (URL hybride) ; exigences ENF-03-01, ENF-04-09.
- **Contexte** : projet de **soutenance sans accès au serveur local SARIS** → un hébergement cloud est
  nécessaire comme hub de synchronisation. L'utilisateur tient à pouvoir **changer d'hébergeur / déplacer
  le serveur sans rebuild**, tout en gardant une expérience « zéro config » par défaut.
- **Options envisagées (hébergement)** :
  1. **On-premise sur le réseau SARIS** — indisponible aujourd'hui (reporté post-soutenance).
  2. **Cloud managé (Render + Neon)** — déploiement immédiat, HTTPS fourni, plan gratuit suffisant.
- **Options envisagées (URL du central)** :
  1. **URL figée au build** — bloque le changement d'hébergeur (rejeté).
  2. **Toujours demander l'URL au 1ᵉʳ lancement** — friction inutile (rejeté).
  3. **URL hybride** : bakée par défaut + formulaire de secours re-modifiable.
- **Choix retenu** :
  - Hébergement : **API NestJS sur Render** (`https://cms-saris-api.onrender.com`) + **PostgreSQL sur
    Neon** ; site web React/Vite (PWA) statique sur Render (`https://cms-saris-web.onrender.com`).
  - URL du central **hybride et dynamique** : résolution **env > `config.json` > `defaults.json` baké >
    écran de saisie** (`server-config.html`) si pas d'URL bakée / central injoignable / changement
    d'hébergeur. Code : `apps/desktop/electron/config.ts`.
- **Conséquences** :
  - (+) Déploiement immédiat sans infrastructure locale ; liberté de changer d'hébergeur sans rebuild.
  - (−) Le **plan gratuit Render/Neon met le service en veille** (première requête lente) → atténué par
    le badge de connectivité ping `/health` anti-clignotement (D-018, ENF-01-06) ; passage payant prévu
    pour un central permanent.
  - (−) **Trust proxy** à régler au déploiement réel (`TRUST_PROXY`, défaut 1) pour l'IP réelle
    (ENF-04-09, `apps/api/src/main.ts`).
  - (−) Secrets de production (JWT, clés de chiffrement) saisis dans l'environnement Render, **jamais**
    dans le dépôt.

## ADR-10 — Desktop Electron + installeur NSIS sur-mesure + auto-update {#adr-10}

- **Statut** : Accepté · Appliqué (packaging + installeurs E2E validés). Renvoi : [[registre_decisions]] **D-017** (annonces MAJ), **D-020** ; exigences ENF-10-01..04.
- **Contexte** : il faut livrer un poste Windows autonome (cf. [[#adr-01]]) **installable sans droits
  administrateur**, et diffuser des mises à jour aux postes installés **sans infrastructure lourde ni
  migration**.
- **Options envisagées** :
  1. **Installeur Electron par défaut (electron-builder NSIS standard)** — ne couvre pas finement le cas
     « app en cours d'exécution » ni la mise à jour pilotée (insuffisant seul).
  2. **Installeur NSIS sur-mesure + auto-update electron-updater + annonce admin**.
- **Choix retenu** : option 2 — **Electron 33 (Node 20.18)**, **electron-builder + installeur NSIS
  sur-mesure** « intelligent » (désinstaller / réinstaller-mettre à jour / annuler, **refus si l'app
  tourne**), installation **per-user** (pas d'UAC), **auto-update electron-updater**, stockage sécurisé
  des secrets via **DPAPI / `safeStorage`**. La diffusion pilotée réutilise les champs existants de
  `Notification` (annonce `MISE_A_JOUR`, portée TOUS) : le bridge desktop télécharge l'installeur et le
  lance après fermeture de l'app (libération du mutex), **sans nouvelle table/migration**. Code :
  `apps/desktop/installer/cms-saris.nsi`, `apps/desktop/scripts/build-local.mjs`,
  `apps/desktop/electron/updater.ts`, `apps/desktop/electron/preload.ts`.
- **Conséquences** :
  - (+) Installation simple per-user ; mise à jour contrôlée par l'admin (web : le bouton ouvre l'URL).
  - (+) Pas de coût de schéma pour la diffusion (réutilisation de `Notification`).
  - (−) Empreinte ≈ 135 Mo (ENF-10-03) ; backend embarqué force `127.0.0.1` (ENF-10-04).
  - **Bloquant externe non résolu** : **signature de code** (certificat OV/EV) absente → SmartScreen
    « éditeur inconnu » ([[exigences_non_fonctionnelles]] ENF-04 note honnêteté).

## ADR-11 — Temps réel par Server-Sent Events (SSE) (vs WebSocket) {#adr-11}

- **Statut** : Accepté · Appliqué. Renvoi : [[registre_decisions]] **D-012** (messagerie), **D-020** ; exigences ENF-09-01..03.
- **Contexte** : plusieurs fonctionnalités exigent du **push serveur → client** : notifications,
  messagerie (nouveaux messages, accusés `MESSAGE_STATUS`), **présence** en ligne, **invalidations live**
  des listes, activité de synchronisation, **révocation de session** (`SESSION_REVOKED`). Les flux sont
  essentiellement **unidirectionnels** (serveur vers client) ; les actions client passent par l'API REST.
- **Options envisagées** :
  1. **Polling périodique** — latence et charge réseau accrues (rejeté comme socle ; conservé en repli
     à ≈ 8 s quand hors-focus/hors-ligne, ENF-02-02).
  2. **WebSocket bidirectionnel** — full duplex, mais infrastructure plus lourde (gestion de connexion,
     reconnexion, compat proxy) pour un besoin majoritairement unidirectionnel (rejeté).
  3. **Server-Sent Events (SSE)** sur HTTP — push serveur natif, reconnexion automatique, simple
     derrière un reverse-proxy.
- **Choix retenu** : option 3 — **SSE** pour tout le temps réel. Émission centralisée par le
  `NotificationModule` (flux SSE + `presence.service.ts`) ; côté client `useNotificationStream`. La
  présence est mise à jour par heartbeat (depuis le listing des messages) + `Utilisateur.lastSeenAt` ;
  accusés à 3 états (envoyé / remis / lu). Les invalidations live passent par
  `@LiveRefresh`/`broadcastLive` (`LiveRefreshInterceptor`). Code :
  `apps/api/src/modules/notification`, `apps/web/src/hooks/useNotificationStream`.
- **Conséquences** :
  - (+) Push natif simple, reconnexion automatique d'`EventSource`, parité web/desktop en ligne.
  - (−) **Soumis au CORS** (EventSource) : l'origine du client de bureau `app://cms-saris` et les
    origines loopback doivent être explicitement autorisées (ENF-04-07, ENF-09-02 ;
    `apps/api/src/main.ts`).
  - (−) Unidirectionnel : toute action client reste un appel API REST (acceptable, c'est le besoin).
  - (−) Sensibilité au **pool de connexions** (un onglet SSE par poste) — piège connu en test
    (mémoire messagerie interne).

---

## Traçabilité ADR ↔ registre ↔ code

| ADR | Décision(s) [[registre_decisions]] | Code de référence principal |
|-----|-----------------------------------|-----------------------------|
| ADR-01 | D-001, D-020 | `apps/desktop/electron/backend.ts`, `main.ts`, `db-init.ts` |
| ADR-02 | D-001 | `apps/api/src/app.module.ts`, `prisma/prisma.service.ts`, `packages/db/prisma/{schema,sqlite/schema}.prisma` |
| ADR-03 | D-001 | `apps/web/src`, `apps/desktop/electron/main.ts` |
| ADR-04 | D-021 | `security.service.ts`, `strategies/jwt.strategy.ts` |
| ADR-05 | D-012, D-013 | `common/crypto/message-crypto.ts`, `totp-secret.ts`, `web/src/lib/offlineCrypto.ts` |
| ADR-06 | D-016 | `packages/types/src/sync-conflict.ts`, `modules/sync/sync.service.ts` |
| ADR-07 | D-015 | `prisma/prisma.service.ts`, `modules/sync/tombstone-purge.cron.ts` |
| ADR-08 | D-005 (+D-006, D-007) | `modules/sync/sync-models.ts`, `modules/patient`, `modules/triage` |
| ADR-09 | D-002, D-019 | `apps/desktop/electron/config.ts`, `apps/api/src/main.ts` (CORS, trust proxy) |
| ADR-10 | D-017, D-020 | `apps/desktop/installer/cms-saris.nsi`, `scripts/build-local.mjs`, `electron/updater.ts` |
| ADR-11 | D-012, D-020 | `apps/api/src/modules/notification`, `web/src/hooks/useNotificationStream` |

> Tout point « à confirmer / réserve » de ce document est repris du [[registre_decisions]] (notes de
> cohérence) et de [[exigences_non_fonctionnelles]] : re-baseline des migrations, réduction
> d'`ADMIN_SYSTEME`, divergence « 3 vs 4 rôles », signature de code, run de rotation de clé non exécuté,
> SLA de latence et plancher matériel non chiffrés. Aucune valeur n'est inventée.
