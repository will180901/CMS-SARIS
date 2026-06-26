# Stack Technique — CMS SARIS

> **Document de synthèse « as-built »** — Il décrit la stack telle qu'elle est
> réellement implémentée dans le dépôt `apps/`, `packages/` (vérifiée sur le code
> et les `package.json`). Les fiches détaillées par couche complètent cette vue
> d'ensemble. La mention « MVP » est levée : l'application couvre désormais
> l'intégralité des modules métier prévus, plus plusieurs briques transversales
> (messagerie chiffrée, temps réel, sauvegarde/restauration, conformité CGU).

---

## 1. Résumé des choix technologiques

| Couche | Technologie retenue | Version | Alternatives écartées |
|---|---|---|---|
| Monorepo | Turborepo + pnpm workspaces | Turbo 2.8.x / pnpm 9.15.9 | Nx (trop lourd), Yarn workspaces (moins standard) |
| Langage | TypeScript (strict) | 5.9.3 | JavaScript (pas de typage), Flow (abandonné) |
| Frontend | React 19 + TypeScript | React 19.2.4 | Vue 3 (moins répandu en médical), Angular (trop verbeux) |
| Client de bureau | Electron + electron-builder | Electron 33.2 / builder 25.1 | Tauri (écosystème moins mûr), application web seule (pas de mode autonome) |
| Internationalisation | react-i18next | i18next + react-i18next | Français codé en dur (non évolutif), FormatJS (plus verbeux) |
| Build frontend | Vite | 7.3.2 | Create React App (abandonné), Webpack seul (trop de config) |
| UI / Composants | shadcn/ui + Radix UI + Tailwind CSS v4 | shadcn 4.7 / Radix 1.4.3 / Tailwind 4.1.x | MUI (trop opinionné), Ant Design (moins flexible) |
| Design System | Tokens SARIS maison (CSS variables) | — | Thème shadcn par défaut (insuffisant pour la charte) |
| État global | Zustand | 5.0.13 | Redux (trop verbeux), Context seul (trop limité) |
| Requêtes serveur | TanStack Query (React Query) | 5.100.10 | SWR (moins complet), fetch seul (pas de cache) |
| Tables de données | TanStack Table | 8.21.3 | grilles propriétaires (moins flexibles) |
| Base de données locale | Dexie.js (IndexedDB) | 4.4.2 | PouchDB (impose CouchDB), localForage (pas de schéma) |
| PWA | Vite PWA Plugin (Workbox) | 1.3.0 | Implémentation manuelle (trop complexe) |
| Backend | NestJS + TypeScript | 11.x | Express seul (pas de structure), FastAPI (hors compétences) |
| Base de données serveur | PostgreSQL | (provider `postgresql`) | MySQL (moins de fonctionnalités JSON), MongoDB (pas relationnel) |
| ORM | Prisma | 6.x | TypeORM (moins lisible), Drizzle (trop récent) |
| Authentification | JWT + bcrypt + TOTP (otplib) | otplib 13.4 / bcrypt 6.0 | Sessions serveur (incompatible offline), OAuth seul (hors contexte) |
| Chiffrement données sensibles | AES-256-GCM (`node:crypto`) | natif | Bibliothèque tierce (dépendance superflue) |
| Temps réel | SSE (Server-Sent Events) + RxJS | rxjs 7.8 | WebSocket (overkill pour du push unidirectionnel) |
| Limitation de débit | @nestjs/throttler | 6.5.0 | Middleware maison (moins robuste) |
| Tâches planifiées | @nestjs/schedule (`@Cron`) | 6.1.3 | node-cron seul (pas intégré au DI Nest) |
| Géolocalisation IP | ip-api.com + repli geoip-lite | geoip-lite 2.0.2 | Service cloud unique (pas de repli hors-ligne) |
| Traitement image (serveur) | sharp | 0.34.5 | Jimp (plus lent), traitement client seul |
| Traitement vidéo (client) | ffmpeg.wasm | @ffmpeg/* 0.12.x | Ré-encodage serveur (coûteux, hors périmètre) |
| Émojis | emoji-mart + sprite Apple local | 5.6.0 | CDN externe (incompatible offline) |
| Synchronisation offline | API REST + file de rejeu IndexedDB (sync engine maison) | — | PouchDB réplication (impose CouchDB), Supabase Realtime (cloud only) |
| Sécurité HTTP | Helmet + CORS + ValidationPipe globale | helmet 8.1 | Configuration manuelle des en-têtes |
| Tests | Jest + Supertest (E2E backend) | Jest 30 / Supertest 7 | Vitest et Cypress non retenus à ce stade |

> **Note de réalité — tests.** La couverture est volontairement minimale à ce
> stade : Jest est configuré côté API avec deux scénarios E2E (`GET /health` →
> 200 ; `GET /notifications/unread-count` → 401 sans jeton). Il n'existe pas
> encore de tests unitaires/d'intégration ni de tests frontend. C'est un axe
> d'amélioration assumé et non un acquis.

---

## 2. Structure du monorepo

```
CMS-SARIS/
├── apps/
│   ├── web/              ← React 19 + Vite + PWA (frontend, responsive + i18n FR/EN)
│   ├── api/              ← NestJS 11 (backend REST + SSE)
│   └── desktop/          ← Electron (client Windows ; renderer = build de web)
├── packages/
│   ├── ui/               ← Design System SARIS : composants shadcn/Radix,
│   │                       globals.css (tokens), polices @fontsource-variable
│   ├── types/            ← Types TypeScript partagés + catalogue de permissions
│   └── db/               ← Schéma Prisma, migrations, seed
├── turbo.json            ← Orchestration des tâches (build, dev, lint, typecheck)
├── pnpm-workspace.yaml
└── package.json          ← Racine (Turbo, pnpm 9.15.9)
```

Conventions de nommage des packages internes : `@workspace/ui` (Design System),
`@cms-saris/db` (client/schéma Prisma), `@cms-saris/types` (types + permissions).

> **Outillage imposé.** `pnpm` est le seul gestionnaire de paquets utilisé
> (jamais `npm`/`npx`/`yarn`). Le build PWA passe par `vite build` (et non un
> `pnpm build` global).

---

## 3. Frontend (apps/web + packages/ui)

### 3.1 Socle applicatif

| Domaine | Bibliothèque | Version | Rôle |
|---|---|---|---|
| Framework UI | react / react-dom | 19.2.4 | Rendu déclaratif (React 19) |
| Build / HMR | vite | 7.3.2 | Bundler ESM, dev server |
| Plugin React | @vitejs/plugin-react | 5.1.x | JSX + Fast Refresh |
| PWA | vite-plugin-pwa | 1.3.0 | Service Worker (Workbox), manifeste |
| CSS | @tailwindcss/vite / tailwindcss | 4.1.x | Tailwind v4 (moteur Lightning) |
| Routage | react-router-dom | 7.15.1 | Routage côté client |
| État global | zustand | 5.0.13 | Stores légers (réseau, sync, session) |
| État serveur | @tanstack/react-query | 5.100.10 | Cache, invalidations, refetch |
| Formulaires | react-hook-form + @hookform/resolvers | 7.76 / 5.2 | Formulaires performants |
| Validation | zod | 3.25.76 | Schémas typés (front) |
| Internationalisation | i18next + react-i18next | — | Bilinguisme **FR/EN** (namespace `translation` + ~10 namespaces de modules fusionnés) |
| Tables | @tanstack/react-table | 8.21.3 | Tri / filtre / pagination headless |
| Base locale | dexie | 4.4.2 | IndexedDB (offline-first) |

### 3.2 Design System & composants

| Domaine | Bibliothèque | Version | Rôle |
|---|---|---|---|
| Composants | shadcn | 4.7.0 | Bibliothèque copier-coller (Radix + Tailwind) |
| Primitives accessibles | radix-ui / @base-ui/react | 1.4.3 / 1.4.1 | Composants headless ARIA |
| Icônes | lucide-react | 0.513.0 | Jeu d'icônes React |
| Variantes | class-variance-authority | 0.7.1 | Composition de variantes |
| Fusion de classes | clsx + tailwind-merge | 2.1.1 / 3.6.0 | Construction conditionnelle de `className` |
| Animations | tw-animate-css | 1.4.0 | Animations CSS Tailwind |
| Thème clair/sombre | ThemeProvider maison (+ next-themes) | 0.4.6 | Bascule maison (classe `.dark` + `prefers-color-scheme` + localStorage) ; next-themes n'alimente que le toaster Sonner |
| Sélecteur de date | react-day-picker | 10.0.1 | Calendrier |
| Carrousel | embla-carousel-react | 8.6.0 | Carrousels |
| Panneaux redimensionnables | react-resizable-panels | 4.11.1 | Split-panels (messagerie, etc.) |
| Toasts | sonner | 2.0.7 | Notifications visuelles |
| Dialogues | vaul | 1.1.2 | Tiroirs / modales |
| Palette de commandes | cmdk | 1.1.1 | Recherche / commandes |
| Graphiques | recharts | 3.8.0 | KPI / séries du tableau de bord |
| Couleurs | culori | 4.0.2 | Conversions d'espaces colorimétriques |
| Saisie OTP | input-otp | 1.4.2 | Code TOTP / codes de secours |
| QR Code | qrcode | 1.5.4 | URI `otpauth` (activation 2FA) |

**Polices auto-hébergées** (`@fontsource-variable`, 4 familles, v5.2.8) :

| Famille | Usage |
|---|---|
| Inter | Texte courant (sans-serif par défaut) |
| Plus Jakarta Sans | Sans-serif secondaire (UI alternative) |
| Sora | Titres / display |
| JetBrains Mono | Contenu monospace / code |

**Tokens du Design System SARIS** (`packages/ui/src/styles/globals.css`) — charte
maison stricte appliquée par variables CSS et styles inline :

- Palette monochrome (`--ap-*`, ardoise + accent teal), accent doré
  (`--as-*`, « Congo Gold »), gris neutres (`--g-*`), couleurs sémantiques
  (succès / erreur / avertissement / info, désaturées).
- Surfaces, textes (encre douce, pas de noir pur), bordures hiérarchisées.
- Effets de glassmorphisme (sidebar, cartes, en-tête, toasts) et grain fractal.
- Échelle typographique (display 28px → overline 10px) et d'espacement (base 4px,
  mode compact -25 % via `[data-densite="compact"]`).
- Rayons plafonnés à **10px** (interface fonctionnelle), aucune dégradé, échelle
  d'ombres désactivée en mode sombre (remplacée par des bordures).
- Tokens dédiés à la sidebar shadcn, aux couleurs de graphiques (`--chart-1..5`).

### 3.3 Médias riches (messagerie)

| Bibliothèque | Version | Rôle |
|---|---|---|
| @ffmpeg/ffmpeg, @ffmpeg/core, @ffmpeg/util | 0.12.x | Découpe vidéo côté client (cœur ESM auto-hébergé) |
| emoji-mart + @emoji-mart/data | 5.6.0 / 1.2.1 | Sélecteur d'émojis, jeu Apple servi depuis un sprite **local** (0 CDN) |

---

## 4. Backend (apps/api)

| Domaine | Bibliothèque | Version | Rôle |
|---|---|---|---|
| Framework | @nestjs/core, @nestjs/common | 11.x | Framework modulaire TypeScript |
| Plateforme HTTP | @nestjs/platform-express | 11.x | Adaptateur Express |
| Configuration | @nestjs/config | 4.0.4 | Variables d'environnement |
| Authentification | passport, passport-jwt, @nestjs/jwt | 0.7 / 4.0 / 11.0 | Stratégie JWT |
| Limitation de débit | @nestjs/throttler | 6.5.0 | Rate-limiting (par utilisateur + global) |
| Tâches planifiées | @nestjs/schedule | 6.1.3 | Cron (sauvegarde automatique quotidienne) |
| Validation | class-validator, class-transformer | 0.15 / 0.5 | DTO + transformation |
| ORM | @prisma/client / prisma | 6.x | Accès BD typé, migrations |
| Hachage | bcrypt | 6.0.0 | Mots de passe, refresh tokens, codes de secours |
| 2FA | otplib | 13.4.0 | TOTP (RFC 6238) |
| QR Code | qrcode | 1.5.4 | Génération d'URI d'activation 2FA |
| Géolocalisation | geoip-lite | 2.0.2 | Repli hors-ligne IP → pays/ville |
| Traitement image | sharp | 0.34.5 | Compression / redimensionnement (photo patient) |
| Téléversement | multer (intégré Express) | — | Multipart (pièces jointes, en mémoire) |
| Sécurité HTTP | helmet | 8.1.0 | En-têtes de sécurité (CSP, HSTS…) |
| Réactif | rxjs | 7.8.x | Subject de diffusion SSE |
| Réflexion | reflect-metadata | 0.2.2 | Décorateurs |

> Les notifications **temps réel** ne reposent sur aucune dépendance externe :
> elles utilisent l'endpoint `@Sse` natif de NestJS alimenté par un `Subject`
> RxJS. Le chiffrement (AES-256-GCM) et la géolocalisation par `ip-api.com`
> s'appuient sur les modules natifs Node (`node:crypto`, `fetch`).

---

## 5. Couche base de données (packages/db)

- **ORM** : Prisma 6 (`@prisma/client` + CLI `prisma`), provider `postgresql`.
- **Schéma** : `packages/db/prisma/schema.prisma` — **79 modèles (tables)**,
  organisés par domaine : sécurité & audit, référentiels, acteurs administratifs,
  patient & dossier, triage, consultation & actes, sorties critiques,
  synchronisation offline, notifications, messagerie chiffrée, paramètres système.
- **Migrations** : suite de migrations Prisma versionnées (jusqu'à
  `…_cgu_acceptation` pour le suivi d'acceptation des CGU).
- **Seed** : `prisma/seed.ts` (via `tsx`) — comptes de démonstration, **110
  permissions** du catalogue, 6 rôles avec leur matrice, 2 sites, référentiels
  (motifs, pathologies, médicaments, catégories patients, types d'examen),
  13 agents de personnel médical et délégations de prescription.

> **Comparé au cadrage initial (71 tables).** Le schéma est passé à **79
> modèles**, principalement par l'ajout de la messagerie chiffrée
> (`Conversation`, `ConversationParticipant`, `Message`, `MessagePieceJointe`,
> `MessageReaction`, `MessageMasque`), du masquage de notification
> (`NotificationLecture.masque`) et des paramètres/sauvegardes système
> (`ParametreSysteme`, `SauvegardeSysteme`).

---

## 6. Types et permissions partagés (packages/types)

- Types de domaine partagés front/back : `auth`, `patient`, `visite`,
  `consultation`, `referentiel`, `sync`.
- **Catalogue de permissions** (`permissions.ts`) : **110 permissions** réparties
  par module (patient, visite, consultation, ordonnance, bon_examen,
  suivi_chronique, evacuation, accident_travail, referentiels, personnel,
  sous_traitants, delegations, utilisateurs, rôles, audit, paramètres,
  synchronisation, notifications, messagerie).
- Formule des permissions effectives : **(permissions des rôles ∪ GRANTs) −
  REVOKEs**, le REVOKE l'emportant toujours.

> ⚠️ **Contrainte connue** : ne jamais importer en valeur `@cms-saris/types` à la
> racine côté API (le watcher ESM plante). Les libellés de la matrice côté
> frontend passent par un fichier de repli `labels.ts`.

---

## 7. Architecture transversale réellement implémentée

| Capacité | Implémentation |
|---|---|
| **Sécurité / Auth** | JWT (access + refresh 7 j, rotation), 2FA TOTP (secret chiffré AES-256-GCM + codes de secours bcryptés), escalade de blocage progressif, sessions multiples révocables, géolocalisation des connexions |
| **RBAC** | 6 rôles, 110 permissions, dérogations GRANT/REVOKE individuelles + en masse, gardes `JwtAuthGuard` / `PermissionsGuard` / `RolesGuard` |
| **Audit** | `AuditInterceptor` global (`@Audit`) → `JournalAudit` sur les mutations ; `JournalAuthentification` pour les événements de connexion (IP, user-agent, géo) |
| **Messagerie chiffrée** | AES-256-GCM (contenu + pièces jointes), conversations directes/groupe cloisonnées par site, accusés de lecture 3 états, présence, réactions, durcissement (magic-bytes, sanitisation de nom de fichier, anti-flood 40/min) |
| **Rotation de clés** | Trousseau versionné `v2:<keyId>:…` (`MESSAGE_ENC_KEYS` / `MESSAGE_ENC_KEYS_FILE` compatible Vault), legacy `v1` lisible, outil de ré-encryption non destructif |
| **Temps réel (SSE)** | Endpoint `@Sse('/notifications/stream')`, `Subject` RxJS, invalidations React Query (notifications cliniques + événements « LIVE » silencieux pour référentiels/acteurs/bons d'examen/sync), service de présence en mémoire |
| **Offline-first / PWA** | Service Worker (NetworkFirst sur GET API, CacheFirst sur ffmpeg.wasm), file de rejeu IndexedDB (`enqueueMutation`/`syncPush`), détection de santé serveur, moteur de synchronisation périodique |
| **Sauvegarde / restauration** | Snapshot JSON de la **configuration uniquement** (référentiels, rôles↔permissions, paramètres) — **jamais** les données cliniques ; restauration non destructive (upsert), cron quotidien 02h00, rétention 30 |
| **Conformité CGU** | Version serveur versionnée, acceptation tracée (`PreferenceUtilisateur`), porte bloquante au login (re-demande si la version change) |
| **Limitation de débit** | `@nestjs/throttler` par utilisateur (messagerie 40/min) et global (150/min) |
| **Géolocalisation** | `ip-api.com` (cache 1 h) avec repli hors-ligne `geoip-lite`, `trust proxy` configurable (`TRUST_PROXY`) |
| **Documents imprimables** | Ordonnance et bon d'examen au format A4 (gabarit unifié, impression côté client, sans serveur PDF) |
| **Client de bureau (Electron)** | `apps/desktop` empaquette le **build web** comme renderer (UI 100 % identique) ; deux modes : **REMOTE** (défaut, client d'un serveur distant) et **LOCAL autonome** (API NestJS + SQLite embarqués, synchro delta avec le central) ; schéma `app://cms-saris`, stockage chiffré DPAPI, auto-update `electron-updater` |
| **Responsive (mobile / tablette)** | Hook `useMediaQuery` + breakpoints (mobile < 768px, tablette 768–1023px, bureau ≥ 1024px, tactile) ; sidebar en **drawer** mobile, split-panels empilés (un panneau à la fois) sous 1024px, onglets scrollables, modales adaptatives — **15 pages adaptées** |
| **Bilinguisme (FR/EN)** | `react-i18next` (`apps/web/src/i18n/config.ts`) : namespace `translation` (fr/en) + ~10 namespaces de modules ; libellés métier résolus via `config/labels.ts` → `i18n.t('labels…', { defaultValue })` ; langue persistée sur le compte (`PreferenceUtilisateur.langue`), formats dates/nombres via `lib/intl.ts` |

---

## 8. Périmètre couvert et extensions futures

### 8.1 Modules métier — RÉALISÉS

Contrairement au cadrage initial où seuls quelques modules étaient codés,
**l'ensemble des domaines métier est aujourd'hui implémenté de bout en bout**
(endpoints NestJS protégés + écrans React consommant les API via React Query) :

- Sécurité & authentification, « Mon compte » (préférences, sessions, 2FA, CGU)
- Administration & gouvernance (utilisateurs, rôles & permissions, audit,
  paramètres système, synchronisation & sauvegardes)
- **Acteurs administratifs** (personnel médical, délégations de prescription,
  sous-traitants) — *désormais codé*
- Référentiels (sites, motifs, pathologies, médicaments, catégories patients,
  types d'examen)
- Accueil & triage (file d'attente, constantes vitales, machine d'états)
- Dossier patient (identité, allergies, antécédents, alertes médicales,
  rattachements ayant-droit CDI et sous-traitants)
- Consultation & actes prescrits (examen clinique, diagnostics, ordonnances,
  clôture)
- Bon d'examen (cycle EN_ATTENTE → VALIDE → RECU → CONSULTE)
- **Sorties critiques** (évacuations, accidents du travail, suivis) — *désormais codé*
- Suivi chronique
- Messagerie interne chiffrée, notifications temps réel, tableau de bord (KPI,
  séries temporelles, patients à risque)

S'y ajoutent trois briques transversales d'exploitation, désormais réalisées :

- **Client de bureau Windows** (`apps/desktop`, Electron) avec modes distant et
  autonome (cf. §8.3) ;
- **Interface responsive** mobile / tablette (cf. §7) ;
- **Bilinguisme FR/EN** via `react-i18next` (cf. §7).

### 8.2 Hors périmètre (extensions futures)

Restent volontairement hors périmètre, conformément au cadrage :

- Gestion des **stocks** de médicaments / consommables.
- **Délivrance physique** des médicaments (dispensation en pharmacie).
- Intégrations externes type **CNSS** / tiers payant automatisé.
- Audit d'**accessibilité** formel (WCAG) et tests automatisés
  (unitaires/intégration/E2E étendus) au-delà des deux scénarios E2E existants.

### 8.3 Application de bureau Windows (`apps/desktop`)

Le client de bureau **réutilise intégralement le frontend** : le renderer est le
build web (`build:renderer = pnpm --filter web build:desktop`), donc l'interface
est **100 % identique** à la version navigateur. Il fonctionne en **deux modes** :

| Mode | Description |
|---|---|
| **REMOTE** (défaut) | Client d'un **serveur distant** ; le comportement par défaut reste inchangé. |
| **LOCAL autonome** | **API NestJS + base SQLite embarquées** (fork du backend sur `127.0.0.1`), synchronisées en delta avec le serveur central. |

- **Résolution de l'URL serveur** (par priorité) : variable d'environnement
  `SARIS_API_URL` → `config.json` (`%APPDATA%`) → `SARIS_DEFAULT_API_URL` figé au
  build (`dist-electron/defaults.json`) → écran de configuration.
- **Schéma custom** `app://cms-saris` (origine stable, compatible CORS / SSE).
- **Stockage sécurisé** via **DPAPI** (Electron `safeStorage`).
- **Mises à jour** : `electron-updater` (auto-update).

**Build & packaging** : `pnpm --filter @cms-saris/desktop dist` produit un
installateur **NSIS** « `CMS SARIS-Setup-<version>.exe` » (~91 Mo). NSIS configuré
en `oneClick: false` (assistant guidé), `perMachine: false` (**aucun droit
administrateur**), `allowToChangeInstallationDirectory`, avec désinstallation
propre. `electron-builder` télécharge **son propre Electron** (cache) même si le
binaire npm `electron` est absent (`ELECTRON_SKIP_BINARY_DOWNLOAD`).

> **Signature.** Sans certificat, SmartScreen affiche « Éditeur inconnu »
> (cliquer *Informations complémentaires* → *Exécuter quand même*). Un certificat
> **OV/EV** est requis en production.

---

## 9. Qualité, build et outillage

| Aspect | État réel |
|---|---|
| Typage | TypeScript `strict: true` côté front et back (`skipLibCheck` activé) |
| Lint / format | ESLint 9 (typescript-eslint) + Prettier (+ `prettier-plugin-tailwindcss`) |
| Orchestration | Turbo (`build`, `dev`, `lint`, `format`, `typecheck`) |
| Tests | Jest 30 + Supertest — 2 scénarios E2E backend ; pas de tests unitaires ni frontend (axe d'amélioration) |
| Build front | `tsc -b && vite build` ; PWA active en build/preview, désactivée en dev |
| Build back | `nest build` (CommonJS) → `dist/` |
| Sécurité HTTP | Helmet, CORS restreint (`FRONTEND_URL`), `ValidationPipe` globale (`whitelist`, `forbidNonWhitelisted`, `transform`) |

---

## 10. Synthèse des décisions clés

1. **Monorepo** pnpm + Turbo pour le partage de types et la cohérence.
2. **Frontend** React 19 + Vite + Tailwind v4, Design System SARIS maison (tokens
   CSS, glassmorphisme, 4 polices auto-hébergées).
3. **Backend** NestJS 11 + Prisma 6 sur PostgreSQL.
4. **Sécurité en profondeur** : JWT + TOTP (chiffré AES-256-GCM), RBAC granulaire,
   audit persistant, durcissement de la messagerie, rotation de clés.
5. **Temps réel** via SSE natif NestJS + invalidations React Query, sans
   dépendance WebSocket.
6. **Offline-first** : PWA (Workbox) + file de rejeu IndexedDB (Dexie) + moteur de
   synchronisation maison.
7. **Médias** : sharp côté serveur (images), ffmpeg.wasm côté client (vidéo),
   émojis Apple servis localement (0 CDN).
8. **Conformité & exploitation** : CGU versionnées et bloquantes, sauvegarde/
   restauration de configuration non destructive avec cron quotidien.
9. **Client de bureau Electron** (`apps/desktop`) réutilisant le build web,
   en mode distant (défaut) ou autonome (API NestJS + SQLite embarqués) ;
   installateur NSIS sans droits administrateur, auto-update.
10. **Accessibilité d'usage** : interface **responsive** (mobile/tablette/bureau)
    et **bilingue FR/EN** (`react-i18next`), langue persistée sur le compte.

> Pour le détail de chaque couche, se référer aux fiches dédiées du dossier
> `Docs/stack-technique/` (sécurité/audit, offline/PWA/temps réel, schéma de
> données, dépendances, tests/NFR).
