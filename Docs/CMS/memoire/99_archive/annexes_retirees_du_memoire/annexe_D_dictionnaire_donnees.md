# ANNEXE D — Dictionnaire de données

> **Contenu** : les **88 entités** du modèle, avec leurs attributs, types, contraintes et rôle métier.
> **Source** : schéma de données du projet, extraction du 2026-08-10. Voir également INV-02.
> **Statut** : `IMPLÉMENTÉ`.

---

## Comment lire ce dictionnaire

| Colonne | Sens |
|---|---|
| **Attribut** | Nom du champ tel qu'il figure en base |
| **Type SQL** | Type réellement implanté en PostgreSQL |
| **Obl.** | ● = obligatoire (`NOT NULL`) · ○ = facultatif |
| **Clé** | `PK` clé primaire · `FK` clé étrangère · `U` contrainte d'unicité |
| **Défaut** | Valeur par défaut |

**Colonnes techniques communes.** Presque toutes les entités portent `createdAt`, `updatedAt`, et beaucoup `createdBy`, `updatedBy`, `deletedAt`, `version`. Elles sont **conservées** dans ce dictionnaire — contrairement au diagramme de classes qui les omet — car un dictionnaire de données doit être exhaustif.

**Volumétrie** : 88 entités · 967 attributs · 97 associations · 6 énumérations.

---

## Table des énumérations

| Énumération | Valeurs autorisées |
|---|---|
| `StatutCompte` | `ACTIF` · `DESACTIVE` · `BLOQUE` |
| `ModeOverridePermission` | `GRANT` · `REVOKE` |
| `StatutPatient` | `ACTIF` · `ARCHIVE` · `DECEDE` · `FUSIONNE` |
| `StatutVisite` | `EN_ATTENTE` · `EN_COURS` · `CLOTUREE` · `ANNULEE` |
| `TypeEvenementVisite` | `STATUT_CHANGE` · `PRIORITE_CHANGE` · `SOIGNANT_CHANGE` · `NOTES_UPDATE` |
| `StatutConsultation` | `OUVERTE` · `CLOTUREE` · `ANNULEE` |

> ⚠️ Ces six énumérations sont les **seules** contraintes d'état portées par la base. Cinq autres machines à états — ordonnance, bon de pharmacie, bon d'examen, évacuation, suivi de traitement — reposent sur des champs `TEXT` contraints uniquement par le code applicatif. Voir INV-07 § 6, écart E-03.

---

## SÉCURITÉ & AUDIT

*18 entités.*

### `Utilisateur`

*29 attributs · degré 11 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `login` | TEXT | ● | U |  |  |
| `email` | TEXT | ● | U |  |  |
| `passwordHash` | TEXT | ● |  |  |  |
| `statut` | ENUM StatutCompte | ● |  | `ACTIF` |  |
| `motDePasseTemp` | BOOLEAN | ● |  | `false` |  |
| `tentativesEchec` | INTEGER | ● |  | `0` |  |
| `blocageJusquA` | TIMESTAMP(3) | ○ |  |  |  |
| `blocageMinutes` | INTEGER | ● |  | `0` |  |
| `siteId` | TEXT | ● | FK |  |  |
| `personnelMedicalId` | TEXT | ○ | U |  |  |
| `photoUrl` | TEXT | ○ |  |  |  |
| `lastSeenAt` | TIMESTAMP(3) | ○ |  |  | présence : dernière activité (messagerie) |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |
| `createdBy` | TEXT | ○ |  |  | technique |
| `updatedBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `Utilisateur` — *site* → **1** `Site`
- `Utilisateur` — *personnelMedical* → **0..1** `PersonnelMedical`
- `Utilisateur` — *roles* → **0..*** `UtilisateurRole`
- `Utilisateur` — *permissionsOverrides* → **0..*** `UtilisateurPermission`
- `Utilisateur` — *sessions* → **0..*** `SessionUtilisateur`
- `Utilisateur` — *configTotp* → **0..1** `ConfigurationTotp`
- `Utilisateur` — *preferences* → **0..1** `PreferenceUtilisateur`
- `Utilisateur` — *journauxAudit* → **0..*** `JournalAudit`
- `Utilisateur` — *journauxAuth* → **0..*** `JournalAuthentification`
- `Utilisateur` — *conversations* → **0..*** `ConversationParticipant`
- `Utilisateur` — *messagesEnvoyes* → **0..*** `Message`

**Contraintes de table** : `@@index([updatedAt])`

### `Role`

*6 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |

**Associations** :

- `Role` — *utilisateurs* → **0..*** `UtilisateurRole`
- `Role` — *permissions* → **0..*** `RolePermission`

**Contraintes de table** : `@@index([updatedAt])`

### `Permission`

*6 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `module` | TEXT | ● |  |  |  |

**Associations** :

- `Permission` — *roles* → **0..*** `RolePermission`
- `Permission` — *overrides* → **0..*** `UtilisateurPermission`

**Contraintes de table** : `@@index([updatedAt])`

### `UtilisateurPermission`

*10 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `utilisateurId` | TEXT | ● | FK |  |  |
| `permissionId` | TEXT | ● | FK |  |  |
| `mode` | ENUM ModeOverridePermission | ● |  |  |  |
| `motif` | TEXT | ○ |  |  |  |
| `accordePar` | TEXT | ○ |  |  | id de l'admin auteur de la dérogation |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |

**Associations** :

- `UtilisateurPermission` — *utilisateur* → **1** `Utilisateur`
- `UtilisateurPermission` — *permission* → **1** `Permission`

**Contraintes de table** : `@@unique([utilisateurId, permissionId])` · `@@index([utilisateurId])`

### `UtilisateurRole`

*5 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `utilisateurId` | TEXT | ● | FK |  |  |
| `roleId` | TEXT | ● | FK |  |  |

**Associations** :

- `UtilisateurRole` — *utilisateur* → **1** `Utilisateur`
- `UtilisateurRole` — *role* → **1** `Role`

**Contraintes de table** : `@@id([utilisateurId, roleId])` · `@@index([updatedAt])`

### `RolePermission`

*5 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `roleId` | TEXT | ● | FK |  |  |
| `permissionId` | TEXT | ● | FK |  |  |

**Associations** :

- `RolePermission` — *role* → **1** `Role`
- `RolePermission` — *permission* → **1** `Permission`

**Contraintes de table** : `@@id([roleId, permissionId])` · `@@index([updatedAt])`

### `ConfigurationTotp`

*7 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `utilisateurId` | TEXT | ● | U |  |  |
| `secretChiffre` | TEXT | ● |  |  |  |
| `actif` | BOOLEAN | ● |  | `false` |  |
| `activatedAt` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `ConfigurationTotp` — *utilisateur* → **1** `Utilisateur`
- `ConfigurationTotp` — *codesSecours* → **0..*** `CodeSecoursTotp`

### `PreferenceUtilisateur`

*12 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `utilisateurId` | TEXT | ● | PK |  |  |
| `theme` | TEXT | ● |  | `"auto"` | clair | sombre | auto |
| `densite` | TEXT | ● |  | `"confort"` | confort | compact |
| `langue` | TEXT | ● |  | `"fr"` | fr | en |
| `pageAccueil` | TEXT | ● |  | `"dashboard"` | route après connexion |
| `lignesParPage` | INTEGER | ● |  | `25` | INERTE : le défaut réel est 10, dans PREF_DEFAULTS (me.servi |
| `notifEmail` | BOOLEAN | ● |  | `true` | notifications par e-mail |
| `notifApp` | BOOLEAN | ● |  | `true` | notifications dans l'application (cloche) |
| `cguAccepteeLe` | TIMESTAMP(3) | ○ |  |  | date d'acceptation des conditions d'utilisation |
| `cguVersion` | TEXT | ○ |  |  | version des CGU acceptée (re-demande si obsolète) |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |

**Associations** :

- `PreferenceUtilisateur` — *utilisateur* → **1** `Utilisateur`

### `Notification`

*15 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `destinataireId` | TEXT | ○ | FK |  | individuelle si renseigné |
| `siteId` | TEXT | ○ | FK |  | diffusion : null = tous les sites (système global) |
| `requiredPermission` | TEXT | ○ |  |  | diffusion : permission requise pour voir |
| `type` | TEXT | ● |  |  | VISITE_CREE, CONSULTATION_CLOTUREE, SYSTEME… |
| `niveau` | TEXT | ● |  | `"INFO"` | INFO | SUCCES | AVERTISSEMENT | CRITIQUE |
| `titre` | TEXT | ● |  |  |  |
| `message` | TEXT | ● |  |  |  |
| `entiteType` | TEXT | ○ |  |  |  |
| `entiteId` | TEXT | ○ | FK |  |  |
| `lien` | TEXT | ○ |  |  | route frontend (navigation au clic) |
| `createdById` | TEXT | ○ | FK |  | acteur à l'origine |
| `concernedPersonnelIds` | TEXT[] | ● |  | `[]` |  |

**Associations** :

- `Notification` — *lectures* → **0..*** `NotificationLecture`

**Contraintes de table** : `@@index([destinataireId])` · `@@index([siteId])` · `@@index([createdAt])`

### `NotificationLecture`

*7 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `notificationId` | TEXT | ● | FK |  |  |
| `utilisateurId` | TEXT | ● | FK |  |  |
| `readAt` | TIMESTAMP(3) | ● |  | `now(` |  |
| `masque` | BOOLEAN | ● |  | `false` | « supprimée pour moi » : masquée du feed de cet utilisateur |

**Associations** :

- `NotificationLecture` — *notification* → **1** `Notification`

**Contraintes de table** : `@@unique([notificationId, utilisateurId])` · `@@index([updatedAt])` · `@@index([utilisateurId])`

### `SessionUtilisateur`

*12 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `utilisateurId` | TEXT | ● | FK |  |  |
| `posteLocalId` | TEXT | ○ | FK |  |  |
| `refreshTokenHash` | TEXT | ● |  |  |  |
| `ipAdresse` | TEXT | ○ |  |  |  |
| `userAgent` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `expiresAt` | TIMESTAMP(3) | ● |  |  |  |
| `revokedAt` | TIMESTAMP(3) | ○ |  |  |  |
| `derniereActiviteAt` | TIMESTAMP(3) | ○ |  |  |  |
| `appareilId` | TEXT | ○ | FK |  |  |

**Associations** :

- `SessionUtilisateur` — *utilisateur* → **1** `Utilisateur`

**Contraintes de table** : `@@index([utilisateurId, revokedAt])`

### `CodeSecoursTotp`

*6 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `configId` | TEXT | ● | FK |  |  |
| `codeHash` | TEXT | ● |  |  |  |
| `utilise` | BOOLEAN | ● |  | `false` |  |
| `utilisedAt` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `CodeSecoursTotp` — *config* → **1** `ConfigurationTotp`

### `JournalAudit`

*12 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `utilisateurId` | TEXT | ○ | FK |  |  |
| `action` | TEXT | ● |  |  |  |
| `module` | TEXT | ● |  |  |  |
| `entiteType` | TEXT | ○ |  |  |  |
| `entiteId` | TEXT | ○ | FK |  |  |
| `avantJson` | JSONB | ○ |  |  |  |
| `apresJson` | JSONB | ○ |  |  |  |
| `ipAdresse` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `JournalAudit` — *utilisateur* → **0..1** `Utilisateur`

### `JournalAuthentification`

*8 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `utilisateurId` | TEXT | ○ | FK |  |  |
| `login` | TEXT | ● |  |  |  |
| `resultat` | TEXT | ● |  |  |  |
| `ipAdresse` | TEXT | ○ |  |  |  |
| `userAgent` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `JournalAuthentification` — *utilisateur* → **0..1** `Utilisateur`

### `AlerteAnomalie`

*8 attributs · degré 0*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `type` | TEXT | ● |  |  |  |
| `message` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"OUVERTE"` |  |
| `investigPar` | TEXT | ○ |  |  |  |
| `investigAt` | TIMESTAMP(3) | ○ |  |  |  |
| `commentaire` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

### `ParametreSysteme`

*6 attributs · degré 0*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `cle` | TEXT | ● | U |  |  |
| `valeur` | TEXT | ● |  |  |  |
| `description` | TEXT | ○ |  |  |  |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |
| `updatedBy` | TEXT | ○ |  |  | technique |

### `SauvegardeSysteme`

*10 attributs · degré 0*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `type` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  |  |  |
| `declenchePar` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `perimetre` | TEXT | ○ |  |  | 'CONFIGURATION' |
| `contenuJson` | TEXT | ○ |  |  | snapshot JSON |
| `taille` | INTEGER | ○ |  |  | octets du snapshot |
| `finishedAt` | TIMESTAMP(3) | ○ |  |  |  |
| `message` | TEXT | ○ |  |  |  |

### `RapportGenere`

*6 attributs · degré 0*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `type` | TEXT | ● |  |  | HEBDOMADAIRE | MENSUEL | ANNUEL |
| `periodeDebut` | TIMESTAMP(3) | ● |  |  |  |
| `periodeFin` | TIMESTAMP(3) | ● |  |  |  |
| `contenuJson` | TEXT | ● |  |  | snapshot JSON (mêmes données que dashboard.statistiques) |
| `genereLe` | TIMESTAMP(3) | ● |  | `now(` |  |

**Contraintes de table** : `@@index([type, periodeDebut])`

---

## RÉFÉRENTIELS

*12 entités.*

### `Site`

*11 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `localisation` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `Site` — *utilisateurs* → **0..*** `Utilisateur`
- `Site` — *patients* → **0..*** `Patient`
- `Site` — *visites* → **0..*** `Visite`

**Contraintes de table** : `@@index([updatedAt])`

### `CategoriePatient`

*9 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIVE"` |  |

**Associations** :

- `CategoriePatient` — *droits* → **0..*** `DroitCategoriePatient`
- `CategoriePatient` — *patients* → **0..*** `Patient`
- `CategoriePatient` — *historiques* → **0..*** `HistoriqueCategoriePatient`

**Contraintes de table** : `@@index([updatedAt])`

### `PathologieReference`

*11 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `chronique` | BOOLEAN | ● |  | `false` |  |
| `statut` | TEXT | ● |  | `"ACTIVE"` |  |
| `confidentialiteRenforcee` | BOOLEAN | ● |  | `false` |  |

**Associations** :

- `PathologieReference` — *diagnostics* → **0..*** `DiagnosticConsultation`
- `PathologieReference` — *suivis* → **0..*** `SuiviChronique`
- `PathologieReference` — *antecedents* → **0..*** `AntecedentPatient`

**Contraintes de table** : `@@index([updatedAt])`

### `MedicamentReference`

*10 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `nomGenerique` | TEXT | ● |  |  |  |
| `nomCommercial` | TEXT | ○ |  |  |  |
| `familleThera` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |

**Associations** :

- `MedicamentReference` — *contreIndications* → **0..*** `ContreIndicationMedicament`
- `MedicamentReference` — *lignesOrdonnance* → **0..*** `LigneOrdonnance`
- `MedicamentReference` — *lignesBonPharmacie* → **0..*** `LigneBonPharmacie`

**Contraintes de table** : `@@index([updatedAt])`

### `TypeExamen`

*9 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `domaine` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |

**Associations** :

- `TypeExamen` — *lignes* → **0..*** `LigneExamen`
- `TypeExamen` — *lignesOrdonnance* → **0..*** `LigneOrdonnance`

**Contraintes de table** : `@@index([updatedAt])`

### `EtablissementReference`

*9 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `nom` | TEXT | ● |  |  |  |
| `type` | TEXT | ● |  |  |  |
| `localisation` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |

**Associations** :

- `EtablissementReference` — *evacuations* → **0..*** `Evacuation`
- `EtablissementReference` — *ordonnances* → **0..*** `Ordonnance`

**Contraintes de table** : `@@index([updatedAt])`

### `DroitCategoriePatient`

*8 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `categorieId` | TEXT | ● | FK |  |  |
| `typePrestation` | TEXT | ● |  |  |  |
| `couvert` | BOOLEAN | ● |  | `true` |  |
| `plafondConsultations` | INTEGER | ○ |  |  |  |
| `periode` | TEXT | ○ |  |  |  |

**Associations** :

- `DroitCategoriePatient` — *categorie* → **1** `CategoriePatient`

**Contraintes de table** : `@@index([updatedAt])`

### `MotifConsultation`

*8 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `triageAllege` | BOOLEAN | ● |  | `false` |  |

**Associations** :

- `MotifConsultation` — *visites* → **0..*** `Visite`

**Contraintes de table** : `@@index([updatedAt])`

### `TypeConsultation`

*7 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |

**Associations** :

- `TypeConsultation` — *consultations* → **0..*** `Consultation`

**Contraintes de table** : `@@index([updatedAt])`

### `ContreIndicationMedicament`

*7 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `medicamentId` | TEXT | ● | FK |  |  |
| `condition` | TEXT | ● |  |  |  |
| `typeCondition` | TEXT | ● |  |  |  |
| `gravite` | TEXT | ● |  |  |  |

**Associations** :

- `ContreIndicationMedicament` — *medicament* → **1** `MedicamentReference`

**Contraintes de table** : `@@index([updatedAt])`

### `TypeCertificat`

*8 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `code` | TEXT | ● | U |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `modeleTexte` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |

**Associations** :

- `TypeCertificat` — *certificats* → **0..*** `CertificatMedical`

**Contraintes de table** : `@@index([updatedAt])`

### `SocieteSousTraitante`

*7 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `nom` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIVE"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `SocieteSousTraitante` — *rattachements* → **0..*** `RattachementSousTraitant`

**Contraintes de table** : `@@index([updatedAt])`

---

## ACTEURS ADMINISTRATIFS

*12 entités.*

### `PersonnelMedical`

*18 attributs · degré 8 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `nom` | TEXT | ● |  |  |  |
| `prenom` | TEXT | ● |  |  |  |
| `matricule` | TEXT | ● | U |  |  |
| `role` | TEXT | ● |  |  |  |
| `siteId` | TEXT | ○ | FK |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `PersonnelMedical` — *utilisateur* → **0..1** `Utilisateur`
- `PersonnelMedical` — *habilitations* → **0..*** `HabilitationPersonnel`
- `PersonnelMedical` — *plannings* → **0..*** `PlanningPermutation`
- `PersonnelMedical` — *presences* → **0..*** `PresenceJournaliere`
- `PersonnelMedical` — *absences* → **0..*** `AbsencePersonnel`
- `PersonnelMedical` — *delegationsDonnees* → **0..*** `DelegationPrescription`
- `PersonnelMedical` — *delegationsRecues* → **0..*** `DelegationPrescription`
- `PersonnelMedical` — *consultations* → **0..*** `Consultation`

**Contraintes de table** : `@@index([updatedAt])`

### `DelegationPrescription`

*14 attributs · degré 5 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `medecinChefId` | TEXT | ● | FK |  |  |
| `infirmierId` | TEXT | ● | FK |  |  |
| `dateDebut` | TIMESTAMP(3) | ● |  |  |  |
| `dateFin` | TIMESTAMP(3) | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIVE"` |  |
| `perimetre` | TEXT | ○ |  |  |  |

**Associations** :

- `DelegationPrescription` — *medecinChef* → **1** `PersonnelMedical`
- `DelegationPrescription` — *infirmier* → **1** `PersonnelMedical`
- `DelegationPrescription` — *medicamentsAutorises* → **0..*** `DelegationMedicamentAutorise`
- `DelegationPrescription` — *ordonnances* → **0..*** `Ordonnance`
- `DelegationPrescription` — *consultations* → **0..*** `Consultation`

**Contraintes de table** : `@@index([updatedAt])`

### `RattachementAyantDroitCdi`

*13 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `cdiId` | TEXT | ○ | FK |  | (legacy) id du patient CDI rattaché — conservé pour compat |
| `employeId` | TEXT | ○ | FK |  | CDI rattaché dans le registre des employés SARIS (nouveau mo |
| `typeLien` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `dateDebut` | TIMESTAMP(3) | ● |  |  |  |
| `dateFin` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `RattachementAyantDroitCdi` — *employe* → **0..1** `EmployeSaris`
- `RattachementAyantDroitCdi` — *historiques* → **0..*** `HistoriqueRattachementAyantDroit`
- `RattachementAyantDroitCdi` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `RattachementSousTraitant`

*11 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `societeId` | TEXT | ● | FK |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `dateDebut` | TIMESTAMP(3) | ● |  |  |  |
| `dateFin` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `RattachementSousTraitant` — *societe* → **1** `SocieteSousTraitante`
- `RattachementSousTraitant` — *historiques* → **0..*** `HistoriqueRattachementSousTraitant`
- `RattachementSousTraitant` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `EmployeSaris`

*17 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `matricule` | TEXT | ● | U |  |  |
| `nom` | TEXT | ● |  |  |  |
| `prenom` | TEXT | ● |  |  |  |
| `dateNaissance` | TIMESTAMP(3) | ○ |  |  |  |
| `sexe` | TEXT | ○ |  |  |  |
| `fonction` | TEXT | ○ |  |  |  |
| `sectionPaie` | TEXT | ○ |  |  |  |
| `service` | TEXT | ○ |  |  |  |
| `departement` | TEXT | ○ |  |  |  |
| `categorie` | TEXT | ● |  |  | ASSURE_CDI | ASSURE_CDD |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `EmployeSaris` — *patients* → **0..*** `Patient`
- `EmployeSaris` — *rattachementsAyantDroit* → **0..*** `RattachementAyantDroitCdi`

**Contraintes de table** : `@@index([updatedAt])`

### `HabilitationPersonnel`

*8 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `personnelId` | TEXT | ● | FK |  |  |
| `type` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIVE"` |  |
| `dateDebut` | TIMESTAMP(3) | ● |  |  |  |
| `dateFin` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `HabilitationPersonnel` — *personnel* → **1** `PersonnelMedical`

**Contraintes de table** : `@@index([updatedAt])`

### `PlanningPermutation`

*8 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `personnelId` | TEXT | ● | FK |  |  |
| `siteId` | TEXT | ● | FK |  |  |
| `dateDebut` | TIMESTAMP(3) | ● |  |  |  |
| `dateFin` | TIMESTAMP(3) | ● |  |  |  |

**Associations** :

- `PlanningPermutation` — *personnel* → **1** `PersonnelMedical`

**Contraintes de table** : `@@index([updatedAt])`

### `PresenceJournaliere`

*8 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `personnelId` | TEXT | ● | FK |  |  |
| `siteId` | TEXT | ● | FK |  |  |
| `date` | TIMESTAMP(3) | ● |  |  |  |
| `present` | BOOLEAN | ● |  |  |  |

**Associations** :

- `PresenceJournaliere` — *personnel* → **1** `PersonnelMedical`

**Contraintes de table** : `@@index([updatedAt])`

### `AbsencePersonnel`

*7 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `personnelId` | TEXT | ● | FK |  |  |
| `date` | TIMESTAMP(3) | ● |  |  |  |
| `motif` | TEXT | ● |  |  |  |

**Associations** :

- `AbsencePersonnel` — *personnel* → **1** `PersonnelMedical`

**Contraintes de table** : `@@index([updatedAt])`

### `DelegationMedicamentAutorise`

*5 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `delegationId` | TEXT | ● | FK |  |  |
| `medicamentId` | TEXT | ● | FK |  |  |

**Associations** :

- `DelegationMedicamentAutorise` — *delegation* → **1** `DelegationPrescription`

**Contraintes de table** : `@@index([updatedAt])`

### `HistoriqueRattachementAyantDroit`

*6 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `rattachementId` | TEXT | ● | FK |  |  |
| `evenement` | TEXT | ● |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `createdBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `HistoriqueRattachementAyantDroit` — *rattachement* → **1** `RattachementAyantDroitCdi`

### `HistoriqueRattachementSousTraitant`

*6 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `rattachementId` | TEXT | ● | FK |  |  |
| `evenement` | TEXT | ● |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `createdBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `HistoriqueRattachementSousTraitant` — *rattachement* → **1** `RattachementSousTraitant`

---

## DOSSIER PATIENT

*13 entités.*

### `Patient`

*36 attributs · degré 18 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `siteId` | TEXT | ○ | FK |  |  |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `numeroPatient` | TEXT | ● | U |  |  |
| `matricule` | TEXT | ○ | U |  | Matricule employeur (travailleur CDI) — base du rattachement |
| `employeId` | TEXT | ○ | FK |  | Lien vers le registre des employés SARIS (si ce patient EST  |
| `siteCreationId` | TEXT | ● | FK |  |  |
| `categoriePatientId` | TEXT | ● | FK |  |  |
| `statut` | ENUM StatutPatient | ● |  | `ACTIF` |  |
| `version` | INTEGER | ● |  | `1` | technique |
| `verrouille` | BOOLEAN | ● |  | `false` |  |
| `verrouilleParId` | TEXT | ○ | FK |  |  |
| `verrouilleLe` | TIMESTAMP(3) | ○ |  |  |  |
| `motifVerrou` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `createdBy` | TEXT | ○ |  |  | technique |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |
| `updatedBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `Patient` — *siteCreation* → **1** `Site`
- `Patient` — *categoriePatient* → **1** `CategoriePatient`
- `Patient` — *employe* → **0..1** `EmployeSaris`
- `Patient` — *rattachementsAD* → **0..*** `RattachementAyantDroitCdi`
- `Patient` — *rattachementsST* → **0..*** `RattachementSousTraitant`
- `Patient` — *identite* → **0..1** `IdentitePatient`
- `Patient` — *contactUrgence* → **0..1** `ContactUrgence`
- `Patient` — *donneesEmploi* → **0..1** `DonneesEmploi`
- `Patient` — *modeVie* → **0..1** `ModeViePatient`
- `Patient` — *allergies* → **0..*** `AllergiePatient`
- `Patient` — *antecedents* → **0..*** `AntecedentPatient`
- `Patient` — *alertesMedicales* → **0..*** `AlerteMedicale`
- `Patient` — *historiquesCateg* → **0..*** `HistoriqueCategoriePatient`
- `Patient` — *visites* → **0..*** `Visite`
- `Patient` — *preSaisies* → **0..*** `PreSaisieMedicale`
- `Patient` — *suiviGrossesse* → **0..*** `SuiviGrossesse`
- `Patient` — *fusionSource* → **0..1** `FusionDossierPatient`
- `Patient` — *fusionCible* → **0..1** `FusionDossierPatient`

**Contraintes de table** : `@@index([siteId, updatedAt])` · `@@index([updatedAt])`

### `AntecedentPatient`

*10 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `type` | TEXT | ● |  |  |  |
| `pathologieId` | TEXT | ○ | FK |  |  |
| `description` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |

**Associations** :

- `AntecedentPatient` — *pathologie* → **0..1** `PathologieReference`
- `AntecedentPatient` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `HistoriqueCategoriePatient`

*10 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `ancienneCategId` | TEXT | ○ | FK |  |  |
| `nouvelleCategId` | TEXT | ● | FK |  |  |
| `dateEffet` | TIMESTAMP(3) | ● |  |  |  |
| `motif` | TEXT | ○ |  |  |  |
| `createdBy` | TEXT | ○ |  |  | technique |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `HistoriqueCategoriePatient` — *nouvelleCategorie* → **1** `CategoriePatient`
- `HistoriqueCategoriePatient` — *patient* → **1** `Patient`

### `FusionDossierPatient`

*7 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `sourceId` | TEXT | ● | U |  |  |
| `cibleId` | TEXT | ● | U |  |  |
| `createdBy` | TEXT | ● |  |  | technique |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `FusionDossierPatient` — *source* → **1** `Patient`
- `FusionDossierPatient` — *cible* → **1** `Patient`

### `SuiviGrossesse`

*11 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `datePrevueAccouch` | TIMESTAMP(3) | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `devenir` | TEXT | ○ |  |  |  |
| `dateFinReelle` | TIMESTAMP(3) | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `SuiviGrossesse` — *patient* → **1** `Patient`
- `SuiviGrossesse` — *consultationsPrenat* → **0..*** `ConsultationPrenatale`

**Contraintes de table** : `@@index([updatedAt])`

### `ConsultationPrenatale`

*12 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `suiviId` | TEXT | ● | FK |  |  |
| `consultationId` | TEXT | ○ | FK |  |  |
| `termeSemaines` | INTEGER | ● |  |  |  |
| `poids` | DOUBLE PRECISION | ○ |  |  |  |
| `tension` | TEXT | ○ |  |  |  |
| `notes` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `ConsultationPrenatale` — *suivi* → **1** `SuiviGrossesse`
- `ConsultationPrenatale` — *consultation* → **0..1** `Consultation`

**Contraintes de table** : `@@index([updatedAt])`

### `IdentitePatient`

*12 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | U |  |  |
| `nom` | TEXT | ● |  |  |  |
| `prenom` | TEXT | ● |  |  |  |
| `dateNaissance` | TIMESTAMP(3) | ○ |  |  |  |
| `sexe` | TEXT | ○ |  |  |  |
| `telephone` | TEXT | ○ |  |  |  |
| `adresse` | TEXT | ○ |  |  |  |
| `photoUrl` | TEXT | ○ |  |  |  |

**Associations** :

- `IdentitePatient` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `DonneesEmploi`

*9 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | U |  |  |
| `fonction` | TEXT | ○ |  |  |  |
| `sectionPaie` | TEXT | ○ |  |  |  |
| `service` | TEXT | ○ |  |  |  |
| `departement` | TEXT | ○ |  |  |  |

**Associations** :

- `DonneesEmploi` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `ModeViePatient`

*16 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | U |  |  |
| `tabac` | TEXT | ○ |  |  |  |
| `alcool` | TEXT | ○ |  |  |  |
| `drogues` | TEXT | ○ |  |  |  |
| `activitePhysique` | TEXT | ○ |  |  |  |
| `alimentation` | TEXT | ○ |  |  |  |
| `sommeil` | TEXT | ○ |  |  |  |
| `troublesSommeil` | TEXT | ○ |  |  |  |
| `sedentarite` | TEXT | ○ |  |  |  |
| `portCharges` | TEXT | ○ |  |  |  |
| `automedication` | TEXT | ○ |  |  |  |
| `observations` | TEXT | ○ |  |  |  |

**Associations** :

- `ModeViePatient` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `ContactUrgence`

*9 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | U |  |  |
| `nom` | TEXT | ● |  |  |  |
| `prenom` | TEXT | ● |  |  |  |
| `telephone` | TEXT | ● |  |  |  |
| `lien` | TEXT | ● |  |  |  |

**Associations** :

- `ContactUrgence` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `AllergiePatient`

*10 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `substance` | TEXT | ● |  |  |  |
| `gravite` | TEXT | ● |  |  |  |
| `confirme` | BOOLEAN | ● |  | `false` |  |
| `statut` | TEXT | ● |  | `"ACTIVE"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `AllergiePatient` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `AlerteMedicale`

*11 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `type` | TEXT | ● |  |  |  |
| `message` | TEXT | ● |  |  |  |
| `gravite` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIVE"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `resolvedAt` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `AlerteMedicale` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

### `PreSaisieMedicale`

*10 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `visiteId` | TEXT | ○ | FK |  |  |
| `type` | TEXT | ● |  |  |  |
| `contenu` | JSONB | ● |  |  |  |
| `valide` | BOOLEAN | ● |  | `false` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `PreSaisieMedicale` — *patient* → **1** `Patient`

**Contraintes de table** : `@@index([updatedAt])`

---

## ACCUEIL & TRIAGE

*3 entités.*

### `Visite`

*22 attributs · degré 6 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ● | FK |  |  |
| `siteId` | TEXT | ● | FK |  |  |
| `motifPrincipalId` | TEXT | ● | FK |  |  |
| `statut` | ENUM StatutVisite | ● |  | `EN_ATTENTE` |  |
| `soignantId` | TEXT | ○ | FK |  |  |
| `notesAccueil` | TEXT | ○ |  |  | Observations cliniques saisies au triage |
| `motifAnnulation` | TEXT | ○ |  |  | Renseigné uniquement si statut=ANNULEE |
| `typeCloture` | TEXT | ○ |  |  | AVEC_CONSULTATION | SANS_CONSULTATION (si CLOTUREE) |
| `dateOuverture` | TIMESTAMP(3) | ● |  | `now(` |  |
| `dateCloture` | TIMESTAMP(3) | ○ |  |  |  |
| `creerHorsLigne` | BOOLEAN | ● |  | `false` |  |
| `version` | INTEGER | ● |  | `1` | technique |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |

**Associations** :

- `Visite` — *site* → **1** `Site`
- `Visite` — *motifPrincipal* → **1** `MotifConsultation`
- `Visite` — *patient* → **1** `Patient`
- `Visite` — *constantes* → **0..*** `ConstanteVitale`
- `Visite` — *consultations* → **0..*** `Consultation`
- `Visite` — *evenements* → **0..*** `VisiteEvenement`

**Contraintes de table** : `@@index([updatedAt])`

### `VisiteEvenement`

*9 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `visiteId` | TEXT | ● | FK |  |  |
| `type` | ENUM TypeEvenementVisite | ● |  |  |  |
| `ancienneVal` | TEXT | ○ |  |  | Valeur avant (statut/priorité/soignantId) |
| `nouvelleVal` | TEXT | ○ |  |  | Valeur après |
| `acteurId` | TEXT | ● | FK |  | Personnel qui a fait l'action |
| `commentaire` | TEXT | ○ |  |  | Motif (annulation, ré-évaluation, etc.) |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `VisiteEvenement` — *visite* → **1** `Visite`

**Contraintes de table** : `@@index([visiteId, createdAt])`

### `ConstanteVitale`

*23 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `visiteId` | TEXT | ● | FK |  |  |
| `patientId` | TEXT | ● | FK |  |  |
| `temperature` | DOUBLE PRECISION | ○ |  |  |  |
| `tensionSystolique` | INTEGER | ○ |  |  |  |
| `tensionDiastolique` | INTEGER | ○ |  |  |  |
| `frequenceCardiaque` | INTEGER | ○ |  |  |  |
| `frequenceRespiratoire` | INTEGER | ○ |  |  |  |
| `saturationO2` | DOUBLE PRECISION | ○ |  |  |  |
| `poids` | DOUBLE PRECISION | ○ |  |  |  |
| `taille` | DOUBLE PRECISION | ○ |  |  |  |
| `imc` | DOUBLE PRECISION | ○ |  |  |  |
| `glycemie` | DOUBLE PRECISION | ○ |  |  |  |
| `etatConscience` | TEXT | ○ |  |  |  |
| `scoreGlasgow` | INTEGER | ○ |  |  |  |
| `etatGeneral` | TEXT | ○ |  |  |  |
| `hydratation` | TEXT | ○ |  |  |  |
| `coloration` | TEXT | ○ |  |  |  |
| `saisiePar` | TEXT | ● |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `ConstanteVitale` — *visite* → **1** `Visite`

**Contraintes de table** : `@@index([updatedAt])`

---

## CONSULTATION & ACTES PRESCRITS

*11 entités.*

### `Consultation`

*37 attributs · degré 13 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `visiteId` | TEXT | ● | FK |  |  |
| `soignantId` | TEXT | ● | FK |  |  |
| `delegationId` | TEXT | ○ | FK |  |  |
| `statut` | ENUM StatutConsultation | ● |  | `OUVERTE` |  |
| `anamneseDateDebut` | TIMESTAMP(3) | ○ |  |  |  |
| `anamneseDuree` | TEXT | ○ |  |  |  |
| `anamneseModeDebut` | TEXT | ○ |  |  |  |
| `anamneseSymptomes` | TEXT | ○ |  |  |  |
| `examenClinique` | TEXT | ○ |  |  |  |
| `conclusion` | TEXT | ○ |  |  |  |
| `decisionMedicale` | TEXT | ○ |  |  |  |
| `motifAnnulation` | TEXT | ○ |  |  | Motif de l'annulation (traçabilité, si statut ANNULEE) |
| `typeConsultationId` | TEXT | ○ | FK |  |  |
| `reposJours` | INTEGER | ○ |  |  |  |
| `reposInclutJour` | BOOLEAN | ○ |  | `false` |  |
| `dateReprise` | TIMESTAMP(3) | ○ |  |  |  |
| `version` | INTEGER | ● |  | `1` | technique |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `closedAt` | TIMESTAMP(3) | ○ |  |  |  |
| `pickedUpById` | TEXT | ○ | FK |  | Utilisateur.id qui a la consultation en main (verrou souple) |
| `pickedUpAt` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `Consultation` — *typeConsultation* → **0..1** `TypeConsultation`
- `Consultation` — *soignant* → **1** `PersonnelMedical`
- `Consultation` — *delegation* → **0..1** `DelegationPrescription`
- `Consultation` — *consultationsPrenat* → **0..*** `ConsultationPrenatale`
- `Consultation` — *visite* → **1** `Visite`
- `Consultation` — *diagnostics* → **0..*** `DiagnosticConsultation`
- `Consultation` — *ordonnances* → **0..*** `Ordonnance`
- `Consultation` — *bonsExamen* → **0..*** `BonExamen`
- `Consultation` — *bonsPharmacie* → **0..*** `BonPharmacie`
- `Consultation` — *suiviChronique* → **0..*** `SuiviChronique`
- `Consultation` — *evacuation* → **0..1** `Evacuation`
- `Consultation` — *suiviTraitement* → **0..1** `SuiviTraitement`
- `Consultation` — *certificats* → **0..*** `CertificatMedical`

**Contraintes de table** : `@@index([updatedAt])`

### `Ordonnance`

*18 attributs · degré 6 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `consultationId` | TEXT | ● | FK |  |  |
| `prescripteurId` | TEXT | ● | FK |  |  |
| `delegationId` | TEXT | ○ | FK |  |  |
| `statut` | TEXT | ● |  | `"BROUILLON"` |  |
| `typeOrdonnance` | TEXT | ○ |  |  |  |
| `indicationClinik` | TEXT | ○ |  |  |  |
| `etablissementId` | TEXT | ○ | FK |  |  |
| `motifAnnulation` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `Ordonnance` — *etablissement* → **0..1** `EtablissementReference`
- `Ordonnance` — *delegation* → **0..1** `DelegationPrescription`
- `Ordonnance` — *consultation* → **1** `Consultation`
- `Ordonnance` — *lignes* → **0..*** `LigneOrdonnance`
- `Ordonnance` — *bonsExamen* → **0..*** `BonExamen`
- `Ordonnance` — *bonsPharmacie* → **0..*** `BonPharmacie`

**Contraintes de table** : `@@index([updatedAt])`

### `BonExamen`

*14 attributs · degré 4 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `consultationId` | TEXT | ● | FK |  |  |
| `ordonnanceId` | TEXT | ○ | FK |  |  |
| `indicationClinik` | TEXT | ● |  |  |  |
| `etablissementId` | TEXT | ○ | FK |  |  |
| `statut` | TEXT | ● |  | `"EN_ATTENTE"` |  |
| `motifAnnulation` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `BonExamen` — *consultation* → **1** `Consultation`
- `BonExamen` — *ordonnance* → **0..1** `Ordonnance`
- `BonExamen` — *lignes* → **0..*** `LigneExamen`
- `BonExamen` — *resultats* → **0..*** `ResultatExamen`

**Contraintes de table** : `@@index([updatedAt])`

### `LigneOrdonnance`

*15 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `ordonnanceId` | TEXT | ● | FK |  |  |
| `medicamentId` | TEXT | ○ | FK |  |  |
| `posologie` | TEXT | ○ |  |  |  |
| `duree` | TEXT | ○ |  |  |  |
| `voieAdmin` | TEXT | ○ |  |  |  |
| `quantite` | TEXT | ○ |  |  |  |
| `instructions` | TEXT | ○ |  |  |  |
| `justification` | TEXT | ○ |  |  |  |
| `typeExamenId` | TEXT | ○ | FK |  |  |

**Associations** :

- `LigneOrdonnance` — *medicament* → **0..1** `MedicamentReference`
- `LigneOrdonnance` — *typeExamen* → **0..1** `TypeExamen`
- `LigneOrdonnance` — *ordonnance* → **1** `Ordonnance`

**Contraintes de table** : `@@index([updatedAt])`

### `BonPharmacie`

*15 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `consultationId` | TEXT | ● | FK |  |  |
| `prescripteurId` | TEXT | ● | FK |  |  |
| `ordonnanceId` | TEXT | ○ | FK |  |  |
| `statut` | TEXT | ● |  | `"EN_ATTENTE"` | EN_ATTENTE | DELIVRE | ANNULE |
| `observations` | TEXT | ○ |  |  |  |
| `delivreLe` | TIMESTAMP(3) | ○ |  |  |  |
| `delivrePar` | TEXT | ○ |  |  |  |
| `motifAnnulation` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `BonPharmacie` — *consultation* → **1** `Consultation`
- `BonPharmacie` — *ordonnance* → **0..1** `Ordonnance`
- `BonPharmacie` — *lignes* → **0..*** `LigneBonPharmacie`

**Contraintes de table** : `@@index([updatedAt])`

### `DiagnosticConsultation`

*8 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `consultationId` | TEXT | ● | FK |  |  |
| `pathologieId` | TEXT | ● | FK |  |  |
| `type` | TEXT | ● |  | `"PRINCIPAL"` |  |
| `certitude` | TEXT | ● |  | `"CONFIRME"` |  |

**Associations** :

- `DiagnosticConsultation` — *pathologie* → **1** `PathologieReference`
- `DiagnosticConsultation` — *consultation* → **1** `Consultation`

**Contraintes de table** : `@@index([updatedAt])`

### `LigneExamen`

*6 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `bonId` | TEXT | ● | FK |  |  |
| `typeExamenId` | TEXT | ● | FK |  |  |

**Associations** :

- `LigneExamen` — *typeExamen* → **1** `TypeExamen`
- `LigneExamen` — *bon* → **1** `BonExamen`

**Contraintes de table** : `@@index([updatedAt])`

### `LigneBonPharmacie`

*10 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `bonId` | TEXT | ● | FK |  |  |
| `medicamentId` | TEXT | ○ | FK |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `posologie` | TEXT | ○ |  |  |  |
| `quantite` | TEXT | ○ |  |  |  |

**Associations** :

- `LigneBonPharmacie` — *medicament* → **0..1** `MedicamentReference`
- `LigneBonPharmacie` — *bon* → **1** `BonPharmacie`

**Contraintes de table** : `@@index([updatedAt])`

### `SuiviChronique`

*15 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `patientId` | TEXT | ○ | FK |  |  |
| `consultationId` | TEXT | ○ | FK |  |  |
| `pathologieId` | TEXT | ● | FK |  |  |
| `frequenceSuivi` | TEXT | ○ |  |  |  |
| `objectifs` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"ACTIF"` |  |
| `motifCloture` | TEXT | ○ |  |  |  |
| `motifAnnulation` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `closedAt` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `SuiviChronique` — *pathologie* → **1** `PathologieReference`
- `SuiviChronique` — *consultation* → **0..1** `Consultation`

**Contraintes de table** : `@@index([updatedAt])`

### `CertificatMedical`

*14 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `consultationId` | TEXT | ● | FK |  |  |
| `typeCertificatId` | TEXT | ● | FK |  |  |
| `dateApplication` | TIMESTAMP(3) | ○ |  |  |  |
| `dureeJours` | INTEGER | ○ |  |  |  |
| `dateFin` | TIMESTAMP(3) | ○ |  |  |  |
| `contenu` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"EMIS"` |  |
| `motifAnnulation` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `CertificatMedical` — *typeCertificat* → **1** `TypeCertificat`
- `CertificatMedical` — *consultation* → **1** `Consultation`

**Contraintes de table** : `@@index([updatedAt])`

### `ResultatExamen`

*11 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `bonId` | TEXT | ● | FK |  |  |
| `laboratoire` | TEXT | ○ |  |  |  |
| `contenu` | TEXT | ● |  |  |  |
| `interpretation` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"RECU"` |  |
| `saisiePar` | TEXT | ● |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `ResultatExamen` — *bon* → **1** `BonExamen`

**Contraintes de table** : `@@index([updatedAt])`

---

## SORTIES CRITIQUES

*2 entités.*

### `Evacuation`

*14 attributs · degré 3 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `consultationId` | TEXT | ● | U |  |  |
| `motifId` | TEXT | ○ | FK |  |  |
| `niveauUrgence` | TEXT | ● |  |  |  |
| `etablissementId` | TEXT | ○ | FK |  |  |
| `infosCliniques` | TEXT | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"EN_COURS"` |  |
| `motifAnnulation` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `Evacuation` — *etablissement* → **0..1** `EtablissementReference`
- `Evacuation` — *consultation* → **1** `Consultation`
- `Evacuation` — *suivi* → **0..*** `SuiviEvacuation`

**Contraintes de table** : `@@index([updatedAt])`

### `SuiviEvacuation`

*7 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `evacuationId` | TEXT | ● | FK |  |  |
| `notes` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `createdBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `SuiviEvacuation` — *evacuation* → **1** `Evacuation`

---

## SUIVI DE TRAITEMENT

*2 entités.*

### `SuiviTraitement`

*12 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `consultationId` | TEXT | ● | U |  |  |
| `motif` | TEXT | ● |  |  |  |
| `statut` | TEXT | ● |  | `"EN_COURS"` |  |
| `motifCloture` | TEXT | ○ |  |  |  |
| `motifAnnulation` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `closedAt` | TIMESTAMP(3) | ○ |  |  |  |

**Associations** :

- `SuiviTraitement` — *consultation* → **1** `Consultation`
- `SuiviTraitement` — *fiches* → **0..*** `FicheSuiviTraitement`

**Contraintes de table** : `@@index([updatedAt])`

### `FicheSuiviTraitement`

*15 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `suiviTraitementId` | TEXT | ● | FK |  |  |
| `temperature` | DOUBLE PRECISION | ○ |  |  |  |
| `tensionSystolique` | INTEGER | ○ |  |  |  |
| `tensionDiastolique` | INTEGER | ○ |  |  |  |
| `frequenceCardiaque` | INTEGER | ○ |  |  |  |
| `frequenceRespiratoire` | INTEGER | ○ |  |  |  |
| `saturationO2` | INTEGER | ○ |  |  |  |
| `poids` | DOUBLE PRECISION | ○ |  |  |  |
| `noteEvolution` | TEXT | ○ |  |  |  |
| `medicamentsAdministres` | TEXT | ○ |  |  |  |
| `resultatExamen` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `createdBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `FicheSuiviTraitement` — *suiviTraitement* → **1** `SuiviTraitement`

---

## MESSAGERIE INTERNE (chiffrée)

*7 entités.*

### `Message`

*19 attributs · degré 7 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `conversationId` | TEXT | ● | FK |  |  |
| `expediteurId` | TEXT | ● | FK |  |  |
| `type` | TEXT | ● |  | `"TEXTE"` | TEXTE | SYSTEME (événement de groupe : ajout/retrait/promoti |
| `contenuChiffre` | TEXT | ● |  |  | contenu AES-256-GCM (jamais en clair) |
| `replyToId` | TEXT | ○ | FK |  | message cité (réponse) |
| `epingle` | BOOLEAN | ● |  | `false` |  |
| `transfere` | BOOLEAN | ● |  | `false` | transféré depuis une autre conversation |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |
| `editedAt` | TIMESTAMP(3) | ○ |  |  |  |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |

**Associations** :

- `Message` — *expediteur* → **1** `Utilisateur`
- `Message` — *conversation* → **1** `Conversation`
- `Message` — *piecesJointes* → **0..*** `MessagePieceJointe`
- `Message` — *reactions* → **0..*** `MessageReaction`
- `Message` — *masques* → **0..*** `MessageMasque`
- `Message` — *replyTo* → **0..1** `Message`

**Contraintes de table** : `@@index([conversationId])` · `@@index([conversationId, createdAt])` · `@@index([replyToId])`

### `Conversation`

*12 attributs · degré 2 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `type` | TEXT | ● |  | `"DIRECT"` | DIRECT | GROUPE |
| `titre` | TEXT | ○ |  |  | titre des conversations de groupe |
| `description` | TEXT | ○ |  |  | description du groupe |
| `photoUrl` | TEXT | ○ |  |  | photo du groupe (data URL Base64, même convention que les au |
| `siteId` | TEXT | ○ | FK |  |  |
| `createdById` | TEXT | ○ | FK |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |

**Associations** :

- `Conversation` — *participants* → **0..*** `ConversationParticipant`
- `Conversation` — *messages* → **0..*** `Message`

**Contraintes de table** : `@@index([updatedAt])`

### `ConversationParticipant`

*10 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `conversationId` | TEXT | ● | FK |  |  |
| `utilisateurId` | TEXT | ● | FK |  |  |
| `estAdmin` | BOOLEAN | ● |  | `false` | admin de groupe (le créateur est identifié via Conversation. |
| `muted` | BOOLEAN | ● |  | `false` | notifications de CETTE conversation désactivées pour cet uti |
| `lastReadAt` | TIMESTAMP(3) | ○ |  |  |  |
| `joinedAt` | TIMESTAMP(3) | ● |  | `now(` |  |

**Associations** :

- `ConversationParticipant` — *utilisateur* → **1** `Utilisateur`
- `ConversationParticipant` — *conversation* → **1** `Conversation`

**Contraintes de table** : `@@unique([conversationId, utilisateurId])` · `@@index([updatedAt])` · `@@index([utilisateurId])`

### `MessageMasque`

*6 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `messageId` | TEXT | ● | FK |  |  |
| `utilisateurId` | TEXT | ● | FK |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `MessageMasque` — *message* → **1** `Message`

**Contraintes de table** : `@@unique([messageId, utilisateurId])` · `@@index([updatedAt])` · `@@index([utilisateurId])`

### `MessageReaction`

*8 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `messageId` | TEXT | ● | FK |  |  |
| `utilisateurId` | TEXT | ● | FK |  |  |
| `emoji` | TEXT | ● |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `MessageReaction` — *message* → **1** `Message`

**Contraintes de table** : `@@unique([messageId, utilisateurId, emoji])` · `@@index([updatedAt])` · `@@index([messageId])`

### `MessagePieceJointe`

*10 attributs · degré 1 · **suppression logique***

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `updatedAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `deletedAt` | TIMESTAMP(3) | ○ |  |  | technique |
| `id` | TEXT | ● | PK | `uuid(` |  |
| `messageId` | TEXT | ● | FK |  |  |
| `nomFichier` | TEXT | ● |  |  |  |
| `mimeType` | TEXT | ● |  |  |  |
| `taille` | INTEGER | ● |  |  | octets (taille en clair, avant chiffrement) |
| `contenuChiffre` | TEXT | ● |  |  | octets AES-256-GCM (base64, jamais en clair) |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `MessagePieceJointe` — *message* → **1** `Message`

**Contraintes de table** : `@@index([updatedAt])` · `@@index([messageId])`

### `SyncState`

> Curseur de synchronisation par poste/appareil et par site (serveur central).

*6 attributs · degré 0*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `posteLocalId` | TEXT | ● | FK |  |  |
| `siteId` | TEXT | ● | FK |  |  |
| `lastPulledAt` | TIMESTAMP(3) | ● |  | `now(` |  |
| `lastPushedAt` | TIMESTAMP(3) | ○ |  |  |  |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |

**Contraintes de table** : `@@unique([posteLocalId, siteId])` · `@@index([siteId])`

---

## SYNCHRONISATION OFFLINE

*8 entités.*

### `PosteLocal`

*9 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `siteId` | TEXT | ● | FK |  |  |
| `libelle` | TEXT | ● |  |  |  |
| `dernierUtilisateurId` | TEXT | ○ | FK |  |  |
| `derniereSyncAt` | TIMESTAMP(3) | ○ |  |  |  |
| `masque` | BOOLEAN | ● |  | `false` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `PosteLocal` — *fileMutations* → **0..*** `FileMutation`
- `PosteLocal` — *journauxSync* → **0..*** `JournalSynchronisation`

### `JournalSynchronisation`

*9 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `posteLocalId` | TEXT | ● | FK |  |  |
| `startedAt` | TIMESTAMP(3) | ● |  | `now(` |  |
| `finishedAt` | TIMESTAMP(3) | ○ |  |  |  |
| `statut` | TEXT | ● |  | `"EN_COURS"` |  |
| `nbMutations` | INTEGER | ● |  | `0` |  |
| `nbConflits` | INTEGER | ● |  | `0` |  |

**Associations** :

- `JournalSynchronisation` — *posteLocal* → **1** `PosteLocal`
- `JournalSynchronisation` — *conflits* → **0..*** `ConflitSynchronisation`

### `ConflitSynchronisation`

*12 attributs · degré 2*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `journalId` | TEXT | ● | FK |  |  |
| `mutationUuid` | TEXT | ● |  |  |  |
| `entiteType` | TEXT | ● |  |  |  |
| `entiteId` | TEXT | ● | FK |  |  |
| `typeConflit` | TEXT | ● |  |  |  |
| `valeurLocale` | JSONB | ● |  |  |  |
| `valeurServeur` | JSONB | ● |  |  |  |
| `statut` | TEXT | ● |  | `"EN_ATTENTE"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `ConflitSynchronisation` — *journal* → **1** `JournalSynchronisation`
- `ConflitSynchronisation` — *resolution* → **0..1** `ResolutionConflit`

### `FileMutation`

*15 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `mutationUuid` | TEXT | ● | U |  |  |
| `posteLocalId` | TEXT | ● | FK |  |  |
| `module` | TEXT | ● |  |  |  |
| `entiteType` | TEXT | ● |  |  |  |
| `entiteId` | TEXT | ● | FK |  |  |
| `action` | TEXT | ● |  |  |  |
| `payloadJson` | JSONB | ● |  |  |  |
| `statut` | TEXT | ● |  | `"PENDING"` |  |
| `ordreLocal` | BigInt | ● |  |  |  |
| `createdLocalAt` | TIMESTAMP(3) | ● |  |  |  |
| `sentAt` | TIMESTAMP(3) | ○ |  |  |  |
| `serverAckedAt` | TIMESTAMP(3) | ○ |  |  |  |
| `errorMessage` | TEXT | ○ |  |  |  |

**Associations** :

- `FileMutation` — *posteLocal* → **1** `PosteLocal`

### `ResolutionConflit`

*7 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `conflitId` | TEXT | ● | U |  |  |
| `resolution` | TEXT | ● |  |  |  |
| `auteur` | TEXT | ● |  |  |  |
| `justification` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

**Associations** :

- `ResolutionConflit` — *conflit* → **1** `ConflitSynchronisation`

### `ParametreMetier`

*7 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `cle` | TEXT | ● | U |  |  |
| `valeur` | TEXT | ● |  |  |  |
| `description` | TEXT | ○ |  |  |  |
| `updatedAt` | TIMESTAMP(3) | ● |  |  | technique |
| `updatedBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `ParametreMetier` — *historiques* → **0..*** `HistoriqueParametreMetier`

### `HistoriqueParametreMetier`

*8 attributs · degré 1*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `parametreId` | TEXT | ● | FK |  |  |
| `ancienneVal` | TEXT | ● |  |  |  |
| `nouvelleVal` | TEXT | ● |  |  |  |
| `motif` | TEXT | ○ |  |  |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |
| `createdBy` | TEXT | ○ |  |  | technique |

**Associations** :

- `HistoriqueParametreMetier` — *parametre* → **1** `ParametreMetier`

### `AlerteTechnique`

*6 attributs · degré 0*

| Attribut | Type SQL | Obl. | Clé | Défaut | Note |
|---|---|:---:|---|---|---|
| `id` | TEXT | ● | PK | `uuid(` |  |
| `type` | TEXT | ● |  |  |  |
| `message` | TEXT | ● |  |  |  |
| `siteId` | TEXT | ○ | FK |  |  |
| `statut` | TEXT | ● |  | `"OUVERTE"` |  |
| `createdAt` | TIMESTAMP(3) | ● |  | `now(` | technique |

---

## Index alphabétique des entités

| `AbsencePersonnel` | `AlerteAnomalie` | `AlerteMedicale` | `AlerteTechnique` |
|---|---|---|---|
| `AllergiePatient` | `AntecedentPatient` | `BonExamen` | `BonPharmacie` |
| `CategoriePatient` | `CertificatMedical` | `CodeSecoursTotp` | `ConfigurationTotp` |
| `ConflitSynchronisation` | `ConstanteVitale` | `Consultation` | `ConsultationPrenatale` |
| `ContactUrgence` | `ContreIndicationMedicament` | `Conversation` | `ConversationParticipant` |
| `DelegationMedicamentAutorise` | `DelegationPrescription` | `DiagnosticConsultation` | `DonneesEmploi` |
| `DroitCategoriePatient` | `EmployeSaris` | `EtablissementReference` | `Evacuation` |
| `FicheSuiviTraitement` | `FileMutation` | `FusionDossierPatient` | `HabilitationPersonnel` |
| `HistoriqueCategoriePatient` | `HistoriqueParametreMetier` | `HistoriqueRattachementAyantDroit` | `HistoriqueRattachementSousTraitant` |
| `IdentitePatient` | `JournalAudit` | `JournalAuthentification` | `JournalSynchronisation` |
| `LigneBonPharmacie` | `LigneExamen` | `LigneOrdonnance` | `MedicamentReference` |
| `Message` | `MessageMasque` | `MessagePieceJointe` | `MessageReaction` |
| `ModeViePatient` | `MotifConsultation` | `Notification` | `NotificationLecture` |
| `Ordonnance` | `ParametreMetier` | `ParametreSysteme` | `PathologieReference` |
| `Patient` | `Permission` | `PersonnelMedical` | `PlanningPermutation` |
| `PosteLocal` | `PreSaisieMedicale` | `PreferenceUtilisateur` | `PresenceJournaliere` |
| `RapportGenere` | `RattachementAyantDroitCdi` | `RattachementSousTraitant` | `ResolutionConflit` |
| `ResultatExamen` | `Role` | `RolePermission` | `SauvegardeSysteme` |
| `SessionUtilisateur` | `Site` | `SocieteSousTraitante` | `SuiviChronique` |
| `SuiviEvacuation` | `SuiviGrossesse` | `SuiviTraitement` | `SyncState` |
| `TypeCertificat` | `TypeConsultation` | `TypeExamen` | `Utilisateur` |
| `UtilisateurPermission` | `UtilisateurRole` | `Visite` | `VisiteEvenement` |

