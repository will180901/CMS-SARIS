# Décision Monorepo — Turborepo + pnpm workspaces

> **Document as-built.** Cette page décrit l'organisation *réelle* du dépôt telle qu'elle existe dans le code (`CMS/APP/CMS-SARIS`), et non l'intention initiale. Les versions, noms de packages, alias d'import et listes de modules ont été vérifiés directement dans les fichiers de configuration du projet.

## 1. Pourquoi un monorepo

Le projet CMS SARIS regroupe **deux applications** et **trois packages partagés** dans un seul dépôt. Ils partagent du code de domaine (types métier) et le schéma de base de données.

| Artefact | Package (nom réel) | Rôle | Partage |
|---|---|---|---|
| Frontend PWA | `apps/web` (nom : `web`) | Interface React 19 + Vite 7 | Consomme `@cms-saris/types` et `@workspace/ui` |
| Backend API | `apps/api` (nom : `api`) | API NestJS 11 | Consomme `@cms-saris/types` et `@cms-saris/db` |
| Types partagés | `packages/types` (nom : `@cms-saris/types`) | Interfaces TypeScript de domaine | Importé par `web` et `api` |
| Design system | `packages/ui` (nom : `@workspace/ui`) | Composants shadcn/Radix + tokens SARIS | Importé par `web` |
| Schéma BDD | `packages/db` (nom : `@cms-saris/db`) | Schéma Prisma + client exporté | Importé par `api` |

Sans monorepo, synchroniser les types entre frontend et backend imposerait de publier des packages npm ou de dupliquer les fichiers — deux approches sources d'erreurs. Le monorepo élimine ce problème : un même `import { ... } from '@cms-saris/types'` fonctionne dans les deux applications, et le client Prisma est exposé une seule fois via `@cms-saris/db`.

## 2. Pourquoi Turborepo (et pas Nx)

Turborepo est plus léger, plus rapide à configurer et mieux adapté à une équipe réduite. Nx est plus puissant mais apporte une complexité de configuration superflue pour ce périmètre. Turborepo s'installe en une commande et orchestre les tâches (`build`, `lint`, `format`, `typecheck`, `dev`) avec cache incrémental et graphe de dépendances (`dependsOn: ["^build"]`).

**Version réelle utilisée : Turborepo `^2.8.17`** (déclaré en `devDependencies` racine).

## 3. Pourquoi pnpm (et pas npm ou yarn)

pnpm utilise un store global dédupliqué : chaque dépendance n'est installée qu'une fois sur le disque, puis liée symboliquement dans chaque package. Dans un monorepo avec plusieurs apps et packages, cela réduit nettement l'espace disque et le temps d'installation. Les `pnpm workspaces` sont le standard recommandé avec Turborepo, et la syntaxe `workspace:*` permet de référencer les packages locaux.

**Version réelle imposée : `pnpm@9.15.9`** (champ `packageManager` racine ; `pnpm-lock.yaml` en `lockfileVersion: '9.0'`). Le moteur Node requis est `>=20`.

> **Règle de projet stricte :** ce dépôt utilise **pnpm exclusivement**. Ne jamais lancer `npm`, `npx` ou `yarn` après l'initialisation (cela casserait les liens `workspace:*`).

---

## 4. Structure réelle du monorepo

> **Versions clés vérifiées :** React **19.2**, Vite **7.3**, Tailwind CSS **v4** (config dans le CSS, pas de `tailwind.config.ts`), TypeScript **5.9.3**, NestJS **11**, Prisma **6**.

```
CMS-SARIS/
├── apps/
│   ├── web/                     ← React 19 + Vite 7 + Tailwind v4 (PWA offline-first)
│   │   ├── src/
│   │   │   ├── modules/         ← un dossier par domaine fonctionnel :
│   │   │   │   ├── auth/                ← connexion, TOTP, changement de mot de passe
│   │   │   │   ├── dashboard/           ← tableau de bord (KPI, séries, patients à risque)
│   │   │   │   ├── patients/            ← dossier patient (identité, allergies, antécédents…)
│   │   │   │   ├── triage/              ← accueil / file d'attente / constantes vitales
│   │   │   │   ├── consultation/        ← examen, diagnostics, ordonnances, clôture
│   │   │   │   ├── bon-examen/          ← bons d'examen + impression A4
│   │   │   │   ├── sorties-critiques/   ← évacuations + accidents du travail
│   │   │   │   ├── referentiels/        ← sites, motifs, pathologies, médicaments…
│   │   │   │   ├── acteurs/             ← personnel, délégations, sous-traitants
│   │   │   │   ├── messagerie/          ← messagerie interne chiffrée
│   │   │   │   ├── notifications/       ← feed + flux temps réel SSE
│   │   │   │   └── admin/               ← utilisateurs, rôles, audit, paramètres, synchro
│   │   │   ├── components/      ← composants locaux (layout, print, ConditionsModal…)
│   │   │   ├── providers/       ← contextes React (React Query, thème…)
│   │   │   ├── hooks/           ← useSyncEngine, useServerHealth, useNotifications…
│   │   │   ├── stores/          ← Zustand : session.store, network.store, sync.store
│   │   │   ├── config/          ← labels.ts (dictionnaire FR), navigation.config.ts
│   │   │   └── lib/
│   │   │       ├── db.ts        ← instance Dexie.js (IndexedDB)
│   │   │       ├── api.ts       ← client HTTP + file de rejeu offline
│   │   │       ├── sync.ts      ← moteur de synchronisation (enqueue / push)
│   │   │       ├── geo.ts · userAgent.ts · sounds.ts · validation.ts · duree.ts
│   │   ├── public/             ← icônes PWA, sprite emoji, core ffmpeg.wasm auto-hébergé
│   │   ├── vite.config.ts      ← Vite 7 + VitePWA + @tailwindcss/vite
│   │   ├── tsconfig.app.json   ← paths : @/* et @workspace/ui/*
│   │   └── package.json        ← name: "web"
│   │
│   └── api/                     ← NestJS 11 + Prisma 6 (CommonJS)
│       ├── src/
│       │   ├── modules/        ← un module Nest par domaine :
│       │   │   ├── security/           ← auth JWT + TOTP + sessions + guards
│       │   │   ├── admin/              ← utilisateurs, rôles, audit, synchronisation
│       │   │   ├── parametres/         ← paramètres système (sécurité, MDP, notifs)
│       │   │   ├── referentiels/       ← référentiels CRUD
│       │   │   ├── personnel/          ← personnel, délégations, sous-traitants
│       │   │   ├── patient/            ← dossier patient
│       │   │   ├── triage/             ← visites + constantes vitales
│       │   │   ├── consultation/       ← consultations + ordonnances
│       │   │   ├── bon-examen/         ← bons d'examen + résultats
│       │   │   ├── sorties-critiques/  ← évacuations + accidents du travail
│       │   │   ├── suivi-chronique/    ← suivi des pathologies chroniques
│       │   │   ├── messagerie/         ← messagerie chiffrée AES-256-GCM
│       │   │   ├── notification/       ← notifications + SSE + présence
│       │   │   └── dashboard/          ← agrégats KPI
│       │   ├── common/
│       │   │   ├── crypto/             ← message-crypto.ts, totp-secret.ts (AES-256-GCM)
│       │   │   ├── decorators/         ← @Audit, @RequirePermissions, @Roles, @LiveRefresh…
│       │   │   ├── interceptors/       ← AuditInterceptor (APP_INTERCEPTOR global)
│       │   │   ├── filters/            ← filtres d'exceptions
│       │   │   └── geo/                ← geo.util.ts (ip-api + repli geoip-lite)
│       │   ├── health/                 ← endpoint /health (sondage PWA)
│       │   ├── prisma/                 ← PrismaService (injection du client @cms-saris/db)
│       │   └── main.ts                 ← bootstrap (helmet, CORS, ValidationPipe, trust proxy)
│       ├── test/               ← app.e2e-spec.ts (E2E minimal : /health, 401)
│       ├── .env
│       ├── tsconfig.json · tsconfig.build.json
│       └── package.json        ← name: "api"
│
├── packages/
│   ├── ui/                      ← Design system partagé (@workspace/ui)  ← créé par la CLI shadcn
│   │   ├── src/
│   │   │   ├── components/      ← button.tsx, input.tsx, form.tsx, table.tsx, dialog.tsx…
│   │   │   ├── hooks/
│   │   │   ├── lib/             ← utils.ts (cn / tailwind-merge)
│   │   │   └── styles/
│   │   │       └── globals.css  ← tokens SARIS (couleurs, typo, espacements, glassmorphisme)
│   │   ├── components.json · tsconfig.json
│   │   └── package.json         ← name: "@workspace/ui"
│   │
│   ├── types/                   ← Interfaces TypeScript de domaine (@cms-saris/types)
│   │   ├── src/
│   │   │   ├── auth.ts · patient.ts · visite.ts · consultation.ts
│   │   │   ├── referentiel.ts · acteur.ts · sync.ts
│   │   │   ├── permissions.ts   ← catalogue des permissions + rôles par défaut
│   │   │   └── index.ts
│   │   ├── tsconfig.json
│   │   └── package.json         ← name: "@cms-saris/types" (exports par sous-chemin)
│   │
│   └── db/                      ← Schéma Prisma + client exporté (@cms-saris/db)
│       ├── prisma/
│       │   ├── schema.prisma    ← 79 modèles (tables) — voir doc « Schéma de données »
│       │   ├── migrations/      ← 22 migrations versionnées
│       │   ├── seed.ts          ← jeu de données de démonstration
│       │   └── sync-permissions.ts ← outil de synchro du catalogue de permissions
│       ├── src/
│       │   └── index.ts         ← export d'un singleton PrismaClient + ré-export PrismaClient
│       ├── tsconfig.json
│       └── package.json         ← name: "@cms-saris/db"
│
├── turbo.json                   ← Configuration Turborepo (ui: "tui")
├── pnpm-workspace.yaml          ← Déclaration des workspaces
├── pnpm-lock.yaml               ← Verrou (lockfileVersion 9.0)
└── package.json                 ← Racine (name: "CMS-SARIS", scripts globaux)
```

> **Différence notable vs l'intention initiale :** le package de design system s'appelle `@workspace/ui` (préfixe shadcn par défaut), tandis que les deux autres packages partagés portent le préfixe métier `@cms-saris/*`. Les applications `web` et `api` ne sont **pas** préfixées (`web`, `api`).

---

## 5. Fichiers de configuration racine (contenu réel)

### `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### `turbo.json`

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": ["dist/**"]
    },
    "lint": { "dependsOn": ["^lint"] },
    "format": { "dependsOn": ["^format"] },
    "typecheck": { "dependsOn": ["^typecheck"] },
    "dev": { "cache": false, "persistent": true }
  }
}
```

> Les tâches `lint`, `format` et `typecheck` ne déclarent pas d'`outputs` : elles ne sont pas mises en cache sur artefacts et s'exécutent à chaque invocation. Il n'existe **pas** de tâche `test` orchestrée par Turborepo (la couverture de tests est minimale — voir doc « Tests / Qualité »).

### `package.json` (racine — contenu réel)

```json
{
  "name": "CMS-SARIS",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "turbo build",
    "dev": "turbo dev",
    "lint": "turbo lint",
    "format": "turbo format",
    "typecheck": "turbo typecheck"
  },
  "devDependencies": {
    "prettier": "^3.8.1",
    "prettier-plugin-tailwindcss": "^0.7.2",
    "turbo": "^2.8.17",
    "typescript": "5.9.3"
  },
  "packageManager": "pnpm@9.15.9",
  "engines": { "node": ">=20" }
}
```

---

## 6. Dépendances inter-packages

```jsonc
// apps/web/package.json
{
  "dependencies": {
    "@cms-saris/types": "workspace:*",
    "@workspace/ui":    "workspace:*"
  }
}

// apps/api/package.json
{
  "dependencies": {
    "@cms-saris/db":    "workspace:*",
    "@cms-saris/types": "workspace:*"
  }
}
```

`workspace:*` est la syntaxe pnpm qui résout vers le package local du monorepo. La résolution des imports se fait :

- **côté `web`** via les `paths` du `tsconfig.app.json` :

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./src/*"],
      "@workspace/ui/*": ["../../packages/ui/src/*"]
    }
  }
}
```

- **côté `types`** via le champ `exports` (résolution par sous-chemin), qui donne aussi un import racine :

```json
{
  "exports": {
    ".":              "./src/index.ts",
    "./auth":         "./src/auth.ts",
    "./patient":      "./src/patient.ts",
    "./visite":       "./src/visite.ts",
    "./consultation": "./src/consultation.ts",
    "./sync":         "./src/sync.ts",
    "./referentiel":  "./src/referentiel.ts"
  }
}
```

- **côté `db`**, le package expose un **singleton Prisma** prêt à injecter (idempotent en développement grâce à un cache sur `globalThis`) :

```ts
// packages/db/src/index.ts (extrait)
import { PrismaClient } from '@prisma/client'
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ /* log selon NODE_ENV */ })
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
export { PrismaClient } from '@prisma/client'
```

> ⚠️ **Piège connu (ESM / watcher API) :** côté `api`, ne jamais faire d'import *value* (non `type`) depuis la racine `@cms-saris/types` — cela fait planter le watcher NestJS sous Windows. Les libellés de la matrice de permissions sont fournis côté frontend (`config/labels.ts`) en repli, et les types sont importés avec `import type` lorsque nécessaire.

---

## 7. Scripts utiles par package

| Package | Script | Effet |
|---|---|---|
| racine | `pnpm dev` | démarre `web` et `api` en parallèle (Turbo) |
| racine | `pnpm typecheck` / `pnpm lint` / `pnpm format` | qualité sur tout le graphe |
| `@cms-saris/db` | `pnpm --filter @cms-saris/db db:generate` | génère le client Prisma |
| `@cms-saris/db` | `pnpm --filter @cms-saris/db db:migrate` | applique les migrations en dev |
| `@cms-saris/db` | `pnpm --filter @cms-saris/db db:seed` | injecte le jeu de démonstration |
| `@cms-saris/db` | `pnpm --filter @cms-saris/db db:sync-permissions` | aligne le catalogue de permissions |
| `apps/web` | `vite build` | build PWA de production |

> **Note build :** le build PWA de `web` se fait via `vite build` (le PWA est désactivé en `dev`, actif en build/preview). Le cœur `ffmpeg.wasm` est exclu du pré-bundling esbuild pour préserver la résolution du worker module.

---

## 8. Ordre d'initialisation (historique du projet)

L'initialisation a suivi cet ordre. Cette section documente la genèse du dépôt ; la structure finale ci-dessus reste la référence.

### Étape 1 — Monorepo + `apps/web` + `packages/ui` via la CLI shadcn

La commande ci-dessous crée **d'un seul coup** le monorepo Turborepo, `apps/web` (React + Vite) et `packages/ui` (design system shadcn partagé).

```powershell
pnpm dlx shadcn@latest init --preset bLFY5uan2 --template vite --monorepo --pointer
# Nom du projet saisi à l'invite : CMS-SARIS
```

> **Architecture shadcn monorepo :** les composants vivent dans `packages/ui` (`@workspace/ui`), pas dans `apps/web`. L'app les consomme via `import { Button } from "@workspace/ui/components/button"`.

### Étape 2 — Backend `apps/api` via NestJS CLI

```powershell
nest new api --package-manager pnpm --skip-git
```

### Étape 3 — Package `@cms-saris/types`

```powershell
# packages/types : pnpm init, tsconfig.json, exports par sous-chemin, fichiers src/*.ts
```

### Étape 4 — Package `@cms-saris/db` (Prisma)

```powershell
# packages/db
pnpm add prisma @prisma/client bcrypt
pnpm dlx prisma init
# Schéma : 79 modèles ; 22 migrations versionnées ; seed.ts + sync-permissions.ts
pnpm prisma migrate dev --name init
```

### Étape 5 — Vérification

```powershell
# Depuis la racine
pnpm dev   # démarre web + api en parallèle via Turborepo
```

> Toutes les commandes `npx` historiques ci-dessus sont à exécuter en pnpm (`pnpm dlx …`) conformément à la règle de projet « pnpm exclusivement ».

---

## 9. Points d'attention

- **pnpm obligatoire** : `workspace:*` nécessite pnpm. Toute commande `npm`/`yarn`/`npx` après initialisation casserait les liens d'espace de travail.
- **Migrations Prisma** : `prisma migrate dev` exige une instance PostgreSQL locale via `DATABASE_URL` dans `apps/api/.env` (ou l'environnement de `@cms-saris/db`). Sous Windows, **tuer l'arborescence du watcher NestJS avant `prisma generate`** pour éviter le verrouillage de fichiers.
- **Builds incrémentaux** : Turborepo respecte le graphe `dependsOn: ["^build"]` ; si `@cms-saris/types` ou `@cms-saris/db` ne changent pas, ils ne sont pas reconstruits.
- **Frontière de confidentialité** : seul le schéma et les *types* de domaine traversent les frontières de package. La logique métier reste dans chaque application.
- **Import `@cms-saris/types` côté API** : préférer `import type` ; ne jamais value-importer la racine (crash du watcher ESM sous Windows).
- **Hygiène Git** : ne jamais committer `node_modules` ni les fichiers `.env`. Un `.gitignore` racine les exclut dès le départ.

---

## 10. Synthèse — état réel vs intention initiale

| Élément | Document initial | État réel (as-built) |
|---|---|---|
| Orchestrateur | Turborepo | Turborepo `^2.8.17` (`ui: "tui"`) ✅ |
| Gestionnaire de paquets | pnpm `9.0.0` | pnpm `9.15.9`, lock v9.0 ✅ |
| React | (18 supposé) | **React 19.2** ✅ |
| Vite | — | **Vite 7.3** ✅ |
| Tailwind | — | **Tailwind v4** (config CSS, pas de fichier JS) ✅ |
| Tables Prisma | « 71 tables » | **79 modèles**, 22 migrations ✅ |
| Apps | `web`, `api` | `web`, `api` ✅ |
| Packages partagés | `types`, `db` (+ `ui`) | `@cms-saris/types`, `@cms-saris/db`, `@workspace/ui` ✅ |
| Modules métier | « 5 modules / Acteurs & Sorties critiques non codés » | **Tous codés** : 14 modules API + transversaux (messagerie chiffrée, notifications SSE, CGU, audit, synchronisation, dashboard) ✅ |
| Alias d'import | `@cms-saris/types` partout | `@cms-saris/*` (types, db) + `@workspace/ui` (design system) ✅ |

> Le détail fonctionnel de chaque module, le schéma des 79 tables, la stack complète et les volets sécurité / offline / temps réel sont décrits dans les autres pages du cahier des charges technique. Les éléments **hors périmètre** (gestion de stock pharmaceutique, délivrance physique des médicaments, intégration CNSS) restent des **extensions futures** non implémentées.
