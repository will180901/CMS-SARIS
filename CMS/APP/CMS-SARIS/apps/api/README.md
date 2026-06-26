# API CMS SARIS

Backend **REST + SSE** de la plateforme médicale **CMS SARIS**. Cette API expose
les services métier du centre médico-social (dossier patient, triage, consultation,
suivis chroniques, sorties critiques, messagerie chiffrée, administration…) et
diffuse en temps réel les notifications et invalidations de cache aux clients
web et bureau.

Le service est **bi-cible** : il fonctionne au-dessus de **PostgreSQL 16** sur le
serveur central et de **SQLite** sur un poste autonome (déploiement hors ligne),
en supportant la synchronisation multi-postes (offline-first). Il peut être lancé
comme processus serveur classique ou **embarqué dans le client de bureau Electron**.

---

## Pile technique

| Domaine | Technologie |
|---|---|
| Framework | **NestJS 11** (monolithe modulaire) |
| ORM | **Prisma 6** — 79 tables, 22 migrations |
| Base de données | **PostgreSQL 16** (serveur) + **SQLite** (poste autonome) |
| Authentification | **Passport JWT** (access + refresh) |
| Double facteur | **2FA TOTP** (`otplib` + QR code `qrcode`) |
| Chiffrement | **AES-256-GCM** (messagerie interne, secrets TOTP) |
| Sécurité HTTP | **helmet**, **throttler** (rate limiting) |
| Temps réel | **SSE** (Server-Sent Events) — notifications & invalidations LIVE |
| Validation | `class-validator` / `class-transformer` (ValidationPipe global) |
| Planification | `@nestjs/schedule` (sauvegardes & purges automatiques) |
| Médias | `sharp` (images), `multer` (téléversements) |
| Géolocalisation | `geoip-lite` (hors ligne) pour l'audit de connexion |

Cette API fait partie d'un **monorepo pnpm + Turbo** :
React 19 / Vite 7 / Tailwind v4 côté web, client de bureau **Electron** (installateur
NSIS), interface **bilingue FR / EN** (react-i18next), architecture **offline-first**.

---

## Modules métier

Le périmètre MVP couvre **8 modules métier** déployés sur **2 sites** (Moutela, Nkayi).
Les modules NestJS exposés par l'API :

| Module | Responsabilité |
|---|---|
| `security` | Authentification (login, refresh), 2FA TOTP, profil `me`, gardes JWT / rôles / permissions |
| `referentiels` | Données de référence (sites, catégories, motifs, sociétés sous-traitantes…) |
| `personnel` | Personnel médical et acteurs (médecins, infirmiers, agents) |
| `patient` | Dossier patient, identité, historique clinique |
| `triage` | Accueil et triage (file d'attente par ordre d'arrivée, dédup patient, acte atomique) |
| `consultation` | Consultation et actes cliniques, constantes vitales, clôture guidée |
| `bon-examen` | Bons d'examen (prescriptions d'examens complémentaires) |
| `suivi-chronique` | Suivis des pathologies chroniques |
| `sorties-critiques` | Évacuations sanitaires et accidents du travail |
| `dashboard` | Indicateurs (KPI) calculés par rôle et filtrés par site |
| `notification` | Notifications temps réel (cloche + flux SSE) |
| `messagerie` | Messagerie interne chiffrée entre agents (AES-256-GCM, pièces jointes, accusés) |
| `admin` | Administration système : utilisateurs, rôles, permissions, journal d'audit |
| `parametres` | Paramètres de configuration et sauvegarde / restauration |
| `sync` | Synchronisation offline-first (bootstrap, push/pull, résolution de conflits) |

Composants transverses dans `src/common/` (chiffrement, décorateurs `@Audit` /
`@RequirePermissions` / `@LiveRefresh`, intercepteurs d'audit et de rafraîchissement
temps réel, géolocalisation, filtre d'exceptions global) et `src/prisma/`
(service Prisma, extension de soft-delete bi-cible).

---

## Sécurité

- **JWT à deux jetons** : un jeton d'accès court et un jeton de rafraîchissement.
- **Authentification à deux facteurs (2FA TOTP)** : secret chiffré au repos
  (AES-256-GCM), codes de secours, vérification au login.
- **Contrôle d'accès** : **110 permissions** réparties sur **6 rôles** —
  `ADMIN_SYSTEME`, `ADMIN_MEDICAL`, `MEDECIN_CHEF`, `INFIRMIER`,
  `INFIRMIER_DELEGUE`, `AGENT_RH`. Gardes `JwtAuthGuard`, `RolesGuard` et
  `PermissionsGuard`.
- **Journalisation d'audit persistante** : intercepteur global qui trace les
  mutations des controllers annotés `@Audit(...)` (acteur, IP réelle, statut).
- **Durcissement HTTP** : `helmet` (en-têtes de sécurité), `throttler`
  (limitation de débit globale + login), CORS restreint (frontend web +
  origine du client de bureau `app://cms-saris`).
- **Chiffrement de la messagerie** : contenu jamais stocké en clair, clés
  versionnées (rotation, compatible fichier monté par Vault / secret Kubernetes).

---

## Commandes

> Utiliser **pnpm exclusivement** (monorepo). Lancer les commandes depuis ce
> dossier (`apps/api`) ou via le filtre Turbo depuis la racine.

```bash
# Développement (watch / rechargement à chaud)
pnpm start:dev

# Compilation (production)
pnpm build

# Démarrage du build compilé
pnpm start:prod

# Tests
pnpm test          # tests unitaires
pnpm test:e2e      # tests end-to-end
pnpm test:cov      # couverture

# Qualité de code
pnpm lint
pnpm format
```

### Base de données

La préparation de la base (génération du client Prisma, application des migrations,
amorçage des données de référence — rôles, permissions, sites…) est automatisée
par le script **`setup-db.ps1`** situé à la racine du monorepo :

```powershell
# Depuis la racine du monorepo
.\setup-db.ps1
```

Variables d'environnement principales (fichier `.env`) : `DATABASE_URL`, `PORT`,
`HOST`, `JWT_*`, `MESSAGE_ENC_KEY` / `MESSAGE_ENC_KEYS`, `TOTP_ENC_KEY`,
`CORS_ORIGINS` / `FRONTEND_URL`, `TRUST_PROXY`.

---

## Voir aussi

Pour la vue d'ensemble du projet, l'installation complète du monorepo, le
frontend web, le client de bureau et la documentation de cadrage, se reporter au
**[README racine du monorepo](../../README.md)**.
