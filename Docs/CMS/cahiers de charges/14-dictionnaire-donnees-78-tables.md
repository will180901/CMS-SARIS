# Document 14 - Dictionnaire Détaillé des 78 Tables

## 1. Objectif

Ce document décrit le modèle de données **réellement implémenté** de CMS SARIS, tel
qu'il figure dans le schéma Prisma de production
(`packages/db/prisma/schema.prisma`). Il recense **79 tables** organisées en
11 domaines fonctionnels, et précise pour chacune : les champs métier principaux,
les contraintes (unicité, index, suppression en cascade) et les liens fonctionnels.

> **État de référence (as-built).** Le présent dictionnaire fait foi sur le périmètre
> de données livré. Les chiffres clés vérifiés sur le code sont les suivants :
>
> - **79 tables** Prisma (modèles) ;
> - **22 migrations** appliquées ;
> - **110 permissions** au catalogue (`packages/types/src/permissions.ts`) ;
> - **6 rôles** : `ADMIN_SYSTEME`, `ADMIN_MEDICAL`, `MEDECIN_CHEF`, `INFIRMIER`,
>   `INFIRMIER_DELEGUE`, `AGENT_RH`.
>
> Base de données : **PostgreSQL 16**, accédée via **Prisma 6** (ORM) depuis l'API
> **NestJS 11**. Tous les identifiants sont des **UUID v4**.

### 1.1 Évolution depuis la cible initiale (71 → 79 tables)

La cible MVP initiale comptait 71 tables. Le modèle livré en compte **79**.
Les **9 tables supplémentaires** ci-dessous (1 préférences utilisateur + 2 notifications
+ 6 messagerie) correspondent aux modules transversaux ajoutés au-delà des 8 modules
du MVP. Elles constituent l'essentiel des nouvelles tables ; le décompte global net
(qui aboutit à 79) est détaillé sous le tableau :

| # | Table ajoutée | Domaine | Apport |
|---|---|---|---|
| 1 | `PreferenceUtilisateur` | Sécurité | Réglages personnels par compte ; **porte aussi l'acceptation des CGU** (`cguAccepteeLe`, `cguVersion`). |
| 2 | `Notification` | Notifications | Notifications temps réel (individuelles ou diffusion par site/permission). |
| 3 | `NotificationLecture` | Notifications | État « lu » et « masqué pour moi » par utilisateur (champ `masque`). |
| 4 | `Conversation` | Messagerie | Conversation 1-1 ou groupe. |
| 5 | `ConversationParticipant` | Messagerie | Participants + curseur de lecture (`lastReadAt`). |
| 6 | `Message` | Messagerie | Message chiffré AES-256-GCM, réponses/citations, édition/suppression. |
| 7 | `MessageMasque` | Messagerie | « Supprimer pour moi » (masquage par utilisateur). |
| 8 | `MessageReaction` | Messagerie | Réactions emoji (toggle, unicité par utilisateur/emoji). |
| 9 | `MessagePieceJointe` | Messagerie | Pièces jointes chiffrées (image/vidéo/audio/document). |

> Le décompte fait foi : 71 (cible) − 4 tables de la cible non retenues telles quelles
> (regroupées, renommées ou portées par d'autres tables) + 12 tables effectives
> nouvelles (les 9 tables transversales listées ci-dessus + 3 tables structurelles
> introduites par migration, dont `SyncState`) aboutit aux **79 modèles** listés en §12. Les colonnes notables ajoutées
> par migration (`cguAccepteeLe`, `cguVersion`, `masque`, `contenuJson`, `lastSeenAt`,
> `pickedUpById`/`pickedUpAt`) sont signalées dans les sections concernées.

## 2. Conventions techniques

### 2.1 Champs techniques communs

La plupart des tables métier portent tout ou partie des champs suivants :

| Champ | Type Prisma | Rôle |
|---|---|---|
| `id` | `String @id @default(uuid())` | Identifiant stable (UUID v4). |
| `createdAt` | `DateTime @default(now())` | Horodatage de création. |
| `updatedAt` | `DateTime @updatedAt` | Horodatage de dernière modification. |
| `createdBy` / `updatedBy` | `String?` | Auteur de la création / modification (UUID utilisateur). |
| `statut` | `String` ou `enum` | Statut métier lorsqu'applicable. |
| `version` | `Int @default(1)` | Verrouillage optimiste sur les entités synchronisées (`Patient`, `Visite`, `Consultation`). |

### 2.2 Conventions de modélisation

- **Suppression sûre (409-safe).** Les suppressions sont des *hard deletes* protégés :
  toute tentative de suppression d'une entité encore référencée renvoie une erreur
  fonctionnelle (HTTP 409) plutôt que de casser l'intégrité.
- **Cascade ciblée.** `onDelete: Cascade` n'est utilisé que sur les agrégats fermés
  (préférences, participants/messages/réactions/pièces jointes d'une conversation,
  événements de visite). `onDelete: SetNull` est utilisé pour les citations de message
  (`replyToId`).
- **Secrets jamais en clair.** Mots de passe (bcrypt, 12 rounds), secret TOTP
  (AES-256-GCM), codes de secours (hash), tokens de session (hash), contenu de
  messagerie et pièces jointes (AES-256-GCM) sont stockés chiffrés ou hachés.
- **Append-only.** Les journaux (`JournalAudit`, `JournalAuthentification`) ne sont
  jamais modifiés par l'interface ; ils sont alimentés par l'intercepteur d'audit
  global (`@Audit`) et le service d'authentification.

## 3. Sécurité, administration et audit (17 tables)

> Domaine réalisé : authentification (login + bcrypt), **TOTP chiffré + codes de
> secours**, sessions JWT (+ refresh 7 j), gestion des comptes/rôles/permissions avec
> **dérogations GRANT/REVOKE**, **audit persistant** via intercepteur global (IP + géo),
> journal d'authentification, paramètres système, **sauvegarde/restauration réelle**.

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Utilisateur` | `login`, `email`, `passwordHash`, `statut`, `motDePasseTemp`, `tentativesEchec`, `blocageJusquA`, `blocageMinutes`, `siteId`, `personnelMedicalId`, `lastSeenAt` | `login` et `email` uniques ; `personnelMedicalId` unique (lien 1-1 optionnel vers le personnel). `lastSeenAt` alimente la **présence** de la messagerie. Verrouillage progressif via `tentativesEchec` / `blocageJusquA` / `blocageMinutes`. |
| `PreferenceUtilisateur` | `theme`, `densite`, `langue`, `pageAccueil`, `lignesParPage`, `notifEmail`, `notifApp`, **`cguAccepteeLe`**, **`cguVersion`** | Clé primaire = `utilisateurId` (1-1, `onDelete: Cascade`). Réglages personnels n'affectant que le compte. **Porte le tracking d'acceptation des CGU** : la `CguGate` re-demande l'acceptation si `cguVersion` est obsolète. |
| `Role` | `code` (unique), `libelle` | 6 rôles applicatifs ; liés aux permissions via `RolePermission`. |
| `Permission` | `code` (unique), `module` | **110 permissions** au catalogue ; couple effectif `module/action` porté par le `code`. |
| `RolePermission` | `roleId`, `permissionId` | Table de jointure (clé composite). |
| `UtilisateurRole` | `utilisateurId`, `roleId` | Table de jointure (clé composite) : un utilisateur peut cumuler des rôles. |
| `UtilisateurPermission` | `utilisateurId`, `permissionId`, `mode` (`GRANT`/`REVOKE`), `motif`, `accordePar` | **Dérogations par utilisateur**. Permissions effectives = (perms des rôles ∪ GRANTs) − REVOKEs. Unicité `(utilisateurId, permissionId)`. |
| `SessionUtilisateur` | `utilisateurId`, `posteLocalId`, `refreshTokenHash`, `ipAdresse`, `userAgent`, `expiresAt`, `revokedAt` | Le refresh token n'est **jamais** stocké en clair. Refresh 7 jours. |
| `ConfigurationTotp` | `utilisateurId` (unique), `secretChiffre`, `actif`, `activatedAt` | Secret TOTP **chiffré AES-256-GCM**. 1-1 avec l'utilisateur. |
| `CodeSecoursTotp` | `configId`, `codeHash`, `utilise`, `utilisedAt` | Codes de secours à **usage unique** (hachés). Liés à la config TOTP. |
| `JournalAudit` | `utilisateurId`, `action`, `module`, `entiteType`, `entiteId`, `avantJson`, `apresJson`, `ipAdresse`, `statut` | **Append-only.** Alimenté par l'intercepteur `@Audit` (APP_INTERCEPTOR global) sur les mutations des controllers cliniques/config. IP + statut consignés. |
| `JournalAuthentification` | `utilisateurId`, `login`, `resultat`, `ipAdresse`, `userAgent` | **Append-only.** Trace chaque tentative de connexion (succès/échec). |
| `AlerteAnomalie` | `type`, `message`, `statut` (`OUVERTE`…), `investigPar`, `investigAt`, `commentaire` | Anomalies de sécurité/audit à investiguer. |
| `ParametreSysteme` | `cle` (unique), `valeur`, `description`, `updatedBy` | Paramètres techniques globaux. |
| `SauvegardeSysteme` | `type`, `statut`, `declenchePar`, `perimetre`, **`contenuJson`**, `taille`, `finishedAt`, `message` | **Sauvegarde réelle de configuration** : `contenuJson` contient le snapshot JSON (référentiels, rôles+permissions, paramètres). `perimetre = 'CONFIGURATION'`. Restauration **non destructive**. Cron quotidien 02h00 (`@nestjs/schedule`), rétention. `contenuJson` NULL = ancienne entrée non restaurable. |

> Sécurité de la messagerie (transverse) : rotation/versioning de clé de chiffrement
> (format `v2:keyId`, `MESSAGE_ENC_KEYS` + clé courante, v1 legacy lisible), clés
> Vault-ready (`MESSAGE_ENC_KEYS_FILE`), outil de ré-encryption v1→v2 non destructif.
> Détails de stockage en §11.

## 4. Notifications temps réel (2 tables)

> Domaine réalisé : flux **SSE** (stream) déclenchant les invalidations react-query
> côté client (map clinique + LIVE silencieux) ; notifications individuelles ou
> diffusion par site/permission ; suppression au survol / multiple / tout ; sons UI.

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Notification` | `destinataireId`, `siteId`, `requiredPermission`, `type`, `niveau` (`INFO`/`SUCCES`/`AVERTISSEMENT`/`CRITIQUE`), `titre`, `message`, `entiteType`, `entiteId`, `lien`, `createdById` | **Individuelle** si `destinataireId` renseigné, sinon **diffusion** : visible par les utilisateurs d'un site (`siteId` null = tous les sites) possédant `requiredPermission`. `lien` = route frontend ouverte au clic. Index sur `destinataireId`, `siteId`, `createdAt`. |
| `NotificationLecture` | `notificationId`, `utilisateurId`, `readAt`, **`masque`** | État « lu » **par utilisateur** (compatible diffusion). `masque = true` → « supprimée pour moi » : retirée du feed de cet utilisateur sans affecter les autres. Unicité `(notificationId, utilisateurId)`, `onDelete: Cascade`. |

## 5. Référentiels et droits (10 tables)

> Domaine réalisé : **CRUD complet** (sites, catégories patients + droits, motifs,
> pathologies, médicaments + contre-indications, types d'examen, établissements,
> sociétés sous-traitantes) ; suppression 409-safe ; temps réel `LIVE_REFERENTIELS`.

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Site` | `code` (unique), `libelle`, `localisation`, `statut` | Établissement/site géographique. Cloisonnement des données par site. |
| `CategoriePatient` | `code` (unique), `libelle`, `statut` | Source de vérité des catégories (CDI, ayant-droit, sous-traitant, etc.). |
| `DroitCategoriePatient` | `categorieId`, `typePrestation`, `couvert`, `plafondConsultations`, `periode` | Définit, par catégorie, les prestations couvertes et plafonds. |
| `MotifConsultation` | `code` (unique), `libelle`, `statut` | Motif principal d'une visite (utilisé au triage). |
| `PathologieReference` | `code` (unique), `libelle`, `chronique`, `statut` | Utilisée en diagnostic et suivi chronique (`chronique = true`). |
| `MedicamentReference` | `nomGenerique`, `nomCommercial`, `familleThera`, `statut` | Référence prescription uniquement — **aucun stock** (hors périmètre). |
| `ContreIndicationMedicament` | `medicamentId`, `condition`, `typeCondition`, `gravite` | Alimente les contrôles d'ordonnance (allergie / contre-indication / grossesse). |
| `TypeExamen` | `code` (unique), `libelle`, `domaine`, `statut` | Biologie, imagerie, autre. |
| `EtablissementReference` | `nom`, `type`, `localisation`, `statut` | Destination d'évacuation ou d'examen externe. |
| `SocieteSousTraitante` | `nom`, `statut` | Société employeuse pour les patients sous-traitants ; suspendue = rattachements bloqués. |

## 6. Acteurs administratifs (11 tables)

> Domaine réalisé : personnel médical, sociétés sous-traitantes, **délégations de
> prescription** (+ médicaments autorisés), **rattachements ayant-droit CDI** et
> **sous-traitant** (+ historiques).
>
> **Extension future (présente en base, non exposée dans l'UI) :** habilitations,
> planning/permutations, présence journalière, absences. Ces tables sont conservées
> comme socle d'extension.

| Table | Champs métier principaux | Contraintes et remarques | Statut |
|---|---|---|---|
| `PersonnelMedical` | `nom`, `prenom`, `matricule` (unique), `role`, `siteId`, `statut` | Lié de façon optionnelle (1-1) à un `Utilisateur`. | Réalisé |
| `HabilitationPersonnel` | `personnelId`, `type`, `statut`, `dateDebut`, `dateFin` | Habilitations datées (historique conservé). | Extension |
| `PlanningPermutation` | `personnelId`, `siteId`, `dateDebut`, `dateFin` | Affectation/permutation planifiée. | Extension |
| `PresenceJournaliere` | `personnelId`, `siteId`, `date`, `present` | Présence réelle. | Extension |
| `AbsencePersonnel` | `personnelId`, `date`, `motif` | Absence planifiée ou non. | Extension |
| `DelegationPrescription` | `medecinChefId`, `infirmierId`, `dateDebut`, `dateFin`, `statut`, `perimetre` | **Délégation accordée par le médecin chef** à un infirmier ; relations nommées donneur/receveur. | Réalisé |
| `DelegationMedicamentAutorise` | `delegationId`, `medicamentId` | Restreint le périmètre médicamenteux d'une délégation. | Réalisé |
| `RattachementAyantDroitCdi` | `patientId`, `cdiId`, `typeLien`, `statut`, `dateDebut`, `dateFin` | Rattachement d'un ayant-droit à un CDI. | Réalisé |
| `HistoriqueRattachementAyantDroit` | `rattachementId`, `evenement`, `createdBy` | Traçabilité des changements. | Réalisé |
| `RattachementSousTraitant` | `patientId`, `societeId`, `statut`, `dateDebut`, `dateFin` | Rattachement d'un patient à une société sous-traitante. | Réalisé |
| `HistoriqueRattachementSousTraitant` | `rattachementId`, `evenement`, `createdBy` | Traçabilité des changements. | Réalisé |

## 7. Dossier patient (11 tables)

> Domaine réalisé : identité, contact d'urgence, allergies, antécédents, alertes
> médicales, catégorie + historique, **fusion de dossiers**, constantes ; documents
> générés (synthèse A4).

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Patient` | `numeroPatient` (unique), `siteCreationId`, `categoriePatientId`, `statut` (`ACTIF`/`ARCHIVE`/`DECEDE`/`FUSIONNE`), `version` | Cœur du dossier. `version` pour le verrouillage optimiste hors-ligne. |
| `IdentitePatient` | `patientId` (unique), `nom`, `prenom`, `dateNaissance`, `sexe`, `telephone`, `adresse`, `photoUrl` | Identité administrative (1-1). `photoUrl` ajoutée par migration dédiée. |
| `ContactUrgence` | `patientId` (unique), `nom`, `prenom`, `telephone`, `lien` | Contact d'urgence (1-1), utilisé en sortie critique. |
| `AllergiePatient` | `patientId`, `substance`, `gravite`, `confirme`, `statut` | Critique pour les contrôles de prescription. |
| `AntecedentPatient` | `patientId`, `type`, `description`, `statut` | Antécédents médicaux/chirurgicaux. |
| `AlerteMedicale` | `patientId`, `type`, `message`, `gravite`, `statut` (`ACTIVE`…), `resolvedAt` | Alerte active ou résolue (ex. grossesse en cours). |
| `HistoriqueCategoriePatient` | `patientId`, `ancienneCategId`, `nouvelleCategId`, `dateEffet`, `motif`, `createdBy` | Obligatoire à chaque changement de catégorie. |
| `FusionDossierPatient` | `sourceId` (unique), `cibleId` (unique), `createdBy` | **Fusion non destructive** : conserve l'historique ; le patient source passe `FUSIONNE`. |
| `PreSaisieMedicale` | `patientId`, `visiteId`, `type`, `contenu` (Json), `valide` | Donnée pré-saisie à valider médicalement. |
| `SuiviGrossesse` | `patientId`, `datePrevueAccouch`, `statut`, `devenir`, `dateFinReelle` | Crée une alerte médicale active. *Suivi complet = extension future.* |
| `ConsultationPrenatale` | `suiviId`, `consultationId`, `termeSemaines`, `poids`, `tension`, `notes` | Rattachée à un suivi de grossesse et, optionnellement, à une consultation. |

## 8. Accueil et triage (3 tables)

> Domaine réalisé : ouverture de visite, constantes + alertes automatiques + IMC,
> motif, file d'attente temps réel, orientation soignant, clôture/annulation,
> **fonctionnement offline complet**.
>
> **Note métier :** la notion de **priorité a été retirée de l'interface** (file par
> ordre d'arrivée). Une colonne historique subsiste en base et l'enum
> `TypeEvenementVisite` conserve `PRIORITE_CHANGE` pour compatibilité — non réintroduite.

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Visite` | `patientId`, `siteId`, `motifPrincipalId`, `statut` (`EN_ATTENTE`/`EN_COURS`/`CLOTUREE`/`ANNULEE`), `soignantId`, `notesAccueil`, `motifAnnulation`, `typeCloture`, `dateOuverture`, `dateCloture`, `creerHorsLigne`, `version` | Porte le parcours du jour. `typeCloture` = `AVEC_CONSULTATION` / `SANS_CONSULTATION`. `creerHorsLigne` marque une visite créée en mode déconnecté. |
| `VisiteEvenement` | `visiteId`, `type` (`STATUT_CHANGE`/`PRIORITE_CHANGE`/`SOIGNANT_CHANGE`/`NOTES_UPDATE`), `ancienneVal`, `nouvelleVal`, `acteurId`, `commentaire` | **Piste d'audit** de la visite : une ligne par changement. Index `(visiteId, createdAt)`, `onDelete: Cascade`. |
| `ConstanteVitale` | `visiteId`, `patientId`, `temperature`, `tensionSystolique`, `tensionDiastolique`, `frequenceCardiaque`, `saturationO2`, `poids`, `taille`, `imc`, `glycemie`, `saisiePar` | Historisée par visite. IMC calculé automatiquement ; alertes générées sur valeurs hors plage. |

## 9. Consultation et actes prescrits (8 tables)

> Domaine réalisé : examen + diagnostic, conclusion, **ordonnance** (contrôles
> allergies / contre-indications / grossesse) + validation, **bon d'examen** +
> résultats, **suivi chronique** ; documents A4 imprimables (aperçu intégré zone
> droite, logo réel) ; **délégation de prescription** appliquée.

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Consultation` | `visiteId`, `soignantId`, `delegationId`, `statut` (`OUVERTE`/`CLOTUREE`/`ANNULEE`), `examenClinique`, `conclusion`, `decisionMedicale`, `version`, `closedAt`, `pickedUpById`, `pickedUpAt` | Rattachée à une visite. `pickedUpById`/`pickedUpAt` = **verrou souple** (qui a la consultation en main). `delegationId` relie une consultation faite sous délégation. |
| `DiagnosticConsultation` | `consultationId`, `pathologieId`, `type` (`PRINCIPAL`/secondaire), `certitude` | Plusieurs diagnostics par consultation. |
| `Ordonnance` | `consultationId`, `prescripteurId`, `delegationId`, `statut` (`BROUILLON`…), `motifAnnulation` | Pas de délivrance physique (hors périmètre). Contrôles appliqués avant validation. |
| `LigneOrdonnance` | `ordonnanceId`, `medicamentId`, `posologie`, `duree`, `voieAdmin`, `instructions`, `justification` | Une ligne par médicament prescrit ; contrôlée (allergie/CI/grossesse). |
| `BonExamen` | `consultationId`, `indicationClinik`, `etablissementId`, `statut` (`EN_ATTENTE`…), `motifAnnulation` | Demande d'examen ; peut viser un établissement externe. |
| `LigneExamen` | `bonId`, `typeExamenId` | Plusieurs examens par bon. |
| `ResultatExamen` | `bonId`, `laboratoire`, `contenu`, `interpretation`, `statut` (`RECU`…), `saisiePar` | Résultat rattaché au bon d'examen. |
| `SuiviChronique` | `patientId`, `consultationId`, `pathologieId`, `frequenceSuivi`, `objectifs`, `statut`, `motifCloture`, `motifAnnulation`, `closedAt` | Suivi longitudinal d'une pathologie chronique. |

## 10. Sorties critiques (4 tables)

> Domaine réalisé : **évacuations** (+ suivi), **accidents du travail** (+ suivi) ;
> fiches A4 imprimables. (Le suivi chronique est documenté en §9.)

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Evacuation` | `consultationId` (unique), `motifId`, `niveauUrgence`, `etablissementId`, `infosCliniques`, `statut` (`EN_COURS`…), `motifAnnulation` | Décision médicale critique (1-1 avec la consultation). |
| `SuiviEvacuation` | `evacuationId`, `notes`, `statut`, `createdBy` | Suivi post-évacuation (départ, arrivée, devenir). |
| `AccidentTravail` | `consultationId` (unique), `dateAccident`, `heureAccident`, `lieu`, `circonstances`, `lesions`, `gravite`, `temoins`, `statut` (`OUVERT`…), `motifAnnulation` | Qualification médicale (1-1 avec la consultation). |
| `SuiviAccidentTravail` | `accidentId`, `type`, `dateDebut`, `dateFin`, `dateReevaluation`, `sequelles`, `descriptionSeq`, `tauxIncapacite`, `createdBy` | Arrêt, reprise, consolidation, rechute, séquelles. |

## 11. Messagerie interne chiffrée (6 tables)

> Domaine réalisé : conversations 1-1 et **groupes** (cap 50 participants), **pièces
> jointes chiffrées** (image/vidéo/audio/document, 16 Mo), notes vocales, **réactions
> emoji** (+ notification), **accusés de lecture 3 états**, présence, **suppression
> 2 niveaux** (pour moi / pour tous ≤ 15 min), badge non-lus temps réel, marquage lu
> instantané.
>
> **Chiffrement.** Contenus de messages et pièces jointes chiffrés **AES-256-GCM au
> repos** (jamais en clair). Versioning/rotation de clé (`v2:keyId`, `MESSAGE_ENC_KEYS`
> + clé courante, v1 legacy lisible), clés Vault-ready (`MESSAGE_ENC_KEYS_FILE`), outil
> de ré-encryption v1→v2 non destructif. Durcissement : rate-limit 40/min/utilisateur,
> anti-IDOR cross-site, contrôle magic-bytes + sanitize du nom de fichier, cloisonnement
> par site.

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `Conversation` | `type` (`DIRECT`/`GROUPE`), `titre`, `siteId`, `createdById` | `titre` pour les groupes. Cloisonnement par site. |
| `ConversationParticipant` | `conversationId`, `utilisateurId`, `lastReadAt`, `joinedAt` | Curseur de lecture par participant (accusés). Unicité `(conversationId, utilisateurId)`, index `utilisateurId`, `onDelete: Cascade`. |
| `Message` | `conversationId`, `expediteurId`, **`contenuChiffre`** (AES-256-GCM), `replyToId`, `editedAt`, `deletedAt` | Réponses/citations via `replyToId` (`onDelete: SetNull`). Édition/suppression ≤ 15 min (`editedAt`/`deletedAt`). Index `(conversationId)`, `(conversationId, createdAt)`, `(replyToId)`. |
| `MessageMasque` | `messageId`, `utilisateurId` | **« Supprimer pour moi »** : masque un message pour un utilisateur précis. Unicité `(messageId, utilisateurId)`, `onDelete: Cascade`. |
| `MessageReaction` | `messageId`, `utilisateurId`, `emoji` | Réaction emoji (toggle). Unicité `(messageId, utilisateurId, emoji)`, index `messageId`, `onDelete: Cascade`. Déclenche une **notification de réaction**. |
| `MessagePieceJointe` | `messageId`, `nomFichier`, `mimeType`, `taille`, **`contenuChiffre`** (base64 AES-256-GCM) | Pièce jointe **chiffrée** (image/vidéo/audio/document). `taille` = octets en clair avant chiffrement. Index `messageId`, `onDelete: Cascade`. |

## 12. Synchronisation offline-first et technique (9 tables)

> Domaine réalisé : PWA Workbox, **file de rejeu IndexedDB** (`apps/web/src/lib/sync.ts`),
> `useSyncEngine` ; sauvegarde réelle de configuration (cf. §3) + restauration non
> destructive + cron quotidien (`@nestjs/schedule`) ; `LIVE_SYNC`.

| Table | Champs métier principaux | Contraintes et remarques |
|---|---|---|
| `PosteLocal` | `siteId`, `libelle`, `derniereSyncAt` | Identifie un poste de travail local. |
| `SyncState` | `id`, `posteLocalId`, `entite`, `lastPulledAt`, `updatedAt` | **Curseur de synchronisation offline-first** : mémorise, par poste (`posteLocalId`) et par entité/modèle (`entite`), la date du dernier enregistrement synchronisé (`lastPulledAt`) afin de reprendre le pull/push de façon **incrémentale**. Introduit pour le mode local SQLite. Unicité `(posteLocalId, entite)`. |
| `FileMutation` | `mutationUuid` (unique), `posteLocalId`, `module`, `entiteType`, `entiteId`, `action`, `payloadJson`, `statut` (`PENDING`…), `ordreLocal` (BigInt), `createdLocalAt`, `sentAt`, `serverAckedAt`, `errorMessage` | File de mutations hors-ligne ; `ordreLocal` garantit l'ordre de rejeu ; `mutationUuid` assure l'idempotence. |
| `JournalSynchronisation` | `posteLocalId`, `startedAt`, `finishedAt`, `statut`, `nbMutations`, `nbConflits` | Historique d'une session de synchronisation. |
| `ConflitSynchronisation` | `journalId`, `mutationUuid`, `entiteType`, `entiteId`, `typeConflit`, `valeurLocale` (Json), `valeurServeur` (Json), `statut` (`EN_ATTENTE`…) | Conflit détecté lors du rejeu. |
| `ResolutionConflit` | `conflitId` (unique), `resolution`, `auteur`, `justification` | Résolution tracée (1-1 avec le conflit). |
| `AlerteTechnique` | `type`, `message`, `siteId`, `statut` (`OUVERTE`…) | Supervision applicative. |
| `ParametreMetier` | `cle` (unique), `valeur`, `description`, `updatedBy` | Paramètre fonctionnel (vs technique). |
| `HistoriqueParametreMetier` | `parametreId`, `ancienneVal`, `nouvelleVal`, `motif`, `createdBy` | Historisation obligatoire des changements de paramètre métier. |

## 13. Contrôle de cohérence

Ce dictionnaire recense **exactement 79 tables** (modèles Prisma), réparties ainsi :

| # | Domaine | Tables | Nb |
|---|---|---|---|
| 3 | Sécurité, administration et audit | `Utilisateur`, `PreferenceUtilisateur`, `Role`, `Permission`, `RolePermission`, `UtilisateurRole`, `UtilisateurPermission`, `SessionUtilisateur`, `ConfigurationTotp`, `CodeSecoursTotp`, `JournalAudit`, `JournalAuthentification`, `AlerteAnomalie`, `ParametreSysteme`, `SauvegardeSysteme` | 15 |
| 4 | Notifications | `Notification`, `NotificationLecture` | 2 |
| 5 | Référentiels et droits | `Site`, `CategoriePatient`, `DroitCategoriePatient`, `MotifConsultation`, `PathologieReference`, `MedicamentReference`, `ContreIndicationMedicament`, `TypeExamen`, `EtablissementReference`, `SocieteSousTraitante` | 10 |
| 6 | Acteurs administratifs | `PersonnelMedical`, `HabilitationPersonnel`, `PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel`, `DelegationPrescription`, `DelegationMedicamentAutorise`, `RattachementAyantDroitCdi`, `HistoriqueRattachementAyantDroit`, `RattachementSousTraitant`, `HistoriqueRattachementSousTraitant` | 11 |
| 7 | Dossier patient | `Patient`, `IdentitePatient`, `ContactUrgence`, `AllergiePatient`, `AntecedentPatient`, `AlerteMedicale`, `HistoriqueCategoriePatient`, `FusionDossierPatient`, `PreSaisieMedicale`, `SuiviGrossesse`, `ConsultationPrenatale` | 11 |
| 8 | Accueil et triage | `Visite`, `VisiteEvenement`, `ConstanteVitale` | 3 |
| 9 | Consultation et actes prescrits | `Consultation`, `DiagnosticConsultation`, `Ordonnance`, `LigneOrdonnance`, `BonExamen`, `LigneExamen`, `ResultatExamen`, `SuiviChronique` | 8 |
| 10 | Sorties critiques | `Evacuation`, `SuiviEvacuation`, `AccidentTravail`, `SuiviAccidentTravail` | 4 |
| 11 | Messagerie interne | `Conversation`, `ConversationParticipant`, `Message`, `MessageMasque`, `MessageReaction`, `MessagePieceJointe` | 6 |
| 12 | Synchronisation et technique | `PosteLocal`, `SyncState`, `FileMutation`, `JournalSynchronisation`, `ConflitSynchronisation`, `ResolutionConflit`, `AlerteTechnique`, `ParametreMetier`, `HistoriqueParametreMetier` | 9 |
| | **Total** | | **79** |

### 13.1 Énumérations métier

| Enum | Valeurs | Usage |
|---|---|---|
| `StatutCompte` | `ACTIF`, `DESACTIVE`, `BLOQUE` | Statut d'un compte utilisateur. |
| `ModeOverridePermission` | `GRANT`, `REVOKE` | Sens d'une dérogation de permission. |
| `StatutPatient` | `ACTIF`, `ARCHIVE`, `DECEDE`, `FUSIONNE` | Cycle de vie d'un dossier patient. |
| `StatutVisite` | `EN_ATTENTE`, `EN_COURS`, `CLOTUREE`, `ANNULEE` | Cycle de vie d'une visite. |
| `TypeEvenementVisite` | `STATUT_CHANGE`, `PRIORITE_CHANGE`, `SOIGNANT_CHANGE`, `NOTES_UPDATE` | Type d'événement d'audit de visite (`PRIORITE_CHANGE` conservé mais non utilisé). |
| `StatutConsultation` | `OUVERTE`, `CLOTUREE`, `ANNULEE` | Cycle de vie d'une consultation. |

## 14. Périmètre, extensions futures et limites

### 14.1 Au-delà des 8 modules MVP (livré)

Les modules transversaux suivants ont été ajoutés et **sont effectivement codés** :

- **Messagerie interne chiffrée** (AES-256-GCM) — §11 ;
- **Notifications temps réel** (SSE) — §4 ;
- **CGU versionnées** (charte 7 sections, version v1-2026.06, acceptation tracée via
  `PreferenceUtilisateur.cguAccepteeLe`/`cguVersion`, porte bloquante `CguGate`) ;
- **Documents imprimables** : gabarit A4 unifié (logo, monochrome) — ordonnance, bon
  d'examen, évacuation, accident, suivi, synthèse de dossier ;
- **Sauvegarde/restauration réelle** de configuration (cron quotidien, rétention) — §3.

### 14.2 Extensions futures (hors périmètre)

Conservées comme socle d'évolution, **non livrées** dans le périmètre actuel :

- Gestion des stocks et délivrance physique des médicaments, réapprovisionnement ;
- Transmission CNSS ; reporting directionnel agrégé ;
- Suivi de grossesse complet ;
- Planning / présence / habilitations du personnel (tables présentes en base,
  non exposées dans l'UI — cf. §6) ;
- Internationalisation multilingue (i18n).

### 14.3 Limites assumées

- **Tests automatisés** : il n'existe pas de suite de tests automatisés étendue.
  La validation repose sur des tests E2E navigateur **manuels**, le contrôle de types
  (`tsc`) et le *build*. L'extension de la couverture de tests est une perspective
  d'évolution, à ne pas présenter comme acquis.
