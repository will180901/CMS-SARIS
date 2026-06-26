# Décision Base de Données — PostgreSQL 16 + Prisma + Dexie.js

> **État au 06/06/2026 (as-built).** Le modèle de données réellement implémenté compte
> **79 tables** (modèles Prisma) et **22 migrations** appliquées, déployées sur **PostgreSQL 16**
> côté serveur. Le poste client utilise **IndexedDB via Dexie.js 4.4.2** pour le mode hors-ligne.
> Ce document décrit l'architecture telle qu'elle existe dans le code (`packages/db`, `apps/web/src/lib/db.ts`),
> et distingue ce qui est **réalisé** de ce qui reste une **extension future**.

## 1. Deux bases de données : une vérité, deux emplacements

| Emplacement | Technologie | Rôle |
|---|---|---|
| Serveur central | **PostgreSQL 16** | Source de vérité, données de tous les sites (79 tables) |
| Poste local (navigateur) | **IndexedDB via Dexie.js 4.4.2** | Copie de travail offline du site courant + file de rejeu |

Ces deux bases ne sont **pas en miroir total**. Le poste local ne contient que ce dont l'utilisateur a
besoin pour travailler sur son site : les référentiels, les patients du site, les visites et consultations
du jour, ainsi que la file de mutations en attente d'envoi. La base serveur, elle, héberge l'intégralité
du modèle (sécurité, audit, messagerie chiffrée, notifications, sauvegardes, etc.).

## 2. Côté serveur : PostgreSQL 16

### 2.1 Pourquoi PostgreSQL

- Standard de fait pour les applications médicales et les systèmes critiques.
- Support natif du type `JSONB`, utilisé dans plusieurs colonnes réelles du schéma :
  - `avantJson` / `apresJson` dans `JournalAudit` (capture des états avant/après mutation) ;
  - `payloadJson` dans `FileMutation` (requête offline rejouable) ;
  - `valeurLocale` / `valeurServeur` dans `ConflitSynchronisation` ;
  - `contenu` dans `ConstanteVitale` ;
  - `contenuJson` (texte) dans `SauvegardeSysteme` (snapshot de configuration).
- Transactions ACID : cohérence garantie lors de la réception des mutations offline et des opérations
  multi-tables (consultation + ordonnance + bon d'examen).
- Fonctions, contraintes d'unicité et clés étrangères pour l'intégrité référentielle.
- Gratuit, open source, hébergeable on-premise chez SARIS.

La connexion est gérée côté API par un `PrismaService` NestJS (singleton, exposé globalement via
`PrismaModule`), qui établit la connexion à `onModuleInit` et la ferme à `onModuleDestroy`. L'URL de
connexion est lue dans la variable d'environnement `DATABASE_URL`.

### 2.2 Pourquoi Prisma

- Schéma déclaratif en TypeScript : les **79 tables** du dictionnaire se traduisent directement en
  modèles Prisma (`packages/db/prisma/schema.prisma`).
- Migrations versionnées (`prisma migrate dev`) : le schéma évolue sans risque. **22 migrations** sont
  appliquées à ce jour, de `20260518140628_init` à `20260607100000_offline_first_foundations`.
- Client généré (`@prisma/client` v6) = types TypeScript automatiques = cohérence forte avec le code API.
- Lisible par un jury non développeur : le fichier `schema.prisma` se lit presque comme du français,
  avec ses sections commentées par module métier.

### 2.3 Configuration du schéma

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### 2.4 Exemple de modèle Prisma (extrait)

```prisma
model Patient {
  id                    String        @id @default(uuid())
  numeroPatient         String        @unique
  siteCreationId        String
  categoriePatientId    String
  statut                StatutPatient @default(ACTIF)
  createdAt             DateTime      @default(now())
  createdBy             String?
  updatedAt             DateTime      @updatedAt
  updatedBy             String?

  siteCreation          Site               @relation(fields: [siteCreationId], references: [id])
  categoriePatient      CategoriePatient   @relation(fields: [categoriePatientId], references: [id])
  identite              IdentitePatient?
  visites               Visite[]
  alertesMedicales      AlerteMedicale[]
  allergies             AllergiePatient[]
  antecedents           AntecedentPatient[]
}

enum StatutPatient {
  ACTIF
  ARCHIVE
  DECEDE
  FUSIONNE
}
```

## 3. Le modèle de données réel : 79 tables par domaine

Les 79 modèles Prisma sont organisés en domaines fonctionnels, en miroir des modules applicatifs
réellement codés. Le tableau ci-dessous reflète l'état exact du `schema.prisma`.

### 3.1 Sécurité, audit & configuration (17 tables)

| Table | Rôle |
|---|---|
| `Utilisateur` | Compte (passwordHash bcrypt, statut, blocage progressif, lien personnel) |
| `PreferenceUtilisateur` | Thème, densité, langue, page d'accueil + suivi CGU (`cguAccepteeLe`, `cguVersion`) |
| `Role` / `Permission` | Rôles d'accès et catalogue de permissions granulaires (110 permissions) |
| `UtilisateurRole` / `RolePermission` | Liaisons N-N rôles↔utilisateurs et rôles↔permissions |
| `UtilisateurPermission` | Dérogations individuelles GRANT / REVOKE (mode, motif, traçabilité) |
| `SessionUtilisateur` | Sessions actives (refreshTokenHash, IP, user-agent, révocation) |
| `ConfigurationTotp` | Secret 2FA chiffré AES-256-GCM |
| `CodeSecoursTotp` | Codes de secours TOTP hachés bcrypt |
| `JournalAudit` | Journal des mutations métier (avantJson / apresJson, IP, statut) |
| `JournalAuthentification` | Journal des connexions et tentatives (résultat, IP, géolocalisation) |
| `AlerteAnomalie` | Détection d'anomalies / fraude |
| `ParametreSysteme` | Configuration système (sécurité, MDP, notifications, sauvegarde) |
| `SauvegardeSysteme` | Snapshots de configuration (`contenuJson`, périmètre, taille) |

### 3.2 Notifications & messagerie chiffrée (8 tables)

| Table | Rôle |
|---|---|
| `Notification` | Notifications individuelles ou de diffusion (type, niveau, lien, entité) |
| `NotificationLecture` | État de lecture par utilisateur + masque « supprimer pour moi » |
| `Conversation` | Fil DIRECT ou GROUPE |
| `ConversationParticipant` | Participants + `lastReadAt` (accusés de lecture) |
| `Message` | Message chiffré (`contenuChiffre` AES-256-GCM, jamais en clair), `deletedAt` |
| `MessagePieceJointe` | Pièce jointe chiffrée (`contenuChiffre` base64 AES-256-GCM) |
| `MessageReaction` | Réactions emoji (toggle, agrégées par emoji) |
| `MessageMasque` | Suppression « pour moi » par utilisateur |

### 3.3 Référentiels (10 tables)

`Site`, `CategoriePatient`, `DroitCategoriePatient`, `MotifConsultation`, `PathologieReference`,
`MedicamentReference`, `ContreIndicationMedicament`, `TypeExamen`, `EtablissementReference`,
`SocieteSousTraitante`.

### 3.4 Acteurs administratifs & rattachements (11 tables)

`PersonnelMedical`, `HabilitationPersonnel`, `PlanningPermutation`, `PresenceJournaliere`,
`AbsencePersonnel`, `DelegationPrescription`, `DelegationMedicamentAutorise`,
`RattachementAyantDroitCdi`, `HistoriqueRattachementAyantDroit`, `RattachementSousTraitant`,
`HistoriqueRattachementSousTraitant`.

### 3.5 Patient & dossier médical (12 tables)

`Patient`, `IdentitePatient`, `ContactUrgence`, `AllergiePatient`, `AntecedentPatient`,
`AlerteMedicale`, `HistoriqueCategoriePatient`, `FusionDossierPatient`, `PreSaisieMedicale`,
`SuiviGrossesse`, `ConsultationPrenatale` (les deux derniers réservés à une extension future),
`SuiviChronique`.

### 3.6 Triage & accueil (3 tables)

`Visite` (statut `EN_ATTENTE` / `EN_COURS` / `CLOTUREE` / `ANNULEE`, `typeCloture`),
`VisiteEvenement` (audit du parcours), `ConstanteVitale` (constantes vitales).

### 3.7 Consultation & actes (7 tables)

`Consultation` (statut `OUVERTE` / `CLOTUREE` / `ANNULEE`, verrou souple `pickedUpById`),
`DiagnosticConsultation`, `Ordonnance`, `LigneOrdonnance`, `BonExamen`, `LigneExamen`, `ResultatExamen`.

### 3.8 Sorties critiques (4 tables)

`Evacuation`, `SuiviEvacuation`, `AccidentTravail`, `SuiviAccidentTravail`.

### 3.9 Synchronisation offline & paramétrage métier (8 tables)

`PosteLocal`, `FileMutation`, `JournalSynchronisation`, `ConflitSynchronisation`, `ResolutionConflit`,
`AlerteTechnique`, `ParametreMetier`, `HistoriqueParametreMetier`.

> **6 énumérations** complètent le schéma : `StatutCompte`, `ModeOverridePermission`, `StatutPatient`,
> `StatutVisite`, `TypeEvenementVisite`, `StatutConsultation`.

### 3.10 Évolution du modèle depuis le cahier des charges initial (71 → 79 tables)

Le dictionnaire de données initial prévoyait 71 tables. Le modèle as-built en compte **78**, l'écart
correspondant aux fonctionnalités ajoutées en cours de réalisation, toutes **réalisées** :

| Domaine ajouté | Tables ajoutées |
|---|---|
| Messagerie interne chiffrée | `Conversation`, `ConversationParticipant`, `Message`, `MessagePieceJointe`, `MessageReaction`, `MessageMasque` |
| Notifications temps réel | `Notification`, `NotificationLecture` |
| Sauvegarde / restauration de configuration | `SauvegardeSysteme` |

Des colonnes ont par ailleurs enrichi des tables existantes (suivi CGU sur `PreferenceUtilisateur`,
`typeCloture` sur `Visite`, `pickedUpById` sur `Consultation`, masque de notification, `lastSeenAt`
sur `Utilisateur`).

## 4. Côté client : IndexedDB via Dexie.js 4.4.2

### 4.1 Pourquoi IndexedDB

IndexedDB est la seule base de données native du navigateur capable de stocker des données structurées
en grande quantité (plusieurs dizaines de Mo) avec des indexes de recherche. C'est le choix réaliste pour
une PWA offline-first.

### 4.2 Pourquoi Dexie.js plutôt que l'API IndexedDB brute

L'API IndexedDB native est verbeuse et basée sur des callbacks. **Dexie.js 4.4.2** l'encapsule avec une
API propre, fondée sur les Promises et typée TypeScript. L'instance est un singleton exporté
(`apps/web/src/lib/db.ts`), importé partout dans l'application.

### 4.3 Schéma Dexie réel (extrait fidèle)

```typescript
// apps/web/src/lib/db.ts
export class CmsSarisDatabase extends Dexie {
  // Données patients (offline-first, modifiables hors ligne)
  patients!:            Table<PatientLocal>
  identites_patient!:   Table<IdentitePatient>
  allergies_patient!:   Table<AllergiePatient>
  alertes_medicales!:   Table<AlerteMedicale>
  contacts_urgence!:    Table<ContactUrgence>

  // Visites et consultations (offline-first)
  visites!:             Table<VisiteLocal>
  consultations!:       Table<ConsultationLocal>

  // Référentiels (cache lecture seule)
  categories_patient!:  Table<CategoriePatientLocal>
  motifs_consultation!: Table<MotifConsultationLocal>
  medicaments!:         Table<MedicamentLocal>
  pathologies!:         Table<PathologieLocal>
  sites!:               Table<SiteLocal>

  // File de synchronisation
  file_mutations!:      Table<FileMutation>
  journal_sync!:        Table<JournalSync>

  constructor() {
    super('cms-saris-db')
    this.version(1).stores({
      patients:             'id, numeroPatient, siteCreationId, categoriePatientId, statut, syncStatus',
      identites_patient:    'id, patientId, nom, prenom',
      allergies_patient:    'id, patientId, statut',
      alertes_medicales:    'id, patientId, statut, gravite',
      contacts_urgence:     'id, patientId',
      visites:              'id, patientId, siteId, statut, syncStatus, createdAt',
      consultations:        'id, visiteId, medecinId, statut, syncStatus',
      categories_patient:   'id, code',
      motifs_consultation:  'id',
      medicaments:          'id, denomination',
      pathologies:          'id, code',
      sites:                'id, code',
      file_mutations:       '++id, mutationUuid, module, statut, ordreLocal, createdLocalAt',
      journal_sync:         '++id, siteId, statut, startedAt',
    })
  }
}

export const db = new CmsSarisDatabase()
```

### 4.4 Données stockées localement

| Table locale | Données contenues | Durée de cache |
|---|---|---|
| `patients` | Patients du site courant | Mise à jour à chaque sync |
| `identites_patient`, `allergies_patient`, `alertes_medicales`, `contacts_urgence` | Détail médical des patients locaux | Mise à jour à chaque sync |
| `visites` | Visites du site | Mise à jour à chaque sync |
| `consultations` | Consultations associées aux visites locales | Mise à jour à chaque sync |
| `categories_patient`, `motifs_consultation`, `medicaments`, `pathologies`, `sites` | Référentiels (lecture seule) | Mise à jour à chaque sync |
| `file_mutations` | Actions locales en attente d'envoi (file de rejeu) | Purgée après sync réussie |
| `journal_sync` | Historique des synchronisations | Conservé localement |

### 4.5 Chiffrement des données locales (extension future)

> **Statut réel : non implémenté à ce jour.** Le champ `payloadJson` des mutations offline stocke
> aujourd'hui la requête brute rejouable (`{ method, path, body }`) en clair dans IndexedDB. Le code le
> documente explicitement comme un point d'évolution (« Chiffrement AES-GCM prévu — les données restent
> locales à IndexedDB en attendant », `apps/web/src/lib/sync.ts`).

La règle **R-SYNC-007** (« données médicales locales doivent être chiffrées ») reste donc à finaliser
sur le client. L'implémentation cible s'appuiera sur l'API **Web Crypto** native (AES-256-GCM, clé dérivée
du contexte utilisateur), sans dépendance externe. À noter que côté serveur, le chiffrement au repos est
déjà **réalisé** pour les données les plus sensibles : messages et pièces jointes de la messagerie
(`contenuChiffre` AES-256-GCM, avec versionnage et rotation de clé) et secrets TOTP.

## 5. Package partagé : `packages/db`

`packages/db` est le **package central du modèle de données** du monorepo. Il porte le nom
`@cms-saris/db` et est consommé en `workspace:*` par l'API.

### 5.1 Contenu et structure réelle

```
packages/db/
├── prisma/
│   ├── schema.prisma          ← Unique source de vérité (79 tables, 6 enums)
│   ├── migrations/            ← 22 migrations versionnées (init → offline_first_foundations)
│   ├── seed.ts                ← Jeu de données de démonstration (tsx)
│   └── sync-permissions.ts    ← Synchronisation du catalogue de permissions
├── src/
│   └── index.ts               ← Export du singleton PrismaClient
├── tsconfig.json
└── package.json
```

### 5.2 Singleton Prisma partagé (`src/index.ts`)

Le package expose une instance unique de `PrismaClient`, mémorisée sur `globalThis` en dehors de la
production pour éviter la multiplication des connexions lors du rechargement à chaud (HMR / watch). Il
réexporte également le type `PrismaClient` :

```typescript
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export { PrismaClient } from '@prisma/client'
```

### 5.3 Scripts de cycle de vie de la base

Le `package.json` du package centralise les commandes de gestion du schéma (toutes en **pnpm**) :

| Script | Commande | Rôle |
|---|---|---|
| `db:generate` | `prisma generate` | Génère le client typé |
| `db:migrate` | `prisma migrate dev` | Crée et applique une migration |
| `db:studio` | `prisma studio` | Explorateur visuel de la base |
| `db:reset` | `prisma migrate reset` | Réinitialise la base (destructif) |
| `db:seed` | `tsx prisma/seed.ts` | Charge les données de démonstration |
| `db:sync-permissions` | `tsx prisma/sync-permissions.ts` | Aligne le catalogue de permissions |

> **Note opérationnelle (Windows).** La régénération du client (`prisma generate`) peut entrer en conflit
> avec le watcher du serveur API : il faut interrompre le processus de watch avant de lancer migration ou
> génération, faute de quoi le fichier du client reste verrouillé.

### 5.4 Dépendances du package

| Dépendance | Usage |
|---|---|
| `@prisma/client` (v6) | Client typé d'accès à la base |
| `prisma` (v6) | CLI de migration et génération (devDependency) |
| `bcrypt` (v6) | Hachage des mots de passe lors du seed |
| `tsx` | Exécution TypeScript des scripts de seed et de synchronisation |

### 5.5 Données de démonstration (`seed.ts`)

Le seed amorce un environnement de démonstration complet : 2 sites (Moutela, Nkayi), les **110 permissions**
du catalogue, **6 rôles** avec leur matrice de droits par défaut, les comptes de test
(`admin` / `Admin123!` plus comptes métier en `Saris2026!`), 13 agents de personnel médical, ainsi que les
référentiels de base (motifs de consultation, pathologies, médicaments, catégories patients, types
d'examen) et quelques délégations de prescription. Le seed est idempotent : il nettoie les permissions
obsolètes à chaque exécution et préserve la 2FA et les dérogations existantes.

## 6. Synchronisation offline-first : la table `FileMutation`

`FileMutation` est le cœur du mécanisme offline-first. Elle existe des **deux côtés** :

- côté serveur, comme modèle Prisma (`payloadJson` de type `Json`) pour la réception et le rejeu ;
- côté client, comme table Dexie pour la mise en file des écritures effectuées hors ligne.

Principes de fonctionnement réels :

- Lorsqu'une écriture (POST / PATCH / PUT / DELETE) échoue faute de réseau, le client API la capture via
  `enqueueMutation()` et la stocke dans `file_mutations` avec un `mutationUuid` unique
  (`crypto.randomUUID()`), garantissant l'**idempotence** du rejeu (aucune collision avec les UUID serveur).
- Le champ `ordreLocal` (horodatage `Date.now()`) préserve l'**ordre** des opérations lors du rejeu.
- Le moteur `syncPush()` rejoue les mutations `PENDING` par ordre croissant, met à jour leur statut
  (`APPLIED` / `REJECTED` selon le code HTTP) puis purge les entrées traitées.
- Le champ `syncStatus` (`PENDING` / `SYNCED` / `CONFLICT` / `ERROR`) sur les tables locales Dexie est
  spécifique au client : il n'existe **pas** côté serveur.

## 7. Points d'attention

- La structure logique de `FileMutation` est cohérente entre le client (Dexie) et le serveur (PostgreSQL) ;
  seul le format diffère (objet typé côté Dexie, colonne `Json`/`JSONB` côté Postgres).
- Les UUID des entités créées offline sont générés côté client (`crypto.randomUUID()`), nativement
  disponible dans les navigateurs modernes — aucune collision possible avec les UUID serveur.
- Le chiffrement au repos de la base serveur cible les données sensibles spécifiques (messagerie, TOTP) ;
  le chiffrement du payload local IndexedDB reste une **extension future** (cf. §4.5).
- Les anciennes entrées de `SauvegardeSysteme` sans `contenuJson` (issues d'une phase de simulation) ne
  sont pas restaurables ; seules les sauvegardes de périmètre `CONFIGURATION` le sont.

## 8. Hors périmètre / extensions futures

Conformément au cahier des charges, certaines tables présentes dans le schéma sont des **points d'ancrage
pour des évolutions futures** et ne sont pas exploitées par les modules MVP livrés :

- `SuiviGrossesse` et `ConsultationPrenatale` (suivi prénatal détaillé) ;
- la couverture santé fine via `DroitCategoriePatient` au-delà du paramétrage de base ;
- la gestion des stocks de médicaments, la délivrance physique et l'intégration CNSS, qui restent
  explicitement **hors périmètre** du présent projet.
