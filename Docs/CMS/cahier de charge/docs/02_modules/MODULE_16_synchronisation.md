# Module 16 — Synchronisation offline-first

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** V1 · **Historique** : v1.0 création

> Spécification « as-built » du module de synchronisation offline-first de CMS SARIS. Elle documente ce qui **existe réellement** dans le code (`apps/api/src/modules/sync`, `apps/web/src/lib/sync.ts`, `apps/web/src/hooks/useSyncEngine.ts`, `apps/desktop`) et reste alignée sur le brief canonique [[_SOURCE_systeme]], le [[plan_modules]], le [[modele_donnees_global]], les [[parametres_metier]] et le [[registre_decisions]]. Décisions structurantes portées : D-001, D-005, D-015, D-016, D-020 (cf. [[registre_decisions]]).

---

## 1. Mission et périmètre

### 1.1 Mission

Rapprocher les données d'un **poste local** (application desktop Electron en mode `local`, backend NestJS + SQLite embarqués) et du **serveur central** (API NestJS sur Render + PostgreSQL Neon, source de vérité — D-002), afin d'assurer la **continuité de service hors-ligne** et la **cohérence multi-poste** (D-001). Le mécanisme repose sur un **pull/push delta** avec résolution de conflit **Last-Write-Wins** (D-016, voir [[glossaire]] « LWW »), des **tombstones** de suppression logique (D-015) et un **curseur par poste** (`SyncState`).

Le module couvre deux réalités complémentaires dans le code :

- **Synchronisation du backend embarqué** (`apps/api/src/modules/sync`) : moteur serveur (`SyncService`), client embarqué (`SyncClientService`), supervision (`SyncSupervisionService`), purge des tombstones (`TombstonePurgeCron`), registre des modèles synchronisés (`sync-models.ts`), résolution de conflit (`conflict.ts`). C'est l'épine dorsale de la réplication d'entités Prisma entre SQLite (poste) et PostgreSQL (central).
- **File de rejeu du client web** (`apps/web/src/lib/sync.ts` + `useSyncEngine`) : capture des écritures dans une file IndexedDB **chiffrée**, rejouées vers les endpoints réels à la reconnexion (offline léger de la PWA). C'est un mécanisme **distinct** du moteur d'entités ci-dessus (rejeu de requêtes HTTP, pas d'application d'entités).

### 1.2 Périmètre couvert

- Pull delta du central vers le poste (réception des changements d'un site depuis un curseur).
- Push d'un lot de changements locaux vers le central, avec rapport applied/skipped/conflicts.
- Résolution de conflit déterministe LWW (sur `updatedAt`, avec `baseUpdatedAt`).
- Propagation des suppressions par tombstone (`deletedAt`) et purge planifiée côté central.
- Registre des modèles synchronisés avec leur **portée** (globale cross-site ou par site) — D-005.
- Supervision côté central : postes connus, journaux de cycles, conflits en attente (écran admin).
- Boucle de synchronisation du backend embarqué : bootstrap, sonde de joignabilité, filet périodique, backoff sur échec.
- Indicateur de « 1ʳᵉ synchro prête » (`/sync/ready`) pour l'ouverture fluide du desktop.
- File de rejeu IndexedDB chiffrée du client web (capture, rejeu ordonné, idempotence, purge).

### 1.3 Hors-périmètre (explicite)

- **UI client de résolution de conflits** : il n'en existe pas. Le serveur **journalise** les conflits (`ConflitSynchronisation`) et la supervision les **affiche** en lecture ; la résolution effective est faite par LWW automatiquement (réserve de D-016).
- **CRDT / merge champ-à-champ généralisé** : explicitement écarté (D-016). Le merge est au niveau enregistrement (le gagnant écrase).
- **Bascule de runtime central ⇄ local du desktop** : pilotée par le **process Electron** (`apps/desktop/electron`, online-first/offline-fallback — D-020), pas par ce module backend. Elle est documentée ici comme interface consommée, ses paramètres relevant de [[parametres_metier]] (PM-24 à PM-30).
- **Stockage sécurisé local, auto-update, installeur NSIS** : relèvent du module desktop ([[modele_operationnel]]), hors du moteur de sync.
- **Sauvegarde / restauration de configuration et volumétrie** : portées par le module `admin`/`parametres` (`SauvegardeSysteme`, permission `synchronisation.restore`) ; l'écran « Synchronisation » côté admin les agrège mais la mécanique de backup n'est pas décrite ici. *(À confirmer : périmètre exact de l'écran admin Synchronisation, hors fichiers `sync/`.)*
- **Définition des paramètres métier configurables** : centralisée dans [[parametres_metier]] ; ce document ne redéfinit aucune valeur chiffrée.

---

## 2. Acteurs et rôles

| Acteur | Rôle vis-à-vis du module |
| --- | --- |
| **Poste local (compte de service)** | Identité technique du backend embarqué pour appeler `/sync/pull` et `/sync/push`. Authentifié par un JWT de service (`SERVER_SYNC_TOKEN` / `SERVER_SYNC_TOKEN_FILE`), **non révoqué** car porteur d'un `posteLocalId` (exemption de session unique — D-021). Le site est **résolu depuis le JWT**, jamais depuis la requête. |
| **ADMIN_SYSTEME** | Possède toutes les permissions du catalogue ; consulte la supervision de synchronisation (`synchronisation.read`), peut déclencher un cycle (`synchronisation.execute`) et restaurer une sauvegarde (`synchronisation.restore`). Voir [[MODULE_02_acces_habilitations]] et D-004. |
| **MEDECIN_CHEF / MEDECIN / INFIRMIER** | N'interviennent pas directement sur le moteur. Ils profitent de la synchronisation de façon transparente (continuité des données hors-ligne via le poste local) et de la **file de rejeu web** lors d'écritures hors-ligne sur la PWA. L'accès aux endpoints `/sync/*` dépend de la détention des permissions `synchronisation.*` (cf. [[MODULE_02_acces_habilitations]] — attribution exacte par rôle **à confirmer** sur `permissions.ts`). |

> Les **catégories de patient** n'ont pas de rôle propre dans ce module ; elles influent en revanche sur la **portée** des entités répliquées (le dossier patient est global cross-site — D-005).

---

## 3. Exigences fonctionnelles (EF-16-xx)

| ID | Exigence (vérifiable) | Source code |
| --- | --- | --- |
| **EF-16-01** | Le central expose `GET /sync/pull` renvoyant les changements d'un site postérieurs à un curseur `since` (ISO 8601), paginés, tombstones inclus, avec `serverTime`, `hasMore` et `nextSince`. | `sync.controller.ts`, `sync.service.ts#pull` |
| **EF-16-02** | Le central expose `POST /sync/push` acceptant un lot de changements (`{ posteLocalId, changes[] }`) et renvoyant `{ applied[], skipped[], conflicts[], serverTime }`. | `sync.controller.ts`, `sync.service.ts#push` |
| **EF-16-03** | Le site ciblé par pull et push est **résolu depuis le JWT** de l'appelant et jamais lu depuis la requête (anti-fuite cross-site). | `sync.controller.ts#requireUser` |
| **EF-16-04** | `GET /sync/pull` et `GET /sync/supervision`/`GET /sync/status` exigent la permission `synchronisation.read` ; `POST /sync/push` et `POST /sync/run` exigent `synchronisation.execute`. | `sync.controller.ts` (`@RequirePermissions`) ; voir PM-47 / [[parametres_metier]] |
| **EF-16-05** | Le pull lit via un **client Prisma brut** (non filtré soft-delete) afin d'inclure les tombstones, et neutralise l'auto-filtre (`deletedAt: undefined`). | `sync.service.ts#delegate`, `#pull` |
| **EF-16-06** | Les changements pull sont ordonnés **par modèle dans l'ordre du registre** (parents avant enfants) pour respecter les contraintes de clés étrangères à l'ingestion, et non par `updatedAt`. | `sync.service.ts#pull`, `sync-models.ts` |
| **EF-16-07** | Chaque enregistrement répliqué est transporté dans une **enveloppe** `{ model, id, op (upsert/delete), data, updatedAt, deletedAt }`, l'`id` étant la clé simple ou composite jointe par `::`. | `sync.service.ts#toEnvelope` |
| **EF-16-08** | L'ingestion d'un delta applique une **résolution de conflit LWW** : applique si absent ou plus récent sans divergence de base, signale un conflit si l'enregistrement serveur a bougé depuis la base, ignore si plus ancien ou égal. | `sync.service.ts#ingest`, `conflict.ts#resolveConflict` |
| **EF-16-09** | À l'écriture d'un delta gagnant, le moteur restaure l'`updatedAt` **source** (et le `deletedAt` source pour les modèles tombstone-able) par SQL brut, après l'`upsert`, pour ne pas casser la chronologie LWW. | `sync.service.ts#applyEnvelope` |
| **EF-16-10** | Un modèle au scope invalide lors d'un pull est **ignoré avec log** sans interrompre toute la synchronisation. | `sync.service.ts#pull` (try/catch par modèle) |
| **EF-16-11** | Le registre des modèles synchronisés fixe, par modèle, le **délégué** Prisma, la **portée** (globale ou par site) et les **champs de clé primaire**. | `sync-models.ts` |
| **EF-16-12** | Le **dossier patient et tout le parcours de soin** (Patient, identité, allergies, antécédents, alertes, visites, consultations, ordonnances, bons, évacuations, etc.) ainsi que `PersonnelMedical` et les référentiels partagés sont répliqués en **portée GLOBALE** (cross-site). | `sync-models.ts` (cf. D-005) |
| **EF-16-13** | Les **comptes** (`Utilisateur` et liaisons), le **RH opérationnel** (planning, présence, délégation) et la **messagerie** sont répliqués **par site**. | `sync-models.ts` (`BY_SITE`, `VIA`) |
| **EF-16-14** | Le backend **embarqué** lance une synchro initiale au démarrage, sonde périodiquement la joignabilité du central et déclenche une synchro **immédiate** à la transition hors-ligne → en ligne ; un filet périodique espacé rattrape les changements manqués. | `sync-client.service.ts#onApplicationBootstrap`, `#probe` ; PM-31/32/33 |
| **EF-16-15** | Un cycle exécute **pull puis push**, est **anti-recouvrement** (un seul cycle à la fois) et applique un **backoff exponentiel borné** sur échec/injoignabilité. | `sync-client.service.ts#runCycle`, `#triggerSync` ; PM-35 |
| **EF-16-16** | Le client embarqué **persiste le curseur** (`SyncState.lastPulledAt`/`lastPushedAt`) après chaque page appliquée pour reprendre exactement où il s'est arrêté en cas d'interruption. | `sync-client.service.ts#pull`, `#saveCursor` |
| **EF-16-17** | Le jeton de synchro est relu à chaque cycle depuis un **fichier** (`SERVER_SYNC_TOKEN_FILE`) si présent (rotation sans redémarrage), sinon depuis l'env `SERVER_SYNC_TOKEN`. | `sync-client.service.ts#token` ; PM-29 |
| **EF-16-18** | Le central enregistre, à chaque lot reçu d'un poste, le **poste** (dernière synchro), un **journal** de cycle, les **conflits détaillés** et l'**état par poste**, puis pousse un événement temps réel `SYNC_ACTIVITY` (SSE) vers la supervision. | `sync-supervision.service.ts#record` |
| **EF-16-19** | `GET /sync/supervision` renvoie, par site : les postes (en ligne / hors-ligne + dernière synchro), l'activité récente (30 journaux) et les conflits en attente (50 max). | `sync-supervision.service.ts#getSupervision` |
| **EF-16-20** | Un poste est réputé « en ligne » s'il s'est synchronisé dans les **3 dernières minutes**. | `sync-supervision.service.ts` (`ONLINE_WINDOW_MS`) — *valeur as-built, à intégrer à [[parametres_metier]] si besoin* |
| **EF-16-21** | Une purge planifiée supprime **physiquement** les tombstones anciens côté central uniquement, en ne purgeant que ce que **tous les postes ont déjà vu** (`deletedAt < min(SyncState.lastPulledAt)` et < rétention). | `tombstone-purge.cron.ts` ; PM-36 |
| **EF-16-22** | `GET /sync/ready` (loopback, public) indique si la **1ʳᵉ synchro** est faite, pour que le desktop n'ouvre l'application qu'une fois les données du site présentes. | `sync-ready.controller.ts`, `sync-client.service.ts#ready` ; PM-27/28 |
| **EF-16-23** | `GET /sync/status` renvoie l'état serveur (site, nombre de modèles, online, pendingPush) **et** l'état du client embarqué (enabled, online, ready, curseurs). | `sync.controller.ts#status`, `sync-client.service.ts#clientStatus` |
| **EF-16-24** | Côté **web (PWA)**, toute écriture (POST/PATCH/PUT/DELETE) effectuée hors-ligne est **capturée** dans une file IndexedDB, le payload (`{method, path, body}`) étant **chiffré AES-256-GCM** au repos (repli en clair anti-perte si la clé est indisponible, avec avertissement). | `apps/web/src/lib/sync.ts#enqueueMutation` ; PM-45 |
| **EF-16-25** | À la reconnexion, la file web est **rejouée dans l'ordre** (`ordreLocal` croissant) vers les endpoints réels (réutilisant validation/permissions serveur), chaque mutation portant un `mutationUuid` unique (idempotence). | `sync.ts#syncPush`, `useSyncEngine` |
| **EF-16-26** | Lors du rejeu web : un 2xx marque APPLIED ; un 4xx (≠ 401) marque REJECTED (rejet métier définitif) ; un 401 suspend le cycle sans rejeter (après une tentative de refresh) ; un 5xx/réseau arrête le cycle en laissant la file intacte. | `sync.ts#syncPush` |
| **EF-16-27** | L'écran Synchronisation web peut **lister**, **purger** et **rejouer** (REJECTED → PENDING + relance) les mutations de la file locale. | `sync.ts#listMutations/#purgeMutations/#retryRejected` |

---

## 4. Cas d'utilisation (CU-16-xx)

### CU-16-01 — Synchronisation périodique d'un poste local (nominal)

- **Acteur** : poste local (backend embarqué).
- **Déclencheur** : bootstrap, sonde de joignabilité, filet périodique ou transition en ligne.
- **Scénario nominal** :
  1. Le client vérifie la joignabilité du central (`GET /health`).
  2. Il exécute un **pull** : pages successives `/sync/pull?since=…`, ingestion delta par delta (LWW), persistance du curseur après chaque page.
  3. Il exécute un **push** : collecte des changements locaux depuis `lastPushedAt`, envoi en lot à `/sync/push`, mise à jour du curseur sur `serverTime`.
  4. Le central trace le cycle et diffuse `SYNC_ACTIVITY`.
- **Scénarios d'erreur** :
  - *Central injoignable* → `runCycle` renvoie `null`, backoff borné, nouvelle sonde plus tard (la file locale reste intacte).
  - *Cycle déjà en cours* → anti-recouvrement, le nouvel appel est ignoré.
  - *Modèle au scope invalide* → ignoré + log, le reste passe.
- **Hors-ligne** : c'est le **mode normal** du poste local ; il continue à servir l'application sur SQLite et reprendra la synchro à la reconnexion (curseur conservé).
- **Critères** :
  - *Étant donné* un poste hors-ligne ayant des écritures locales, *quand* le central redevient joignable, *alors* une synchro immédiate est déclenchée et les changements sont poussés puis confirmés.
  - *Étant donné* un pull interrompu en cours, *quand* la connexion revient, *alors* la reprise repart du dernier `nextSince` persisté (aucun re-traitement complet).

### CU-16-02 — Résolution d'un conflit d'écriture concurrente (LWW)

- **Acteur** : `SyncService` (central) à l'ingestion d'un delta poussé.
- **Déclencheur** : `POST /sync/push` contenant un enregistrement modifié des deux côtés.
- **Scénario nominal** : `resolveConflict` compare `updatedAt` entrant, `updatedAt` serveur et `baseUpdatedAt`. Si l'entrant est plus récent **et** que le serveur a bougé depuis la base → conflit `winner: incoming` (appliqué) ; si l'entrant est plus ancien et le serveur a bougé → conflit `winner: existing` (non appliqué). Le conflit est journalisé (`ConflitSynchronisation`, valeur locale vs serveur).
- **Scénarios d'erreur** :
  - *Modèle inconnu du registre* → delta ignoré (`skip`), non appliqué.
  - *Échec de la traçabilité* → loggé en warning, n'interrompt pas la synchro (la sync prime sur la trace).
- **Hors-ligne** : N/A (côté central uniquement).
- **Critères** :
  - *Étant donné* un enregistrement modifié sur deux postes, *quand* les deux poussent, *alors* la version au `updatedAt` le plus récent l'emporte et le conflit est tracé pour supervision.
  - *Étant donné* un delta strictement plus ancien sans divergence serveur, *quand* il est ingéré, *alors* il est **ignoré** (skip) et signalé dans `skipped[]`.

### CU-16-03 — Propagation et purge d'une suppression (tombstone)

- **Acteur** : moteur de sync + `TombstonePurgeCron` (central).
- **Déclencheur** : suppression logique d'un enregistrement (soft-delete bi-cible — D-015), puis cron quotidien.
- **Scénario nominal** : la suppression pose `deletedAt` ; le pull renvoie le tombstone (op `delete`) ; chaque poste applique la suppression ; le cron (à l'heure planifiée, voir PM-36) purge **physiquement** les tombstones plus anciens que la rétention **et** que le plus petit `lastPulledAt` des postes.
- **Scénarios d'erreur** :
  - *Un poste n'a pas encore pull* (lastPulledAt ancien) → la borne `min(lastPulledAt)` **empêche** la purge prématurée (anti-résurrection).
  - *Modèle sans colonne `deletedAt`* → DELETE ignoré (try/catch).
  - *Exécution sur SQLite (poste)* → purge **désactivée** (le central fait foi).
- **Hors-ligne** : la suppression se propage au retour réseau comme tout delta.
- **Critères** :
  - *Étant donné* un enregistrement supprimé, *quand* un poste se synchronise, *alors* il reçoit le tombstone et applique la suppression localement.
  - *Étant donné* un poste en retard de pull, *quand* le cron s'exécute, *alors* les tombstones non encore vus par ce poste ne sont **pas** purgés.

### CU-16-04 — Supervision de la synchronisation (administrateur)

- **Acteur** : ADMIN_SYSTEME (ou détenteur de `synchronisation.read`).
- **Déclencheur** : ouverture de l'écran de supervision / réception SSE `SYNC_ACTIVITY`.
- **Scénario nominal** : `GET /sync/supervision` renvoie les postes du site (statut en ligne / dernière synchro), les 30 derniers journaux et les conflits en attente ; l'écran se rafraîchit en temps réel à chaque cycle reçu.
- **Scénarios d'erreur** :
  - *Aucun poste enregistré* → listes vides (premier déploiement).
  - *Permission absente* → 403 (garde `synchronisation.read`).
- **Hors-ligne** : la supervision est une fonction **du central** ; sans connexion au central, elle n'est pas disponible.
- **Critères** :
  - *Étant donné* un poste synchronisé il y a moins de 3 minutes, *quand* l'admin consulte la supervision, *alors* ce poste est marqué « en ligne ».
  - *Étant donné* un cycle avec conflits, *quand* il est reçu, *alors* un journal de statut « CONFLITS » et les conflits détaillés apparaissent.

### CU-16-05 — Écriture hors-ligne et rejeu différé sur la PWA (web)

- **Acteur** : soignant utilisant le client web (PWA).
- **Déclencheur** : écriture (création/modification/suppression) alors que le réseau est indisponible.
- **Scénario nominal** : la requête est capturée et chiffrée dans IndexedDB (`file_mutations`, statut PENDING) ; un badge indique les mutations en attente ; à la reconnexion, `useSyncEngine` rejoue la file dans l'ordre vers les endpoints réels, puis invalide les caches React Query pour rafraîchir l'affichage ; les mutations traitées (APPLIED/REJECTED) sont purgées.
- **Scénarios d'erreur** :
  - *Clé de chiffrement indisponible* → repli en clair local avec avertissement (anti-perte).
  - *Payload illisible/indéchiffrable* → mutation marquée REJECTED, file non bloquée.
  - *401 au rejeu* → une tentative de refresh ; si la session est morte, cycle suspendu, file intacte, redirection login.
  - *4xx métier* → REJECTED (pas de rejeu en boucle) ; *5xx/réseau* → cycle arrêté, file conservée.
- **Hors-ligne** : c'est le cas d'usage **central** de la file web ; les GET sont servis par le service worker (NetworkFirst).
- **Critères** :
  - *Étant donné* une création faite hors-ligne, *quand* la connexion revient, *alors* elle est rejouée et confirmée par le serveur, puis l'affichage est rafraîchi.
  - *Étant donné* une mutation rejetée pour raison métier, *quand* l'utilisateur la **relance** depuis l'écran Synchronisation, *alors* elle repasse PENDING et un nouveau cycle est tenté.

### CU-16-06 — Ouverture fluide du desktop après 1ʳᵉ synchro

- **Acteur** : process Electron (desktop) + backend embarqué.
- **Déclencheur** : démarrage de l'application desktop.
- **Scénario nominal** : Electron démarre le backend embarqué, attend la santé du backend, puis interroge `GET /sync/ready` ; tant que `ready` est faux, il patiente (dans la limite d'un délai), puis ouvre la fenêtre une fois la 1ʳᵉ synchro aboutie (données du site présentes).
- **Scénarios d'erreur** :
  - *Central injoignable au 1er lancement* → après le délai d'attente (voir PM-27), l'application s'ouvre quand même (mode hors-ligne) ; `ready` deviendra vrai au 1er pull réussi.
- **Hors-ligne** : pris en charge — l'ouverture n'est pas bloquée indéfiniment.
- **Critères** :
  - *Étant donné* un central joignable, *quand* le desktop démarre, *alors* la fenêtre n'apparaît qu'après le 1er pull (pas d'écran « à vide »).
  - *Étant donné* un central injoignable, *quand* le délai d'attente expire, *alors* l'application s'ouvre en mode local.

---

## 5. Données du module

Les entités sont définies dans [[modele_donnees_global]] (§3.9 « Synchronisation offline-first »). Entités propres au module et utilisées par le code de `sync/` :

- **`SyncState`** — curseur de synchronisation par couple (`posteLocalId`, `siteId`), champs `lastPulledAt` / `lastPushedAt`. Lu/écrit par `SyncClientService` (poste) et `SyncSupervisionService` (central). Sert aussi de borne anti-résurrection à la purge.
- **`PosteLocal`** — poste/appareil enregistré (`id`, `siteId`, `libelle`, `derniereSyncAt`). Renseigné par `record()` au central.
- **`JournalSynchronisation`** — trace d'un cycle reçu (`startedAt`, `finishedAt`, `statut` REUSSIE/CONFLITS, `nbMutations`, `nbConflits`).
- **`ConflitSynchronisation`** — conflit détaillé (`mutationUuid`, `entiteType`, `entiteId`, `typeConflit` LOCAL_GAGNE/SERVEUR_GAGNE, `valeurLocale`, `valeurServeur`, `statut` EN_ATTENTE).
- **`FileMutation`** — *côté web*, mutation locale rejouable (`mutationUuid`, `module`, `entiteType`, `entiteId`, `action`, `payloadJson` **chiffré**, `statut` PENDING/APPLIED/REJECTED, `ordreLocal`). Persistée dans IndexedDB (`db.file_mutations`), pas en base relationnelle.
- **Entités répliquées** : toute entité du registre `sync-models.ts` (référentiels, dossier patient, parcours de soin, comptes, RH, messagerie). Le registre fixe leur portée (cf. EF-16-11/12/13). Le transport utilise leurs colonnes de sync `updatedAt` / `deletedAt` (voir conventions [[modele_donnees_global]] §1).

> Le **`SyncEntityEnvelope`** (enveloppe de transport) et les réponses pull/push (`SyncPullResponseV2`, `SyncPushResponseV2`) sont des **types partagés** (`@cms-saris/types/sync`), pas des tables.

---

## 6. Règles métier (RM-16-xx)

| ID | Règle | Renvoi paramètre / décision |
| --- | --- | --- |
| **RM-16-01** | La résolution de conflit est **Last-Write-Wins** sur `updatedAt`, avec `baseUpdatedAt` pour distinguer un vrai conflit d'une simple application. Le gagnant écrase au niveau enregistrement (pas de merge champ-à-champ). | D-016 ; `conflict.ts` |
| **RM-16-02** | Après application d'un delta, l'`updatedAt` (et le `deletedAt` pour les modèles tombstone-able) **source** est restauré par SQL brut : `@updatedAt` automatique ne doit pas ré-horodater (sinon LWW faussé). | `sync.service.ts#applyEnvelope` |
| **RM-16-03** | Le **dossier patient + parcours de soin + `PersonnelMedical` + référentiels** sont GLOBAUX (cross-site) : chaque poste détient tout, condition de la continuité cross-site hors-ligne. La confidentialité reste assurée par le **verrou médecin-chef** appliqué côté API (y compris backend local). | D-005, D-006 ; `sync-models.ts` |
| **RM-16-04** | Les **comptes**, le **RH opérationnel** et la **messagerie** restent cloisonnés **par site**. | D-005 ; `sync-models.ts` |
| **RM-16-05** | Le **site** de pull/push est dérivé du **JWT**, jamais de la requête (cloisonnement strict). | EF-16-03 ; `sync.controller.ts` |
| **RM-16-06** | Les changements pull sont émis **dans l'ordre des dépendances** (parents avant enfants) pour satisfaire les clés étrangères à l'ingestion. | EF-16-06 ; `sync-models.ts` |
| **RM-16-07** | La purge des tombstones ne supprime physiquement que ce que **tous les postes ont déjà vu** (`deletedAt < min(lastPulledAt)` borné par la rétention), et **uniquement côté central** (jamais sur un poste SQLite). | D-015 ; PM-36 ; `tombstone-purge.cron.ts` |
| **RM-16-08** | La rétention des tombstones avant purge est de **90 jours**. | `tombstone-purge.cron.ts` (`retentionDays = 90`) — *valeur as-built ; à confirmer/intégrer dans [[parametres_metier]]* |
| **RM-16-09** | Un cycle de synchro est **anti-recouvrement** (un seul à la fois) et **best-effort** (un échec ne bloque rien : backoff borné, file conservée). | EF-16-15 ; PM-35 ; `sync-client.service.ts` |
| **RM-16-10** | Le client embarqué est **actif uniquement** si `SERVER_URL` est défini, `DATABASE_PROVIDER=sqlite` et `SITE_ID` présent ; sinon il est inerte (mode serveur central). | `sync-client.service.ts#enabled` |
| **RM-16-11** | Le jeton de service du poste **n'est pas révoqué** (porteur d'un `posteLocalId`) ; la révocation immédiate reste effective pour les sessions applicatives ordinaires. | D-021 |
| **RM-16-12** | La **traçabilité** (poste, journal, conflits, état) ne doit **jamais** casser la synchronisation : toute erreur d'écriture de trace est avalée en warning. | `sync-supervision.service.ts#record` |
| **RM-16-13** | Côté web, le payload d'une mutation en file est **chiffré AES-256-GCM** au repos ; en cas d'indisponibilité de clé, repli en clair **avec avertissement** (la perte de donnée est jugée pire que le clair local). | PM-45 ; `apps/web/src/lib/sync.ts#enqueueMutation` |
| **RM-16-14** | Au rejeu web, une **401** ne purge **jamais** la mutation (≠ rejet métier) : la file reste PENDING ; seuls les **4xx métier** marquent REJECTED. | EF-16-26 ; `sync.ts#syncPush` |
| **RM-16-15** | Le rejeu web respecte l'**ordre** (`ordreLocal` croissant) et l'**idempotence** (`mutationUuid`), et réutilise les endpoints réels (aucun moteur d'application parallèle côté client). | `sync.ts` |
| **RM-16-16** | Un poste est « en ligne » côté supervision s'il s'est synchronisé dans une fenêtre de **3 minutes**. | EF-16-20 ; `sync-supervision.service.ts` |

> Toutes les durées/intervalles/timeouts chiffrés (sonde, filet, backoff, timeout requête, attente 1ʳᵉ synchro, purge, rejeu web) sont définis dans [[parametres_metier]] : **PM-20 à PM-36** (connectivité & synchronisation), **PM-23** (cycle de rejeu web), **PM-45** (chiffrement). Ce document ne les redéfinit pas.

---

## 7. Interfaces

### 7.1 Endpoints exposés (HTTP)

| Méthode | Route | Permission | Description |
| --- | --- | --- | --- |
| GET | `/sync/pull` | `synchronisation.read` | Deltas du site depuis `since` (paginés, tombstones inclus). |
| POST | `/sync/push` | `synchronisation.execute` | Applique un lot de changements, renvoie applied/skipped/conflicts. |
| GET | `/sync/supervision` | `synchronisation.read` | Postes, journaux récents, conflits en attente (par site). |
| GET | `/sync/status` | `synchronisation.read` | État serveur + client embarqué. |
| POST | `/sync/run` | `synchronisation.execute` | Déclenche un cycle (mode local embarqué ; no-op sinon). |
| GET | `/sync/ready` | *(public, loopback)* | Indique si la 1ʳᵉ synchro est faite (ouverture fluide desktop). |

### 7.2 Contrats inter-modules (cf. [[plan_modules]])

- **C-12 — Synchronisation offline-first** : entités marquées sync ↔ module `sync` (pull/push LWW, tombstones, curseur `SyncState`) ; supervision de la file terrain agrégée côté `admin`.
- **C-8 — Notification temps réel** : `sync → notification` ; `SyncModule` importe `NotificationModule` pour diffuser `SYNC_ACTIVITY` (SSE) à la supervision (`broadcastLive`).
- **C-9 — Authentification & autorisation** : `sync` protégé par les gardes globales exportées par `SecurityModule` (`JwtAuthGuard`, `PermissionsGuard`).

### 7.3 Consommations / dépendances

- **`SecurityModule`** (imports) : gardes JWT + permissions, résolution du site depuis le JWT.
- **`NotificationModule`** (imports) : événement temps réel de supervision.
- **`PrismaService`** : accès base, avec un **accesseur `raw`** (client brut non filtré soft-delete) indispensable pour voir/écrire les tombstones (EF-16-05) et la purge physique.
- **Variables d'environnement** (posées par Electron pour le backend embarqué) : `DATABASE_PROVIDER`, `SERVER_URL`, `SERVER_SYNC_TOKEN` / `SERVER_SYNC_TOKEN_FILE`, `POSTE_LOCAL_ID`, `SITE_ID`, `SYNC_PROBE_SEC`, `SYNC_SAFETY_SEC`.
- **Process Electron (desktop)** : consomme `/sync/ready` et `/health` ; gère la bascule central ⇄ local (D-020) — interface **consommée**, hors de ce module.

### 7.4 Interface web (file de rejeu)

- `enqueueMutation`, `syncCycle`/`syncPush`/`syncPull`, `listMutations`, `purgeMutations`, `retryRejected`, `refreshPendingCount` (`apps/web/src/lib/sync.ts`) ; orchestrés par `useSyncEngine` (montage unique dans l'AppShell). Stores Zustand : `useSyncStore`, `useNetworkStore`, `useSessionStore`.

---

## 8. Exigences non fonctionnelles spécifiques

- **Résilience / best-effort** : aucun échec de cycle ne doit bloquer l'application ; backoff borné, file conservée, anti-recouvrement (RM-16-09).
- **Idempotence & non-perte** : `mutationUuid` (web) et upsert (entités) garantissent qu'un rejeu n'introduit pas de doublon ; une mutation reste PENDING tant qu'elle n'a pas reçu un verdict 2xx/4xx définitif (web).
- **Reprise sur interruption** : curseur persisté par page (EF-16-16) — une coupure réseau ne fait pas reperdre tout le pull.
- **Sécurité** : cloisonnement par site dérivé du JWT (RM-16-05) ; jeton de service en fichier rotatif (EF-16-17) ; payload web chiffré au repos (RM-16-13) ; `/sync/ready` non authentifié mais **loopback-only** et sans donnée sensible.
- **Cohérence FK** : ordre parents→enfants à l'ingestion (RM-16-06) ; conséquences du soft-delete bi-cible connues (plus de cascade FK DB — réserve de D-015).
- **Anti-résurrection** : purge bornée par `min(lastPulledAt)` (RM-16-07).
- **Temps réel** : la supervision se rafraîchit via SSE `SYNC_ACTIVITY` à chaque cycle reçu.
- **Compatibilité provider** : double cible PostgreSQL (central) / SQLite (poste), avec aiguillage des placeholders SQL et du comportement de purge selon `DATABASE_PROVIDER`.

---

## 9. Risques et points ouverts

- **Validation runtime** : le code source signale lui-même que plusieurs comportements (ordre FK parent→enfant à l'application, binding `Date` selon provider, restauration de l'`updatedAt` source, gros volumes, auth de service) sont **structurés/typés mais à valider en environnement réel** (base + ≥ 2 postes). Cf. en-têtes de `sync.service.ts` et `sync-client.service.ts`.
- **Valeurs as-built non encore référencées dans [[parametres_metier]]** : fenêtre « poste en ligne » = 3 min (RM-16-16) et rétention tombstones = 90 jours (RM-16-08). À intégrer comme PM dédiés pour respecter la source unique des chiffres.
- **Pas d'UI de résolution de conflits** : les conflits sont automatiquement tranchés (LWW) et seulement **journalisés/affichés** ; un opérateur ne peut pas arbitrer manuellement (réserve assumée de D-016).
- **Deux mécanismes de « sync » distincts** : moteur d'entités (backend embarqué) vs file de rejeu de requêtes (web). Ils ne partagent pas le même chemin ; veiller à ne pas les confondre en exploitation (le web ne réplique pas d'entités, il rejoue des requêtes HTTP).
- **Périmètre de l'écran admin « Synchronisation »** (sauvegardes config, volumétrie, restauration via `synchronisation.restore`) : **à confirmer**, car porté hors des fichiers `sync/` (module `admin`/`parametres`).
- **Attribution exacte des permissions `synchronisation.*` par rôle** : à confirmer sur `packages/types/src/permissions.ts` (cf. [[MODULE_02_acces_habilitations]]) ; le décompte global de permissions présente un écart documenté (PM-47, « à confirmer »).
- **Régularisation migrations** (réserve transverse D-009/D-023) : re-baseline des migrations au déploiement, susceptible d'affecter l'allow-list soft-delete et donc l'ensemble synchronisé.

---

> Sources : code réel `apps/api/src/modules/sync/*` (controller, service, client, supervision, conflict, dto, cron, ready, models), `apps/web/src/lib/sync.ts`, `apps/web/src/hooks/useSyncEngine.ts`, catalogue `packages/types/src/permissions.ts`. Faits décisionnels : [[registre_decisions]] (D-001, D-005, D-006, D-015, D-016, D-020, D-021). Chiffres : [[parametres_metier]]. Entités : [[modele_donnees_global]]. Termes : [[glossaire]].
