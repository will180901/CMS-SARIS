# Document 09 — Synchronisation Offline-First, Sauvegarde & Restauration

> **Statut de réalisation : RÉALISÉ (as-built).** Le présent document décrit l'état réel de l'application CMS SARIS, vérifié sur le code source. Il distingue explicitement ce qui est **réalisé** de ce qui relève d'une **extension future**.

---

## 1. Objectif

Permettre aux centres médicaux SARIS de continuer à travailler **même sans connexion réseau**, puis de synchroniser les données **sans perte ni doublon** lorsque la connexion revient. Ce module couvre deux volets complémentaires :

1. **Offline-first côté poste** — l'application web est une PWA (Progressive Web App) entièrement utilisable hors-ligne : l'interface est pré-mise en cache, les lectures déjà consultées restent disponibles, et toute écriture effectuée hors-ligne est mise en file pour rejeu automatique au retour réseau.
2. **Sauvegarde & restauration côté serveur** — sauvegarde **réelle** de la configuration (référentiels, matrice rôles → permissions, paramètres système) avec restauration **non destructive**, planification automatique quotidienne et rétention.

> L'offline-first est un choix **architectural**, pas un simple bonus : il conditionne la conception du client API, du service worker et de la file de mutations.

---

## 2. Acteurs concernés

| Acteur | Rôle vis-à-vis de la synchronisation |
|---|---|
| Tous les utilisateurs | Travaillent en mode hors-ligne de façon transparente ; voient l'indicateur d'état réseau et le compteur de mutations en attente. |
| Administrateur système (`ADMIN_SYSTEME`) | Supervise l'état du système, déclenche/restaure les sauvegardes, force un cycle de synchronisation, lance la ré-encryption de la messagerie. |
| Administrateur médical (`ADMIN_MEDICAL`) | Acteur de référence pour la résolution de conflits métier (volet conflits = extension future, voir §13). |

Les rôles du système CMS SARIS sont au nombre de **6** : `ADMIN_SYSTEME`, `ADMIN_MEDICAL`, `MEDECIN_CHEF`, `INFIRMIER`, `INFIRMIER_DELEGUE`, `AGENT_RH`.

---

## 3. Données manipulées

### 3.1 Côté poste (IndexedDB, via Dexie.js)

La base locale `cms-saris-db` (Dexie) stocke :

- **File de mutations** (`file_mutations`) — chaque écriture hors-ligne sous forme de requête rejouable `{ method, path, body }`, avec UUID d'idempotence, module dérivé, action (`CREATE` / `UPDATE` / `CLOSE` / `DELETE`), statut et ordre local.
- **Journal de synchronisation local** (`journal_sync`).
- **Cache de données métier modifiables hors-ligne** : patients, identités, allergies, alertes médicales, contacts d'urgence, visites, consultations.
- **Cache de référentiels en lecture seule** : catégories patient, motifs de consultation, médicaments, pathologies, sites.

### 3.2 Côté serveur (PostgreSQL, via Prisma)

Tables techniques du schéma (groupe **Sync/technique**, 8 tables) :

| Table | Rôle |
|---|---|
| `PosteLocal` | Poste/appareil rattaché à un site, avec date de dernière synchronisation. |
| `FileMutation` | Représentation serveur d'une mutation (UUID, module, entité, action, payload, statut, ordre local, horodatages d'envoi/ACK). |
| `JournalSynchronisation` | Cycle de synchronisation (nb mutations, nb conflits, statut). |
| `ConflitSynchronisation` | Conflit détecté (valeur locale vs valeur serveur, type, statut). |
| `ResolutionConflit` | Résolution d'un conflit (résolution, auteur, justification, date). |
| `AlerteTechnique` | Alerte technique (file trop grande, échec…). |
| `ParametreMetier` | Paramètre métier versionnable. |
| `HistoriqueParametreMetier` | Historique de modification des paramètres métier. |

Table de sauvegarde (groupe **Sécurité/Admin/Audit**) :

| Table | Rôle |
|---|---|
| `SauvegardeSysteme` | Sauvegarde réelle : `type` (MANUELLE / AUTOMATIQUE), `statut` (EN_COURS / REUSSIE / ECHEC), `perimetre` (CONFIGURATION), `contenuJson` (snapshot), `taille`, `declenchePar`, `createdAt`, `finishedAt`, `message`. |

---

## 4. Architecture offline-first (RÉALISÉ)

### 4.1 PWA et service worker (Workbox)

L'application web est packagée en PWA via **`vite-plugin-pwa` (Workbox)** :

- **App shell pré-caché** : tout le bundle (`js, css, html, svg, woff, woff2, ttf, png, ico`) est pré-mis en cache → l'application se charge intégralement sans réseau.
- **Fallback SPA** : toute navigation inconnue retombe sur `index.html` (déjà pré-caché) ; `/api` et `/health` en sont exclus.
- **Stratégies de cache runtime** :
  - **GET API → `NetworkFirst`** (cache `saris-api-get`, timeout réseau 5 s, 400 entrées max, rétention 7 j) : les données déjà consultées restent lisibles hors-ligne. Exclut `/health`, `/auth` et le flux SSE `/notifications/stream`.
  - **Polices & images → `StaleWhileRevalidate`** (cache `saris-assets`).
  - **`ffmpeg.wasm` → `CacheFirst`** (cache `saris-ffmpeg`) : le cœur ~30 Mo n'est pas pré-caché mais conservé dès le premier usage, rendant la découpe vidéo disponible hors-ligne ensuite.
- **Manifeste** : nom, icônes 192/512 (dont maskable), thème `#4E8BA4`, affichage `standalone`, langue `fr`. Installable sur poste/mobile.
- La PWA est **désactivée en développement** (évite les surprises de cache pendant le HMR) et active dès le build/preview.

### 4.2 Capture des écritures hors-ligne (`apps/web/src/lib/sync.ts`)

Stratégie de **rejeu de requêtes** plutôt que moteur d'application parallèle :

- Hors-ligne, toute écriture (POST / PATCH / PUT / DELETE) est capturée par `enqueueMutation()` et stockée dans IndexedDB (`file_mutations`) sous la forme `{ method, path, body }`.
- Chaque mutation reçoit un **`mutationUuid` unique** (idempotence) et un **`ordreLocal`** (horodatage) garantissant le rejeu **dans l'ordre**.
- Le module et l'action sont dérivés du chemin (`deriveModule`, `deriveAction`, `deriveEntiteId`).

### 4.3 Cycle de synchronisation et rejeu

`syncCycle()` enchaîne **push** puis **pull** lorsque le poste est en ligne :

- **`syncPush()`** rejoue les mutations `PENDING` triées par `ordreLocal` croissant, vers les **endpoints réels** : la validation, les permissions et la logique métier du serveur sont ainsi intégralement réutilisées.
  - Réponse 2xx → mutation `APPLIED`.
  - Réponse 4xx (rejet métier : validation, permission, conflit de statut) → mutation `REJECTED` (inutile de rejouer en boucle).
  - Réponse 5xx → cycle stoppé, nouvelle tentative ultérieure (la file reste intacte).
  - Perte réseau en cours de rejeu → arrêt propre, file préservée.
  - Les mutations traitées (`APPLIED` / `REJECTED`) sont purgées pour garder la file propre.
- **`syncPull()`** signale la fin de cycle : le rafraîchissement des données est piloté par l'invalidation **TanStack Query** au retour réseau (les GET sont déjà servis par le service worker). Conservé comme point d'extension (delta pull serveur).

### 4.4 Orchestration (`useSyncEngine`)

Le hook **`useSyncEngine`** (monté une seule fois dans l'AppShell) :

- recalcule au montage le nombre de mutations en attente ;
- à la **transition hors-ligne → en ligne**, rejoue la file (`syncCycle`) puis invalide tous les caches React Query pour rafraîchir l'affichage ;
- exécute un **filet de sécurité** : tentative de cycle toutes les **30 secondes** tant que le poste est en ligne.

L'état réseau réel (joignabilité du serveur API) est piloté par `useServerHealth`, qui combine `navigator.onLine` et un ping périodique sur `/health` ; il alimente `useNetworkStore` (Zustand). Un indicateur permanent et un chip de synchronisation sont affichés dans l'en-tête.

### 4.5 Maintenance de la file (écran Synchronisation)

Fonctions exposées à l'administrateur : `listMutations()` (inventaire), `purgeMutations(statut?)` (purge ciblée ou totale), `retryRejected()` (remise en `PENDING` des mutations rejetées puis relance du cycle).

---

## 5. Sauvegarde & restauration de configuration (RÉALISÉ)

Volet serveur entièrement codé (`apps/api/src/modules/admin/synchronisation.service.ts` + `synchronisation.controller.ts`).

### 5.1 Périmètre de la sauvegarde

Sauvegarde **réelle** de la **configuration** uniquement (périmètre sûr), constituée d'un **snapshot JSON** (`contenuJson`) :

- **Référentiels** : sites, catégories patient, motifs de consultation, pathologies de référence, médicaments de référence, types d'examen.
- **Paramètres système**.
- **Matrice de gouvernance** : rôles → permissions (par code).

> ⚠️ Les données **cliniques / patients** ne sont **jamais** incluses ni restaurées (intégrité + confidentialité).

### 5.2 Déclenchement

- **Manuel** : endpoint `POST /synchronisation/sauvegardes/manuelle` (permission `synchronisation.execute`).
- **Automatique** : tâche planifiée **quotidienne à 02h00** via **`@nestjs/schedule`** (`@Cron(EVERY_DAY_AT_2AM)`). En cas d'échec, l'erreur est journalisée sans interrompre le service.

Une sauvegarde réussie est tracée (statut `REUSSIE`, taille en octets, date de fin), auditée et **diffusée en temps réel** à l'écran Synchronisation (`broadcastLive('LIVE_SYNC')`).

### 5.3 Rétention

Seules les **30 sauvegardes les plus récentes** sont conservées ; les plus anciennes sont supprimées automatiquement après chaque sauvegarde réussie.

### 5.4 Restauration **non destructive**

- Endpoint `POST /synchronisation/sauvegardes/:id/restaurer` (permission `synchronisation.restore`).
- La restauration ré-applique les valeurs du snapshot par **`upsert`** (référentiels + paramètres) **sans supprimer** les lignes créées depuis la sauvegarde.
- La matrice rôles → permissions est réinitialisée **par rôle existant** (suppression puis recréation des liaisons à partir des codes de permission).
- L'ensemble s'exécute dans une **transaction** (timeout 30 s).
- Une entrée historique sans `contenuJson` (anciennes simulations) est refusée proprement (message explicite), de même qu'un contenu corrompu.
- Après restauration : audit (`RESTORE`) + diffusion temps réel `LIVE_SYNC` et `LIVE_REFERENTIELS`.

### 5.5 Outil de ré-encryption de la messagerie

Endpoint `POST /synchronisation/messagerie/rechiffrer` (permission `synchronisation.execute`) : ré-encrypte les messages et pièces jointes chiffrés avec une **ancienne clé** vers la **clé courante**, après une rotation de clé. Opération **non destructive et idempotente** (par curseur sur `id`, par lots) ; permet de retirer ensuite l'ancienne clé du trousseau.

### 5.6 État du système (tableau de bord)

L'endpoint `GET /synchronisation/status` (permission `synchronisation.read`) renvoie la **volumétrie par module** (utilisateurs, sites, personnel, patients, visites, consultations, ordonnances, bons d'examen, évacuations, accidents du travail), les compteurs de **journaux** (audit, authentifications), la **dernière sauvegarde** et l'état de la **planification** (actif, « Tous les jours à 02h00 », rétention 30).

---

## 6. Temps réel (LIVE_SYNC)

Le module est intégré au flux **SSE** transverse de notifications temps réel. Les événements `LIVE_SYNC` (et `LIVE_REFERENTIELS` à la restauration) déclenchent l'invalidation ciblée des caches TanStack Query côté client, rafraîchissant l'écran Synchronisation **sans rechargement** et de façon silencieuse.

---

## 7. États et statuts

**Connexion (poste)** : `EN_LIGNE`, `HORS_LIGNE`, `SYNCHRONISATION`, `ERREUR_SYNC`.

**Mutation (file de rejeu)** — implémentation actuelle :

- `PENDING` — en attente de rejeu.
- `APPLIED` — appliquée (serveur 2xx), puis purgée.
- `REJECTED` — rejet métier définitif (serveur 4xx ou payload illisible).

**Sauvegarde** : `EN_COURS`, `REUSSIE`, `ECHEC`.

**Conflit** (modèle de données prévu, volet extension) : `EN_ATTENTE`, `RESOLUTION_AUTO`, `A_RESOUDRE_MANUELLEMENT`, `RESOLU`.

---

## 8. Écrans réalisés

- **Indicateur de connexion permanent** + chip de synchronisation dans l'en-tête (compteur de mutations en attente).
- **Écran Synchronisation** structuré en zones : terrain offline (file locale, purge/réessai), sauvegardes de configuration (historique, sauvegarde manuelle, restauration), volumétrie/état du système.

Écrans de gestion des conflits (liste, résolution) : voir §13 (extension future).

---

## 9. Notifications et alertes

- Passage hors-ligne / retour en ligne (indicateur réseau).
- Synchronisation terminée / échouée (cycle de rejeu).
- Sauvegarde réussie / en échec (toast + audit + `LIVE_SYNC`).
- File d'attente trop grande (alerte technique — modèle `AlerteTechnique` disponible).

---

## 10. Permissions

Le catalogue compte **110 permissions** au total (`packages/types/src/permissions.ts`). Pour ce module :

| Permission | Libellé | Action |
|---|---|---|
| `synchronisation.read` | Consulter l'état de synchronisation | Voir l'état système, la volumétrie, l'historique des sauvegardes, la file. |
| `synchronisation.execute` | Lancer une sauvegarde système | Déclencher une sauvegarde manuelle ; lancer la ré-encryption messagerie. |
| `synchronisation.restore` | Restaurer une sauvegarde de configuration | Restaurer la configuration depuis une sauvegarde. |

> L'indicateur de connexion et la file locale (IndexedDB) sont accessibles à tout utilisateur connecté sur son propre poste ; les actions serveur (sauvegarde, restauration, ré-encryption, état système) sont protégées par les permissions ci-dessus et confiées à l'administrateur système.

---

## 11. Dépendances

- **Tous les modules métier** déclarent leurs écritures via le client API : elles sont automatiquement capturées hors-ligne (aucune logique de rejeu propre à chaque module).
- **Sécurité** fournit l'identité de l'auteur (JWT) et la matrice rôles/permissions sauvegardée.
- **Audit** : chaque sauvegarde/restauration/ré-encryption est journalisée (`journalAudit`, via l'interceptor global et l'audit best-effort du service).
- **Référentiels** : objet principal de la sauvegarde de configuration ; influencent l'ordre de rejeu des mutations dépendantes.
- **Notifications temps réel (SSE)** : diffusion `LIVE_SYNC` / `LIVE_REFERENTIELS`.
- **Messagerie chiffrée** : cible de l'outil de ré-encryption (rotation de clé AES-256-GCM).

---

## 12. Critères d'acceptation

- ✅ L'application se charge et reste utilisable **sans réseau** (app shell pré-caché, GET servis depuis le cache).
- ✅ Une visite peut être **ouverte hors-ligne** ; une consultation **clôturée hors-ligne** ; une prescription **créée hors-ligne** avec les référentiels mis en cache.
- ✅ Le retour en ligne **rejoue** les écritures dans l'ordre, **sans doublon** (UUID d'idempotence), et rafraîchit l'affichage.
- ✅ Un rejet métier (4xx) n'est **pas rejoué en boucle** ; un échec serveur (5xx) ou une perte réseau **n'altère pas** la file.
- ✅ Une sauvegarde **réelle** de configuration peut être déclenchée manuellement **et** automatiquement (02h00), avec **rétention 30**.
- ✅ Une restauration **non destructive** ré-applique référentiels, paramètres et matrice rôles → permissions **sans supprimer** les données créées depuis.

---

## 13. Points de risque et limites

- **Offline-first architectural** : la stratégie « rejeu de requêtes » réutilise toute la validation serveur, mais ne fait pas de fusion champ-à-champ ; les conflits sont aujourd'hui tranchés par le serveur au rejeu (dernier écrivain / rejet 4xx).
- **Chiffrement local des écritures en file** : le payload des mutations est aujourd'hui stocké en clair dans IndexedDB (donnée locale au poste). Le chiffrement AES-GCM de la file locale est **prévu** (point de durcissement). Les postes perdus ou volés imposent une vigilance sur ce point.
- **Identifiants inter-sites** : les UUID évitent les collisions ; le cloisonnement par site est appliqué côté serveur.
- **Clarté de l'état réseau** : l'utilisateur doit comprendre l'indicateur (en ligne / hors-ligne / synchronisation) — assuré par le chip d'en-tête.
- **Outil de ré-encryption** : le mécanisme est codé et testé ; l'exécution en masse n'est à lancer qu'au moment d'une véritable rotation de clé.

---

## 14. Extensions futures (hors périmètre actuel)

- **Gestion fine des conflits de synchronisation** : détection/écriture des `ConflitSynchronisation` + `ResolutionConflit`, écrans de liste et de résolution manuelle (par l'administrateur médical pour les conflits métier), avec conservation de l'auteur, de la date et de la justification. Le **modèle de données est déjà présent** (`ConflitSynchronisation`, `ResolutionConflit`, `JournalSynchronisation`, `AlerteTechnique`) ; l'orchestration applicative reste à exposer.
- **Delta pull serveur** dans `syncPull()` (synchronisation descendante ciblée au-delà du cache GET).
- **Chiffrement AES-GCM de la file locale** (IndexedDB) pour les postes à risque.
- **Sauvegarde des données cliniques** (avec exigences de confidentialité/intégrité renforcées) — volontairement exclue du périmètre de sauvegarde actuel.

---

## 15. Note sur la qualité et les tests

L'application ne dispose pas, à ce stade, d'une suite de **tests automatisés étendue**. La validation s'appuie sur : le **typage statique** (`tsc`), le **build** de production, et des **tests E2E manuels en navigateur** (offline/online, rejeu de file, sauvegarde/restauration, rotation de clé). La mise en place d'une couverture de tests automatisés est identifiée comme **extension future** et présentée honnêtement comme une limite, non comme un acquis.
