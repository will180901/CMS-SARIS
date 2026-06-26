# Décision Backend — NestJS + TypeScript

> **Document as-built** — Ce document décrit l'état RÉEL de l'API CMS SARIS tel
> qu'implémenté dans `apps/api`. Chaque module, interceptor, garde et endpoint
> mentionné existe dans le code. Les éléments qui restent volontairement hors
> périmètre du MVP sont identifiés explicitement (section « Hors périmètre »).

## Choix retenu

**NestJS 11 + TypeScript 5.9 (monolithe modulaire, Express en couche HTTP)**

| Couche | Technologie | Version |
|---|---|---|
| Framework | `@nestjs/core` / `@nestjs/common` | 11.1.21 |
| Adapter HTTP | `@nestjs/platform-express` | 11.1.21 |
| Configuration | `@nestjs/config` | 4.0.4 |
| Authentification | `passport` + `passport-jwt` + `@nestjs/jwt` | 0.7.0 / 4.0.1 / 11.0.2 |
| Rate limiting | `@nestjs/throttler` | 6.5.0 |
| Tâches planifiées | `@nestjs/schedule` | 6.1.3 |
| Validation / sérialisation | `class-validator` / `class-transformer` | 0.15.1 / 0.5.1 |
| ORM | `@prisma/client` / `prisma` | 6.19.3 |
| Hachage mot de passe | `bcrypt` | 6.0.0 |
| 2FA (TOTP) | `otplib` | 13.4.0 |
| QR code (TOTP) | `qrcode` | 1.5.4 |
| Géolocalisation IP | `geoip-lite` | 2.0.2 |
| Traitement image | `sharp` | 0.34.5 |
| Sécurité HTTP | `helmet` | 8.1.0 |
| Flux réactifs (SSE) | `rxjs` | 7.8.2 |
| Upload fichiers | `multer` (via `@nestjs/platform-express`) | intégré |

Langage : **TypeScript 5.9.3**, exécution Node via Nest. Tests : Jest 30 (configuré,
mais couverture réelle minimale — voir section « Tests »).

## Justification

### Pourquoi NestJS

NestJS impose une architecture modulaire par nature. Chaque module NestJS
correspond directement à un domaine fonctionnel du cahier des charges. La
correspondance ci-dessous reflète l'`AppModule` réellement câblé
(`apps/api/src/app.module.ts`) :

| Domaine CMS SARIS | Module NestJS | Statut |
|---|---|---|
| Sécurité, authentification, 2FA, sessions, profil « Mon compte » | `SecurityModule` | ✅ Codé |
| Administration (utilisateurs, rôles, permissions, audit, paramètres, sauvegardes) | `AdminModule` | ✅ Codé |
| Référentiels (sites, motifs, pathologies, médicaments, catégories, examens) | `ReferentielsModule` | ✅ Codé |
| Acteurs administratifs (personnel, délégations, sous-traitants) | `PersonnelModule` | ✅ Codé |
| Dossier patient (identité, allergies, antécédents, alertes, rattachements) | `PatientModule` | ✅ Codé |
| Accueil & triage (visites, constantes vitales) | `TriageModule` | ✅ Codé |
| Consultation & actes prescrits (diagnostics, ordonnances) | `ConsultationModule` | ✅ Codé |
| Bons d'examen | `BonExamenModule` | ✅ Codé |
| Suivis chroniques | `SuiviChroniqueModule` | ✅ Codé |
| Sorties critiques (évacuations, accidents du travail) | `SortiesCritiquesModule` | ✅ Codé |
| Tableau de bord (KPI, séries temporelles, patients à risque) | `DashboardModule` | ✅ Codé |
| Notifications temps réel (cloche + SSE + présence) | `NotificationModule` | ✅ Codé |
| Messagerie interne chiffrée | `MessagerieModule` | ✅ Codé |
| Paramètres système (lecture, appliqués par le code métier) | `ParametresModule` | ✅ Codé |

Cette correspondance directe est un argument fort en soutenance : **le code
reflète exactement le cahier des charges**, et **l'intégralité des 8 modules MVP
du cahier des charges est implémentée** (les éléments « Acteurs administratifs »
et « Sorties critiques », parfois donnés pour partiels, sont bien codés de bout
en bout, controllers + services + écrans web).

### Pourquoi pas Express seul

Express n'impose aucune structure. Sans discipline stricte, le code d'un projet
de cette taille devient désorganisé rapidement. NestJS force la séparation
Controllers / Services / Providers dès le départ et fournit nativement
l'injection de dépendances, les gardes, les interceptors et les pipes de
validation utilisés ici.

### Pourquoi TypeScript côté backend aussi

- Le package partagé `@cms-saris/types` (rôles, permissions, types métier)
  fonctionne uniquement si les deux côtés sont TypeScript.
- Les DTO (Data Transfer Objects) NestJS valident automatiquement les entrées
  utilisateur avec `class-validator`.
- Un DTO mal formé est rejeté par le `ValidationPipe` global avant même
  d'atteindre le service — sécurité à la frontière système.

## Structure `apps/api`

```
apps/api/
├── src/
│   ├── modules/
│   │   ├── security/          ← Auth, JWT, TOTP, sessions, profil « me »
│   │   │   ├── security.module.ts
│   │   │   ├── security.controller.ts   (/auth/*)
│   │   │   ├── security.service.ts
│   │   │   ├── me.controller.ts         (/me/*)
│   │   │   ├── me.service.ts            (préférences, CGU, TOTP, sessions)
│   │   │   ├── guards/                  ← JwtAuthGuard, PermissionsGuard,
│   │   │   │                              RolesGuard, UserThrottlerGuard
│   │   │   ├── strategies/              ← JwtStrategy (passport-jwt)
│   │   │   └── dto/
│   │   ├── admin/             ← Utilisateurs, rôles, permissions, audit,
│   │   │   │                     paramètres, synchronisation/sauvegardes
│   │   │   ├── utilisateurs.{controller,service}.ts
│   │   │   ├── roles.{controller,service}.ts
│   │   │   ├── audit.{controller,service}.ts
│   │   │   ├── parametres.controller.ts
│   │   │   └── synchronisation.{controller,service}.ts
│   │   ├── referentiels/
│   │   ├── personnel/         ← Personnel, délégations, sous-traitants
│   │   ├── patient/
│   │   ├── triage/
│   │   ├── consultation/
│   │   ├── bon-examen/
│   │   ├── suivi-chronique/
│   │   ├── sorties-critiques/
│   │   ├── dashboard/
│   │   ├── notification/      ← Notifications + SSE + présence
│   │   │   ├── notification.{controller,service}.ts
│   │   │   └── presence.service.ts
│   │   ├── messagerie/        ← Messagerie chiffrée + pièces jointes
│   │   └── parametres/
│   ├── common/
│   │   ├── guards/
│   │   ├── decorators/        ← @Roles(), @CurrentUser(),
│   │   │                         @RequirePermissions(), @Audit(), @LiveRefresh()
│   │   ├── interceptors/      ← AuditInterceptor, LiveRefreshInterceptor
│   │   ├── filters/           ← GlobalExceptionFilter
│   │   ├── crypto/            ← message-crypto.ts (AES-256-GCM messagerie),
│   │   │                         totp-secret.ts (AES-256-GCM secret TOTP)
│   │   └── geo/               ← geo.util.ts (IP → ville/pays, ip-api + geoip-lite)
│   ├── prisma/                ← PrismaModule / PrismaService (injection NestJS)
│   ├── health/                ← HealthController (sonde publique /health)
│   └── main.ts
├── test/                      ← app.e2e-spec.ts (E2E de base)
├── tsconfig.json
└── package.json
```

Le schéma Prisma est centralisé dans `packages/db/prisma/schema.prisma`
(**79 modèles**, **22 migrations**) ; `PrismaService` y donne accès depuis
chaque module.

## Démarrage applicatif (`main.ts`)

L'amorçage configure plusieurs garde-fous de sécurité globaux :

- **`trust proxy`** : piloté par la variable `TRUST_PROXY` (nombre de hops,
  `true`/`false`, ou plage). Indispensable derrière un reverse-proxy (nginx,
  traefik, load-balancer cloud) pour lire la vraie IP client via
  `X-Forwarded-For`. Défaut : `1` (1er proxy en amont). ⚠️ À ajuster au
  déploiement.
- **`helmet()`** : headers HTTP sécurisés (HSTS, X-Frame-Options, etc.).
- **CORS restreint** : origine = `FRONTEND_URL` (défaut `http://localhost:5173`),
  `credentials: true`, méthodes `GET/POST/PUT/PATCH/DELETE`.
- **`ValidationPipe` global** : `whitelist: true` (supprime les champs hors DTO),
  `forbidNonWhitelisted: true` (rejette les champs inconnus), `transform: true`
  (conversion implicite des types). Défense contre l'injection de masse et les
  payloads malformés.
- **`GlobalExceptionFilter`** : normalise le format des erreurs renvoyées.

## Interceptors globaux

Deux interceptors sont enregistrés comme `APP_INTERCEPTOR` et s'appliquent à
toute l'application, mais restent **NO-OP** tant que la route n'est pas annotée
— zéro impact ailleurs.

### 1. AuditInterceptor — journalisation des mutations (R-SEC-018)

Enregistré dans `AppModule` via `{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }`.
Sur toute route annotée `@Audit('module', 'EntiteType')` et pour les seules
méthodes **mutantes** (`POST → CREATE`, `PUT/PATCH → UPDATE`, `DELETE → DELETE`),
il persiste une entrée dans `journal_audit` : auteur (`utilisateurId`), action,
module, type/id d'entité, IP, et statut (`SUCCES` / `ERREUR`). Le logging est
**best-effort** : un échec d'écriture d'audit n'altère jamais la requête métier.
C'est la garantie de la règle **R-SEC-018** (journal non modifiable par
interface) : seul cet interceptor (et les écritures explicites des services
d'administration) écrit dans `journal_audit`, jamais une route métier.

### 2. LiveRefreshInterceptor — rafraîchissement temps réel silencieux

Enregistré comme `APP_INTERCEPTOR` dans `NotificationModule`. Sur toute route
annotée `@LiveRefresh('LIVE_*')` et après une mutation réussie, il appelle
`NotificationService.broadcastLive(type)`, qui diffuse un événement temps réel
**silencieux** (sans cloche, son ni toast) sur le flux SSE. Les listes de tous
les clients connectés (référentiels, acteurs, bons d'examen, synchronisation) se
rafraîchissent alors instantanément. Types diffusés : `LIVE_REFERENTIELS`,
`LIVE_ACTEURS`, `LIVE_BONS_EXAMEN`, `LIVE_SYNC`.

## Sécurité API

### Authentification & sessions

- **JWT** : access token (durée paramétrable, ~15 min) + refresh token (7 jours,
  rotation). Payload : `{ sub, siteId, roles, permissions, personnelMedicalId, sid }`.
  Stratégie `passport-jwt` + `@nestjs/jwt`, clé `JWT_SECRET`.
- **Sessions** persistées (`SessionUtilisateur`) : `refreshTokenHash` haché bcrypt,
  IP, user-agent, expiration, révocation. Révocation unitaire ou en masse depuis
  « Mon compte ».
- **Bcrypt** : hachage des mots de passe et des refresh tokens (jamais en clair).
- **2FA TOTP** (`otplib`) : secret chiffré AES-256-GCM (voir crypto), 8 codes de
  secours hachés bcrypt à usage unique. QR code généré via `qrcode`.
- **Escalade de blocage** : après un seuil d'échecs (paramètre système), durée de
  blocage progressive (×4 à chaque récidive). Réinitialisée au login réussi.
- **Géolocalisation des connexions** : `geo.util.ts` résout l'IP en ville/pays via
  `ip-api.com` (cache 1 h) avec repli hors-ligne `geoip-lite`.

### Gardes (Guards)

| Garde | Rôle |
|---|---|
| `JwtAuthGuard` | Valide le JWT et injecte `req.user` (id, siteId, rôles, permissions). |
| `PermissionsGuard` | Vérifie les permissions du JWT via `@RequirePermissions(...)` (mode ANY/ALL). |
| `RolesGuard` | Vérifie les rôles via `@Roles(...)`. |
| `UserThrottlerGuard` | Rate-limiting **par utilisateur** (clé `u:{userId}`), repli sur IP pour le trafic non authentifié — évite que plusieurs agents derrière le même NAT se pénalisent mutuellement. |

### Modèle de permissions (RBAC granulaire)

- **110 permissions** déclarées dans `@cms-saris/types` (`PERMISSIONS`), par
  module : `dashboard`, `patient`, `visite`, `consultation`, `ordonnance`,
  `bon_examen`, `suivi_chronique`, `evacuation`, `accident_travail`,
  `referentiel` (lecture globale + écriture granulaire par service),
  `personnel`, `sous_traitant`, `delegation`, `utilisateur`, `role`, `audit`,
  `parametre`, `synchronisation`, `notification`, `messagerie`.
- **6 rôles** : `ADMIN_SYSTEME` (super-administrateur = catalogue complet),
  `ADMIN_MEDICAL` (gouvernance clinique), `MEDECIN_CHEF` (pleins droits
  cliniques), `INFIRMIER` (triage), `INFIRMIER_DELEGUE` (triage + prescription
  limitée), `AGENT_RH` (personnel + administratif).
- **Formule de permission effective** : `(permissions des rôles ∪ GRANTs) − REVOKEs`.
  Les dérogations individuelles (`UtilisateurPermission`, mode GRANT/REVOKE, motif,
  auteur, horodatage) s'appliquent par-dessus les rôles ; un REVOKE l'emporte
  toujours. Dérogations possibles unitairement ou **en masse**.

> **Règle R-SEC-013** : toute permission vérifiée côté frontend l'est aussi côté
> backend. `PermissionsGuard` est la garantie serveur, appliquée à chaque endpoint
> sensible.

### Rate limiting (Throttler)

- **Global** : `ThrottlerModule.forRoot([{ name: 'global', ttl: 60 000, limit: 100 }])`
  dans `AppModule` — 100 requêtes/min.
- **Messagerie** : `@Throttle({ default: { limit: 150, ttl: 60_000 } })` au niveau
  du controller (lectures fréquentes), resserré à **40 envois/min/utilisateur**
  sur l'endpoint d'envoi (`POST /messagerie/conversations/:id/messages`)
  via `UserThrottlerGuard`.

## Chiffrement applicatif (`common/crypto`)

### Messagerie — `message-crypto.ts`

- Algorithme **AES-256-GCM** (IV 12 octets, tag d'authentification inclus).
- Format stocké **versionné** : `v2:<keyId>:<iv_b64>:<authTag_b64>:<ct_b64>` ;
  le format legacy `v1:<iv>:<tag>:<ct>` reste déchiffrable.
- **Rotation de clé** : trousseau `MESSAGE_ENC_KEYS` (`"1:phraseA,2:phraseB,…"`),
  source Vault-ready `MESSAGE_ENC_KEYS_FILE`, clé courante
  `MESSAGE_ENC_KEY_CURRENT` (défaut : plus grand id). Repli mono-clé
  `MESSAGE_ENC_KEY`/`TOTP_ENC_KEY`. Dérivation par `scrypt`.
- Outil de **ré-encryption v1 → v2** non destructif (curseur par id, idempotent)
  exposé via l'API de synchronisation.
- Le contenu des messages **et les pièces jointes** sont chiffrés au repos.

### Secret TOTP — `totp-secret.ts`

- **AES-256-GCM**, format `v1:<iv_b64>:<authTag_b64>:<ct_b64>`, clé dérivée
  `scrypt` de `TOTP_ENC_KEY`. Rétro-compatible (secret sans préfixe traité comme
  clair, migration transparente).

## Messagerie — pièces jointes (multer) & durcissement

Le `MessagerieController` (`POST .../messages`) accepte les fichiers via
`FilesInterceptor('fichiers', 10, ATTACHMENT_OPTS)` (`@nestjs/platform-express` +
`multer`) avec un durcissement défensif :

- **Stockage en mémoire** (`memoryStorage`) — aucun fichier sur disque ; les
  octets sont chiffrés puis conservés en base (`MessagePieceJointe`).
- **Limites** : 10 fichiers max, 16 Mo par fichier.
- **Whitelist MIME** : images (`jpeg/png/webp/gif`), vidéo, audio, PDF, texte
  (`plain/csv`), Office (Word/Excel).
- **Sanitisation du nom de fichier** : retrait du chemin (anti path-traversal),
  des caractères de contrôle et de `<>:"/\|?*`, borné à 200 caractères.
- **Vérification des magic bytes** (`assertSafeBinary`) : rejet des exécutables /
  scripts indépendamment du MIME déclaré — `MZ` (PE Windows), `ELF` (Linux),
  `Mach-O` (macOS), `#!` (script shell). Bloque l'« .exe déguisé en .pdf ».

Côté serveur, le cloisonnement par site empêche les fuites IDOR cross-site ; les
règles fines (compression image, durée vidéo ≤ 2 min) sont appliquées côté
client. Fenêtre d'édition/suppression : 15 min ; suppression à deux niveaux
(« pour moi » via masque permanent / « pour tout le monde » ≤ 15 min).

## Temps réel — SSE & présence

- **Endpoint SSE** : `@Sse('stream')` sur `GET /notifications/stream?token=JWT`.
  Le token JWT passe en query car `EventSource` ne supporte pas les en-têtes.
  L'audience (userId, siteId, permissions) est dérivée du JWT.
- **`NotificationService.emit()`** : crée une notification persistée et la pousse
  sur un `Subject` RxJS (best-effort, ne casse jamais la logique métier). Portée
  individuelle (`destinataireId`) ou diffusion (filtrée par `siteId` +
  `requiredPermission`).
- **`broadcastLive(type)`** : événements live silencieux (cf. LiveRefreshInterceptor).
- **`PresenceService`** : compteur en mémoire — un utilisateur est « en ligne »
  tant qu'au moins une connexion SSE est ouverte. Sert les accusés de réception
  (✓ envoyé / ✓✓ remis / ✓✓ lu) et le statut « en ligne / vu à » de la messagerie.
- **REST associé** : `GET /notifications`, `GET /notifications/unread-count`,
  `PATCH /:id/read`, `POST /read-all`, `POST /dismiss-many`, `POST /dismiss-all`,
  `DELETE /:id` (admin système). Permissions `notification.read/update/delete`.

## Tâches planifiées (Cron) & sauvegardes de configuration

`ScheduleModule.forRoot()` est activé dans `AppModule`. Le
`SynchronisationService` (module `admin`) porte la sauvegarde automatique :

- **`@Cron(CronExpression.EVERY_DAY_AT_2AM, { name: 'sauvegarde-auto' })`** :
  snapshot quotidien de la **configuration uniquement** (référentiels, matrice
  rôles→permissions, paramètres système). **Les données cliniques/patients ne sont
  JAMAIS incluses** (confidentialité + intégrité).
- **Restauration non-destructive** par `upsert` (ré-applique les valeurs sans
  supprimer l'existant), réinstalle la matrice rôles→permissions.
- **Rétention** : 30 dernières sauvegardes conservées.
- **Audit + broadcastLive** à chaque opération.

Endpoints (`synchronisation.controller.ts`) :

```
GET    /synchronisation/status               ← compteurs + dernière sauvegarde
GET    /synchronisation/sauvegardes          ← historique (métadonnées)
POST   /synchronisation/sauvegardes/manuelle   @RequirePermissions('synchronisation.execute')
POST   /synchronisation/sauvegardes/:id/restaurer  @RequirePermissions('synchronisation.restore')
POST   /synchronisation/messagerie/rechiffrer  @RequirePermissions('synchronisation.execute')
```

> La synchronisation **offline terrain** (file de rejeu des mutations) est gérée
> **côté client** (IndexedDB/Dexie + Service Worker PWA, rejeu via le client API).
> Il n'existe pas (encore) de `SyncModule` serveur dédié `/sync/push` ↔
> `/sync/pull` : les mutations hors-ligne sont rejouées en réémettant les requêtes
> REST d'origine vers les controllers métier existants.

## Conformité — Conditions d'utilisation (CGU)

Gérée par `me.service.ts` :

- Version serveur `CGU_VERSION = 'v1-2026.06'`.
- Acceptation tracée dans `PreferenceUtilisateur` (`cguAccepteeLe`, `cguVersion`).
- `POST /me/cgu/accept` enregistre l'acceptation ; `GET /me/preferences` expose
  `cguAJour` (booléen) et la version requise. Un bump de version force la
  ré-acceptation de tous les utilisateurs (porte bloquante côté frontend).

## Endpoints principaux par module

Routes REST réellement exposées (extrait représentatif) :

```
# Authentification & profil
POST   /auth/login
POST   /auth/totp-verify
POST   /auth/refresh
POST   /auth/logout
PATCH  /auth/change-password
GET    /me                       PATCH /me/preferences
GET    /me/sessions              POST  /me/sessions/:id/revoke   POST /me/sessions/revoke-others
POST   /me/totp/setup            POST  /me/totp/activate         POST /me/totp/disable
GET    /me/cgu                   POST  /me/cgu/accept

# Administration
GET/POST /admin/utilisateurs     ... /admin/utilisateurs/:id/roles | /permissions | batch-permissions
GET    /admin/roles              PATCH /admin/roles/:id/permissions
GET    /admin/permissions
GET    /admin/audit/actions      GET   /admin/audit/authentifications

# Référentiels (sites, motifs, pathologies, médicaments, catégories, examens) — CRUD

# Acteurs administratifs
GET/POST /personnel              ... /personnel/:id/statut
GET/POST /personnel/delegations  ... /personnel/delegations/:id/medicaments-autorises
GET/POST /personnel/sous-traitants

# Dossier patient
GET/POST /patients               PATCH /patients/:id/identite | /categorie | /statut
.../allergies  .../antecedents  .../alertes-medicales
.../rattachements-ad  .../rattachements-st

# Triage
POST   /visites                  GET /visites   GET /visites/:id
PATCH  /visites/:id/statut | /soignant | /notes
POST   /visites/:id/constantes

# Consultation & actes
GET/POST /consultations          PATCH /consultations/:id/examen | /conclusion | /cloturer | /annuler
POST   /consultations/:id/diagnostics
POST   /consultations/:id/ordonnances    .../lignes (CRUD)   .../valider

# Bons d'examen
GET/POST /bons-examen            PATCH .../valider   POST .../saisir-resultat

# Sorties critiques
GET/POST /sorties-critiques/evacuations   .../suivi
GET/POST /sorties-critiques/accidents     .../suivi

# Suivi chronique
GET/POST /suivi-chronique        POST .../cloturer   POST .../visites

# Tableau de bord
GET    /dashboard/overview | /timeline | /staff | /patients-at-risk

# Notifications (REST + SSE)
SSE    /notifications/stream?token=JWT
GET    /notifications | /unread-count   PATCH /:id/read   POST /read-all | /dismiss-many | /dismiss-all

# Messagerie chiffrée
GET    /messagerie/contacts | /conversations | /unread-count
POST   /messagerie/conversations | /groupes | /conversations/:id/messages (multipart)
GET    /messagerie/pieces-jointes/:id

# Sonde liveness (publique)
GET    /health
```

## Points d'attention

- **R-SEC-013** : toute permission vérifiée côté frontend l'est aussi côté
  backend (`PermissionsGuard`).
- **R-SEC-018** : le journal d'audit est alimenté uniquement par
  `AuditInterceptor` (et les services d'administration), jamais par une route
  d'écriture métier.
- **`TRUST_PROXY`** doit être réglé au déploiement selon le reverse-proxy réel,
  sinon `req.ip` (et donc l'audit + la géolocalisation) reflètera l'IP du proxy.
- **Clés de chiffrement** (`MESSAGE_ENC_KEYS*`, `TOTP_ENC_KEY`, `JWT_SECRET`) :
  fournir en production via variables d'environnement ou secret monté
  (Vault/Kubernetes). Une rotation réelle suppose d'exécuter l'outil de
  ré-encryption sur l'ensemble du corpus de messages.
- **Synchronisation offline** : la sauvegarde de configuration et la
  synchronisation terrain sont deux mécanismes distincts (voir ci-dessus).

## Tests & qualité (état réel)

- **Tests** : configuration Jest 30 complète, mais couverture réelle **minimale**
  — seuls 2 specs E2E de base (`/health` → 200, `/notifications/unread-count`
  → 401 sans token). Aucun test unitaire/intégration en `src/`. Axe d'amélioration
  pour la soutenance.
- **Typecheck** : `strict: true` (avec `noImplicitAny: false`, `skipLibCheck: true`).
- **Lint/format** : ESLint (typescript-eslint) + Prettier via Turbo.

## Hors périmètre (extensions futures)

Conformément au cadrage du MVP, les éléments suivants ne sont **pas** implémentés
côté backend et restent des extensions futures :

- Gestion des **stocks pharmaceutiques** et **délivrance physique** des médicaments
  (l'ordonnance est produite et imprimable, mais la dispensation n'est pas gérée).
- Intégrations externes type **CNSS** / tiers payant automatisé (les catégories et
  rattachements existent en base, sans connecteur externe).
- `SyncModule` serveur dédié (`/sync/push` ↔ `/sync/pull`) et résolution de
  conflits côté serveur — les tables `FileMutation`, `ConflitSynchronisation`,
  `ResolutionConflit` existent au schéma mais le flux de rejeu reste piloté par le
  client.
- Internationalisation backend (les libellés métier sont en français).
```
