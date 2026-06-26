# Offline-First, Synchronisation, Temps Réel & Sauvegarde

> **Statut : document « as-built »** — il décrit l'implémentation **réellement présente dans le code** (état du dépôt à juin 2026), et non une cible théorique. Tous les chemins, noms de fichiers, endpoints et structures de données cités ci-dessous sont vérifiables dans le code source sous `CMS/APP/CMS-SARIS/`.

---

## 1. Le problème central

CMS SARIS équipe des centres médicaux (sites de Moutela et Nkayi) où la connectivité réseau n'est pas garantie en permanence. Une infirmière doit pouvoir ouvrir une visite, saisir des constantes vitales ou créer un dossier patient **même hors ligne**, et retrouver son travail intégralement synchronisé dès le retour du réseau, **sans perte de données et dans l'ordre de saisie**.

Ce document explique exactement comment ce besoin est résolu, ainsi que les trois mécanismes connexes qui forment le « système nerveux » de l'application :

1. **Offline-first** — sur deux niveaux : (a) file de rejeu des écritures (IndexedDB) côté web/PWA, (b) base locale SQLite + moteur de synchronisation **delta** (LWW + tombstones) pour le poste de bureau autonome ;
2. **Temps réel** — flux SSE (Server-Sent Events) avec invalidation ciblée des caches et présence en ligne ;
3. **Sauvegarde / restauration** — snapshots de la configuration côté serveur + cron quotidien.

---

## 2. Architecture retenue : « rejeu de requêtes » (request replay)

L'application combine **deux niveaux** d'offline-first, qui répondent à deux usages distincts :

1. **Web / PWA — rejeu de requêtes HTTP** (toujours actif). Toute écriture qui échoue faute de réseau est capturée telle quelle et rejouée vers les endpoints REST réels à la reconnexion. C'est le mécanisme décrit en §3-§4.
2. **Poste de bureau autonome — base locale SQLite + moteur de synchronisation delta** (mode local du client Electron). Chaque poste travaille sur sa propre base ; un moteur de synchronisation **réellement implémenté** échange des deltas avec le serveur central et résout les conflits concurrents par **Last-Write-Wins (LWW) + tombstones**. C'est le mécanisme décrit en §4 bis.

Le niveau 1 repose sur une stratégie volontairement simple et robuste : le **rejeu de requêtes HTTP**.

> Toute écriture (POST / PATCH / PUT / DELETE) qui échoue faute de réseau est **capturée telle quelle** (`{ method, path, body }`) dans IndexedDB. À la reconnexion, le moteur **rejoue ces requêtes vers les endpoints REST réels**, dans l'ordre de création. Le serveur applique alors toute sa validation, ses permissions et sa logique métier habituelles — **il n'existe aucun moteur d'application parallèle côté serveur** sur ce chemin.

```
[ Utilisateur agit hors ligne ]
            ↓
[ Client API détecte l'absence de réseau ]
            ↓
[ Requête capturée dans file_mutations (IndexedDB / Dexie) ]
            ↓
[ Toast « Hors-ligne — action enregistrée » + OfflineQueuedError ]
            ↓
( … plus tard, le réseau revient … )
            ↓
[ useSyncEngine détecte la transition hors-ligne → en ligne ]
            ↓
[ syncPush() rejoue chaque requête PENDING, triée par ordreLocal ]
            ↓
[ Serveur : validation + permissions + métier (endpoints normaux) ]
            ↓
[ Invalidation React Query → l'affichage se rafraîchit ]
```

### Pourquoi ce choix ?

| Avantage | Détail |
|---|---|
| **Réutilisation totale du backend** | Aucune duplication de la logique métier : les requestes rejouées passent par les mêmes contrôleurs, guards et DTO que les requêtes en ligne. |
| **Sécurité conservée** | Permissions, validation `class-validator`, audit, cloisonnement par site : tout s'applique au rejeu comme en temps normal. |
| **Idempotence** | Chaque mutation porte un `mutationUuid` unique ; les rejets métier (4xx) ne sont pas rejoués en boucle. |
| **Simplicité de maintenance** | Pas de schéma de conflit à maintenir des deux côtés ; le serveur reste l'unique source de vérité. |

> **Note d'honnêteté technique (mise à jour).** Le moteur de synchronisation delta côté serveur — longtemps resté à l'état de types — est désormais **réellement implémenté** : module `apps/api/src/modules/sync/` avec endpoints `/sync/pull|push|status|run|supervision`, résolution de conflit LWW + tombstones (`SyncEntityEnvelope`, `SyncPullResponseV2`, `SyncPushResponseV2`, `SyncStatusV2` dans `packages/types/src/sync.ts`) et client embarqué côté poste local. Voir §4 bis. Le **rejeu de requêtes** (web/PWA) reste le mécanisme de base et coexiste avec ce moteur delta (réservé, lui, au poste de bureau autonome sur SQLite).

---

## 3. La file de rejeu : table `file_mutations` (IndexedDB / Dexie)

### 3.1 Base de données locale

- **Fichier** : `apps/web/src/lib/db.ts`
- **Moteur** : [Dexie](https://dexie.org/) **4.4.2** (surcouche IndexedDB), classe singleton `CmsSarisDatabase`, base nommée `cms-saris-db`.

La base locale contient trois familles de tables :

| Famille | Tables | Rôle |
|---|---|---|
| **Données offline-first** | `patients`, `identites_patient`, `allergies_patient`, `alertes_medicales`, `contacts_urgence`, `visites`, `consultations` | Entités modifiables hors ligne, marquées d'un `syncStatus` (`PENDING` / `SYNCED` / `CONFLICT` / `ERROR`). |
| **Référentiels (cache lecture seule)** | `categories_patient`, `motifs_consultation`, `medicaments`, `pathologies`, `sites` | Données de référence rafraîchies depuis le serveur ; **ne génèrent jamais de mutation**. |
| **Synchronisation** | `file_mutations`, `journal_sync` | File de rejeu + journal des cycles. |

### 3.2 Schéma réel de `FileMutation`

```typescript
// packages/types/src/sync.ts
export type MutationAction = 'CREATE' | 'UPDATE' | 'DELETE' | 'CLOSE'
export type MutationStatut = 'PENDING' | 'SENT' | 'APPLIED' | 'REJECTED' | 'CONFLICT'
export type ModuleName =
  | 'patients' | 'visites' | 'consultations' | 'acteurs'
  | 'referentiels' | 'triage' | 'sorties_critiques'

export interface FileMutation {
  id?:            number          // auto-increment local (Dexie)
  mutationUuid:   string          // crypto.randomUUID() — garantit l'idempotence
  module:         ModuleName      // déduit du premier segment de l'URL
  entiteType:     string          // premier segment du chemin (ex. 'patients')
  entiteId:       string          // premier UUID trouvé dans le chemin (ou '')
  action:         MutationAction  // déduit de la méthode + du chemin
  payloadJson:    string          // JSON.stringify({ method, path, body }) — requête rejouable
  statut:         MutationStatut  // 'PENDING' à la capture, puis 'APPLIED' / 'REJECTED'
  ordreLocal:     number          // Date.now() à la capture — préserve l'ordre
  createdLocalAt: Date
  sentAt?:        Date
  serverAckedAt?: Date
  errorMessage?:  string
}
```

Index Dexie (déclaration `db.ts`) :

```typescript
file_mutations: '++id, mutationUuid, module, statut, ordreLocal, createdLocalAt'
journal_sync:   '++id, siteId, statut, startedAt'
```

### 3.3 Le champ `ordreLocal`

Contrairement à une conception antérieure (timestamp haute précision avec compteur), l'implémentation réelle utilise **`Date.now()`** au moment de la capture (`apps/web/src/lib/sync.ts`). Le moteur trie les mutations `PENDING` par `ordreLocal` **croissant** avant de les rejouer, ce qui garantit que les écritures sont appliquées au serveur dans l'ordre où l'utilisateur les a produites.

> **Remarque sur le chiffrement local.** Le commentaire « JSON chiffré AES-256-GCM » figurant dans les types est **prospectif** : aujourd'hui, `payloadJson` est stocké en clair dans IndexedDB (espace privé de l'origine, propre au navigateur). Le chiffrement au repos de la file locale est une **extension future** (voir §9). En revanche, le chiffrement AES-256-GCM est bel et bien implémenté pour la **messagerie** et les **secrets TOTP** côté serveur (voir le document de sécurité).

---

## 4. Le moteur de synchronisation

### 4.1 Capture des écritures (client API)

- **Fichier** : `apps/web/src/lib/api.ts`

Le client HTTP central (`api.get/post/patch/delete/upload`) décide, pour chaque écriture, si elle est **éligible à la mise en file** via `canQueueOffline()` :

```typescript
function canQueueOffline(method, path, isForm): boolean {
  if (!WRITE_METHODS.has(method)) return false   // seules POST/PUT/PATCH/DELETE
  if (isForm) return false                       // uploads FormData non rejouables tels quels
  if (path.startsWith('/auth')) return false     // login/refresh n'ont pas de sens en différé
  if (path.startsWith('/notifications')) return false  // accusés non critiques
  return true
}
```

Deux chemins de capture :

1. **Hors-ligne avéré** (`navigator.onLine === false`) → on appelle directement `enqueueMutation()` sans tenter le réseau, pour une UX immédiate ;
2. **Échec réseau** sur une écriture éligible (serveur injoignable) → `enqueueMutation()` également.

Dans les deux cas, un toast informatif s'affiche (« Hors-ligne — action enregistrée, synchronisation à la reconnexion ») et une `OfflineQueuedError` (`queued = true`) est levée. Les helpers de toast l'ignorent afin de ne pas afficher de faux message d'erreur.

### 4.2 Mise en file (`sync.ts`)

- **Fichier** : `apps/web/src/lib/sync.ts`

```typescript
export async function enqueueMutation(method, path, body): Promise<void> {
  // dérive module / entiteType / entiteId / action depuis l'URL + la méthode
  const mutation = {
    mutationUuid:   crypto.randomUUID(),
    module:         deriveModule(firstSegment),
    entiteType:     firstSegment,
    entiteId:       deriveEntiteId(segments),     // premier UUID du chemin
    action:         deriveAction(method, path),    // DELETE / CREATE / CLOSE / UPDATE
    payloadJson:    JSON.stringify({ method, path, body }),
    statut:         'PENDING',
    ordreLocal:     Date.now(),
    createdLocalAt: new Date(),
  }
  await db.file_mutations.add(mutation)
  await refreshPendingCount()
}
```

Les fonctions `deriveModule` / `deriveAction` / `deriveEntiteId` extraient les métadonnées du chemin (utiles pour l'inspection UI). `deriveAction` détecte notamment les transitions de cycle de vie : une requête vers `…/cloturer` ou `…/annuler` est classée `CLOSE`.

### 4.3 Cycle de rejeu (`syncPush`)

`syncCycle()` enchaîne `syncPush()` puis `syncPull()` lorsqu'on est en ligne. Le cœur est `syncPush()` :

```typescript
const pending = await db.file_mutations
  .where('statut').equals('PENDING').sortBy('ordreLocal')   // ordre garanti

for (const m of pending) {
  const { method, path, body } = JSON.parse(m.payloadJson)
  const status = await replayRequest(method, path, body)    // re-fetch vers l'endpoint réel
  if (status >= 200 && status < 300) {
    update(m, { statut: 'APPLIED', serverAckedAt: now })     // succès
  } else if (status >= 400 && status < 500) {
    update(m, { statut: 'REJECTED', errorMessage: `HTTP ${status}` })  // rejet métier définitif
  } else {
    setSyncError(...)                                         // 5xx → on stoppe, on retentera
    return
  }
}
// purge des mutations traitées (APPLIED + REJECTED) → file propre
```

Règles importantes :

- **`replayRequest()`** (`api.ts`) rejoue la requête **sans repasser par la logique de mise en file** (évite la récursion), en ré-injectant le `Bearer` token courant.
- **2xx** → `APPLIED`. **4xx** → `REJECTED` (rejet métier définitif : validation, permission, conflit de statut — inutile de boucler). **5xx ou échec réseau** → on **stoppe le cycle** et on **conserve la file intacte** pour réessayer plus tard.
- Après le cycle, les mutations `APPLIED` **et** `REJECTED` sont **purgées** pour garder la file légère.

### 4.4 Lecture hors-ligne côté web (PWA)

Sur le **chemin web/PWA**, la lecture hors-ligne n'est **pas** assurée par un delta serveur côté navigateur, mais par le **service worker** (stratégie `NetworkFirst` sur les GET — voir §6) combiné à l'**invalidation React Query** au retour réseau. Ce chemin reste donc volontairement « écritures différées + cache de lecture », sans réplication delta dans le navigateur.

> Le **delta-pull serveur**, lui, existe bel et bien : il est implémenté côté API (`/sync/pull`) et consommé par le **poste de bureau autonome** sur sa base SQLite locale (voir §4 bis). Il ne s'applique pas au navigateur, qui n'embarque pas de base relationnelle locale.

### 4.5 Orchestration (`useSyncEngine`)

- **Fichier** : `apps/web/src/hooks/useSyncEngine.ts` — à monter **une seule fois** (dans l'`AppShell`).

| Déclencheur | Action |
|---|---|
| **Au montage** | `refreshPendingCount()` — affiche le compteur de mutations en attente. |
| **Transition hors-ligne → en ligne** | `syncCycle()` puis `queryClient.invalidateQueries()` (rafraîchit tout l'affichage). |
| **Filet de sécurité périodique** (toutes les **30 s**, en ligne) | `syncCycle()` — relance le rejeu si des mutations restent. |

### 4.6 Détection réseau réelle (`useServerHealth`)

- **Fichier** : `apps/web/src/hooks/useServerHealth.ts` — à monter **une fois** (sidebar persistante).

Le statut « En ligne / Hors ligne » ne se fie **pas seulement** à `navigator.onLine` (qui ne dit que si le navigateur a *un* réseau), mais vérifie la **vraie joignabilité du serveur API** :

- `navigator.onLine === false` → **Hors ligne** immédiatement (inutile de pinger) ;
- sinon → `GET /health` avec **timeout 4 s** et `cache: 'no-store'` : `2xx` = En ligne, échec/timeout = Hors ligne ;
- re-vérification **au montage, toutes les 20 s, au retour réseau (`online`) et au focus de la fenêtre**.

Le résultat alimente le `network.store` (Zustand, `apps/web/src/stores/network.store.ts`), consommé par `useSyncEngine`, l'UI et le client API.

### 4.7 État exposé (stores Zustand)

| Store | Fichier | Contenu |
|---|---|---|
| `sync.store` | `apps/web/src/stores/sync.store.ts` | `status` (`idle` / `syncing` / `success` / `error`), `pendingCount`, `lastSyncAt`, `errorMessage` |
| `network.store` | `apps/web/src/stores/network.store.ts` | `isOnline` (piloté par `useServerHealth`) |

---

## 4 bis. Moteur de synchronisation delta (poste de bureau autonome)

> **État « as-built » (à jour).** Ce moteur **est implémenté et validé en développement**. Il ne faut donc plus le décrire comme « non implémenté » ni considérer le pull comme « un no-op » : c'est le chemin de synchronisation du **poste de bureau autonome** (client Electron en mode local, base SQLite par machine). Ce qui **reste** relève du **packaging** et de la **validation à grande échelle** (voir §4 bis.7).

Pour les postes de terrain où la connectivité est intermittente, l'application de bureau (Electron) peut fonctionner en **mode local** : la **même API NestJS** est lancée sur une **base SQLite embarquée** (une base par poste). Un moteur de synchronisation échange ensuite des **deltas** avec le serveur central PostgreSQL dès que celui-ci redevient joignable, dans les deux sens, avec résolution de conflit.

### 4 bis.1 Schéma double-cible (PostgreSQL ↔ SQLite)

- Le schéma Prisma de référence (`packages/db/prisma/schema.prisma`, PostgreSQL) est **dérivé** en un schéma **SQLite** (`packages/db/prisma/sqlite/schema.prisma`) par un générateur dédié (datasource → `sqlite`, énumérations → `String`, client généré séparé).
- Une **migration SQLite réelle** a été générée et appliquée hors-ligne (`prisma/sqlite/migrations/...`).
- `PrismaService` est **bi-cible** : le client SQLite est résolu via `SQLITE_CLIENT_PATH` quand `DATABASE_PROVIDER=sqlite`.

Le socle de synchronisation repose sur deux colonnes ajoutées aux modèles concernés :

| Colonne | Rôle |
|---|---|
| `updatedAt` (`@updatedAt`, indexé) | Horodatage de dernière modification → arbitrage **Last-Write-Wins**. |
| `deletedAt` (nullable, sur les modèles supprimables) | **Soft-delete** : une suppression devient une **tombstone** synchronisable, jamais un `DELETE` physique immédiat. |

### 4 bis.2 Modèle `SyncState` — curseur par poste

Un modèle **`SyncState`** (présent dans les **deux** schémas, PostgreSQL et SQLite) tient le **curseur de synchronisation** de chaque poste :

```prisma
model SyncState {
  id           String    @id @default(uuid())
  posteLocalId String
  siteId       String
  lastPulledAt DateTime  @default(now())   // dernier delta reçu (reprise incrémentale)
  lastPushedAt DateTime?                   // dernier delta envoyé
  updatedAt    DateTime  @updatedAt
  @@unique([posteLocalId, siteId])
  @@index([siteId])
}
```

`lastPulledAt` est **persisté après chaque page appliquée** : en cas de coupure réseau en plein cycle, la reprise repart **exactement** là où elle s'était arrêtée (reprise incrémentale, pas de re-téléchargement complet).

### 4 bis.3 Endpoints serveur `/sync` (API centrale)

- **Fichier** : `apps/api/src/modules/sync/sync.controller.ts` — tout le contrôleur est derrière `JwtAuthGuard` + `PermissionsGuard`, et le **site est résolu depuis le JWT** (jamais transmis dans la requête → pas d'usurpation de portée).

| Méthode & chemin | Permission | Rôle |
|---|---|---|
| `GET /sync/pull?since=&limit=` | `synchronisation.read` | Renvoie les deltas du site modifiés depuis `since` (**tombstones incluses**), paginés. |
| `POST /sync/push` | `synchronisation.execute` | Applique un lot de changements (`{ posteLocalId, changes }`) en LWW, renvoie `applied / skipped / conflicts`. |
| `GET /sync/status` | `synchronisation.read` | État serveur + état du client embarqué (`enabled`, `online`, curseurs). |
| `GET /sync/supervision` | `synchronisation.read` | Postes en ligne, activité récente, conflits — **scope par site**. |
| `POST /sync/run` | `synchronisation.execute` | Déclenche manuellement un cycle (mode local embarqué) — secours de forçage. |

### 4 bis.4 Cœur métier (`sync.service.ts`)

- **Fichier** : `apps/api/src/modules/sync/sync.service.ts`. Registre des modèles synchronisables et de leur portée par site : `sync-models.ts`.

| Fonction | Rôle |
|---|---|
| `pull(siteId, since, limit)` | Parcourt le registre des modèles, renvoie les lignes `updatedAt > since` **en conservant l'ordre du registre** (parents avant enfants → contraintes de clés étrangères respectées à l'application) ; tombstones incluses via `deletedAt: undefined` (neutralise le filtre soft-delete). |
| `ingest(envelope)` | Applique **un** delta avec résolution de conflit. **Réutilisé** par le push serveur ET le pull du client embarqué. |
| `push(siteId, posteLocalId, changes)` | Applique un lot, renvoie `applied / skipped / conflicts`, et enregistre l'activité de supervision. |
| `applyEnvelope(def, env)` | `upsert` PUIS **restaure l'`updatedAt`/`deletedAt` source en SQL brut** — sinon `@updatedAt` ré-horodaterait la ligne et casserait le LWW. SQL **bi-provider** (`?` pour SQLite, `$n` pour PostgreSQL). |

### 4 bis.5 Résolution de conflit (LWW + tombstones)

- **Cœur testé** : `packages/types/src/sync-conflict.ts` (`resolveConflict`, `diffFields`, `mergeTombstone`), couvert par **17 tests** (`packages/types/test/sync-conflict.test.ts`).
- **Soft-delete** : logique pure `apps/api/src/prisma/soft-delete-core.ts`, couverte par **10 tests** (`apps/api/test/soft-delete-core.test.ts`).

Principe : la version dont l'`updatedAt` est le **plus récent** gagne ; une tombstone (`deletedAt` renseigné) participe à l'arbitrage comme n'importe quelle écriture. La détection d'un **vrai** conflit (modification concurrente des deux côtés, et non simple écho) s'appuie sur `baseUpdatedAt`. Les conflits sont **rapportés** (`conflicts[]`, `valeurLocale` / `valeurServeur`) et tracés via la supervision — il n'y a pas (encore) de merge champ-par-champ automatique.

### 4 bis.6 Client de synchronisation embarqué

- **Fichier** : `apps/api/src/modules/sync/sync-client.service.ts` — **actif uniquement** dans le backend embarqué (`enabled` exige `DATABASE_PROVIDER=sqlite` + `SERVER_URL` + `SITE_ID`). En mode serveur central, c'est un **no-op** (`enabled === false`).

Au démarrage du poste (`onApplicationBootstrap`), il lance une **synchronisation initiale non bloquante**, puis :

- un **sondeur de joignabilité** léger (`GET /health`, timeout 4 s, intervalle `SYNC_PROBE_SEC` ≈ 4 s) déclenche une **synchronisation immédiate** dès la transition *hors-ligne → en ligne* (pas d'attente d'un cycle périodique) ;
- un **backoff exponentiel borné** (5 s → 60 s) sur échec / serveur injoignable ;
- un **filet de sécurité** espacé (`SYNC_SAFETY_SEC` ≈ 300 s) rattrape tout changement non capté par la sonde.

Un cycle (`runCycle`) enchaîne **`pull` puis `push`** (pull d'abord pour minimiser les conflits), avec verrou anti-recouvrement (`running`).

### 4 bis.7 État de validation (dev) & reste à faire

| Élément | État |
|---|---|
| Cœur conflit LWW + tombstones | **Implémenté + 17 tests verts**. |
| Soft-delete (logique pure) | **Implémenté + 10 tests verts**. |
| Schéma SQLite double-cible + migration | **Généré et appliqué hors-ligne**. |
| Modèle `SyncState` + reprise incrémentale | **Implémenté** (les deux schémas). |
| Endpoints serveur `/sync/*` (gardes JWT + perms + scope site) | **Implémentés**. |
| Client embarqué (pull + push) | **Implémenté**. |
| **Synchronisation auto au démarrage (mode local)** | **VALIDÉE EN DEV** : la même API a démarré sur SQLite et la synchro initiale a rempli la base locale — cycle pull+push complet, journal **« 542 reçus, 0 envoyé, 0 conflit »**, 0 erreur. |
| **Empaquetage de l'installateur AUTONOME** | **RESTE** : bundler l'API + ses moteurs natifs (client Prisma + moteur SQLite) + une base `seed.db` pré-migrée. L'installateur **mode distant** (remote) est, lui, déjà produit (NSIS ~91 Mo). |
| **Bascule globale du soft-delete** | **RESTE** : aujourd'hui branchée en **opt-in** (`PrismaService.softDelete`) ; la bascule globale dépend d'une revue des cascades / clés étrangères. |
| **Test multi-postes concurrents** | **RESTE** : valider 2 postes ↔ 1 central avec conflits réellement concurrents. |

> En résumé : la **couche code du moteur delta est complète et fonctionne** (synchro de bout en bout prouvée en dev sur une base locale réelle) ; ce qui reste est l'**empaquetage de l'installateur autonome** et la **validation à plusieurs postes**, non le moteur lui-même.

---

## 5. Temps réel : flux SSE & invalidation ciblée

Au-delà de la synchronisation différée, l'application offre une **propagation instantanée** des changements via **Server-Sent Events (SSE)** — sans WebSocket, sans bouton « Actualiser ».

### 5.1 Endpoint SSE (backend)

- **Fichier** : `apps/api/src/modules/notification/notification.controller.ts`
- **Endpoint** : `@Sse('stream')` → `GET /notifications/stream?token=<JWT>`

`EventSource` ne pouvant pas transmettre d'en-tête `Authorization`, le JWT est passé **en query** et vérifié manuellement (`JwtService.verify`). L'audience (`userId`, `siteId`, `permissions`) est dérivée du token.

À l'ouverture du flux :

- **Présence** : `presence.connect(userId)` — l'utilisateur est « en ligne » tant que ≥ 1 flux SSE est ouvert ;
- **`lastSeenAt`** est mis à jour (`Utilisateur.lastSeenAt`) ;
- **Co-participants** : `notifyCoParticipants()` prévient les autres membres des conversations de l'utilisateur → leurs messages passent « remis » (✓✓ gris) instantanément.

À la fermeture (`finalize`), `presence.disconnect(userId)` + nouveau `lastSeenAt`.

### 5.2 Service de notifications & diffusion (backend)

- **Fichier** : `apps/api/src/modules/notification/notification.service.ts`

| Mécanisme | Détail |
|---|---|
| `emit(input)` | Crée une `Notification` **persistée** + la pousse dans le flux SSE (RxJS `Subject`). Best-effort : ne casse jamais la logique métier. |
| **Portée** | Individuelle (`destinataireId`) **ou** diffusion (filtrée par `siteId` + `requiredPermission`) → la confidentialité par rôle/site est respectée. |
| État « lu » | Table `NotificationLecture` (par utilisateur, compatible diffusions ; champ `masque` pour « supprimer pour moi »). |
| `broadcastLive(type)` | Événement **temps réel silencieux, NON persisté** : déclenche une invalidation côté client **sans cloche, son ni toast**. Types : `LIVE_REFERENTIELS`, `LIVE_ACTEURS`, `LIVE_BONS_EXAMEN`, `LIVE_SYNC`. |

Les actions REST (toutes derrière `JwtAuthGuard` + `PermissionsGuard`) : `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/:id/read`, `POST /notifications/read-all`, `POST /notifications/dismiss-many`, `POST /notifications/dismiss-all`, `POST /notifications/:id/dismiss`, `DELETE /notifications/:id` (suppression définitive réservée à `notification.delete`).

### 5.3 Présence en ligne

- **Fichier** : `apps/api/src/modules/notification/presence.service.ts`
- Compteur **en mémoire** : un utilisateur est en ligne tant qu'il maintient ≥ 1 connexion SSE. Sert aux accusés de réception (« remis »), au statut « en ligne / vu à » de la messagerie et au champ persisté `lastSeenAt`.

### 5.4 Réception côté client (« réseau de neurones » d'invalidations)

- **Fichier** : `apps/web/src/modules/notifications/hooks/useNotifications.ts`
- `useNotificationStream()` ouvre l'`EventSource` (reconnexion automatique du navigateur + reconnexion sur rotation du token).

À chaque événement reçu, le hook applique une **carte d'invalidations ciblées** qui propage le changement aux seuls caches concernés :

```typescript
// Notifications PERSISTÉES → invalide les modules + cloche + son + toast
const SSE_INVALIDATIONS = {
  PATIENT_CREE:             [['patients'], ['dashboard']],
  VISITE_CREE:              [['visites'], ['dashboard']],
  CONSULTATION_OUVERTE:     [['consultations'], ['visites'], ['dashboard']],
  CONSULTATION_CLOTUREE:    [['consultations'], ['visites'], ['dashboard']],
  ORDONNANCE_VALIDEE:       [['consultations'], ['bons-examen']],
  SUIVI_CHRONIQUE_OUVERT:   [['suivis-chroniques'], ['dashboard']],
  EVACUATION_INITIEE:       [['evacuations'], ['dashboard']],
  ACCIDENT_TRAVAIL_DECLARE: [['accidents-travail'], ['dashboard']],
  UTILISATEUR_CREE:         [['admin', 'utilisateurs'], ['acteurs']],
  // … désactivation / réactivation / suppression / ROLE_MODIFIE
}

// Événements LIVE SILENCIEUX (non persistés) → rafraîchissent SANS cloche/son/toast
const LIVE_INVALIDATIONS = {
  LIVE_REFERENTIELS: [['referentiels']],
  LIVE_ACTEURS:      [['acteurs']],
  LIVE_BONS_EXAMEN:  [['bons-examen']],
  LIVE_SYNC:         [['admin', 'sync']],
}
```

Comportements particuliers :

- **`MESSAGE_STATUS`** → invalide uniquement `['messagerie', 'thread']` (accusés ✓✓ gris/bleu), sans toucher cloche ni feed ;
- **`MESSAGE`** → invalide `['messagerie']` + `playSound('received')` ;
- autres → invalide la cloche + le feed `['notifications']` + `playSound('notification')` ;
- toast discret selon le niveau : `CRITIQUE` → erreur, `AVERTISSEMENT` → warning, `SUCCES` → succès.

Un **filet de sécurité** (`refetchInterval: 90 s`) garantit la cohérence même si le SSE se coupe.

---

## 6. PWA & cache hors-ligne (lecture)

- **Fichier** : `apps/web/vite.config.ts` (plugin `vite-plugin-pwa` **1.3.0**, Workbox)

| Élément | Configuration réelle |
|---|---|
| **Type d'enregistrement** | `registerType: "autoUpdate"` ; PWA **désactivée en dev** (`devOptions.enabled: false`), active dès `build` / `preview`. |
| **Manifeste** | `name: "CMS SARIS — Centre médical"`, `display: "standalone"`, `theme_color: "#4E8BA4"`, `lang: "fr"`, icônes 192/512 (dont maskable). |
| **App shell** | `globPatterns: ["**/*.{js,css,html,svg,woff,woff2,ttf,png,ico}"]` → tout le bundle est pré-caché, l'app se charge **intégralement sans réseau**. |
| **Fallback SPA** | `navigateFallback: "/index.html"`, exclusions `^/api` et `/health`. |

Stratégies de **runtime caching** :

| Cible | Stratégie | Détail |
|---|---|---|
| **GET API** (hors `/health`, `/auth`, `/notifications/stream`) | `NetworkFirst` | timeout **5 s**, repli sur le dernier cache connu hors-ligne ; rétention **7 jours**, **400 entrées** max. |
| **Polices & images** | `StaleWhileRevalidate` | rétention **30 jours**, **80 entrées**. |
| **ffmpeg.wasm** (`/ffmpeg/`) | `CacheFirst` | non pré-caché (~30 Mo), mis en cache au 1ᵉʳ usage ; rétention **180 jours**, **6 entrées** — permet la découpe vidéo de la messagerie hors-ligne ensuite. |

C'est cette stratégie `NetworkFirst` qui assure la **lecture hors-ligne** des données déjà consultées **côté web/PWA**. (Le poste de bureau autonome, lui, lit dans sa base SQLite locale alimentée par le delta-pull serveur — voir §4 bis.)

---

## 7. Sauvegarde & restauration (serveur) + cron

> **Périmètre volontairement restreint à la CONFIGURATION.** Les données **cliniques / patients ne sont JAMAIS** incluses dans une sauvegarde ni écrasées par une restauration (intégrité + confidentialité). C'est un choix de conception assumé.

- **Service** : `apps/api/src/modules/admin/synchronisation.service.ts`
- **Contrôleur** : `apps/api/src/modules/admin/synchronisation.controller.ts`
- **Modèle Prisma** : `SauvegardeSysteme` (champs `type`, `statut`, `perimetre`, `contenuJson`, `taille`, `finishedAt`, `message`, `declenchePar`).

### 7.1 Contenu d'un snapshot

`buildSnapshot()` sérialise en JSON (`version: 1`, `perimetre: 'CONFIGURATION'`) :

- les **référentiels** : `site`, `categoriePatient`, `motifConsultation`, `pathologieReference`, `medicamentReference`, `typeExamen` ;
- les **paramètres système** : `parametreSysteme` ;
- la **matrice de gouvernance** : chaque `Role` avec la liste de ses permissions (par `code`).

### 7.2 Endpoints

| Méthode & chemin | Permission | Rôle |
|---|---|---|
| `GET /synchronisation/status` | `synchronisation.read` | Compteurs par module (utilisateurs, sites, personnel, patients, visites, consultations, ordonnances, bons d'examen, évacuations, accidents) + totaux audit/auth + dernière sauvegarde + planification. |
| `GET /synchronisation/sauvegardes` | `synchronisation.read` | Historique (métadonnées uniquement — le `contenuJson` volumineux n'est **pas** renvoyé en liste ; 50 entrées max). |
| `POST /synchronisation/sauvegardes/manuelle` | `synchronisation.execute` | Déclenche une sauvegarde réelle (`type: 'MANUELLE'`). |
| `POST /synchronisation/sauvegardes/:id/restaurer` | `synchronisation.restore` | Restauration **non destructive**. |
| `POST /synchronisation/messagerie/rechiffrer` | `synchronisation.execute` | Ré-encrypte la messagerie vers la clé courante (nettoyage post-rotation de clé). |

### 7.3 Restauration non destructive

`restaurerSauvegarde()` s'exécute dans une **transaction Prisma** (timeout 30 s) :

1. **Référentiels + paramètres** : `upsert` par `id` → ré-applique les valeurs du snapshot **sans supprimer** les lignes créées depuis la sauvegarde ;
2. **Matrice rôles → permissions** : pour chaque rôle (retrouvé par `code`), réinitialise ses `RolePermission` puis ré-applique les permissions du snapshot.

Garde-fous : une sauvegarde ancienne **sans `contenuJson`** (entrées historiques de simulation) est explicitement signalée comme **non restaurable** ; un JSON corrompu lève une `BadRequestException`. À la fin, `broadcastLive('LIVE_SYNC')` + `broadcastLive('LIVE_REFERENTIELS')` rafraîchissent les écrans concernés en direct.

### 7.4 Planification automatique & rétention

- **Cron** : `@Cron(CronExpression.EVERY_DAY_AT_2AM)` via `@nestjs/schedule` (**6.1.3**) → sauvegarde automatique **chaque jour à 02 h 00** (`type: 'AUTOMATIQUE'`).
- **Rétention** : `appliquerRetention()` conserve les **30 dernières** sauvegardes et supprime les plus anciennes après chaque création.
- Chaque opération est **auditée** (`journalAudit`, module `synchronisation`).

### 7.5 Ré-encryption après rotation de clé

`reencrypterMessages()` parcourt par curseur les tables `Message` (lots de 200) et `MessagePieceJointe` (lots de 25, car base64 volumineux) et ré-encrypte `contenuChiffre` vers la **clé courante** (`reencryptToCurrent`). Opération **idempotente et non destructive** : une ligne n'est réécrite que si elle a pu être déchiffrée **et** qu'elle n'est pas déjà à jour. Sert à pouvoir retirer une ancienne clé du trousseau après rotation (voir le document de sécurité pour le format de clé versionné `v2:<keyId>:…`).

---

## 8. Écran d'administration « Synchronisation »

- **Fichier** : `apps/web/src/modules/admin/pages/SynchronisationPage.tsx`

L'écran est organisé en **trois zones** :

1. **Zone terrain (`SyncTerrainZone`)** — état réseau temps réel (En ligne / Hors ligne), nombre de mutations en attente, dernière synchronisation, état du Service Worker ; actions : **Synchroniser maintenant** (`syncCycle`), **réessayer les rejetées** (`retryRejected`), **purger** (`purgeMutations('REJECTED')`) ; inspection de la file via `listMutations()`.
2. **Zone sauvegardes (`SauvegardesZone`)** — dernière sauvegarde + historique (dates, tailles, type `MANUELLE` / `AUTOMATIQUE`) ; actions : lancer une sauvegarde, restaurer, afficher la planification (quotidienne 02 h 00), selon les permissions `synchronisation.execute` / `synchronisation.restore`.
3. **Zone volumétrie (`VolumetrieZone`)** — compteurs par module + totaux audit / authentifications.

---

## 9. Garanties, limites et extensions futures

### 9.1 Garanties effectivement assurées

| Garantie | Mécanisme réel |
|---|---|
| Pas de perte d'écriture | Une mutation reste `PENDING` dans IndexedDB tant que le serveur n'a pas répondu `2xx` (ou rejeté en `4xx`). |
| Ordre respecté | Tri par `ordreLocal` croissant avant rejeu. |
| Pas de double application en boucle | `mutationUuid` unique + arrêt du cycle sur `5xx` / échec réseau (file intacte) ; les `4xx` ne sont pas rejoués. |
| Sécurité conservée hors-ligne→reconnexion | Le rejeu passe par les endpoints réels (guards, permissions, validation, audit, cloisonnement site). |
| Lecture hors-ligne (web/PWA) | Cache `NetworkFirst` du service worker (7 jours) + app shell pré-caché. |
| Réplication delta (poste autonome) | Moteur `/sync/pull|push` + LWW/tombstones + curseur `SyncState` (reprise incrémentale). |
| Cohérence temps réel | SSE + carte d'invalidations React Query + filet `refetchInterval`. |
| Sauvegarde sûre | Snapshot **configuration uniquement**, restauration non destructive, cron quotidien + rétention 30. |

### 9.2 Limites assumées (état actuel)

- **Web/PWA : pas de résolution de conflit** automatique — le rejeu de requêtes suppose que les rejets métier (`4xx`) sont définitifs et signalés à l'utilisateur via la zone terrain. (La résolution de conflit LWW existe en revanche sur le chemin **poste autonome**, voir §4 bis.5.)
- **Web/PWA : pas de delta-pull dans le navigateur** — la fraîcheur hors-ligne repose sur le cache du service worker. Le delta-pull serveur existe mais ne s'applique qu'au poste de bureau autonome (SQLite local).
- **Poste autonome : reste à finaliser** — empaquetage de l'installateur **autonome** (API + moteurs natifs + `seed.db`), bascule **globale** du soft-delete (aujourd'hui opt-in), et **test multi-postes concurrents** (voir §4 bis.7).
- **`payloadJson` non chiffré au repos** dans IndexedDB (espace privé du navigateur).
- **Uploads (`FormData`) non rejouables** hors-ligne sur le chemin web (exclus de la file de rejeu).

### 9.3 Points d'extension prévus (hors périmètre actuel)

- **Empaquetage autonome** de l'installateur Electron (mode local) : bundler `apps/api/dist` + moteurs natifs (client Prisma + moteur SQLite) + `seed.db` pré-migrée.
- **Bascule globale du soft-delete** (aujourd'hui branché en opt-in via `PrismaService.softDelete`), après revue des cascades / clés étrangères.
- **Validation multi-postes** (2 postes ↔ 1 central) avec conflits réellement concurrents.
- **Merge champ-par-champ** des conflits (au-delà du LWW + rapport de conflit actuel).
- **Chiffrement AES-256-GCM** de la file `file_mutations` au repos (l'infrastructure crypto existe déjà côté serveur).
- File de rejeu pour les **pièces jointes / uploads** côté web.

> Ces éléments sont documentés ici pour distinguer clairement le **réalisé** de l'**à finaliser**, conformément à l'exigence d'honnêteté du cahier des charges. Le moteur de synchronisation delta, lui, **n'est plus une extension future** : il est implémenté et validé en développement (§4 bis).

---

## 10. Récapitulatif des fichiers clés (preuves)

| Domaine | Chemin |
|---|---|
| File locale (Dexie) | `apps/web/src/lib/db.ts` |
| Moteur de rejeu | `apps/web/src/lib/sync.ts` |
| Client API (capture) | `apps/web/src/lib/api.ts` |
| Orchestration sync (web) | `apps/web/src/hooks/useSyncEngine.ts` |
| Détection réseau | `apps/web/src/hooks/useServerHealth.ts` |
| Types partagés (rejeu + delta) | `packages/types/src/sync.ts` |
| Cœur conflit LWW + tombstones (17 tests) | `packages/types/src/sync-conflict.ts` · `packages/types/test/sync-conflict.test.ts` |
| Endpoints serveur `/sync` | `apps/api/src/modules/sync/sync.controller.ts` |
| Moteur delta serveur (pull/ingest/push) | `apps/api/src/modules/sync/sync.service.ts` |
| Registre des modèles synchronisables | `apps/api/src/modules/sync/sync-models.ts` |
| Client de synchro embarqué (poste local) | `apps/api/src/modules/sync/sync-client.service.ts` |
| Soft-delete (logique pure, 10 tests) | `apps/api/src/prisma/soft-delete-core.ts` · `apps/api/test/soft-delete-core.test.ts` |
| Extension soft-delete (opt-in) | `apps/api/src/prisma/soft-delete.extension.ts` |
| Modèle `SyncState` (curseur) | `packages/db/prisma/schema.prisma` · `packages/db/prisma/sqlite/schema.prisma` → `model SyncState` |
| Schéma SQLite double-cible | `packages/db/prisma/sqlite/schema.prisma` (+ `sqlite/migrations/`) |
| PWA / cache | `apps/web/vite.config.ts` |
| SSE (contrôleur) | `apps/api/src/modules/notification/notification.controller.ts` |
| Notifications / live | `apps/api/src/modules/notification/notification.service.ts` |
| Présence | `apps/api/src/modules/notification/presence.service.ts` |
| Réception SSE (client) | `apps/web/src/modules/notifications/hooks/useNotifications.ts` |
| Sauvegarde / restauration / cron | `apps/api/src/modules/admin/synchronisation.service.ts` |
| Endpoints sync | `apps/api/src/modules/admin/synchronisation.controller.ts` |
| Écran Synchronisation | `apps/web/src/modules/admin/pages/SynchronisationPage.tsx` |
| Modèle de sauvegarde | `packages/db/prisma/schema.prisma` → `model SauvegardeSysteme` |
