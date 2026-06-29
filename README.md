# CMS SARIS — Centre Médico-Social

Système de **gestion clinique médico-sociale multi-site** pour les travailleurs (et ayants droit, riverains, sous-traitants) de **SARIS-CONGO**. Conçu **offline-first** : chaque poste fonctionne même sans Internet et se synchronise avec un serveur central.

> Projet de soutenance. Documentation complète (cahier des charges as-built) : **`Docs/CMS/cahier de charge/docs/`** — point d'entrée [`00_HOME.md`](Docs/CMS/cahier%20de%20charge/docs/00_HOME.md).

---

## Architecture

```
                ┌─────────────────────────────┐
                │   Serveur central (cloud)    │
                │   API NestJS (Render)        │
                │   Base PostgreSQL (Neon)     │
                └──────────────┬──────────────┘
        HTTPS / sync (pull-push) │
        ┌───────────────────────┼───────────────────────┐
        │                                               │
 ┌──────┴───────┐                            ┌──────────┴───────────┐
 │ Site web      │                            │ App desktop (Windows) │
 │ React PWA     │  (client en ligne)         │ Electron : UI + backend│
 │ (Render)      │                            │ NestJS + SQLite EMBARQUÉS│
 └──────────────┘                            │ → marche HORS-LIGNE     │
                                              └──────────────────────┘
```

- **Central** = source de vérité (API + PostgreSQL), dans le cloud.
- **Web** = client direct du central (PWA, offline léger).
- **Desktop** = backend + base SQLite embarqués → autonome hors-ligne, **se synchronise** (LWW) avec le central. En ligne, l'interface parle au central (temps réel) ; hors-ligne, au backend local.

## Stack

| Couche | Technologies |
|--------|--------------|
| Frontend | React 19, Vite, Tailwind v4, Zustand, React Query, react-i18next (FR/EN), PWA |
| Backend | NestJS 11, Prisma 6, PostgreSQL (central) / SQLite (desktop), JWT + TOTP 2FA |
| Desktop | Electron 33, electron-builder + installeur NSIS, auto-update |
| Monorepo | pnpm workspace |

Chiffres : **16 modules**, **87 tables**, **110 permissions**, **3 rôles** (ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER ; *MEDECIN* = profession du personnel mappée au rôle MEDECIN_CHEF).

## Structure du dépôt

```
CMS/APP/CMS-SARIS/         ← monorepo pnpm (racine de travail)
├── apps/
│   ├── api/               API NestJS (modules métier)
│   ├── web/               Frontend React (web + renderer desktop)
│   └── desktop/           Application Electron (Windows)
├── packages/
│   ├── db/                Prisma (schéma PostgreSQL + schéma SQLite généré)
│   ├── types/             Types & permissions partagés
│   └── ui/                Composants UI partagés
Docs/                      Documentation (cahier des charges, charte graphique)
```

## Démarrage (développement)

> **pnpm exclusivement** (jamais npm/npx/yarn). Toutes les commandes depuis `CMS/APP/CMS-SARIS/`.

```bash
pnpm install                                   # dépendances
pnpm --filter @cms-saris/db exec prisma migrate deploy   # base PostgreSQL
pnpm --filter @cms-saris/db exec prisma db seed          # données de départ

pnpm --filter api start           # API   → http://localhost:3000
pnpm --filter web dev             # Web   → http://localhost:5173
```

Compte par défaut (seed) : `admin` / `Admin123!`.

## Build de l'application desktop (Windows)

```bash
# Mode local (backend + SQLite embarqués) :
node apps/desktop/scripts/build-local.mjs --dir     # → release/win-unpacked
node apps/desktop/installer/build-installer.mjs     # → release/CMS SARIS-Setup-x.y.z.exe
```

L'URL du serveur central est bakée via `SARIS_DEFAULT_API_URL` ; les secrets (JWT, clés de chiffrement) via `apps/api/.env`. Signature de code : voir [`checklist_mise_en_production`](Docs/CMS/cahier%20de%20charge/docs/03_conception_transverse/checklist_mise_en_production.md).

## Déploiement

Central = **API sur Render** + **PostgreSQL sur Neon** ; site web sur Render. Configuration : [`render.yaml`](render.yaml). Procédure complète + état de préparation : [`checklist_mise_en_production`](Docs/CMS/cahier%20de%20charge/docs/03_conception_transverse/checklist_mise_en_production.md).

---

*Conventions de code, design system et règles métier détaillés dans le cahier des charges (`Docs/CMS/cahier de charge/docs/`).*
