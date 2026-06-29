# Exigences non fonctionnelles — CMS SARIS (as-built)

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Ce document recense les exigences non fonctionnelles **telles que construites** (le système
> est développé et déployé pour la soutenance). Chaque exigence est quantifiée et vérifiable.
> Les faits techniques citent le chemin de code de référence dans le monorepo
> `CMS/APP/CMS-SARIS/`. Les chiffres canoniques (3 rôles, 87 tables, 110 permissions, stack)
> proviennent du brief système et sont définis une seule fois — voir [[_SOURCE_systeme]].
> Documents liés : [[plan_modules]], [[glossaire]], [[tracabilite]].
>
> Convention : une exigence « à confirmer » signale un point non vérifié à la source au moment
> de la rédaction. Aucun chiffre n'est inventé.

---

## ENF-01 — Offline-first (fonctionnement hors-ligne)

L'application de bureau (Electron, Windows) embarque un backend NestJS + une base **SQLite**
locale et doit rester **pleinement opérationnelle hors-ligne** (triage, consultation, dossier,
documents, messagerie locale), puis se synchroniser à la reconnexion.

- **ENF-01-01** — En mode `local`, le poste doit ouvrir et fonctionner **sans aucune connexion
  réseau** : login local, lecture/écriture cliniques sur la base SQLite embarquée. Référence :
  `apps/desktop/electron/backend.ts`, `apps/api/src/prisma/prisma.service.ts` (cible bi-provider PG/SQLite).
- **ENF-01-02** — Le client web (PWA) doit fournir un **offline léger** : cache de lecture
  (service worker, NetworkFirst sur GET API) et **file de rejeu IndexedDB chiffrée** des mutations
  en attente. Référence : `apps/web/src/lib/sync.ts`, `apps/web/src/lib/offlineCrypto.ts` (AES-256-GCM,
  format `enc:v1:…`).
- **ENF-01-03 (RPO — perte de données tolérée)** — Une mutation effectuée hors-ligne **n'est jamais
  perdue** : elle est conservée localement (SQLite côté desktop, IndexedDB côté web) jusqu'à
  pousse réussie. Objectif RPO de synchronisation = **0 mutation perdue** ; toute mutation faite
  hors-ligne reste en file (`PENDING`) tant qu'elle n'est pas acceptée par le central, même en cas
  de session expirée (retry après refresh proactif). Référence : `apps/web/src/lib/sync.ts`,
  `apps/web/src/lib/api.ts`.
- **ENF-01-04 (RTO — délai de retour à la cohérence)** — À la reconnexion, la synchronisation
  doit se déclencher **immédiatement** (sondeur de joignabilité ≈ 4 s, paramètre `SYNC_PROBE_SEC` ;
  filet de sécurité 300 s, `SYNC_SAFETY_SEC`). Au 1ᵉʳ lancement d'un poste vide, la base locale se
  remplit par synchronisation avant ouverture de l'application (validé E2E : « prêt » ≈ 23 s, ≈ 542
  enregistrements reçus). Référence : `apps/api/src/modules/sync/sync-client.service.ts`,
  `apps/desktop/electron/main.ts` (poll `/sync/ready`, max 90 s).
- **ENF-01-05 (cohérence multi-poste)** — La résolution de conflits est **Last-Write-Wins** sur
  `updatedAt` + détection de vrai conflit via `baseUpdatedAt`, avec **tombstones** (soft-delete
  `deletedAt` — [[parametres_metier]] PM-62) répliqués. Le serveur central reste la **source de
  vérité**. Référence :
  `packages/types/src/sync-conflict.ts`, `apps/api/src/modules/sync/sync.service.ts`.
- **ENF-01-06 (mode en-ligne prioritaire)** — En ligne, le renderer desktop parle **directement au
  central** (API + temps réel SSE) pour la latence ; hors-ligne il bascule sur le backend local.
  Hystérésis de bascule (≈ 2 sondes / 10 s) pour éviter le flickering. Référence :
  `apps/desktop/electron/main.ts` (`startConnectivityWatch`), `apps/web/src/stores/connectivity.store.ts`.

## ENF-02 — Performance

- **ENF-02-01** — En mode en-ligne, les lectures de listes cliniques doivent rester réactives sur
  un réseau réel ; les listes paginées sont **bornées côté serveur** (ex. notifications : `take`
  plafonné à 100 ; pull de synchronisation par pages de 500 enregistrements). Référence :
  `apps/api/src/modules/notification/notification.service.ts`,
  `apps/api/src/modules/sync/sync.service.ts` (`limit = 500`).
- **ENF-02-02** — Le frontend utilise un cache serveur (React Query) et des **invalidations temps
  réel** ciblées (SSE) plutôt que du polling agressif, pour réduire la latence perçue et la charge
  réseau. À l'état en-ligne/focus, les rafraîchissements sont quasi instantanés ; sinon intervalle
  ≈ 8 s. Référence : `apps/web/src/hooks` (React Query).
- **ENF-02-03** — Les lots de synchronisation peuvent être volumineux : le corps de requête JSON
  est accepté jusqu'à **50 Mo**. Référence : `apps/api/src/main.ts` (`useBodyParser('json', { limit: '50mb' })`).
- **ENF-02-04** — En mode local, le backend embarqué démarre rapidement (boot ≈ 1 s mesuré) et
  répond `/health` = ok depuis les ressources packagées. Référence : `apps/desktop/electron/backend.ts`.
- *Cible de latence chiffrée sur un réseau SARIS de production : à confirmer* (le système est
  validé pour la démo cloud Render/Neon ; aucun SLA de latence p95 n'a été mesuré sur le réseau cible réel).

## ENF-03 — Disponibilité

- **ENF-03-01** — Le **serveur central** (API NestJS sur Render + PostgreSQL sur Neon) est la source
  de vérité et le point d'accès du client web. Référence : [[_SOURCE_systeme]] (URLs Render).
- **ENF-03-02 (mode dégradé local)** — En cas d'indisponibilité du central, chaque poste desktop
  continue de fonctionner en autonomie sur sa base SQLite (mode dégradé local), sans interruption
  du travail clinique ; la synchronisation reprend automatiquement au retour du central
  (cf. ENF-01-04). Référence : `apps/desktop/electron/main.ts`.
- **ENF-03-03 (sauvegardes)** — Une sauvegarde **réelle de configuration** est planifiée par cron
  quotidien (@nestjs/schedule), avec rétention configurable et restauration non destructive.
  Référence : `apps/api/src/modules/synchronisation` / écran admin Synchronisation.
- **ENF-03-04 (purge contrôlée)** — Les notifications expirées sont purgées par cron (rétention
  `notif.retention_jours`, central uniquement) ; les tombstones de synchronisation sont purgés
  physiquement au-delà de **90 jours** — [[parametres_metier]] PM-59, avec garde-fou
  `deletedAt < min(SyncState.lastPulledAt)`
  pour ne jamais purger un changement non encore propagé. Référence :
  `apps/api/src/modules/sync/tombstone-purge.cron.ts`, `NotificationPurgeCron`.

## ENF-04 — Sécurité

- **ENF-04-01 (authentification JWT)** — Authentification par **JWT access + refresh**. Le token
  d'accès porte un identifiant de session `sid` ; sa durée de vie est pilotée par le paramètre
  système `auth.session_timeout_minutes` (**défaut 480 min** — [[parametres_metier]] PM-01, plage 5
  à 10080). Le refresh dure **7 jours** — [[parametres_metier]] PM-02 ; le token temporaire
  (étape 2FA) dure **5 minutes** — [[parametres_metier]] PM-03. Référence :
  `apps/api/src/modules/security/security.service.ts` (`REFRESH_TOKEN_TTL`, `TEMP_TOKEN_TTL`),
  `apps/api/src/modules/parametres/parametres.service.ts`.
- **ENF-04-02 (session unique)** — Un même compte ne peut avoir **qu'une seule session
  applicative active** : à chaque login/vérification 2FA/refresh, les autres sessions « app » du
  compte sont révoquées. Exemption : les sessions de **synchronisation desktop** (champ
  `posteLocalId` rempli) ne sont pas révoquées, pour ne pas casser la synchro du poste. Référence :
  `apps/api/src/modules/security/security.service.ts` (`creerSession`).
- **ENF-04-03 (révocation immédiate)** — Une session révoquée (logout, déconnexion forcée par un
  admin, désactivation ou suppression de compte) est rejetée **au prochain appel** : la stratégie
  JWT vérifie en base l'existence du `sid` (session non révoquée, non expirée), et une déconnexion
  **instantanée** est poussée par SSE (`type: SESSION_REVOKED`) aux connexions concernées.
  Référence : `apps/api/src/modules/security/strategies/jwt.strategy.ts`,
  `NotificationService.pushSessionRevoked`.
- **ENF-04-04 (2FA TOTP)** — Double authentification **TOTP** disponible (codes de secours).
  Le secret TOTP est **chiffré at-rest en AES-256-GCM**. Référence :
  `apps/api/src/common/crypto/totp-secret.ts`, `apps/api/src/modules/security/me.service.ts`.
- **ENF-04-05 (chiffrement at-rest)** — Le **contenu des messages et les pièces jointes** de la
  messagerie sont chiffrés en base en **AES-256-GCM**, avec versioning/rotation de clé
  (format `v2:keyId`, lecture rétro-compatible v1). La file de rejeu IndexedDB (web/desktop) est
  également chiffrée AES-256-GCM. Référence : `apps/api/src/common/crypto/message-crypto.ts`,
  `apps/api/src/modules/messagerie/messagerie.service.ts`, `apps/web/src/lib/offlineCrypto.ts`.
- **ENF-04-06 (audit persistant)** — Toutes les mutations des contrôleurs cliniques et de
  configuration sont journalisées (`@Audit` + intercepteur global), avec **IP réelle, géolocalisation
  et statut succès/erreur** ; les actions auto-déclenchées par l'admin système sont exclues.
  Référence : décorateur `@Audit` + AuditInterceptor (`APP_INTERCEPTOR`), table `JournalAudit`,
  `apps/api/src/common` (IP réelle via trust proxy + geoip-lite hors-ligne).
- **ENF-04-07 (CORS strict)** — Les origines autorisées sont une **liste blanche explicite**
  (`CORS_ORIGINS` / `FRONTEND_URL`) + l'origine du client de bureau `app://cms-saris` + les origines
  loopback (mode backend embarqué) ; toute autre origine est refusée. Méthodes limitées à
  GET/POST/PUT/PATCH/DELETE, `credentials: true`. Référence : `apps/api/src/main.ts` (`enableCors`).
- **ENF-04-08 (rate-limit)** — Throttling global **100 requêtes / minute** — [[parametres_metier]]
  PM-06 (fenêtre 60 000 ms). Le login est limité à **10 tentatives / minute / IP** — [[parametres_metier]]
  PM-04, et la vérification TOTP à **10 tentatives / minute / IP** — [[parametres_metier]] PM-05
  (anti brute-force), le refresh à 30 / minute (valeur as-built, cf. code). Référence : `apps/api/src/app.module.ts` (`ThrottlerModule`),
  `apps/api/src/modules/security/security.controller.ts` (`@Throttle`),
  `apps/api/src/modules/security/guards/user-throttler.guard.ts` (throttling par utilisateur
  derrière proxy/NAT).
- **ENF-04-09 (trust proxy)** — L'API est configurée pour s'exécuter derrière un reverse-proxy et
  lire la **vraie IP client** via `X-Forwarded-For` ; le nombre de hops de confiance est
  paramétrable (`TRUST_PROXY`, défaut 1). À régler au déploiement réel. Référence :
  `apps/api/src/main.ts` (`app.set('trust proxy', …)`), `apps/api/src/common` (IP réelle + geoip-lite).
- **ENF-04-10 (en-têtes HTTP & validation)** — En-têtes de sécurité via **helmet** ;
  validation globale stricte des DTO (`whitelist`, `forbidNonWhitelisted` → rejet des champs
  inconnus). Référence : `apps/api/src/main.ts` (`helmet()`, `ValidationPipe`).
- **ENF-04-11 (stockage de secrets desktop)** — Sur le poste Windows, les secrets de session sont
  stockés via le coffre sécurisé du système (DPAPI / `safeStorage`). Référence :
  `apps/desktop/electron` (`window.saris.secure.*`).
- **ENF-04-12 (CGU)** — L'acceptation des **Conditions d'utilisation** (version `v1-2026.06` —
  [[parametres_metier]] PM-61) est tracée (masque CGU) et bloque l'accès tant qu'elle n'est pas
  faite (CguGate). Référence : (traçabilité interne).
- *Note honnêteté* : les builds de test sont bakés sur `localhost` avec des clés `.env` de
  développement ; le déploiement réel impose un re-packaging avec l'URL Render et les clés du
  central (TOTP/messagerie doivent matcher). La **signature de code** (certificat OV/EV) est un
  bloquant externe non résolu (SmartScreen « éditeur inconnu »). Référence : `apps/desktop/installer`.

## ENF-05 — Confidentialité

- **ENF-05-01 (dossier centralisé)** — Le dossier patient est **centralisé cross-site** : il suit
  le patient sur tous les sites (continuité des soins), en lecture partagée. La synchronisation
  réplique le patient et tout son dossier en **global** sur chaque poste (un travailleur muté reste
  visible). Référence : `apps/api/src/modules/patient`, `apps/api/src/modules/sync/sync-models.ts`
  (décision « dossier complet en global »).
- **ENF-05-02 (activité scopée)** — L'**activité clinique** (triage, visites, consultations) est
  scopée au **site initiateur / au soignant** : le `siteId` provient toujours du JWT pour le triage
  et les visites. Référence : `apps/api/src/modules/triage`, `apps/api/src/modules/consultation`.
- **ENF-05-03 (verrou de confidentialité)** — Le **MEDECIN_CHEF** (et l'ADMIN_SYSTEME) peuvent
  **verrouiller** un dossier ; les colonnes `verrouille / verrouilleParId / verrouilleLe /
  motifVerrou` sont portées et synchronisées. La confidentialité par dossier reste portée par ce
  verrou y compris sur le backend local. Référence : `packages/db/prisma/schema.prisma` (Patient).
- **ENF-05-04 (rideau de confidentialité)** — Les zones de détail clinique (triage, consultation,
  messagerie, aperçu patient, éditeur de rôle) sont **floutées en permanence** (verre poli + grain)
  et se révèlent au survol, pour protéger des regards sur un poste partagé. Bascule globale
  persistée (défaut activé), neutralisée sur écran tactile. Référence :
  `apps/web/src/components/PrivacyCurtain.tsx`, `apps/web/src/stores/privacy.store.ts`.
- **ENF-05-05 (permissions par rôle)** — Le contrôle d'accès repose sur **~110 permissions**
  catalogue (`packages/types/src/permissions.ts`) appliquées par garde `@RequirePermissions`, sur
  **3 rôles** (ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER ; MEDECIN = profession mappée au rôle MEDECIN_CHEF). Référence :
  `packages/types/src/permissions.ts`, [[_SOURCE_systeme]].

## ENF-06 — Internationalisation

- **ENF-06-01** — L'interface est **bilingue FR/EN strict** via react-i18next : namespace
  `translation` (fr/en) + namespaces par module fusionnés sous leur préfixe. La bascule de langue
  est **persistée sur le compte** (`PreferenceUtilisateur.langue`). Référence :
  `apps/web/src/i18n/config.ts`.
- **ENF-06-02** — Les libellés métier (référentiels) se résolvent via i18n avec repli
  d'humanisation ; les dates/heures/nombres sont formatés selon la langue active
  (`apps/web/src/lib/intl.ts`). Référence : `apps/web/src/config/labels.ts`.
- **ENF-06-03** — *Couverture* : modules cliniques, menu/en-tête, paramètres, CGU/confidentialité,
  toasts traduits. Restes mineurs non traduits identifiés (zones Sauvegardes/Volumétrie/Terrain de
  la page Synchronisation, helper de temps relatif, quelques composants partagés) — *à confirmer /
  finaliser*.

## ENF-07 — Accessibilité & Responsive

- **ENF-07-01** — Socle responsive avec hook `useMediaQuery` + breakpoints. La **barre latérale
  passe en drawer mobile** (déclencheur hamburger dans le TopHeader) ; les split-panels (messagerie,
  triage) sont **empilés** (un panneau à la fois) sous 1024 px, avec bouton Retour ; la Modal est
  adaptative. Vérifié à 400 px de large. Référence : `apps/web/src/hooks/useMediaQuery`,
  `apps/web/src/stores/ui.store`.
- **ENF-07-02** — Les éléments de bascule sensibles exposent des rôles/états ARIA
  (ex. interrupteur du rideau : `role="switch"` + `aria-checked`). Référence :
  `apps/web/src/components/layout/TopHeader.tsx`.
- **ENF-07-03** — *Exigence détaillée WCAG (contrastes, navigation clavier complète, lecteurs
  d'écran)* : couverte partiellement par le design system ; conformité formelle WCAG 2.1 AA
  **à confirmer** (non auditée à ce jour).
- **ENF-07-04** — *Limite connue* : le composant tableau-cartes (DATA_TABLE_CARD) n'a pas été
  adapté au responsive (sticky). Référence : (traçabilité interne).

## ENF-08 — Documents A4 imprimables

- **ENF-08-01** — Les documents cliniques (ordonnance, bon d'examen, bon de pharmacie, certificat,
  certificat de repos, évacuation) utilisent un **gabarit A4 unifié** au thème SARIS (logo réel
  `/logo_cms_saris.png`), avec helpers de mise en page (PrintTable, Prose, Callout) et variantes
  `inline | modal`. Référence : `apps/web/src` (gabarit documents).
- **ENF-08-02** — L'aperçu est intégré à la **zone de droite** de la consultation (occupe la zone,
  pas une modale plein écran) pour les documents concernés. Référence : `apps/web/src` (gabarit documents).

## ENF-09 — Temps réel (SSE)

- **ENF-09-01** — Le temps réel repose sur **Server-Sent Events (SSE)** pour : notifications,
  messagerie (nouveaux messages, accusés de lecture `MESSAGE_STATUS`), **présence** des utilisateurs,
  **invalidations live** (référentiels/acteurs/bon-examen via `@LiveRefresh`/`broadcastLive`),
  activité de synchronisation et révocation de session. Référence :
  `apps/api/src/modules/notification` (flux SSE + `presence.service.ts`),
  `apps/web/src/hooks/useNotificationStream`.
- **ENF-09-02** — Le flux SSE est soumis au CORS (EventSource) : l'origine du client de bureau et
  les origines loopback sont explicitement autorisées (cf. ENF-04-07). Référence :
  `apps/api/src/main.ts`.
- **ENF-09-03** — La présence est mise à jour par heartbeat (depuis le listing des messages) et
  `Utilisateur.lastSeenAt` ; les accusés ont 3 états (envoyé / remis / lu). Référence :
  `apps/api/src/modules/notification/presence.service.ts`, `apps/api/src/modules/messagerie`.

## ENF-10 — Plancher matériel & logiciel (poste Windows)

- **ENF-10-01** — Le client de bureau cible **Windows** (installeur NSIS, schéma applicatif
  `app://cms-saris`). Runtime embarqué : **Electron 33** sur **Node 20.18**. Référence :
  `apps/desktop/electron`, [[_SOURCE_systeme]].
- **ENF-10-02 (contrainte runtime)** — Node 20.18 nécessite le flag `--experimental-require-module`
  pour charger des modules ESM-only via `require()` (sinon `ERR_REQUIRE_ESM` au boot du backend
  embarqué). Référence : `apps/desktop/electron/backend.ts` (`execArgv`).
- **ENF-10-03 (empreinte)** — L'installeur de référence pèse ≈ 135 Mo ; la base SQLite seedée
  embarquée ≈ 1,24 Mo ; installation **per-user** (pas de droits administrateur / UAC requis),
  installation visible. Référence : `apps/desktop/installer/cms-saris.nsi`,
  `apps/desktop/scripts/build-local.mjs`.
- **ENF-10-04** — Le backend embarqué force l'écoute sur **127.0.0.1** (jamais le LAN) sur un port
  dynamique. Référence : `apps/desktop/electron/main.ts`.
- **ENF-10-05** — *Configuration matérielle minimale chiffrée (RAM/CPU/disque)* : **à confirmer**
  (non spécifiée formellement ; contrainte = un poste Windows capable de faire tourner Electron 33
  et SQLite, avec l'espace disque pour la base répliquée globale et les médias de messagerie).

---

## Traçabilité

| ENF | Domaine | Source principale de vérité |
| --- | --- | --- |
| ENF-01 | Offline-first / sync | `apps/api/src/modules/sync`, `apps/web/src/lib/sync.ts`, `packages/types/src/sync-conflict.ts` |
| ENF-02 | Performance | `apps/api/src/main.ts`, hooks React Query |
| ENF-03 | Disponibilité | Render/Neon, crons `tombstone-purge` / sauvegardes |
| ENF-04 | Sécurité | `security.service.ts`, `jwt.strategy.ts`, `app.module.ts`, `main.ts`, `common/crypto/*` |
| ENF-05 | Confidentialité | `patient`, `sync-models.ts`, `PrivacyCurtain.tsx`, `permissions.ts` |
| ENF-06 | i18n | `apps/web/src/i18n/config.ts`, `labels.ts` |
| ENF-07 | Accessibilité/Responsive | `useMediaQuery`, `ui.store`, `TopHeader.tsx` |
| ENF-08 | Documents A4 | gabarit documents `apps/web/src` |
| ENF-09 | Temps réel SSE | `modules/notification`, `useNotificationStream` |
| ENF-10 | Plancher matériel | `apps/desktop/electron`, installeur NSIS |

> Toute valeur marquée « à confirmer » doit être levée avant la version 1.0 finale (validée).
