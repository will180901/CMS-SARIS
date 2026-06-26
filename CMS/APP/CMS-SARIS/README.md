# CMS SARIS — Centre Médico-Social (Congo)

**Plateforme interne de gestion médico-sociale**, bilingue (🇫🇷/🇬🇧), conçue pour les centres
de santé congolais (Moutela, Nkayi…). Elle fonctionne **en ligne et hors-ligne** : chaque poste
peut travailler sans internet sur une base locale, puis se **synchronise automatiquement** avec
un serveur central dès le retour de la connexion.

Deux façons de l'utiliser, **même code** :

- 🌐 **Application web** — servie depuis un serveur (local ou hébergé), accessible au navigateur.
- 🖥️ **Application de bureau Windows** (Electron) — installable, en deux modes :
  - **Connecté** : cliente d'un serveur central distant.
  - **Autonome (offline-first)** : embarque son propre mini-serveur + base **SQLite locale**, et
    se synchronise avec le serveur central (la dernière écriture gagne, conflits journalisés).

---

## 1. Résumé fonctionnel

| Domaine | Contenu |
|---|---|
| **Sécurité** | Authentification JWT + bcrypt, **2FA (TOTP)** + codes de secours, rôles & permissions (6 rôles, ~110 permissions), sessions, **journal d'audit** persistant |
| **Référentiels** | Sites, catégories de patients, motifs, pathologies, médicaments, types d'examen, établissements |
| **Acteurs / RH** | Personnel médical, habilitations, délégations de prescription, présences/absences, sous-traitants |
| **Patients** | Dossier complet (identité, contacts, allergies, antécédents, alertes, constantes, suivis grossesse/chronique), rattachements |
| **Accueil & Triage** | File d'attente, prise en charge, constantes vitales, affectation soignant |
| **Consultations & Actes** | Consultations, diagnostics, **ordonnances**, **bons d'examen** + résultats |
| **Sorties critiques** | Évacuations, accidents du travail, suivis |
| **Communication** | **Messagerie interne chiffrée** (AES-256-GCM), pièces jointes/médias, réactions, accusés de lecture, présence temps réel |
| **Documents** | Impression A4 (ordonnance, bon d'examen, dossier…) |
| **Tableaux de bord** | Vue **adaptée au rôle** (clinique / admin médical / admin système / RH) : KPI temps réel, tendances, file d'attente, indicateurs RH |
| **Synchronisation** | Offline-first : base locale SQLite ↔ serveur central PostgreSQL (delta par `updatedAt`, tombstones, scope par site) |
| **Plateforme** | **Bilingue FR/EN** (bascule en direct, persistée par compte), thème clair/sombre, **responsive mobile/tablette** (sidebar en tiroir, panneaux empilés), notifications temps réel (SSE), PWA |

**Hors-ligne** : en cas de coupure réseau, le poste continue de fonctionner sur sa base locale ;
les modifications sont rejouées et réconciliées en sécurité au retour de la connexion.

---

## 2. Architecture (monorepo)

```
CMS-SARIS/
├── apps/
│   ├── api/        → Backend NestJS 11 (REST + SSE). Bi-cible : PostgreSQL (serveur) / SQLite (embarqué).
│   ├── web/        → Frontend React 19 + Vite 7 (PWA, i18n FR/EN).
│   └── desktop/    → Client Windows Electron (modes connecté / autonome) + installateur NSIS.
├── packages/
│   ├── db/         → Schéma Prisma + migrations (PostgreSQL) + génération du schéma/ client SQLite + seed.
│   ├── types/      → Types TS partagés (dont la logique pure de synchronisation, testée).
│   └── ui/         → Composants partagés (shadcn/ui).
├── pnpm-workspace.yaml · turbo.json
```

| Couche | Technologie |
|---|---|
| Frontend | React 19, Vite 7, Tailwind, **react-i18next** (FR/EN), Zustand, TanStack Query, React Router |
| Desktop | Electron (schéma `app://cms-saris`, DPAPI, auto-update electron-updater, installateur NSIS) |
| Backend | NestJS 11, Prisma 6 |
| Bases | **PostgreSQL 16** (serveur central) · **SQLite** (réplique locale embarquée) |
| Monorepo | pnpm workspaces + Turborepo |

> ⚠️ **Toujours utiliser `pnpm`** (jamais npm/npx/yarn) dans ce monorepo.

---

## 3. Prérequis

| Outil | Version | Vérifier |
|---|---|---|
| [Node.js](https://nodejs.org) | 20+ | `node -v` |
| [pnpm](https://pnpm.io) | 9+ | `pnpm -v` |
| [PostgreSQL](https://www.postgresql.org/) | 16 | (installé automatiquement par `setup-db.ps1` sous Windows) |
| [Git](https://git-scm.com) | 2.x | `git -v` |

---

## 4. Mise en route — en LOCAL

### 4.1 Cloner + installer

```bash
git clone <url-du-repo>
cd CMS-SARIS/CMS/APP/CMS-SARIS
pnpm install
```

### 4.2 Base de données (PostgreSQL natif — automatique)

Sous **Windows**, un script met tout en place (installe PostgreSQL 16 si absent, crée la base
`cms_saris_dev`, applique les migrations, charge les données de démo) :

```powershell
powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
```

> Identifiants attendus : utilisateur `postgres`, mot de passe `postgres`, port `5432`, base `cms_saris_dev`
> (modifiables dans `apps/api/.env` et `packages/db/.env`).

Mise en place **manuelle** équivalente (toutes plateformes, PostgreSQL déjà installé) :

```bash
pnpm --filter @cms-saris/db exec prisma migrate deploy   # crée/maj le schéma
pnpm --filter @cms-saris/db db:generate                  # client Prisma
pnpm --filter @cms-saris/db db:seed                      # données de démo
```

### 4.3 Lancer l'application web (2 terminaux)

```bash
# Terminal 1 — API (http://localhost:3000)
pnpm --filter api start:dev

# Terminal 2 — Frontend (http://localhost:5173)
pnpm --filter web dev
```

Ouvre **http://localhost:5173** → connexion : **`admin` / `Admin123!`**.

---

## 5. Application de bureau (Windows)

### 5.1 Mode CONNECTÉ (cliente d'un serveur)

L'app se connecte à un serveur (local en test, ou l'hébergeur en production).

```bash
# Construire l'installateur (.exe) — sur Windows
pnpm --filter @cms-saris/desktop dist
# Résultat : apps/desktop/release/CMS SARIS-Setup-<version>.exe
```

L'URL du serveur est résolue dans cet ordre : variable `SARIS_API_URL` → `config.json`
(`%APPDATA%\CMS SARIS`) → valeur figée au build (`SARIS_DEFAULT_API_URL`) → écran de configuration
au 1er lancement. **Pour la production**, figer l'URL de l'hébergeur au build évite toute
configuration manuelle.

### 5.2 Mode AUTONOME (offline-first, base locale SQLite)

Le poste embarque son backend + une base **SQLite** locale et se synchronise avec le serveur central.

- Activation : `config.json` → `{ "mode": "local", "serverUrl": "https://<serveur-central>" }`
  (ou env `SARIS_MODE=local`, `SERVER_URL=…`).
- Au démarrage, le poste démarre son API locale (127.0.0.1) sur la base SQLite, puis **se
  synchronise automatiquement** depuis le serveur central (comptes, référentiels, patients du site…).
- Packaging du mode local : voir **`apps/desktop/README.md`** (bundle de l'API compilée + moteur
  SQLite + base modèle `seed.db`).

### 5.3 Installateur

L'installateur **NSIS** (assistant 2 zones, charte SARIS) : choix du dossier d'installation,
progression détaillée, raccourcis, **2-en-1** (au lancement : installer **ou** désinstaller
proprement, sans laisser de trace), désinstallation complète des données.

---

## 6. Déploiement sur un SERVEUR distant (production)

1. **Serveur central** : héberger l'API NestJS + PostgreSQL.
   ```bash
   pnpm --filter @cms-saris/db exec prisma migrate deploy   # sur la base de prod
   pnpm --filter api build && node apps/api/dist/main         # ou via un gestionnaire de process
   ```
   Variables d'environnement de prod (`apps/api/.env`) : `DATABASE_URL` (PostgreSQL de prod),
   `JWT_SECRET` (à changer), `CORS_ORIGINS` (domaines autorisés + `app://cms-saris`),
   `TRUST_PROXY` (si derrière un reverse-proxy), `MESSAGE_ENC_KEYS` (clés de chiffrement messagerie).
2. **Web de production** : `pnpm --filter web build` en pointant `VITE_API_URL` vers l'API de prod,
   puis servir `apps/web/dist` (ou héberger derrière le même domaine).
3. **Desktop de production** : construire l'installateur avec `SARIS_DEFAULT_API_URL` = l'URL de
   l'hébergeur → les postes se connectent sans configuration. (Mode autonome : `serverUrl` = l'hébergeur.)

---

## 7. Commandes utiles

```bash
# Base de données
pnpm --filter @cms-saris/db db:studio        # Prisma Studio (UI de la base)
pnpm --filter @cms-saris/db db:migrate        # nouvelle migration (dev)
pnpm --filter @cms-saris/db db:seed           # (re)charger les données de démo
pnpm --filter @cms-saris/db db:sqlite:gen     # (re)générer le schéma SQLite (mode autonome)

# Vérifications TypeScript
pnpm -C apps/api exec tsc --noEmit
pnpm -C apps/web exec tsc --noEmit
pnpm -C apps/desktop exec tsc -p tsconfig.json --noEmit

# Desktop
pnpm --filter @cms-saris/desktop dist         # construire l'installateur Windows
```

---

## 8. Identifiants de test (après seed)

| Login | Mot de passe | Rôle | Pour tester |
|---|---|---|---|
| `admin` | `Admin123!` | ADMIN_SYSTEME | Tableau de bord système, administration, supervision |
| `admin-medical` | `Saris2026!` | ADMIN_MEDICAL | Référentiels, personnel, dashboard gouvernance clinique |
| `infirmier-delegue` | `Saris2026!` | INFIRMIER_DELEGUE | Triage, consultation, prescription (dashboard clinique) |
| `agent-rh` | `Saris2026!` | AGENT_RH | Dashboard RH, personnel, sous-traitants |

> Site : **Moutela** · Sites disponibles : Moutela, Nkayi. Chaque rôle voit un **tableau de bord
> et une navigation différents** (filtrés par permission) — pratique pour tester l'adaptation par rôle.

---

## 9. Accès rapide (développement)

| Service | URL |
|---|---|
| Frontend web | http://localhost:5173 |
| API | http://localhost:3000 |
| Prisma Studio | http://localhost:5555 |
| PostgreSQL | localhost:5432 |

---

*Développé par **Déo Cherel BOUWAYI MIKOUYA** — SARIS-CONGO. © 2026.*
