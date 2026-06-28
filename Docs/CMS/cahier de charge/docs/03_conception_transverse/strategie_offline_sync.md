# Stratégie offline / synchronisation — CMS SARIS (conception transverse)

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document de **conception transverse** « as-built » : il décrit la stratégie de fonctionnement
> hors-ligne et de synchronisation **telle qu'elle est construite** dans le monorepo
> `CMS/APP/CMS-SARIS/`. Les chiffres ne sont pas redéfinis ici : ils sont référencés par
> identifiant `PM-xx` depuis [[parametres_metier]] et par `D-xxx` depuis [[registre_decisions]].
> Vérité de référence : [[_SOURCE_systeme]]. Détail fonctionnel du module : [[MODULE_16_synchronisation]].
> Documents liés : [[exigences_non_fonctionnelles]], [[plan_modules]], [[modele_operationnel]],
> [[modele_menaces]], [[parametres_metier]].
>
> Convention d'honnêteté : tout ce qui est affirmé cite le code (chemin sous
> `CMS/APP/CMS-SARIS/`) ou une décision/fiche mémoire. Un point non vérifié à la source est
> marqué « à confirmer ». Aucun chiffre n'est inventé.

---

## 1. Modèle de synchronisation (deux clients, un central)

CMS SARIS suit une architecture **offline-first multi-poste** (décision [[registre_decisions#D-001]],
modèle « ulamu »). Le **serveur central** (API NestJS sur Render + PostgreSQL sur Neon —
[[registre_decisions#D-002]]) est la **source de vérité** et le **hub de synchronisation**. Deux
familles de clients s'y connectent, avec deux mécaniques distinctes.

### 1.1 Desktop Electron mode `local` — base SQLite ↔ central (pull/push)

Chaque poste de bureau (Electron 33 / Node 20.18, Windows) embarque un **backend NestJS + une base
SQLite locale** ([[exigences_non_fonctionnelles#ENF-01]]). Le même code applicatif tourne en
bi-provider PostgreSQL (central) / SQLite (poste) — `apps/api/src/prisma/prisma.service.ts`.

- Le backend embarqué exécute une **boucle de synchronisation** qui **pull** les deltas du central
  puis **push** ses mutations locales (`apps/api/src/modules/sync/sync-client.service.ts`,
  `runCycle` = pull puis push). Le central reste passif : il répond aux endpoints `/sync/pull` et
  `/sync/push` (`apps/api/src/modules/sync/sync.controller.ts`).
- Hors-ligne, le poste reste **pleinement opérationnel** sur sa base SQLite (triage, consultation,
  dossier, documents, messagerie locale) ; la synchronisation reprend à la reconnexion (voir §5 et §7).

### 1.2 Web PWA — file de rejeu de mutations (pas de réplication de base)

Le client web (React/Vite, PWA) n'embarque **pas** de base de données ; il fournit un **offline
léger** ([[exigences_non_fonctionnelles#ENF-01-02]]) :

- **Lecture** : service worker (VitePWA), GET de l'API en **NetworkFirst** (cache `saris-api-get`,
  hors `/health`, `/auth`, `/notifications/stream`) → relecture des données déjà consultées.
  Asset précaché plafonné — [[parametres_metier#PM-42]].
- **Écriture** : une **file de rejeu** des mutations en attente, persistée en **IndexedDB chiffrée**
  (`apps/web/src/lib/sync.ts`, `apps/web/src/lib/offlineCrypto.ts`), rejouée à la reconnexion. Il
  s'agit d'un **rejeu de requêtes HTTP**, pas d'un moteur d'application parallèle côté serveur
  (`apps/web/src/lib/sync.ts` : `syncPull` est un no-op, les lectures étant servies par le SW).

> **C-OS-1 (contrat de portée des deux clients)** : le desktop **réplique des données** (pull/push de
> modèles entiers) ; le web **rejoue des intentions** (requêtes HTTP en file). Les deux convergent vers
> le même central, source de vérité unique.

> **Cas du desktop en ligne** : en ligne, le renderer desktop parle **directement au central**
> (API + SSE temps réel) ; hors-ligne il bascule sur le backend local SQLite. Voir §7 et
> [[registre_decisions#D-020]].

---

## 2. Données mises en cache / synchronisées (registre des modèles & portées)

### 2.1 Registre des modèles synchronisés (desktop)

Le périmètre de réplication desktop est **explicite** : un registre listé dans
`apps/api/src/modules/sync/sync-models.ts` (`SYNC_MODELS`) déclare, pour chaque modèle Prisma, son
**délégué client** et son **filtre de portée** (`scopeWhere`). Un modèle absent du registre **n'est
pas synchronisé**. Cardinalité de référence : `SyncService.status` renvoie `models = SYNC_MODELS.length`
(`apps/api/src/modules/sync/sync.service.ts`).

### 2.2 Deux portées : GLOBAL vs PAR-SITE

La portée applique la décision [[registre_decisions#D-005]] (**dossier patient centralisé cross-site**)
et son corollaire de réplication (« dossier complet en global », fiche mémoire offline-first).

| Portée | Modèles (extrait vérifié `sync-models.ts`) | Pourquoi |
|--------|--------------------------------------------|----------|
| **GLOBAL** (aucun filtre de site) | Référentiels (`CategoriePatient`, `DroitCategoriePatient`, `MotifConsultation`, `PathologieReference`, `MedicamentReference`, `TypeExamen`, `SocieteSousTraitante`, `EmployeSaris`, `Role`, `Permission`, …) ; **dossier patient** (`Patient`, `IdentitePatient`, `ContactUrgence`, `DonneesEmploi`, `ModeViePatient`, `AllergiePatient`, `AntecedentPatient`, `AlerteMedicale`, rattachements ayant droit / sous-traitant) ; **parcours de soin** (`Visite`, `ConstanteVitale`, `Consultation`, `Ordonnance`/`LigneOrdonnance`, `BonExamen`/`LigneExamen`/`ResultatExamen`, `BonPharmacie`/`LigneBonPharmacie`, `Evacuation`, …) ; **`PersonnelMedical`** | Continuité cross-site **même hors-ligne** : un travailleur muté est retrouvé sur n'importe quel poste → zéro doublon. `PersonnelMedical` global pour afficher le soignant (« Dr X ») d'un acte d'un autre site. |
| **PAR-SITE** (`{ siteId }` ou via relation) | **Comptes** (`Utilisateur` → `BY_SITE` ; `UtilisateurRole`/`UtilisateurPermission` via `utilisateur.siteId`) ; **RH opérationnel** (`PlanningPermutation`, `PresenceJournaliere`, `DelegationPrescription` via `medecinChef.siteId`) ; **messagerie** (`Conversation` → `BY_SITE` ; `Message`/réactions/masques/pièces jointes via `conversation.siteId`) | Comptes locaux au site (login hors-ligne) ; planning/présence/délégation propres au site ; messagerie **cloisonnée par site** ([[registre_decisions#D-012]]). |

> **Confidentialité ≠ portée de réplication.** Le dossier est répliqué en global, mais la
> **confidentialité par dossier** reste portée par le **verrou médecin-chef** ([[registre_decisions#D-006]],
> champs `verrouille/verrouilleParId/verrouilleLe/motifVerrou`), dont le dépouillement s'applique aussi
> sur le backend **local**. L'activité clinique reste **scopée à l'initiateur** ([[registre_decisions#D-007]]).
> Voir [[exigences_non_fonctionnelles#ENF-05]].

### 2.3 Données cachées côté web

Le web ne réplique pas de modèles : il **cache des réponses GET** (service worker NetworkFirst) et
**met en file ses mutations** (§3). Il n'y a donc pas de notion de portée par modèle côté web ;
le scope est garanti par le central à chaque requête (JWT → `siteId`).

---

## 3. File d'actions

### 3.1 File de rejeu côté web (front : IndexedDB chiffrée)

`apps/web/src/lib/sync.ts` + `apps/web/src/lib/api.ts` :

- **Mise en file** : pour une écriture (POST/PUT/PATCH/DELETE, hors `/auth`, `/notifications`, hors
  `FormData`) alors que le poste est hors-ligne **ou** que `fetch` échoue, `request()` appelle
  `enqueueMutation(method, path, body)` puis lève une `OfflineQueuedError` (la mutation est conservée,
  jamais perdue). La requête brute est stockée dans la table Dexie `file_mutations`
  (`apps/web/src/lib/db.ts`), statut `PENDING`, `ordreLocal = Date.now()`, `mutationUuid`.
- **Chiffrement au repos** : le `payloadJson` est chiffré **AES-256-GCM** via `crypto.subtle` avant
  écriture (`offlineCrypto.ts`, format `enc:v1:<base64(iv||ct+tag)>`, IV aléatoire par enregistrement).
  Clé **non-extractible** : desktop = clé brute 32 o dans le coffre `window.saris.secure.*`
  (DPAPI/`safeStorage`) ; web = `CryptoKey` AES-GCM générée et persistée dans IndexedDB (table
  `crypto_keys`). Repli en clair anti-perte si la clé est indisponible (avec `console.warn` non
  sensible). Voir [[exigences_non_fonctionnelles#ENF-04-05]].
  *Limite documentée (honnêteté)* : en web pur, ceci protège l'inspection passive d'IndexedDB, **pas**
  un XSS même-origine.
- **Rejeu ordonné** : `syncPush()` rejoue les `PENDING` **triées par `ordreLocal`** (ordre d'émission)
  via `replayRequest` ; 2xx → `APPLIED`, 4xx → `REJECTED` (pas de re-rejeu), 5xx/réseau → arrêt (reste
  `PENDING`). Les entrées `APPLIED`/`REJECTED` sont purgées.
- **Idempotence** : le rejeu réémet la requête HTTP d'origine ; côté serveur, la cohérence repose sur
  les contraintes d'unicité et le mapping d'erreurs Prisma (`GlobalExceptionFilter` : P2002→409,
  P2025→404, P2003→409 — [[registre_decisions#D-015]]). Un `mutationUuid` est porté localement
  (déduplication/traçabilité de la file).
- **Refresh token au rejeu** : `sync.ts`/`api.ts` rafraîchissent **proactivement** le jeton si proche
  expiration (`jwtExpiresAt`/`isTokenExpiringSoon`) + **un** retry sur 401 pendant le rejeu (branche 401
  placée avant le 4xx générique) → une session expirée laisse la mutation en `PENDING` (jamais purgée à
  tort), avec **un seul** refresh par cycle (garde `refreshAttempted`).
- **Wiring/UX** : `apps/web/src/hooks/useSyncEngine.ts` (monté dans `Sidebar.tsx`) déclenche un
  `syncCycle()` à la transition hors-ligne → en-ligne, puis invalide les requêtes React Query ;
  intervalle de filet [[parametres_metier#PM-23]]. Un chip « N en attente » / « Synchronisation… »
  s'affiche dans `TopHeader.tsx`.

### 3.2 Pull / push côté desktop (réplication de modèles)

`apps/api/src/modules/sync/sync.service.ts` (central) + `sync-client.service.ts` (poste) :

- **PULL** (`pull(siteId, since, limit)`) : pour chaque modèle du registre, lecture des lignes dont
  `updatedAt > since` (curseur), **tombstones inclus** (`deletedAt: undefined` neutralise l'auto-filtre
  soft-delete), scopées par site selon `scopeWhere`. Pagination par lots — taille de page de référence
  500 ([[parametres_metier#PM-46]]/§ENF-02 ; constante `limit = 500`, `take: limit + 1` → `hasMore`).
  L'ordre **suit le registre** (parents avant enfants) pour respecter les clés étrangères à
  l'application côté client (le service **ne re-trie pas** par `updatedAt`). Réponse :
  `{ changes, serverTime, hasMore, nextSince }`.
- **PUSH** (`push(siteId, posteLocalId, changes)`) : applique le lot via `ingest()` (résolution LWW,
  §4), renvoie `{ applied, skipped, conflicts, serverTime }`. **Idempotent** : un push d'enveloppe
  inchangée est `skipped` (round-trip prouvé, fiche mémoire offline-first).
- **Écriture LWW-correcte** (`applyEnvelope`) : `upsert` puis **restauration de l'`updatedAt`/`deletedAt`
  SOURCE en SQL brut** (sinon `@updatedAt` ré-horodaterait et casserait LWW). Bi-provider (placeholders
  `?` SQLite / `$n` PostgreSQL).
- **Sécurité d'accès** : endpoints sous `JwtAuthGuard` + `PermissionsGuard`, permissions
  `synchronisation.read` (pull/status/supervision) et `synchronisation.execute` (push/run) ; le `siteId`
  est **toujours résolu depuis le JWT**, jamais depuis la requête (`sync.controller.ts`,
  `requireUser`). Les sessions de synchronisation desktop (`posteLocalId` présent) sont **exemptées** de
  la révocation « session unique » ([[registre_decisions#D-021]], [[exigences_non_fonctionnelles#ENF-04-02]]).
- **Curseur** : un modèle `SyncState` par poste mémorise `lastPulledAt` (curseur sauvegardé après chaque
  page lors du pull, reprise incrémentale).

---

## 4. Résolution de conflits (LWW + supervision)

La stratégie est **Last-Write-Wins** sur `updatedAt`, avec détection de vrai conflit via
`baseUpdatedAt` ([[registre_decisions#D-016]], [[exigences_non_fonctionnelles#ENF-01-05]]). Logique pure
testée : `packages/types/src/sync-conflict.ts` (17 tests) ; copie côté API
`apps/api/src/modules/sync/conflict.ts` (dupliquée volontairement pour éviter le crash du watcher Nest
sur value-import `@cms-saris/types` — cf. [[plan_modules]]).

### 4.1 Décision (`resolveConflict`)

Pour une enveloppe entrante et une ligne existante (`base = baseUpdatedAt` ou, à défaut, l'`updatedAt`
existant) :

- pas d'existant → **`apply`** ;
- `incoming > existing` : si le serveur a bougé depuis la base (`existing > base`) → **`conflict`,
  gagnant `incoming`** ; sinon → **`apply`** ;
- `incoming < existing` : si le serveur a bougé depuis la base → **`conflict`, gagnant `existing`** ;
  sinon → **`skip`** ;
- égalité → **`skip`**.

> **RM-OS-1** : le **gagnant** d'un conflit est toujours la version au `updatedAt` le plus récent
> (LWW) ; la détection « `conflict` » sert à **journaliser** une écriture concurrente, pas à changer le
> gagnant.

### 4.2 Tombstones (suppressions répliquées)

Le **soft-delete global** ([[registre_decisions#D-015]]) marque `deletedAt` au lieu de supprimer ; ces
**tombstones** sont inclus dans le pull (`deletedAt: undefined` au `findMany`) et traités comme un état
versionné (une suppression « gagne » par LWW comme toute autre écriture). La synchronisation lit via le
client **`raw`** (non filtré) pour **voir** les tombstones (`SyncService.delegate` → `prisma.raw`).

### 4.3 Journal des conflits & supervision

Lors d'un push, chaque `conflict` est reporté avec ses **champs divergents** (`diffFields`, ignore
`updatedAt/createdAt/deletedAt`) et enregistré par `SyncSupervisionService.record` (poste, site,
`valeurLocale`/`valeurServeur`). L'écran admin **Synchronisation** affiche postes en ligne, journaux et
conflits (endpoint `GET /sync/supervision`, scope par site), avec invalidation temps réel
(`broadcastLive('SYNC_ACTIVITY')`).

> **Réserve as-built (honnêteté)** : il n'existe **pas d'UI client de résolution manuelle** de conflit ;
> le serveur applique LWW et **journalise**, la supervision **affiche**. Cf. mémoire offline-first.

---

## 5. Déclencheurs de synchronisation

Les valeurs temporelles ci-dessous sont définies une seule fois dans [[parametres_metier]] et
**référencées** ici (ne pas les redéfinir).

### 5.1 Côté backend embarqué (boucle desktop, `sync-client.service.ts`)

- **Bootstrap** : synchro initiale peu après le démarrage du backend — [[parametres_metier#PM-31]]
  (`onApplicationBootstrap`).
- **Sonde de reconnexion** : sondeur de joignabilité déclenchant une synchro **immédiate** à la
  transition hors-ligne → en-ligne — [[parametres_metier#PM-32]] (`SYNC_PROBE_SEC`, configurable env).
- **Filet de sécurité** : synchro périodique espacée — [[parametres_metier#PM-33]] (`SYNC_SAFETY_SEC`,
  configurable env). Timeout d'une requête — [[parametres_metier#PM-34]] ; backoff borné sur échec —
  [[parametres_metier#PM-35]].
- **Rafraîchissement du jeton de synchro** — [[parametres_metier#PM-29]] (`sync-auth.ts`).

### 5.2 Côté Electron (bascule central ⇄ local, `main.ts`)

- **Sonde du central** — [[parametres_metier#PM-24]] ; **hystérésis** avant bascule —
  [[parametres_metier#PM-25]] (évite le clignotement des reconnexions SSE) ; **délai de retour au
  central** — [[parametres_metier#PM-26]] ; **attente de 1ʳᵉ synchro avant ouverture** (hors-ligne /
  poste vide) — [[parametres_metier#PM-27]] / pas de scrutation `/sync/ready` — [[parametres_metier#PM-28]].

### 5.3 Côté web (filet de rejeu)

- Sonde `/health` (badge connectivité) — [[parametres_metier#PM-20]]/[[parametres_metier#PM-21]],
  anti-clignotement [[parametres_metier#PM-22]] ([[registre_decisions#D-018]]) ; cycle de rejeu de la
  file — [[parametres_metier#PM-23]]. La transition hors-ligne → en-ligne déclenche `syncCycle()`
  (`useSyncEngine.ts`).

---

## 6. Purge des tombstones

`apps/api/src/modules/sync/tombstone-purge.cron.ts` (serveur **central uniquement** ;
`if (isSqlite) return` → pas de purge sur les postes) :

- **Cron quotidien** — [[parametres_metier#PM-36]] (`EVERY_DAY_AT_3AM`).
- **Rétention** : suppression **physique** des lignes `deletedAt` au-delà de **90 jours**
  (`retentionDays = 90`).
- **Garde-fou anti-résurrection** : la borne effective est `min(rétention, min(SyncState.lastPulledAt))`
  → on ne purge **jamais** un changement qu'un poste n'a pas encore vu
  ([[exigences_non_fonctionnelles#ENF-03-04]]). DELETE en SQL brut (contourne l'extension soft-delete),
  pour chaque modèle de `SOFT_DELETE_MODELS`.

> Note : les **notifications expirées** sont purgées par un cron distinct (rétention
> [[parametres_metier#PM-37]], `NotificationPurgeCron`, central uniquement).

---

## 7. Bascule online-first / offline-fallback du desktop

Décision [[registre_decisions#D-020]] (validée E2E : messagerie desktop ↔ web instantanée).

- **En ligne** : le renderer desktop parle **directement au central** (API + SSE temps réel, comme le
  web) → latence faible. `apps/desktop/electron/main.ts` (`startConnectivityWatch`) sonde `/health` du
  central, pousse l'URL active au renderer (`saris:api-url`) ; `connectivity.store.ts` côté web applique
  l'URL et fait reconnecter le flux SSE.
- **Hors-ligne** : le renderer bascule sur le **backend local SQLite** (loopback), qui tourne et
  synchronise en arrière-plan. Le backend embarqué force l'écoute sur **127.0.0.1**
  ([[exigences_non_fonctionnelles#ENF-10-04]]).
- **Activateur clé** : en backend embarqué (`DATABASE_PROVIDER==='sqlite'`, loopback), la stratégie JWT
  **saute la vérification de session en base** — un jeton émis par le central est accepté localement,
  rendant la bascule transparente sans re-login (`apps/api/src/modules/security/strategies/jwt.strategy.ts`).
  La **révocation immédiate** reste effective côté central ([[registre_decisions#D-021]]).
- **Anti-flickering** : hystérésis sur la sonde ([[parametres_metier#PM-25]]) + délai de retour au
  central ([[parametres_metier#PM-26]]).

> **Edge connu (honnêteté)** : un login effectué **hors-ligne** (jeton émis localement, `sid` en SQLite)
> peut être refusé par le central à la reconnexion (session inexistante côté central) → 401/logout. Cas
> rare ; le login en ligne ne le rencontre pas. Cf. mémoire offline-first.

---

## 8. RPO / RTO (objectifs de continuité)

| Indicateur | Objectif as-built | Fondement (code / réf.) |
|------------|-------------------|--------------------------|
| **RPO** (perte de données tolérée) | **0 mutation perdue** | Toute mutation hors-ligne reste en file jusqu'à pousse réussie : SQLite côté desktop (base locale + curseur `SyncState`), IndexedDB chiffrée `PENDING` côté web (jamais purgée tant que non acceptée, même session expirée — retry après refresh). [[exigences_non_fonctionnelles#ENF-01-03]], `apps/web/src/lib/sync.ts`. |
| **RTO** (retour à la cohérence) | **Synchro immédiate à la reconnexion** | Sondeur de joignabilité ≈ 4 s ([[parametres_metier#PM-32]]) + filet 300 s ([[parametres_metier#PM-33]]) ; au 1ᵉʳ lancement d'un poste vide, remplissage par synchro **avant** ouverture (validé E2E : « prêt » ≈ 23 s, ≈ 542 enregistrements reçus). [[exigences_non_fonctionnelles#ENF-01-04]], `sync-client.service.ts`, `apps/desktop/electron/main.ts` (poll `/sync/ready`, max 90 s [[parametres_metier#PM-27]]). |
| **Disponibilité en mode dégradé** | **Continuité locale sans le central** | Chaque poste continue sur sa base SQLite ; la synchro reprend au retour du central. [[exigences_non_fonctionnelles#ENF-03-02]]. |

> *Limites de mesure (honnêteté)* : RPO/RTO sont **validés en E2E sur l'environnement de démo
> (Render/Neon + poste de test)**. Aucun SLA de latence/temps de bascule **p95 sur le réseau SARIS réel**
> n'a été mesuré ([[exigences_non_fonctionnelles#ENF-02]]). Le plan gratuit Render/Neon met le service en
> veille (première requête lente) — pris en compte par le timeout de sonde élevé
> ([[parametres_metier#PM-21]]) et l'anti-clignotement ([[registre_decisions#D-018]]).

---

## 9. Traçabilité

| Thème | Source de vérité |
|-------|------------------|
| Modèle d'architecture | [[registre_decisions#D-001]], [[registre_decisions#D-002]], [[_SOURCE_systeme]] |
| Registre & portées | `apps/api/src/modules/sync/sync-models.ts` ; [[registre_decisions#D-005]] |
| File de rejeu web | `apps/web/src/lib/{sync.ts,api.ts,offlineCrypto.ts,db.ts}` ; [[exigences_non_fonctionnelles#ENF-01-02]] |
| Pull/push desktop | `apps/api/src/modules/sync/{sync.service.ts,sync-controller.ts,sync-client.service.ts}` |
| Conflits LWW | `packages/types/src/sync-conflict.ts`, `apps/api/src/modules/sync/conflict.ts` ; [[registre_decisions#D-016]] |
| Tombstones & purge | `apps/api/src/prisma/soft-delete.extension.ts`, `apps/api/src/modules/sync/tombstone-purge.cron.ts` ; [[registre_decisions#D-015]] |
| Déclencheurs (chiffres) | [[parametres_metier]] (PM-20 à PM-36) |
| Bascule online/offline | [[registre_decisions#D-020]], `apps/desktop/electron/main.ts`, `jwt.strategy.ts` |
| RPO/RTO | [[exigences_non_fonctionnelles#ENF-01]], [[exigences_non_fonctionnelles#ENF-03]] |
| Détail fonctionnel | [[MODULE_16_synchronisation]] |

> Tout document citant un chiffre de synchronisation **doit** le référencer par `PM-xx` et toute
> décision par `D-xxx`, sans les redéfinir localement (principe « une seule source de vérité »,
> méthodo ULAMU).
