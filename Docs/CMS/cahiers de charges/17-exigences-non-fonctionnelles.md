# Document 17 — Exigences Non-Fonctionnelles

## 1. Objectif

Les exigences fonctionnelles disent **ce que** le système fait. Les exigences non-fonctionnelles (ENF) disent **comment** il doit le faire : vitesse, sécurité, disponibilité, compatibilité, maintenabilité, accessibilité.

Ce document est obligatoire pour une soutenance sérieuse : un jury technique évalue non seulement les fonctionnalités, mais aussi la robustesse et la qualité du système.

> **Statut de ce document.** Il décrit l'**état réel (as-built)** de l'application CMS SARIS, vérifié dans le code. Chaque exigence est annotée d'un statut :
> - **RÉALISÉ** — implémenté et vérifié dans le code livré ;
> - **PARTIEL** — mécanisme présent mais non outillé (pas de test automatisé, pas d'audit formel) ;
> - **EXTENSION FUTURE** — reconnu, hors périmètre du MVP livré.
>
> Cette transparence est volontaire : elle permet au jury de distinguer ce qui est démontrable de ce qui relève de la feuille de route.

---

## 2. Performance

L'application est conçue **offline-first** : la performance perçue repose sur un cache applicatif granulaire (Service Worker Workbox + PWA), une base locale IndexedDB (Dexie), un découpage de bundle Vite et la pagination serveur systématique. Les chiffres ci-dessous sont des **cibles** ; ils ne sont pas (encore) mesurés par une chaîne d'instrumentation automatisée — c'est une limite assumée du MVP.

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-PERF-001 | Le temps de réponse de l'API pour les requêtes courantes (liste, ouverture de visite) reste inférieur à 500 ms en conditions normales. | Requêtes Prisma optimisées (`include` ciblés, `count` séparés pour éviter les N+1) ; à instrumenter | PARTIEL |
| ENF-PERF-002 | L'application frontend doit charger en moins de 3 s sur une connexion 10 Mbps. | App Shell pré-cachée (JS/CSS/fonts), build Vite avec tree-shaking | PARTIEL |
| ENF-PERF-003 | Le premier affichage utile (First Contentful Paint) doit rester inférieur à 1,5 s. | Cible Lighthouse ; non instrumentée en CI | EXTENSION FUTURE |
| ENF-PERF-004 | Les listes (patients, visites, consultations, notifications) supportent l'affichage de plusieurs centaines d'enregistrements sans dégradation. | Pagination serveur obligatoire ; bornes : audit ≤ 500/page, feed notifications 40, messagerie 50/page | RÉALISÉ |
| ENF-PERF-005 | La file de rejeu hors ligne se synchronise par lots ordonnés sans saturer le réseau. | `syncPush()` rejoue les mutations PENDING triées par `ordreLocal`, idempotence par `mutationUuid` | RÉALISÉ |
| ENF-PERF-006 | Les référentiels locaux (Dexie) répondent à une recherche en quelques millisecondes. | IndexedDB avec index déclarés (`cms-saris-db`) | RÉALISÉ |
| ENF-PERF-007 | Le traitement vidéo (rognage des pièces jointes messagerie) s'exécute côté client sans ré-encodage coûteux. | `ffmpeg.wasm` auto-hébergé (`-ss -t -c copy`, découpe quasi-instantanée) ; cœur ESM exclu du pré-bundling esbuild | RÉALISÉ |
| ENF-PERF-008 | Les compteurs du tableau de bord et l'invalidation des caches sont mis à jour sans rechargement complet. | TanStack Query + invalidations ciblées pilotées par le flux temps réel (SSE) | RÉALISÉ |

---

## 3. Sécurité

La sécurité est traitée **en profondeur** : authentification multi-facteurs, chiffrement au repos des données sensibles, RBAC granulaire avec dérogations individuelles, audit persistant et durcissement applicatif de la messagerie. C'est le volet le plus abouti du projet.

### 3.1 Authentification et gestion des sessions

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-SEC-001 | Toutes les communications réseau passent par HTTPS (TLS) en production. | Configuration du reverse-proxy (Nginx/Caddy) ; `trust proxy` côté API | EXTENSION FUTURE (déploiement) |
| ENF-SEC-002 | L'authentification repose sur des JSON Web Tokens (JWT) signés. | Passport + `@nestjs/jwt` ; payload `{ sub, siteId, roles, permissions, personnelMedicalId, sid }` | RÉALISÉ |
| ENF-SEC-003 | La durée de vie du token d'accès est **paramétrable** via le paramètre système `auth.session_timeout_minutes` (5–10080 min). Le refresh token a une durée de 7 jours avec rotation. | `security.service.ts` (`accessTtlSec`, `REFRESH_TOKEN_TTL = 7 j`) | RÉALISÉ |
| ENF-SEC-004 | Les mots de passe sont hachés avec **bcrypt (12 rounds)**. Les refresh tokens sont également hachés en base. | `bcrypt.hash(motDePasse, 12)` ; jamais stockés en clair | RÉALISÉ |
| ENF-SEC-005 | Une **double authentification TOTP (2FA)** est disponible par utilisateur, avec codes de secours. | `otplib` ; secret TOTP chiffré AES-256-GCM (`totp-secret.ts`) ; 8 codes de secours hachés bcrypt, à usage unique | RÉALISÉ |
| ENF-SEC-006 | L'API résiste aux attaques par force brute par **escalade dynamique du blocage** de compte. | 1er échec = `auth.duree_blocage_minutes`, puis ×4 à chaque tentative suivante ; compteur réinitialisé au succès | RÉALISÉ |
| ENF-SEC-007 | La politique de mot de passe est **paramétrable** (longueur min 8–64, majuscule, minuscule, chiffre, caractère spécial). | Appliquée réellement par le code métier via `ParametreMetier` | RÉALISÉ |
| ENF-SEC-008 | Les sessions multiples sont gérées : affichage IP / user-agent / géolocalisation, révocation sélective ou en masse. | Table `SessionUtilisateur` ; endpoints `/me/sessions/*` | RÉALISÉ |

### 3.2 Chiffrement et confidentialité

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-SEC-009 | Les messages internes et leurs pièces jointes sont **chiffrés au repos en AES-256-GCM**. | `message-crypto.ts` ; tables `Message`, `MessagePieceJointe` | RÉALISÉ |
| ENF-SEC-010 | Le chiffrement supporte une **rotation / versionnage de clé** sans rupture. | Format `v2:<keyId>:<iv>:<tag>:<ct>` ; trousseau `MESSAGE_ENC_KEYS` + `MESSAGE_ENC_KEY_CURRENT` ; legacy `v1` toujours déchiffrable ; clés Vault-ready (`MESSAGE_ENC_KEYS_FILE`) | RÉALISÉ |
| ENF-SEC-011 | Un outil de **ré-encryption** permet de migrer les anciens messages vers la clé courante après rotation. | `reencryptToCurrent()` ; endpoint `POST /synchronisation/messagerie/rechiffrer` (non destructif, idempotent par curseur) | RÉALISÉ |
| ENF-SEC-012 | Les secrets TOTP sont chiffrés au repos (jamais stockés en clair). | AES-256-GCM, clé dérivée scrypt de `TOTP_ENC_KEY` (`totp-secret.ts`) | RÉALISÉ |
| ENF-SEC-013 | Aucune donnée clinique ou message en clair n'est exposé dans les notifications ou les logs. | Notifications de type MESSAGE sans contenu ; logging best-effort sans payload sensible | RÉALISÉ |
| ENF-SEC-014 | La clé secrète JWT et les clés de chiffrement ne sont jamais commitées dans le dépôt. | Variables d'environnement (`JWT_SECRET`, `TOTP_ENC_KEY`, `MESSAGE_ENC_KEYS`) ; avertissement si clé par défaut en production | RÉALISÉ |

### 3.3 Autorisation (RBAC granulaire)

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-SEC-015 | Le contrôle d'accès repose sur un modèle **rôles + permissions granulaires** (110 permissions, 6 rôles). | Catalogue `permissions.ts` ; tables `Role`, `Permission`, `RolePermission` | RÉALISÉ |
| ENF-SEC-016 | La permission effective d'un utilisateur suit la formule **(rôles ∪ GRANTs) − REVOKEs**, le REVOKE l'emportant toujours. | Table `UtilisateurPermission` (mode GRANT/REVOKE, motif, auditée) | RÉALISÉ |
| ENF-SEC-017 | Chaque endpoint est protégé par des guards combinés. | `JwtAuthGuard`, `PermissionsGuard` (`@RequirePermissions`, mode ANY/ALL), `RolesGuard`, `UserThrottlerGuard` | RÉALISÉ |
| ENF-SEC-018 | Les données sont **cloisonnées par site** : le `siteId` du JWT restreint toutes les requêtes cliniques. | Triage, consultation, patient, sorties critiques, messagerie | RÉALISÉ |
| ENF-SEC-019 | Des garde-fous protègent l'intégrité des comptes (impossibilité de retirer le dernier administrateur). | Vérification dans le service admin | RÉALISÉ |

### 3.4 Durcissement applicatif (messagerie et API)

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-SEC-020 | Les en-têtes HTTP de sécurité sont actifs (HSTS, CSP, X-Frame-Options, X-Content-Type-Options…). | `helmet` activé dans `main.ts` | RÉALISÉ |
| ENF-SEC-021 | Les entrées sont validées et nettoyées côté backend avant tout traitement. | `ValidationPipe` global (`whitelist`, `forbidNonWhitelisted`, `transform`) + `class-validator` | RÉALISÉ |
| ENF-SEC-022 | L'API applique un **rate-limiting par utilisateur** : 40 envois/min en messagerie, 150 requêtes/min en lecture. | `@nestjs/throttler` + `UserThrottlerGuard` (clé `u:{userId}`) | RÉALISÉ |
| ENF-SEC-023 | Les pièces jointes sont contrôlées : whitelist MIME, **vérification des signatures binaires** (rejet des exécutables déguisés), assainissement des noms de fichier, 10 fichiers × 16 Mo max. | `assertSafeBinary()` (rejet PE/ELF/Mach-O/shell), `sanitize` du nom, stockage en mémoire | RÉALISÉ |
| ENF-SEC-024 | L'accès inter-sites est bloqué (anti-IDOR) avec un message d'erreur uniforme ne révélant pas l'existence de comptes. | « Destinataire introuvable » indifférencié | RÉALISÉ |
| ENF-SEC-025 | L'ORM Prisma protège contre les injections SQL (requêtes paramétrées). | Prisma par conception | RÉALISÉ |
| ENF-SEC-026 | La capacité des groupes de discussion est plafonnée. | Cap 50 participants par groupe | RÉALISÉ |

### 3.5 Audit et traçabilité

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-SEC-027 | Toutes les mutations métier (CREATE/UPDATE/DELETE) sont **journalisées** automatiquement. | `AuditInterceptor` global (`@Audit`) → table `JournalAudit` (utilisateur, action, module, entité, IP, statut, horodatage) | RÉALISÉ |
| ENF-SEC-028 | Les événements d'authentification (login, échecs, TOTP, codes de secours) sont journalisés. | Table `JournalAuthentification` (résultat, IP, user-agent, géolocalisation) | RÉALISÉ |
| ENF-SEC-029 | Les journaux d'audit sont consultables et filtrables (module, action, utilisateur, entité, plage de dates). | Écran Admin / Audit ; bornes de dates inclusives ; max 500 résultats/page | RÉALISÉ |
| ENF-SEC-030 | L'adresse IP réelle et la géolocalisation des connexions sont capturées de manière fiable derrière un reverse-proxy. | `trust proxy` paramétrable (`TRUST_PROXY`) ; lecture `X-Forwarded-For` ; voir §8 | RÉALISÉ |

---

## 4. Disponibilité et fiabilité

La résilience repose sur le mode hors ligne (PWA + file de rejeu), des sauvegardes de configuration automatisées et une restauration non destructive.

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-DISP-001 | L'application fonctionne en mode dégradé (hors ligne) pour les parcours de saisie : les mutations sont mises en file et rejouées à la reconnexion. | PWA (Service Worker Workbox, NetworkFirst sur GET API) + file IndexedDB (`sync.ts`) | RÉALISÉ |
| ENF-DISP-002 | Les données et l'App Shell restent disponibles hors ligne pendant plusieurs jours. | Cache runtime : API 7 jours / assets 30 jours / `ffmpeg.wasm` 180 jours | RÉALISÉ |
| ENF-DISP-003 | Une synchronisation échouée n'entraîne **jamais** de perte de données locales. | Mutations conservées jusqu'à acquittement (PENDING → APPLIED/REJECTED), `retryRejected()` pour rejouer | RÉALISÉ |
| ENF-DISP-004 | La configuration du système (référentiels, matrice rôles↔permissions, paramètres) est **sauvegardée automatiquement** chaque jour, avec rétention. | Cron quotidien 02h00 (`@nestjs/schedule`), rétention des 30 dernières sauvegardes | RÉALISÉ |
| ENF-DISP-005 | La restauration d'une sauvegarde est **non destructive** (upsert) et n'écrase jamais les données cliniques. | `restaurerSauvegarde()` ; les données patients/cliniques ne sont **jamais** incluses dans les snapshots (confidentialité + intégrité) | RÉALISÉ |
| ENF-DISP-006 | En cas d'erreur API, le frontend affiche un message clair et ne plante pas. | Gestion globale des erreurs + helpers toast (`sonner`) | RÉALISÉ |
| ENF-DISP-007 | L'état réseau et la santé du serveur sont surveillés en continu. | `useServerHealth` (ping `/health`, timeout 4 s, intervalle 20 s) + `network.store` | RÉALISÉ |
| ENF-DISP-008 | Le serveur PostgreSQL doit supporter les connexions simultanées d'un centre médical sans dégradation. | Pool de connexions Prisma | EXTENSION FUTURE (charge non testée) |

---

## 5. Temps réel

Une couche temps réel (Server-Sent Events) propage les événements aux clients connectés et déclenche des invalidations de cache ciblées, sans rechargement de page.

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-RT-001 | Les événements métier sont poussés en temps réel aux utilisateurs concernés. | Endpoint SSE `/notifications/stream?token=JWT` ; `NotificationService.emit()` (RxJS Subject) | RÉALISÉ |
| ENF-RT-002 | Les notifications respectent le cloisonnement par site et les permissions du destinataire. | Diffusions filtrées par `siteId` + `requiredPermission` | RÉALISÉ |
| ENF-RT-003 | Les invalidations de cache sont silencieuses et ciblées (référentiels, acteurs, bons d'examen, synchronisation). | `broadcastLive()` (LIVE_REFERENTIELS, LIVE_ACTEURS, LIVE_BONS_EXAMEN, LIVE_SYNC) + tables d'invalidation TanStack Query | RÉALISÉ |
| ENF-RT-004 | La présence « en ligne » et les accusés de lecture (✓ envoyé / ✓✓ remis / ✓✓ lu) sont gérés en temps réel. | `PresenceService` (compteur en mémoire) + `Utilisateur.lastSeenAt` + événement MESSAGE_STATUS | RÉALISÉ |
| ENF-RT-005 | La connexion SSE se reconnecte automatiquement, y compris après rotation du token. | `EventSource` auto-reconnect côté frontend | RÉALISÉ |

---

## 6. Compatibilité

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-COMPAT-001 | L'application fonctionne sur les navigateurs modernes (Chrome, Firefox, Edge récents). | React 19 + Vite (cible ESNext) | RÉALISÉ |
| ENF-COMPAT-002 | L'application est installable comme **PWA** (standalone). | `vite-plugin-pwa` (Workbox) ; `manifest.webmanifest` (`display: standalone`, `theme_color: #4E8BA4`) | RÉALISÉ |
| ENF-COMPAT-003 | L'interface est utilisable sur écran de bureau (≥ 1280 × 720). | Layout responsive Tailwind v4 (sidebar 240 px, topbar 54 px, contenu max 1100 px) | RÉALISÉ |
| ENF-COMPAT-004 | L'interface est **responsive** et s'adapte aux tablettes et au mobile (triage, messagerie, dossier patient). | Hook `useMediaQuery` + breakpoints (mobile < 768 px, tablette 768–1023 px, desktop ≥ 1024 px) ; sidebar → **drawer** (bouton hamburger) sous 768 px ; split-panels (messagerie, triage, patients, consultation, rôles) empilés un panneau à la fois sous 1024 px avec bouton Retour ; sidebar dossier/visite en bandeau ; onglets scrollables ; modales adaptatives ; **15 pages adaptées** (était 100 % desktop-first). Validation sur appareils physiques recommandée avant la soutenance. | RÉALISÉ |
| ENF-COMPAT-005 | Le backend NestJS s'exécute sur Node.js LTS. | NestJS 11 ; version Node à fixer au déploiement (`.nvmrc`) | PARTIEL |
| ENF-COMPAT-006 | PostgreSQL est la base de données cible. | Prisma 6 (client + CLI) ; version à fixer au déploiement | RÉALISÉ |

---

## 7. Internationalisation (i18n)

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-I18N-001 | L'intégralité de l'interface est en **français**, langue unique du contexte SARIS Congo. | Strings FR directes ; dictionnaire centralisé `config/labels.ts` (~600 entrées : rôles, métiers, modules, actions, statuts) | RÉALISÉ |
| ENF-I18N-002 | Les libellés de domaine (rôles, métiers, modules, actions d'audit) sont centralisés et réutilisables. | Helpers `labelRole()`, `labelMetier()`, `labelModule()`, `labelAction()` avec fallback d'humanisation | RÉALISÉ |
| ENF-I18N-003 | La géolocalisation affiche les noms de pays/villes en français. | `Intl.DisplayNames(['fr'])` côté géolocalisation | RÉALISÉ |
| ENF-I18N-004 | Le multilinguisme dynamique (commutation de langue à l'exécution) n'est pas implémenté. | Aucune librairie i18n (i18next, etc.) ; le FR est codé en dur | EXTENSION FUTURE |

---

## 8. IP réelle et géolocalisation

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-GEO-001 | L'API capture l'adresse IP réelle du client, même derrière un reverse-proxy. | `trust proxy` paramétrable (`TRUST_PROXY` : nombre de proxies, `true`, ou booléen) ; lecture `X-Forwarded-For` | RÉALISÉ |
| ENF-GEO-002 | La géolocalisation enrichit l'IP (ville, région, pays, lat/lon, fuseau). | Service externe `ip-api.com` (prioritaire, timeout court, libellés FR) | RÉALISÉ |
| ENF-GEO-003 | La géolocalisation reste fonctionnelle **hors ligne** (sans Internet). | Repli embarqué `geoip-lite` (base hors-ligne) | RÉALISÉ |
| ENF-GEO-004 | Les appels de géolocalisation sont mis en cache et dédupliqués pour ne pas sur-solliciter le service externe. | Cache mémoire par IP (TTL 1 h), déduplication des appels concurrents | RÉALISÉ |
| ENF-GEO-005 | ⚠️ Le paramètre `TRUST_PROXY` doit être réglé selon la topologie réseau au déploiement. | Documentation de déploiement | EXTENSION FUTURE (déploiement) |

---

## 9. Maintenabilité et qualité du code

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-MAINT-001 | Le projet est un **monorepo** géré par pnpm + Turbo. | `pnpm` 9.x (exclusif), `turbo` pour l'orchestration | RÉALISÉ |
| ENF-MAINT-002 | Le code TypeScript compile en **mode strict** (`strict: true`). | `tsconfig` API et Web (`strict`, `strictNullChecks`, `noUnusedLocals/Parameters` côté Web) | RÉALISÉ |
| ENF-MAINT-003 | Le linter ESLint et le formateur Prettier sont configurés. | ESLint 9 (typescript-eslint), Prettier + `prettier-plugin-tailwindcss` | RÉALISÉ |
| ENF-MAINT-004 | Les migrations Prisma sont versionnées et rejouables sur une base vide. | 22 migrations versionnées ; `prisma migrate reset` ; seed déterministe | RÉALISÉ |
| ENF-MAINT-005 | Le schéma de données est unique et documenté. | `schema.prisma` (~79 modèles, regroupés par domaine) | RÉALISÉ |
| ENF-MAINT-006 | Les types métier sont partagés entre frontend et backend. | Package `@cms-saris/types` (auth, patient, visite, consultation, sync, référentiels) | RÉALISÉ |
| ENF-MAINT-007 | Une suite de tests automatisés couvre les services critiques (auth, sync, patients). | **Limite assumée** : seuls 2 tests E2E basiques existent (`/health` → 200, `/notifications/unread-count` → 401). Aucun test unitaire/intégration ; la configuration Jest est en place mais inexploitée. | EXTENSION FUTURE |
| ENF-MAINT-008 | Les variables d'environnement sensibles sont documentées (`.env.example`) et séparées par environnement. | À finaliser au déploiement | PARTIEL |

> **Note d'honnêteté pour la soutenance.** L'effort de qualité a porté en priorité sur le **typage strict**, la **revue manuelle** et la **validation E2E en navigateur réel** plutôt que sur une couverture de tests automatisés. C'est un arbitrage explicite à présenter comme tel, et la mise en place d'une suite de tests unitaires/intégration est la première recommandation d'évolution.

---

## 10. Accessibilité

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-ACCESS-001 | Les composants d'interface intègrent les attributs ARIA de base. | Primitives **Radix UI** + shadcn/ui (ARIA intégré) ; ~122 occurrences `role`/`aria-*`/`tabindex` dans le code | RÉALISÉ |
| ENF-ACCESS-002 | Les modales et dialogues annoncent leur rôle et se ferment au clavier (Échap). | Ex. `ConditionsModal` (`role="dialog"`, `aria-modal`, fermeture Échap) | RÉALISÉ |
| ENF-ACCESS-003 | Les messages d'erreur de validation sont visibles et associés au champ concerné. | `react-hook-form` + `zod` ; validation partagée (`lib/validation.ts`) | RÉALISÉ |
| ENF-ACCESS-004 | Un audit formel WCAG 2.1 AA (contrastes, lecteurs d'écran, navigation clavier complète) est mené. | Aucun audit automatisé (axe-core/pa11y) ni test lecteur d'écran à ce stade | EXTENSION FUTURE |

---

## 11. Design system et expérience utilisateur

L'application repose sur un **design system SARIS** maison, strict et cohérent, appliqué via des variables CSS (tokens) et des styles en ligne.

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-UX-001 | Toutes les couleurs, espacements, typographies et rayons proviennent de **tokens CSS** (aucune valeur codée en dur arbitraire). | `globals.css` : palettes monochrome + accent teal/or (`--ap-*`, `--as-*`), greys, sémantiques (succès/erreur/avertissement/info) | RÉALISÉ |
| ENF-UX-002 | Le système supporte les thèmes **clair / sombre / auto** et une densité d'affichage réglable. | `ThemeProvider` maison (`components/theme-provider.tsx`, classe `.dark` + `prefers-color-scheme`) ; `[data-densite="compact"]` (-25 %) ; ombres désactivées en sombre (bordures à la place) | RÉALISÉ |
| ENF-UX-003 | L'échelle de rayons de bordure est plafonnée à 10 px (interface fonctionnelle, sans excès). | `rounded-sm` 4 px → `rounded-3xl` 10 px | RÉALISÉ |
| ENF-UX-004 | L'interface emploie un effet de **glassmorphisme** maîtrisé (sidebar, cartes, en-tête, toasts) et un grain de texture. | Variables `--glass-*-bg` / `--glass-*-blur` ; bruit fractal SVG (`.saris-grain`) | RÉALISÉ |
| ENF-UX-005 | Une typographie variable cohérente est embarquée localement (offline). | `@fontsource-variable` : Inter, Plus Jakarta Sans, JetBrains Mono, Sora | RÉALISÉ |
| ENF-UX-006 | Les emojis et stickers de la messagerie s'affichent **localement** (Apple, style WhatsApp), sans dépendance CDN. | Sprite local `public/emoji/apple-32/64.png` + coordonnées `@emoji-mart/data` ; offline total | RÉALISÉ |
| ENF-UX-007 | Un retour sonore discret accompagne les actions clés, désactivable par l'utilisateur. | `lib/sounds.ts` : 6 sons **synthétisés** (Web Audio, 0 fichier/0 CDN) — success, error, notification, sent, received, tap ; préférence `localStorage` (`setSoundsEnabled`) | RÉALISÉ |
| ENF-UX-008 | Les conditions d'utilisation (CGU) sont présentées et leur acceptation est tracée et versionnée. | `ConditionsModal` ; version serveur `CGU_VERSION = v1-2026.06` ; champs `cguAccepteeLe`/`cguVersion` ; porte bloquante (`CguGate`) ; re-demande si version incrémentée | RÉALISÉ |
| ENF-UX-009 | Les documents médicaux (ordonnance, bon d'examen) sont imprimables en A4 sans dépendance serveur. | Gabarit `MedicalPrintSheet` (impression CSS client) | RÉALISÉ |

---

## 12. Déploiement

| ID | Exigence | Mesure / moyen | Statut |
|---|---|---|---|
| ENF-DEPLOY-001 | L'application est déployable sur un serveur Linux on-premise (contexte SARIS Congo). | Stack NestJS + PostgreSQL + assets statiques | EXTENSION FUTURE (procédure à finaliser) |
| ENF-DEPLOY-002 | Les variables d'environnement sont séparées par environnement (développement, production). | Fichiers `.env` distincts | PARTIEL |
| ENF-DEPLOY-003 | Le build de production frontend génère des assets optimisés (code-splitting, compression). | `vite build` + PWA ; ⚠️ utiliser `vite build` (et non `pnpm build`, cassé par dette pré-existante) | RÉALISÉ |
| ENF-DEPLOY-004 | Le `trust proxy` et les clés de chiffrement sont réglés correctement avant la mise en production. | `TRUST_PROXY`, `MESSAGE_ENC_KEYS`, `JWT_SECRET`, `TOTP_ENC_KEY` | EXTENSION FUTURE (déploiement) |

---

## 13. Exigences hors périmètre (extensions futures reconnues)

Les exigences suivantes sont reconnues mais explicitement **hors du périmètre livré** ; elles constituent la feuille de route d'évolution :

- **Tests automatisés** : suite de tests unitaires et d'intégration (auth, sync, patients) — recommandation prioritaire ;
- **Instrumentation des performances** : mesures Lighthouse / monitoring APM en continu ;
- **Audit d'accessibilité formel** : conformité WCAG 2.1 AA vérifiée (axe-core, tests lecteur d'écran) ;
- **Internationalisation dynamique** : commutation de langue à l'exécution (l'application est en français uniquement) ;
- **Haute disponibilité** : clustering, load balancing, failover PostgreSQL ;
- **Chiffrement au repos côté serveur** : chiffrement disque (géré au niveau OS) ;
- **Audit de sécurité externe** : test d'intrusion (pentest) ;
- **Conformité RGPD complète** : recommandée en extension, hors contexte réglementaire Congo ;
- **Gestion physique des stocks et délivrance pharmaceutique**, **intégration CNSS / assurances en temps réel** : domaines métier hors MVP (cf. document de périmètre).

---

> **Synthèse.** Le projet est particulièrement abouti sur la **sécurité** (2FA, chiffrement AES-256-GCM avec rotation de clé, RBAC granulaire, audit persistant, durcissement messagerie), le **temps réel** (SSE + présence + accusés), l'**offline-first** (PWA + file de rejeu non destructive + sauvegardes de configuration) et le **design system** (tokens SARIS, thèmes, sons synthétisés, emojis locaux). Les limites assumées concernent l'**absence de tests automatisés**, l'**absence d'instrumentation de performance** et l'**absence d'audit d'accessibilité formel** — points présentés en toute transparence et constituant les premières évolutions recommandées.
