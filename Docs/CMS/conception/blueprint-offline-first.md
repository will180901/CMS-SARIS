# BLUEPRINT D'IMPLÉMENTATION OFFLINE-FIRST — CMS SARIS

> **Comment lire la documentation offline-first.** Trois documents se complètent ; lisez-les dans cet ordre :
>
> 1. **`plan-offline-first-synchronisation.md`** (racine de `Docs/`) — *vision et plan haut niveau*. Objectifs, principe « local-first », architecture cible et feuille de route. **À lire en premier** pour comprendre le pourquoi et le cap visé.
> 2. **Ce blueprint** (`conception/blueprint-offline-first.md`) — *ingénierie détaillée, phase par phase*. Traduit la vision en étapes d'implémentation concrètes (schéma, migrations, moteur pull/push, embarquement Electron…), avec les faits ancrés dans le code et les points de vigilance.
> 3. **`stack-technique/04-offline-sync.md`** — *état « as-built »*. Décrit ce qui est **réellement implémenté** dans le dépôt (chemins, fichiers, endpoints vérifiables). À consulter pour savoir où en est concrètement le code.
>
> En résumé : **le plan dit où l'on va, ce blueprint dit comment y aller, l'as-built dit où l'on en est.**

---

Racine monorepo : `D:\parcours\mes projets perso\A_realiser\CMS-SARIS\CMS\APP\CMS-SARIS\` (abrégée `<ROOT>` ci-dessous).

**Faits vérifiés dans le code (ancrage, non recopiés des audits) :**
- `schema.prisma` : `datasource db { provider = "postgresql" }`, single datasource ; tous les `@id @default(uuid())` confirmés ; `Utilisateur` a déjà `updatedAt @updatedAt` + `siteId`, `Message` a déjà `deletedAt`.
- `apps/api/src/main.ts` : `bootstrap()` n'est **pas exporté** (`void bootstrap()` en fin de fichier) → à rendre exportable pour l'embarquement.
- `prisma.service.ts` : log « PostgreSQL connectée » codé en dur, pas de PRAGMA, pas de bi-cible.
- `packages/types/src/sync.ts` : les types v2 (`SyncPushPayload/Response`, `SyncPullResponse`, `MutationStatut` avec `CONFLICT`) sont **déjà déclarés mais inutilisés**. On les complète, on ne repart pas de zéro.
- `apps/web/src/lib/sync.ts` : moteur replay v1 fonctionnel, `syncPull()` est un stub vide.
- `apps/web/src/lib/db.ts` : Dexie `version(1)`, table `journal_sync` existe déjà mais vide ; pas de table curseur.
- Module API existant `apps/api/src/modules/admin/synchronisation.*` = **backup/restore config**, PAS le moteur pull/push → ne pas confondre, créer un module distinct.
- `packages/db/prisma/migrations/migration_lock.toml` = `postgresql` (bloque un swap de provider naïf).
- Electron : `config.ts` résout `apiUrl` (env > config.json > baked) ; pas de backend embarqué ; `main.ts`/`preload.ts`/`updater.ts` présents.

**Honnêteté effort** : ~3 semaines-dev pour un MVP synchro mono-site testable, + 1 semaine durcissement. Le risque #1 n'est PAS SQLite (audit confirme 95% portable) ; c'est **la double-cible Prisma client** (un seul `@prisma/client` généré à la fois) et **la cohérence des migrations PG↔SQLite**. Détaillé en §6.

---

## PHASE 0 — Fondations schéma (vérifiable hors-ligne : `prisma validate` + `prisma migrate dev`)

But : rendre chaque entité métier *delta-syncable* (curseur par `updatedAt`) et *tombstone-able* (`deletedAt`). On ne touche QUE le `schema.prisma` PostgreSQL (source de vérité). La cible SQLite en dérive (Phase 1).

### 0.1 — Modèles recevant `updatedAt DateTime @updatedAt @default(now())` ET `deletedAt DateTime?`

Entités métier (`syncable:true`) **mutables** + qui circulent dans le delta. Liste exacte issue de l'audit, recoupée avec le schéma réel :

| Modèle | updatedAt | deletedAt | Note |
|---|---|---|---|
| `Utilisateur` | déjà ✅ | **ajouter** | soft-delete = désactivation logique (statut reste, deletedAt sépare la sync) |
| `Patient` | déjà ✅ | **ajouter** | a `siteCreationId` ; ajouter aussi `siteId` (cf. 0.3) |
| `Visite` | déjà ✅ | **ajouter** | possède `version` aussi → garder pour OCC fin |
| `Conversation` | déjà ✅ | **ajouter** | |
| `Message` | déjà ✅ | déjà ✅ | rien |
| `Site` | — | **ajouter les 2** | |
| `CategoriePatient` | **ajouter les 2** | | référentiel |
| `MotifConsultation` | **ajouter les 2** | | |
| `PathologieReference` | **ajouter les 2** | | |
| `MedicamentReference` | **ajouter les 2** | | |
| `TypeExamen` | **ajouter les 2** | | |
| `EtablissementReference` | **ajouter les 2** | | |
| `SocieteSousTraitante` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `PersonnelMedical` | updatedAt **ajouter** | deletedAt **ajouter** | a déjà siteId |
| `IdentitePatient` | **ajouter les 2** | | |
| `ContactUrgence` | **ajouter les 2** | | |
| `AllergiePatient` | updatedAt **ajouter** | deletedAt **ajouter** | a déjà createdAt |
| `AntecedentPatient` | **ajouter les 2** | | |
| `AlerteMedicale` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `PreSaisieMedicale` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `SuiviGrossesse` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `ConsultationPrenatale` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `ConstanteVitale` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `Consultation` | updatedAt **ajouter** | deletedAt **ajouter** | a `version` → garder |
| `Ordonnance` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `LigneOrdonnance` | **ajouter les 2** | | enfant d'Ordonnance |
| `BonExamen` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `ResultatExamen` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `SuiviChronique` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `Evacuation` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `AccidentTravail` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `MessageReaction` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `MessagePieceJointe` | updatedAt **ajouter** | deletedAt **ajouter** | |
| `Role` / `Permission` | **ajouter updatedAt** | non | quasi-statiques, mais doivent porter un curseur pour le pull |
| `PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel`, `DelegationPrescription`, `RattachementAyantDroitCdi`, `RattachementSousTraitant` | **ajouter les 2** | | RH/affiliations mutables |

**Pattern exact à coller** dans chaque modèle (placer après `createdAt`) :
```prisma
  updatedAt DateTime  @updatedAt @default(now())
  deletedAt DateTime?

  @@index([updatedAt])        // curseur de pull delta
  @@index([siteId, updatedAt]) // si le modèle a siteId (pull scopé)
```

### 0.2 — Tables de liaison : `updatedAt` seul, PAS de `deletedAt`

Pour ces tables, la suppression d'une ligne = retrait d'appartenance, capturée par `updatedAt` du **parent** (re-pull du parent rejoue la liste complète). Ajouter `updatedAt @updatedAt @default(now())` à : `UtilisateurRole`, `RolePermission`, `RolePermission`, `DiagnosticConsultation`, `LigneExamen`, `DelegationMedicamentAutorise`, `DroitCategoriePatient`, `ContreIndicationMedicament`, `HabilitationPersonnel`, `ConversationParticipant`, `NotificationLecture`, `MessageMasque`. (`UtilisateurPermission` a déjà les deux timestamps.)

> Décision : pour les M2M sans `updatedAt` qui n'ont pas de PK propre, on synchronise par **remplacement intégral via le parent** (le pull renvoie l'agrégat parent+enfants), pas en delta ligne-à-ligne. Cela évite les tombstones sur tables de jointure.

### 0.3 — `siteId` manquant (scope tenant)

L'audit signale Patient sans `siteId` (a `siteCreationId`). Pour le scope-par-site du pull/push, chaque entité racine doit porter le site « propriétaire ».
- **Patient** : ajouter `siteId String` (+ relation Site, +index). Valeur = `siteCreationId` à la migration (backfill).
- Entités enfants (Consultation, Ordonnance…) : **ne pas** dupliquer `siteId` ; elles héritent du site via leur chaîne (Visite.siteId / Patient.siteId). Le scope se résout par jointure côté serveur (cf. §2.1 `scopeWhere`).

### 0.4 — Tables techniques pour la synchro (nouvelles)

Le schéma a déjà `FileMutation`, `JournalSynchronisation`, `ConflitSynchronisation`, `ResolutionConflit`, `PosteLocal` (table-log). On AJOUTE **côté serveur central** une table curseur par poste, et côté SQLite local une table miroir (Phase 1). Modèle serveur :

```prisma
// Curseur de synchro par poste/appareil (serveur central)
model SyncState {
  id           String   @id @default(uuid())
  posteLocalId String                       // device id (UUID généré au 1er run)
  siteId       String
  lastPulledAt DateTime @default(now())     // borne haute du dernier pull réussi
  lastPushedAt DateTime?
  updatedAt    DateTime @updatedAt
  @@unique([posteLocalId, siteId])
  @@index([siteId])
}
```

`SyncChangeLog` **n'est pas nécessaire** : le delta se calcule par `WHERE updatedAt > cursor` (les tombstones via `deletedAt` suffisent, pas besoin de journal d'événements append-only). On l'écarte volontairement pour limiter la dette — décision à réviser seulement si on veut un audit cryptographique des deltas.

### 0.5 — Adaptations SQLite (préparées ici, appliquées Phase 1)

D'après l'audit compat : seuls 2 `@db.Text` (`Visite.notesAccueil`, `VisiteEvenement.commentaire`) sont PG-spécifiques. Décision : **les retirer maintenant** du schéma source (SQLite ET PG traitent `String?` comme TEXT illimité ; `@db.Text` est superflu). Cela rend le schéma 100% provider-agnostique et permet l'approche mono-schéma multi-provider (§1.1). Aucun `String[]`, aucun type PG propriétaire, JSON natif des deux côtés (SQLite ≥3.38) — confirmé par l'audit.

### 0.6 — Stratégie de migration (la plus simple : DB fraîche)

Le projet est en pré-prod (DB recréable, `setup-db.ps1` + seed). **Ne pas** faire 40 ALTER incrémentaux.
1. Éditer `schema.prisma` (0.1→0.5) en une passe.
2. `prisma validate` (hors-ligne, vérifie la cohérence) — **gate de validation hors-ligne #1**.
3. Reset + migration consolidée :
   ```
   pnpm --filter @cms-saris/db exec prisma migrate dev --name offline_sync_foundations
   ```
   ⚠️ **Action destructive (reset DB)** → demander confirmation utilisateur avant exécution (règle MEMORY `feedback_actions_destructives`).
4. Backfill `Patient.siteId = siteCreationId` : soit dans le `seed.ts`, soit en SQL d'amorçage dans la migration générée.
5. `pnpm --filter @cms-saris/db db:seed`.

⚠️ **Piège Windows connu (MEMORY `project_synchronisation_refonte`)** : tuer l'arbre du watcher Nest/Vite avant `prisma generate`/`migrate` sinon `query_engine.dll.node` est verrouillé (`EPERM`).

**Fichiers Phase 0** : `<ROOT>\packages\db\prisma\schema.prisma` (édition), `<ROOT>\packages\db\prisma\seed.ts` (backfill siteId), nouvelle migration auto-générée sous `migrations/`.

---

## PHASE 1 — Base locale SQLite + backend NestJS embarqué (exige environnement Electron/DB)

### 1.1 — Schéma SQLite : approche mono-schéma multi-provider (recommandée)

Après 0.5, le schéma est provider-agnostique → **un seul `schema.prisma`**, provider piloté par env. **MAIS** Prisma fige le provider dans `migration_lock.toml` et ne génère qu'**un** client à la fois. Deux solutions :

- **Option A (retenue) — Deux dossiers de migrations, un schéma physique dupliqué au build.**
  - Garder `schema.prisma` (PG) comme source.
  - Script `<ROOT>\packages\db\scripts\gen-sqlite-schema.mjs` : copie `schema.prisma` → `prisma/sqlite/schema.prisma` en remplaçant le bloc `datasource` par `provider="sqlite"` (transformation textuelle, idempotente).
  - `prisma/sqlite/migrations/` avec son `migration_lock.toml = sqlite`.
  - **Le client `@prisma/client` du backend embarqué est généré depuis le schéma SQLite** (le backend embarqué ne parle JAMAIS PG). Le serveur central garde le client PG. Comme api est le même code, on génère le client selon `DATABASE_PROVIDER` au build de chaque cible (cf. 1.5).

- Option B — `provider = env("DATABASE_PROVIDER")` : supporté par Prisma 6 mais `migrate` reste mono-lock ; nécessite quand même deux dossiers de migrations. Pas plus simple qu'A, et plus fragile sur le lock. **Écartée.**

**Fichiers à créer** :
- `<ROOT>\packages\db\scripts\gen-sqlite-schema.mjs`
- `<ROOT>\packages\db\prisma\sqlite\` (généré : `schema.prisma`, `migrations/`, `migration_lock.toml`)
- `package.json` (db) — scripts :
  ```json
  "db:sqlite:gen":     "node scripts/gen-sqlite-schema.mjs",
  "db:sqlite:migrate": "prisma migrate dev   --schema prisma/sqlite/schema.prisma",
  "db:sqlite:deploy":  "prisma migrate deploy --schema prisma/sqlite/schema.prisma",
  "db:sqlite:generate":"prisma generate       --schema prisma/sqlite/schema.prisma"
  ```

> Cohérence PG↔SQLite : générer la migration SQLite à partir du **même** `schema.prisma` transformé garantit l'iso-structure. CI : un test `prisma validate` sur les deux schémas + diff structurel.

### 1.2 — PrismaService bi-cible

`<ROOT>\apps\api\src\prisma\prisma.service.ts` — réécrire :
- Lire `process.env.DATABASE_PROVIDER` (`'sqlite' | 'postgresql'`, défaut `postgresql`).
- `onModuleInit` : après `$connect()`, si SQLite → `await this.$executeRawUnsafe('PRAGMA foreign_keys = ON')` **et** `PRAGMA journal_mode = WAL` (concurrence lecture/écriture) **et** `PRAGMA busy_timeout = 5000`.
- Log dynamique (« SQLite locale connectée » vs « PostgreSQL connectée »).
- (Phase 0 a déjà ajouté `deletedAt` partout → ici, **brancher un Prisma Client Extension** `$extends` qui : intercepte `delete`/`deleteMany` → `update`/`updateMany {deletedAt: now()}` ; ajoute `deletedAt: null` aux `findMany/findFirst/count` par défaut. **Décision** : implémenter l'extension MAIS la rendre opt-out par modèle via une allow-list, car certaines suppressions actuelles font des `deleteMany` d'enfants qu'on veut garder en hard-delete tant que le parent est hard-delete. Pour le MVP, appliquer le soft-delete UNIQUEMENT aux modèles racines de la table 0.1 ayant `deletedAt`, via un `Set<string>` de noms de modèles.)

**Fichier à créer** : `<ROOT>\apps\api\src\prisma\soft-delete.extension.ts` (fonction pure `buildSoftDeleteExtension(models: Set<string>)`, testable unitairement avec un faux client).

### 1.3 — Rendre `bootstrap()` réutilisable

`<ROOT>\apps\api\src\main.ts` — refactor :
- Exporter `export async function bootstrap(opts?: { port?: number; host?: string }): Promise<NestExpressApplication>`.
- `host` défaut `0.0.0.0` (serveur), passé à `'127.0.0.1'` en embarqué (jamais exposé réseau).
- Garder `void bootstrap()` SEULEMENT si lancé directement : `if (require.main === module) void bootstrap()`.
- CORS : ajouter `http://127.0.0.1:*` (origine du frontend Electron en mode local). Comme le port est dynamique, autoriser une fonction `origin` qui accepte `127.0.0.1` quel que soit le port + `app://cms-saris`.

### 1.4 — Démarrage NestJS dans Electron (child process fork)

**Fichiers à créer** :
- `<ROOT>\apps\desktop\electron\backend.ts` :
  - `findFreePort()` (server.listen(0)).
  - `startBackend({dbPath, port})` : `fork(path.join(__dirname,'backend-entry.js'), [], { env: { ...process.env, DATABASE_PROVIDER:'sqlite', DATABASE_URL:`file:${dbPath}`, PORT:String(port), HOST:'127.0.0.1', NODE_ENV:'production' }, silent:false })`.
  - `waitForHealth('http://127.0.0.1:'+port+'/health', { timeoutMs: 30000, intervalMs: 300 })`.
  - `stopBackend()` (SIGTERM + fallback kill).
  - Capturer stdout/stderr → fichier log `%APPDATA%\CMS SARIS\backend.log`.
- `<ROOT>\apps\desktop\electron\backend-entry.ts` :
  ```ts
  import { bootstrap } from '@cms-saris/api/dist/main'
  bootstrap().catch(e => { console.error(e); process.exit(1) })
  ```
- `<ROOT>\apps\desktop\electron\db-init.ts` :
  - `ensureDb(dbPath)` : si fichier absent → exécuter les migrations. Stratégie retenue : **embarquer `prisma migrate deploy`** via le binaire schema-engine packagé, schéma `prisma/sqlite/schema.prisma` copié dans les resources. Fallback si échec migrate : copier un `seed.db` pré-migré+seedé embarqué (généré au build) → garantit un 1er lancement qui ne bloque jamais.

**Fichiers à modifier** :
- `<ROOT>\apps\desktop\electron\main.ts` : dans `app.whenReady()`, AVANT `createMainWindow()` :
  - déterminer le **mode** : `MODE = config.mode ?? 'local'` (`'local' | 'remote'`).
  - si `local` : `dbPath = path.join(app.getPath('userData'),'cms-saris.db')` ; `ensureDb(dbPath)` ; `port = await findFreePort()` ; `await startBackend({dbPath,port})` ; `effectiveApiUrl = 'http://127.0.0.1:'+port`.
  - si `remote` : `effectiveApiUrl = resolveApiUrl()` (comportement actuel inchangé).
  - `app.on('before-quit', stopBackend)`.
- `<ROOT>\apps\desktop\electron\config.ts` : ajouter `mode?: 'local'|'remote'` et `serverUrl?` (URL du serveur central pour la SYNCHRO en mode local — distincte de `apiUrl` qui devient l'API locale). Ajouter `getEffectiveApiUrl()` qui renvoie l'URL locale en mode local.
- `<ROOT>\apps\desktop\electron\preload.ts` : exposer `window.saris.mode`, `window.saris.apiUrl` (résolu), `window.saris.serverUrl` (central). Le frontend lit `apiUrl` au boot au lieu d'une constante.
- `<ROOT>\apps\desktop\electron\server-config.html` : ajouter un choix « Mode autonome (local) / Mode connecté (serveur) » + champ URL serveur central.

### 1.5 — Packaging des engines Prisma SQLite

**Fichier à modifier** : `<ROOT>\apps\desktop\package.json` (bloc `build` electron-builder) :
- `asarUnpack`: `node_modules/.prisma/**`, `node_modules/@prisma/engines/**`, `**/query_engine-windows.dll.node`, `**/schema-engine-windows.exe` (nécessaire pour `migrate deploy` à l'exécution), `node_modules/sharp/**`.
- `extraResources` : `prisma/sqlite/schema.prisma`, `prisma/sqlite/migrations/**`, `seed.db` (fallback).
- `files` : inclure `apps/api/dist/**`, `node_modules/@prisma/client/**`, `node_modules/.prisma/**`.
- Build step : générer le client Prisma **SQLite** avant d'empaqueter (`db:sqlite:gen` → `db:sqlite:generate`), compiler api (`apps/api` → `dist`), compiler electron.
- ⚠️ `binaryTargets = ["native", "windows"]` dans le generator du schéma SQLite pour garantir la `.dll.node` Windows même si build sur autre OS.

**Vérifiable hors-ligne en Phase 1** : `prisma validate` (2 schémas), génération client SQLite, tests unitaires de `soft-delete.extension.ts` et `findFreePort`. **Exige environnement** : fork backend + health, migrate deploy réel, packaging electron-builder.

---

## PHASE 2 — Moteur de synchro pull/push (cœur ; testable : fonctions pures de conflit)

Architecture : **mode local** (Electron) = SQLite via backend embarqué pour le travail quotidien ; un **client de synchro** (dans le backend embarqué, pas le navigateur) parle au **serveur central PG** via 2 endpoints HTTP. On NE réutilise PAS le moteur replay v1 (qui rejoue des requêtes API) — on passe à une **synchro de données par delta** car maintenant on a une vraie base locale. Le replay v1 reste utile uniquement pour le **mode remote pur** (PWA web sans base locale) → on le conserve mais il devient secondaire.

### 2.1 — Endpoints serveur central (sur l'API PG)

**Module à créer** : `<ROOT>\apps\api\src\modules\sync\` → `sync.module.ts`, `sync.controller.ts`, `sync.service.ts`, `sync.dto.ts`. (Distinct du `admin/synchronisation.*` existant = backup config.)

- `GET /sync/pull?siteId=&since=<ISO>&limit=` (auth JWT, permission `SYNC_EXEC`) :
  - Pour chaque modèle syncable, `findMany({ where: { ...scopeWhere(siteId, model), updatedAt: { gt: since } }, orderBy: { updatedAt:'asc' }, take: limit })` — **inclut** les lignes `deletedAt != null` (tombstones) pour propager les suppressions.
  - `scopeWhere` : Site/référentiels globaux → pas de filtre site ; Patient → `{siteId}` ; enfants → jointure (`{ visite: { siteId } }` etc.).
  - Réponse = `SyncPullResponse` (déjà typé dans `packages/types/src/sync.ts`, à enrichir) : `{ changes: Record<modelName, Row[]>, serverTime: ISO, hasMore: bool, nextSince: ISO }`. Pagination par curseur `updatedAt` (le client redemande tant que `hasMore`).
- `POST /sync/push` (body `SyncPushPayload`) :
  - Pour chaque mutation (upsert d'entité avec son `id` UUID) : transaction ; détection conflit par comparaison `updatedAt` (cf. 2.3) ; applique ou renvoie conflit.
  - Réponse `SyncPushResponse` (déjà typé) : `applied[]`, `rejected[]`, `conflicts[]`.
  - Met à jour `SyncState(posteLocalId, siteId)`.
  - **Idempotence** : chaque mutation porte `mutationUuid` ; table `AppliedMutation(mutationUuid @id)` (ajouter au schéma) → `INSERT … ON CONFLICT DO NOTHING` ; si déjà vu → renvoyer `applied` sans réappliquer.

**Fichiers à modifier** : `packages/types/src/sync.ts` (enrichir `SyncPullResponse` en `{changes, serverTime, hasMore, nextSince}`, ajouter `ConflictResolution`, `SyncEntityEnvelope {model, id, op:'upsert'|'delete', data, baseUpdatedAt}`), schéma (table `AppliedMutation`, modèle `SyncState`).

### 2.2 — Client de synchro (dans le backend embarqué)

**Module/fichier à créer** : `<ROOT>\apps\api\src\modules\sync\sync-client.service.ts` (n'est actif QUE si `DATABASE_PROVIDER=sqlite` ET `SERVER_URL` défini) :
- `pull()` : lit curseur local (`SyncState` local), GET `<SERVER_URL>/sync/pull?since=cursor`, applique chaque envelope en local (upsert ; si `deletedAt` set → marque tombstone localement), boucle tant que `hasMore`, écrit `nextSince`.
- `push()` : sélectionne les lignes locales `updatedAt > lastPushedAt` (toutes tables syncable, y compris tombstones), construit `SyncPushPayload`, POST, traite `applied/rejected/conflicts`, écrit `lastPushedAt`.
- `syncCycle()` : `pull()` puis `push()` (pull-first pour minimiser les conflits), déclenché par : reconnexion (health du serveur central OK), timer (ex. 60 s), et action manuelle (écran Synchro).
- `posteLocalId` : généré au 1er run, stocké dans `PosteLocal` local + DPAPI.

**Détection réseau du serveur central** : ping `<SERVER_URL>/health` (réutilise le pattern `useServerHealth` côté client). Le backend embarqué expose `GET /sync/status` (en ligne central ? lastPull/lastPush ? pending count) consommé par l'écran Synchro existant.

### 2.3 — Détection & résolution de conflit (FONCTIONS PURES — testables hors-ligne)

**Fichier à créer** : `<ROOT>\packages\types\src\sync-conflict.ts` (pur, zéro I/O, zéro Prisma → testable unitairement des deux côtés) :

```ts
export type ConflictDecision =
  | { kind: 'apply' }                              // pas de conflit, on écrit
  | { kind: 'skip' }                               // serveur plus récent, on ignore l'entrant
  | { kind: 'conflict'; winner: 'incoming'|'existing'; fields: string[] }

export interface Versioned { updatedAt: string; deletedAt?: string | null }

/** LWW par updatedAt, tombstone-aware. PUR. */
export function resolveConflict(incoming: Versioned, existing: Versioned | null): ConflictDecision

/** Diff des champs réellement divergents (pour journaliser DIFFERENT_FIELDS vs SAME_FIELD). PUR. */
export function diffFields(a: Record<string,unknown>, b: Record<string,unknown>, ignore: string[]): string[]

/** Délétion gagne sur édition concurrente si plus récente. PUR. */
export function mergeTombstone(incoming: Versioned, existing: Versioned): ConflictDecision
```

Règle MVP (sans verrou) : **Last-Write-Wins par `updatedAt`** ; égalité → tie-break déterministe (`posteLocalId` lexicographique) ; tombstone récent l'emporte sur édition. Les conflits « vrais » (deux éditions concurrentes de champs différents) sont **journalisés** en `ConflitSynchronisation` (table déjà au schéma) pour revue, mais LWW tranche pour ne jamais bloquer. **Tests unitaires obligatoires** (`<ROOT>\packages\types\src\sync-conflict.spec.ts`) : ~15 cas (incoming plus récent, existing plus récent, égalité, tombstone vs edit, edit vs tombstone, null existing, champs disjoints…). → **Gate de validation hors-ligne #2**.

### 2.4 — Gestion des suppressions (tombstones)

- Toute suppression = `update {deletedAt: now()}` (via l'extension §1.2). La ligne reste, circule dans le delta, marque `deletedAt` chez tous les postes.
- Le frontend filtre `deletedAt != null` à l'affichage (l'extension le fait par défaut en lecture).
- **Purge** : cron serveur (`@nestjs/schedule`, déjà utilisé pour backups) supprime physiquement les tombstones `deletedAt < now()-90j` UNIQUEMENT après confirmation que tous les `SyncState` actifs ont `lastPulledAt > deletedAt` (sinon un poste hors-ligne 91 j « ressusciterait » la ligne). Fichier : `<ROOT>\apps\api\src\modules\sync\tombstone-purge.cron.ts`.

### 2.5 — Frontend

- L'écran `SynchronisationPage.tsx` existant : ajouter une zone « Synchro données (mode local) » qui lit `GET /sync/status` et offre « Synchroniser maintenant » → `POST /sync/run`. Réutiliser les composants v1.
- `apps/web/src/lib/db.ts` : ajouter `this.version(2).stores({ sync_state: 'siteId, lastPulledAt' })` (curseur côté PWA web si on garde un cache delta) — sinon non requis en mode Electron (la base est SQLite serveur-side). **Décision** : en mode Electron, le frontend reste « thin client » sur l'API locale (pas de double base) → pas de changement Dexie nécessaire pour le mode local. Dexie/replay v1 reste uniquement pour le mode remote-PWA.

**Vérifiable hors-ligne** : `sync-conflict.spec.ts`, DTOs (`prisma validate`), typecheck. **Exige environnement** : pull/push réels, idempotence multi-appel, scénario multi-poste (2 Electron + 1 PG central).

---

## PHASE 3 — Durcissement

- **Tests** :
  - Unitaires purs (hors-ligne) : conflit, diff, soft-delete extension, dérivation curseur.
  - Intégration (DB SQLite éphémère) : pull renvoie tombstones ; push idempotent (rejouer 2× = 1 effet) ; scope site (poste A ne reçoit pas patients site B).
  - E2E multi-poste : 2 backends SQLite + 1 PG ; éditer la même fiche offline des deux côtés → LWW déterministe + 1 entrée `ConflitSynchronisation`.
- **Perf** : index `@@index([siteId, updatedAt])` (Phase 0) ; pagination pull (`limit` 500) ; WAL + busy_timeout ; push en batch transactionnel par lots de 100 ; éviter `invalidateQueries()` global (sélectif par module — déjà noté dans l'audit v1).
- **Reprise** : curseur n'avance QUE sur lot intégralement appliqué (atomicité) ; si crash mi-pull, `nextSince` non écrit → on rejoue (idempotent). Backend embarqué : si fork meurt, Electron le relance (supervisor avec back-off) + bannière UI.
- **Chiffrement base locale (option)** : SQLite chiffré via SQLCipher n'est PAS supporté nativement par le query-engine Prisma standard. Options honnêtes : (a) chiffrer le **fichier** au repos via BitLocker/EFS (recommandé, zéro code) ; (b) clé DPAPI au niveau OS ; (c) SQLCipher = nécessiterait un build custom du moteur → **hors MVP**. Documenter, ne pas tenter (c) sous pression.
- **Sécurité sync** : endpoint `/sync/*` derrière JWT + permission dédiée `SYNC_EXEC` (ajouter au catalogue, +1 perm) ; TLS sur `SERVER_URL` ; payload validable (DTO `whitelist`).

---

## ORDRE D'EXÉCUTION RECOMMANDÉ

1. **Phase 0** (schéma + migration consolidée + seed backfill) — *bloque tout le reste*. Vérifiable hors-ligne par `prisma validate` AVANT le reset DB (qui exige confirmation).
2. **Phase 2.3** (fonctions pures de conflit + tests) — **faisable immédiatement, 100% hors-ligne, sans attendre l'infra**. À faire en parallèle de Phase 1.
3. **Phase 1** (SQLite dérivé + PrismaService bi-cible + bootstrap exportable + fork Electron + packaging).
4. **Phase 2.1/2.2** (endpoints serveur + client embarqué) — dépend de Phase 1 (base locale) + Phase 0 (curseurs).
5. **Phase 2.4** (tombstones/purge), **Phase 2.5** (UI).
6. **Phase 3** (durcissement, perf, E2E multi-poste).

**Vérifiable HORS-LIGNE (aucune DB/Electron) :**
- `prisma validate` des 2 schémas (PG + SQLite généré).
- Tests unitaires : `sync-conflict.spec.ts`, `soft-delete.extension` (faux client), `gen-sqlite-schema.mjs` (snapshot du diff), `findFreePort`, DTOs.
- Typecheck monorepo.

**Exige un ENVIRONNEMENT :**
- DB : `migrate dev/deploy` (PG et SQLite), seed, backfill, requêtes delta réelles.
- Electron : fork backend + health-wait, packaging electron-builder + présence des engines, migrate au 1er lancement.
- Multi-poste : LWW déterministe, idempotence, scope site, purge tombstones — uniquement avec 2 postes + 1 central.

---

## RISQUES BLOQUANTS (issus des audits) & CONTOURNEMENTS

1. **(MAJEUR, sous-estimé par l'audit « sqlite »)** — Prisma ne gère qu'**un client + un `migration_lock` par schéma**. Le backend doit parler PG (central) OU SQLite (embarqué), jamais les deux dans le même process. **Contournement** : deux schémas (source PG + SQLite généré, §1.1 option A), client choisi au build par cible ; le backend embarqué = build SQLite-only, le serveur central = build PG-only. C'est le vrai gros morceau, pas la portabilité du schéma.
2. **Engines Prisma manquants au packaging** (audit embarquement). **Contournement** : `binaryTargets=["native","windows"]`, `asarUnpack` des `.dll.node` + `schema-engine.exe`, fallback `seed.db` pré-migré si `migrate deploy` échoue au 1er run.
3. **Verrou fichier `query_engine.dll.node` sous Windows** (MEMORY) → `generate`/`migrate` échouent (`EPERM`). **Contournement** : tuer l'arbre watcher avant toute opération Prisma (déjà documenté projet).
4. **`@db.Text` PG-spécifique** (audit) — *mineur* : retiré en 0.5, schéma 100% agnostique.
5. **Ressuscitation de lignes supprimées** si purge des tombstones trop agressive vs poste longtemps hors-ligne. **Contournement** : purge conditionnée à `min(SyncState.lastPulledAt) > deletedAt` (§2.4).
6. **Conflits silencieux** (audit v1 : « rejoue blind ») — résolu par LWW `updatedAt` + journalisation `ConflitSynchronisation`, jamais de blocage (pas de verrou, conforme à l'archi cible).
7. **`invalidateQueries()` global** (audit v1) coûteux à la reconnexion → invalidation sélective par module.
8. **Ne PAS value-importer `@cms-saris/types` racine côté API** (MEMORY `project_crud_complet` : crash watcher ESM) → mettre les fonctions pures de conflit dans un sous-chemin (`@cms-saris/types/sync-conflict`) importé en type-only côté API, ou dupliquer la fonction pure dans `apps/api` si le watcher casse. À valider tôt (Phase 2.3).

**Effort total réaliste** : Phase 0 ≈ 1 j (édition mécanique + migration) ; Phase 2.3 ≈ 0,5 j ; Phase 1 ≈ 5–7 j (le bi-cible Prisma + packaging = le risque-temps réel) ; Phase 2.1/2.2 ≈ 4–5 j ; Phase 2.4/2.5 ≈ 2 j ; Phase 3 ≈ 4–5 j. **MVP synchro testable ≈ 3 sem, version durcie ≈ 4 sem.**

Fichiers de référence (absolus) : `<ROOT>=D:\parcours\mes projets perso\A_realiser\CMS-SARIS\CMS\APP\CMS-SARIS` ; schéma `<ROOT>\packages\db\prisma\schema.prisma` ; PrismaService `<ROOT>\apps\api\src\prisma\prisma.service.ts` ; bootstrap `<ROOT>\apps\api\src\main.ts` ; types sync `<ROOT>\packages\types\src\sync.ts` ; client sync v1 `<ROOT>\apps\web\src\lib\sync.ts` ; Dexie `<ROOT>\apps\web\src\lib\db.ts` ; Electron `<ROOT>\apps\desktop\electron\{main,config,preload,updater}.ts` ; module backup existant (à ne pas confondre) `<ROOT>\apps\api\src\modules\admin\synchronisation.*`.