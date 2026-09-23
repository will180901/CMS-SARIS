# Relevé du modèle conceptuel — les 88 entités et les 97 associations

> **Destination** : les deux onglets d'atelier `ATELIER — MCD structurel` et `ATELIER — MCD détaillé`, fiche `MCD-GLOBAL-01`.
> **Document de travail, hors mémoire.** Il ne modifie aucune figure ni aucun texte du mémoire.

| | |
|---|---|
| Date du relevé | 18 septembre 2026 |
| Source | le schéma de données du dépôt, copie écrite par le générateur le 24 août 2026 |
| Règle appliquée | D-78 — le code fait foi sur la structure ; la fiche ne fait pas foi sur les contenus |
| Dernière migration du dépôt | 15 août 2026 — la structure n'a pas bougé depuis |

---

## 1. Ce que le relevé confirme

Le tableau du § 3 de la fiche `MCD-GLOBAL-01` a été confronté au schéma, ligne à ligne. **Il est exact sur tous les points.**

| Ce que la fiche annonce | Ce que le schéma contient |
|---|---|
| 88 entités en 10 modules | 88 entités, 10 modules — mêmes noms, même ordre |
| 971 champs | 971 — soit **777 colonnes réelles** et **194 champs de navigation** |
| 97 associations | 97 — dont **65 internes** à un module et **32 inter-modules** |
| 55 entités métier / 33 techniques | 55 / 33 |

S'y ajoutent, recomptés : **88 identifiants**, **76 index**, **10 suppressions en cascade**, **40 migrations**.

---

## 2. Les règles d'écriture, relevées sur vos planches 8.1a, 8.1b et 8.1c

Elles ne sont pas choisies : elles sont **déduites de ce que vos trois planches MCD font déjà**, en comparant chaque entité dessinée au schéma.

| Règle | Ce qu'elle donne |
|---|---|
| **R1 — L'identifiant remplace la colonne `id`** | `id` disparaît, un identifiant MERISE souligné le remplace : `idVisite`, `idConsultation`, `numeroPatient` |
| **R2 — Aucune clé étrangère** | toute colonne en `…Id` est retirée. C'est la règle MERISE : le lien est porté par l'association, pas par une colonne |
| **R3 — Aucune colonne technique** | `createdAt`, `updatedAt`, `deletedAt`, `version`, `createdBy`, `updatedBy`, et les colonnes de verrou et de traçabilité applicative |
| **R4 — Cardinalités déduites du schéma** | côté porteur de la clé : `1,1` si obligatoire, `0,1` si facultative · côté opposé : `0,n`, ou `0,1` si une contrainte d'unicité l'impose |

**Contrôle de ces règles** : appliquées aux 13 associations que vos planches dessinent déjà, elles retrouvent **les 13 couples de cardinalités, à l'identique**. Appliquées aux 12 entités déjà dessinées, elles retrouvent **exactement les mêmes attributs**, sans un de plus ni un de moins.

Effet sur le volume : **376 attributs descriptifs** retenus sur les 777 colonnes du schéma.

---

## 3. Cinq points à trancher avant de dessiner

| # | Le point | Ce que je propose |
|---|---|---|
| 1 | **84 associations sur 97 n'ont aucun verbe dans le mémoire.** 13 seulement sont sourcées, celles de vos planches 8.1 | les proposer en gris et entre parenthèses, comme le § 6 de la fiche le prévoit — c'est l'étape 2 |
| 2 | **76 entités sur 88 n'ont pas d'identifiant nommé.** 12 le tiennent de vos planches | appliquer la convention `id` + nom de l'entité, et l'écrire au cartouche |
| 3 | **Sept colonnes désignent une table sans que la base l'impose** — les fausses clés étrangères de la révision du 4 septembre. Sur vos planches 8.1 elles sont invisibles : ni attribut, ni lien | sur une planche d'atelier, **les montrer en pointillés** : c'est exactement ce qu'un directeur de mémoire cherche à discuter |
| 4 | **Six entités n'ont aucun attribut descriptif** — `UtilisateurRole`, `RolePermission`, `DelegationMedicamentAutorise`, `FusionDossierPatient`, `LigneExamen`, `MessageMasque`. En MERISE pur, ce sont des associations, pas des entités | garder la forme d'entité, comme `LigneExamen` sur votre planche 8.1c, et le signaler en note |
| 5 | **`indicationClinik`** s'écrit ainsi dans le code, et vos planches 8.1c le reproduisent fidèlement | ne rien corriger — le code fait foi — mais vous le savoir |

**Une limite à connaître** : ma copie du schéma est la variante du poste autonome. Elle ne porte pas les **six énumérations** que déclare la base centrale. Cela ne change aucune entité ni aucune association ; cela touche le domaine de quelques attributs de statut.

---

## 4. Les 88 entités, module par module

L'identifiant est en tête, souligné sur la planche. Les attributs suivent dans l'ordre du schéma.


### SÉCURITÉ & AUDIT — 18 entités · technique

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `Utilisateur` | `idUtilisateur` ᵖ | `login`, `email`, `passwordHash`, `statut`, `motDePasseTemp`, `tentativesEchec`, `blocageJusquA`, `blocageMinutes`, `photoUrl`, `lastSeenAt` |
| `PreferenceUtilisateur` | `idPreferenceUtilisateur` ᵖ | `theme`, `densite`, `langue`, `pageAccueil`, `lignesParPage`, `notifEmail`, `notifApp`, `cguAccepteeLe`, `cguVersion` |
| `Notification` | `idNotification` ᵖ | `requiredPermission`, `type`, `niveau`, `titre`, `message`, `entiteType`, `lien`, `concernedPersonnelIds` |
| `NotificationLecture` | `idNotificationLecture` ᵖ | `readAt`, `masque` |
| `Role` | `idRole` ᵖ | `code`, `libelle` |
| `Permission` | `idPermission` ᵖ | `code`, `module` |
| `UtilisateurPermission` | `idUtilisateurPermission` ᵖ | `mode`, `motif`, `accordePar` |
| `UtilisateurRole` | `idUtilisateurRole` ᵖ | — *aucun* |
| `RolePermission` | `idRolePermission` ᵖ | — *aucun* |
| `SessionUtilisateur` | `idSessionUtilisateur` ᵖ | `refreshTokenHash`, `ipAdresse`, `userAgent`, `expiresAt`, `revokedAt`, `derniereActiviteAt` |
| `ConfigurationTotp` | `idConfigurationTotp` ᵖ | `secretChiffre`, `actif`, `activatedAt` |
| `CodeSecoursTotp` | `idCodeSecoursTotp` ᵖ | `codeHash`, `utilise`, `utilisedAt` |
| `JournalAudit` | `idJournalAudit` ᵖ | `action`, `module`, `entiteType`, `avantJson`, `apresJson`, `ipAdresse`, `statut` |
| `JournalAuthentification` | `idJournalAuthentification` ᵖ | `login`, `resultat`, `ipAdresse`, `userAgent` |
| `AlerteAnomalie` | `idAlerteAnomalie` ᵖ | `type`, `message`, `statut`, `investigPar`, `investigAt`, `commentaire` |
| `ParametreSysteme` | `idParametreSysteme` ᵖ | `cle`, `valeur`, `description` |
| `SauvegardeSysteme` | `idSauvegardeSysteme` ᵖ | `type`, `statut`, `declenchePar`, `perimetre`, `contenuJson`, `taille`, `finishedAt`, `message` |
| `RapportGenere` | `idRapportGenere` ᵖ | `type`, `periodeDebut`, `periodeFin`, `contenuJson`, `genereLe` |

### RÉFÉRENTIELS — 12 entités · métier

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `Site` | `idSite` ᵖ | `code`, `libelle`, `localisation`, `statut` |
| `CategoriePatient` | `idCategoriePatient` ᵖ | `code`, `libelle`, `statut` |
| `DroitCategoriePatient` | `idDroitCategoriePatient` ᵖ | `typePrestation`, `couvert`, `plafondConsultations`, `periode` |
| `MotifConsultation` | `idMotifConsultation` ᵖ | `code`, `libelle`, `statut`, `triageAllege` |
| `TypeConsultation` | `idTypeConsultation` ᵖ | `code`, `libelle`, `statut` |
| `PathologieReference` | `idPathologieReference` ᵖ | `code`, `libelle`, `chronique`, `statut`, `confidentialiteRenforcee` |
| `MedicamentReference` | `idMedicamentReference` ᵖ | `nomGenerique`, `nomCommercial`, `familleThera`, `statut` |
| `ContreIndicationMedicament` | `idContreIndicationMedicament` ᵖ | `condition`, `typeCondition`, `gravite` |
| `TypeExamen` | `idTypeExamen` ᵖ | `code`, `libelle`, `domaine`, `statut` |
| `TypeCertificat` | `idTypeCertificat` ᵖ | `code`, `libelle`, `modeleTexte`, `statut` |
| `EtablissementReference` | `idEtablissementReference` ᵖ | `nom`, `type`, `localisation`, `statut` |
| `SocieteSousTraitante` | `idSocieteSousTraitante` ᵖ | `nom`, `statut` |

### ACTEURS ADMINISTRATIFS — 12 entités · métier

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `PersonnelMedical` | `idPersonnelMedical` ᵖ | `nom`, `prenom`, `matricule`, `role`, `statut` |
| `HabilitationPersonnel` | `idHabilitationPersonnel` ᵖ | `type`, `statut`, `dateDebut`, `dateFin` |
| `PlanningPermutation` | `idPlanningPermutation` ᵖ | `dateDebut`, `dateFin` |
| `PresenceJournaliere` | `idPresenceJournaliere` ᵖ | `date`, `present` |
| `AbsencePersonnel` | `idAbsencePersonnel` ᵖ | `date`, `motif` |
| `DelegationPrescription` | `idDelegationPrescription` ᵖ | `dateDebut`, `dateFin`, `statut`, `perimetre` |
| `DelegationMedicamentAutorise` | `idDelegationMedicamentAutorise` ᵖ | — *aucun* |
| `EmployeSaris` | `idEmployeSaris` ᵖ | `matricule`, `nom`, `prenom`, `dateNaissance`, `sexe`, `fonction`, `sectionPaie`, `service`, `departement`, `categorie`, `statut` |
| `RattachementAyantDroitCdi` | `idRattachementAyantDroitCdi` ᵖ | `typeLien`, `statut`, `dateDebut`, `dateFin` |
| `HistoriqueRattachementAyantDroit` | `idHistoriqueRattachementAyantDroit` ᵖ | `evenement` |
| `RattachementSousTraitant` | `idRattachementSousTraitant` ᵖ | `statut`, `dateDebut`, `dateFin` |
| `HistoriqueRattachementSousTraitant` | `idHistoriqueRattachementSousTraitant` ᵖ | `evenement` |

### DOSSIER PATIENT — 13 entités · métier

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `Patient` | `numeroPatient` | `numeroPatient`, `matricule`, `statut` |
| `IdentitePatient` | `idIdentitePatient` ᵖ | `nom`, `prenom`, `dateNaissance`, `sexe`, `telephone`, `adresse`, `photoUrl` |
| `DonneesEmploi` | `idDonneesEmploi` ᵖ | `fonction`, `sectionPaie`, `service`, `departement` |
| `ModeViePatient` | `idModeViePatient` ᵖ | `tabac`, `alcool`, `drogues`, `activitePhysique`, `alimentation`, `sommeil`, `troublesSommeil`, `sedentarite`, `portCharges`, `automedication`, `observations` |
| `ContactUrgence` | `idContactUrgence` ᵖ | `nom`, `prenom`, `telephone`, `lien` |
| `AllergiePatient` | `idAllergiePatient` ᵖ | `substance`, `gravite`, `confirme`, `statut` |
| `AntecedentPatient` | `idAntecedentPatient` ᵖ | `type`, `description`, `statut` |
| `AlerteMedicale` | `idAlerteMedicale` ᵖ | `type`, `message`, `gravite`, `statut`, `resolvedAt` |
| `HistoriqueCategoriePatient` | `idHistoriqueCategoriePatient` ᵖ | `dateEffet`, `motif` |
| `FusionDossierPatient` | `idFusionDossierPatient` ᵖ | — *aucun* |
| `PreSaisieMedicale` | `idPreSaisieMedicale` ᵖ | `type`, `contenu`, `valide` |
| `SuiviGrossesse` | `idSuiviGrossesse` ᵖ | `datePrevueAccouch`, `statut`, `devenir`, `dateFinReelle` |
| `ConsultationPrenatale` | `idConsultationPrenatale` ᵖ | `termeSemaines`, `poids`, `tension`, `notes` |

### ACCUEIL & TRIAGE — 3 entités · métier

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `Visite` | `idVisite` | `statut`, `notesAccueil`, `motifAnnulation`, `typeCloture`, `dateOuverture`, `dateCloture` |
| `VisiteEvenement` | `idVisiteEvenement` ᵖ | `type`, `ancienneVal`, `nouvelleVal`, `commentaire` |
| `ConstanteVitale` | `idConstante` | `temperature`, `tensionSystolique`, `tensionDiastolique`, `frequenceCardiaque`, `frequenceRespiratoire`, `saturationO2`, `poids`, `taille`, `imc`, `glycemie`, `etatConscience`, `scoreGlasgow`, `etatGeneral`, `hydratation`, `coloration` |

### CONSULTATION & ACTES PRESCRITS — 11 entités · métier

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `Consultation` | `idConsultation` | `statut`, `anamneseDateDebut`, `anamneseDuree`, `anamneseModeDebut`, `anamneseSymptomes`, `examenClinique`, `conclusion`, `decisionMedicale`, `motifAnnulation`, `reposJours`, `reposInclutJour`, `dateReprise`, `closedAt` |
| `DiagnosticConsultation` | `idDiagnostic` | `type`, `certitude` |
| `Ordonnance` | `idOrdonnance` | `statut`, `typeOrdonnance`, `indicationClinik`, `motifAnnulation` |
| `LigneOrdonnance` | `idLigne` | `posologie`, `duree`, `voieAdmin`, `quantite`, `instructions`, `justification` |
| `BonExamen` | `idBonExamen` | `indicationClinik`, `statut`, `motifAnnulation` |
| `LigneExamen` | `idLigneExamen` | — *aucun* |
| `ResultatExamen` | `idResultatExamen` ᵖ | `laboratoire`, `contenu`, `interpretation`, `statut` |
| `BonPharmacie` | `idBonPharmacie` | `statut`, `observations`, `delivreLe`, `motifAnnulation` |
| `LigneBonPharmacie` | `idLigne` | `libelle`, `posologie`, `quantite` |
| `SuiviChronique` | `idSuiviChronique` ᵖ | `frequenceSuivi`, `objectifs`, `statut`, `motifCloture`, `motifAnnulation`, `closedAt` |
| `CertificatMedical` | `idCertificatMedical` ᵖ | `dateApplication`, `dureeJours`, `dateFin`, `contenu`, `statut`, `motifAnnulation` |

### SORTIES CRITIQUES — 2 entités · métier

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `Evacuation` | `idEvacuation` | `niveauUrgence`, `infosCliniques`, `statut`, `motifAnnulation` |
| `SuiviEvacuation` | `idSuiviEvacuation` ᵖ | `notes`, `statut` |

### SUIVI DE TRAITEMENT — 2 entités · métier

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `SuiviTraitement` | `idSuiviTraitement` ᵖ | `motif`, `statut`, `motifCloture`, `motifAnnulation`, `closedAt` |
| `FicheSuiviTraitement` | `idFicheSuiviTraitement` ᵖ | `temperature`, `tensionSystolique`, `tensionDiastolique`, `frequenceCardiaque`, `frequenceRespiratoire`, `saturationO2`, `poids`, `noteEvolution`, `medicamentsAdministres`, `resultatExamen` |

### SYNCHRONISATION OFFLINE — 8 entités · technique

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `PosteLocal` | `idPosteLocal` ᵖ | `libelle`, `derniereSyncAt`, `latitude`, `longitude`, `precisionM`, `positionAt`, `masque` |
| `FileMutation` | `idFileMutation` ᵖ | `mutationUuid`, `module`, `entiteType`, `action`, `payloadJson`, `statut`, `ordreLocal`, `createdLocalAt`, `sentAt`, `serverAckedAt`, `errorMessage` |
| `JournalSynchronisation` | `idJournalSynchronisation` ᵖ | `startedAt`, `finishedAt`, `statut`, `nbMutations`, `nbConflits` |
| `ConflitSynchronisation` | `idConflitSynchronisation` ᵖ | `mutationUuid`, `entiteType`, `typeConflit`, `valeurLocale`, `valeurServeur`, `statut` |
| `ResolutionConflit` | `idResolutionConflit` ᵖ | `resolution`, `auteur`, `justification` |
| `AlerteTechnique` | `idAlerteTechnique` ᵖ | `type`, `message`, `statut` |
| `ParametreMetier` | `idParametreMetier` ᵖ | `cle`, `valeur`, `description` |
| `HistoriqueParametreMetier` | `idHistoriqueParametreMetier` ᵖ | `ancienneVal`, `nouvelleVal`, `motif` |

### MESSAGERIE INTERNE (chiffrée) — 7 entités · technique

| Entité | Identifiant | Attributs descriptifs |
|---|---|---|
| `Conversation` | `idConversation` ᵖ | `type`, `titre`, `description`, `photoUrl` |
| `ConversationParticipant` | `idConversationParticipant` ᵖ | `estAdmin`, `muted`, `lastReadAt`, `joinedAt` |
| `Message` | `idMessage` ᵖ | `type`, `contenuChiffre`, `epingle`, `transfere`, `editedAt` |
| `MessageMasque` | `idMessageMasque` ᵖ | — *aucun* |
| `MessageReaction` | `idMessageReaction` ᵖ | `emoji` |
| `MessagePieceJointe` | `idMessagePieceJointe` ᵖ | `nomFichier`, `mimeType`, `taille`, `contenuChiffre` |
| `SyncState` | `idSyncState` ᵖ | `lastPulledAt`, `lastPushedAt` |

> ᵖ identifiant proposé, selon la convention `id` + nom de l'entité. Sans marque : repris tel quel de vos planches 8.1.


---

## 5. Les 97 associations

Lecture : `Entité` **cardinalité** — *verbe* — **cardinalité** `Entité`. La cardinalité se pose sur la patte, du côté de l'entité, en `minimum,maximum`.


### SÉCURITÉ & AUDIT — 15 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 1 | `Site` | 0,n | **à proposer** | 1,1 | `Utilisateur` |
| 2 | `PersonnelMedical` | 0,1 | **à proposer** | 0,1 | `Utilisateur` |
| 3 | `Utilisateur` | 0,n | **à proposer** | 1,1 | `PreferenceUtilisateur` |
| 4 | `Notification` | 0,n | **à proposer** | 1,1 | `NotificationLecture` |
| 5 | `Utilisateur` | 0,n | **à proposer** | 1,1 | `UtilisateurPermission` |
| 6 | `Permission` | 0,n | **à proposer** | 1,1 | `UtilisateurPermission` |
| 7 | `Utilisateur` | 0,n | **à proposer** | 1,1 | `UtilisateurRole` |
| 8 | `Role` | 0,n | **à proposer** | 1,1 | `UtilisateurRole` |
| 9 | `Role` | 0,n | **à proposer** | 1,1 | `RolePermission` |
| 10 | `Permission` | 0,n | **à proposer** | 1,1 | `RolePermission` |
| 11 | `Utilisateur` | 0,n | **à proposer** | 1,1 | `SessionUtilisateur` |
| 12 | `Utilisateur` | 0,1 | **à proposer** | 1,1 | `ConfigurationTotp` |
| 13 | `ConfigurationTotp` | 0,n | **à proposer** | 1,1 | `CodeSecoursTotp` |
| 14 | `Utilisateur` | 0,n | **à proposer** | 0,1 | `JournalAudit` |
| 15 | `Utilisateur` | 0,n | **à proposer** | 0,1 | `JournalAuthentification` |

### RÉFÉRENTIELS — 2 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 16 | `CategoriePatient` | 0,n | **à proposer** | 1,1 | `DroitCategoriePatient` |
| 17 | `MedicamentReference` | 0,n | **à proposer** | 1,1 | `ContreIndicationMedicament` |

### ACTEURS ADMINISTRATIFS — 13 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 18 | `PersonnelMedical` | 0,n | **à proposer** | 1,1 | `HabilitationPersonnel` |
| 19 | `PersonnelMedical` | 0,n | **à proposer** | 1,1 | `PlanningPermutation` |
| 20 | `PersonnelMedical` | 0,n | **à proposer** | 1,1 | `PresenceJournaliere` |
| 21 | `PersonnelMedical` | 0,n | **à proposer** | 1,1 | `AbsencePersonnel` |
| 22 | `PersonnelMedical` | 0,n | **à proposer** | 1,1 | `DelegationPrescription` |
| 23 | `PersonnelMedical` | 0,n | **à proposer** | 1,1 | `DelegationPrescription` |
| 24 | `DelegationPrescription` | 0,n | **à proposer** | 1,1 | `DelegationMedicamentAutorise` |
| 25 | `Patient` | 0,n | **à proposer** | 1,1 | `RattachementAyantDroitCdi` |
| 26 | `EmployeSaris` | 0,n | **à proposer** | 0,1 | `RattachementAyantDroitCdi` |
| 27 | `RattachementAyantDroitCdi` | 0,n | **à proposer** | 1,1 | `HistoriqueRattachementAyantDroit` |
| 28 | `Patient` | 0,n | **à proposer** | 1,1 | `RattachementSousTraitant` |
| 29 | `SocieteSousTraitante` | 0,n | **à proposer** | 1,1 | `RattachementSousTraitant` |
| 30 | `RattachementSousTraitant` | 0,n | **à proposer** | 1,1 | `HistoriqueRattachementSousTraitant` |

### DOSSIER PATIENT — 19 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 31 | `Site` | 0,n | **à proposer** | 1,1 | `Patient` |
| 32 | `CategoriePatient` | 0,n | **à proposer** | 1,1 | `Patient` |
| 33 | `EmployeSaris` | 0,n | **à proposer** | 0,1 | `Patient` |
| 34 | `Patient` | 0,1 | **à proposer** | 1,1 | `IdentitePatient` |
| 35 | `Patient` | 0,1 | **à proposer** | 1,1 | `DonneesEmploi` |
| 36 | `Patient` | 0,1 | **à proposer** | 1,1 | `ModeViePatient` |
| 37 | `Patient` | 0,1 | **à proposer** | 1,1 | `ContactUrgence` |
| 38 | `Patient` | 0,n | **à proposer** | 1,1 | `AllergiePatient` |
| 39 | `Patient` | 0,n | **à proposer** | 1,1 | `AntecedentPatient` |
| 40 | `PathologieReference` | 0,n | **à proposer** | 0,1 | `AntecedentPatient` |
| 41 | `Patient` | 0,n | **à proposer** | 1,1 | `AlerteMedicale` |
| 42 | `Patient` | 0,n | **à proposer** | 1,1 | `HistoriqueCategoriePatient` |
| 43 | `CategoriePatient` | 0,n | **à proposer** | 1,1 | `HistoriqueCategoriePatient` |
| 44 | `Patient` | 0,1 | **à proposer** | 1,1 | `FusionDossierPatient` |
| 45 | `Patient` | 0,1 | **à proposer** | 1,1 | `FusionDossierPatient` |
| 46 | `Patient` | 0,n | **à proposer** | 1,1 | `PreSaisieMedicale` |
| 47 | `Patient` | 0,n | **à proposer** | 1,1 | `SuiviGrossesse` |
| 48 | `SuiviGrossesse` | 0,n | **à proposer** | 1,1 | `ConsultationPrenatale` |
| 49 | `Consultation` | 0,n | **à proposer** | 0,1 | `ConsultationPrenatale` |

### ACCUEIL & TRIAGE — 5 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 50 | `Patient` | 0,n | *ouvrir* | 1,1 | `Visite` |
| 51 | `Site` | 0,n | **à proposer** | 1,1 | `Visite` |
| 52 | `MotifConsultation` | 0,n | **à proposer** | 1,1 | `Visite` |
| 53 | `Visite` | 0,n | **à proposer** | 1,1 | `VisiteEvenement` |
| 54 | `Visite` | 0,n | *porter* | 1,1 | `ConstanteVitale` |

### CONSULTATION & ACTES PRESCRITS — 25 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 55 | `Visite` | 0,n | *être parente de* | 1,1 | `Consultation` |
| 56 | `PersonnelMedical` | 0,n | **à proposer** | 1,1 | `Consultation` |
| 57 | `DelegationPrescription` | 0,n | **à proposer** | 0,1 | `Consultation` |
| 58 | `TypeConsultation` | 0,n | **à proposer** | 0,1 | `Consultation` |
| 59 | `Consultation` | 0,n | *rattacher* | 1,1 | `DiagnosticConsultation` |
| 60 | `PathologieReference` | 0,n | **à proposer** | 1,1 | `DiagnosticConsultation` |
| 61 | `Consultation` | 0,n | *rattacher* | 1,1 | `Ordonnance` |
| 62 | `DelegationPrescription` | 0,n | **à proposer** | 0,1 | `Ordonnance` |
| 63 | `EtablissementReference` | 0,n | **à proposer** | 0,1 | `Ordonnance` |
| 64 | `Ordonnance` | 0,n | *porter* | 1,1 | `LigneOrdonnance` |
| 65 | `MedicamentReference` | 0,n | **à proposer** | 0,1 | `LigneOrdonnance` |
| 66 | `TypeExamen` | 0,n | **à proposer** | 0,1 | `LigneOrdonnance` |
| 67 | `Consultation` | 0,n | *rattacher* | 1,1 | `BonExamen` |
| 68 | `Ordonnance` | 0,n | *engendrer* | 0,1 | `BonExamen` |
| 69 | `BonExamen` | 0,n | *porter* | 1,1 | `LigneExamen` |
| 70 | `TypeExamen` | 0,n | **à proposer** | 1,1 | `LigneExamen` |
| 71 | `BonExamen` | 0,n | **à proposer** | 1,1 | `ResultatExamen` |
| 72 | `Consultation` | 0,n | *rattacher* | 1,1 | `BonPharmacie` |
| 73 | `Ordonnance` | 0,n | *engendrer* | 0,1 | `BonPharmacie` |
| 74 | `BonPharmacie` | 0,n | *porter* | 1,1 | `LigneBonPharmacie` |
| 75 | `MedicamentReference` | 0,n | **à proposer** | 0,1 | `LigneBonPharmacie` |
| 76 | `PathologieReference` | 0,n | **à proposer** | 1,1 | `SuiviChronique` |
| 77 | `Consultation` | 0,n | **à proposer** | 0,1 | `SuiviChronique` |
| 78 | `Consultation` | 0,n | **à proposer** | 1,1 | `CertificatMedical` |
| 79 | `TypeCertificat` | 0,n | **à proposer** | 1,1 | `CertificatMedical` |

### SORTIES CRITIQUES — 3 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 80 | `Consultation` | 0,1 | *rattacher* | 1,1 | `Evacuation` |
| 81 | `EtablissementReference` | 0,n | **à proposer** | 0,1 | `Evacuation` |
| 82 | `Evacuation` | 0,n | **à proposer** | 1,1 | `SuiviEvacuation` |

### SUIVI DE TRAITEMENT — 2 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 83 | `Consultation` | 0,1 | **à proposer** | 1,1 | `SuiviTraitement` |
| 84 | `SuiviTraitement` | 0,n | **à proposer** | 1,1 | `FicheSuiviTraitement` |

### SYNCHRONISATION OFFLINE — 5 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 85 | `PosteLocal` | 0,n | **à proposer** | 1,1 | `FileMutation` |
| 86 | `PosteLocal` | 0,n | **à proposer** | 1,1 | `JournalSynchronisation` |
| 87 | `JournalSynchronisation` | 0,n | **à proposer** | 1,1 | `ConflitSynchronisation` |
| 88 | `ConflitSynchronisation` | 0,1 | **à proposer** | 1,1 | `ResolutionConflit` |
| 89 | `ParametreMetier` | 0,n | **à proposer** | 1,1 | `HistoriqueParametreMetier` |

### MESSAGERIE INTERNE (chiffrée) — 8 associations

| # | Entité | Card. | Verbe | Card. | Entité |
|---:|---|:---:|---|:---:|---|
| 90 | `Conversation` | 0,n | **à proposer** | 1,1 | `ConversationParticipant` |
| 91 | `Utilisateur` | 0,n | **à proposer** | 1,1 | `ConversationParticipant` |
| 92 | `Conversation` | 0,n | **à proposer** | 1,1 | `Message` |
| 93 | `Utilisateur` | 0,n | **à proposer** | 1,1 | `Message` |
| 94 | `Message` | 0,n | **à proposer** | 0,1 | `Message` |
| 95 | `Message` | 0,n | **à proposer** | 1,1 | `MessageMasque` |
| 96 | `Message` | 0,n | **à proposer** | 1,1 | `MessageReaction` |
| 97 | `Message` | 0,n | **à proposer** | 1,1 | `MessagePieceJointe` |

> Les associations sont classées par le module de l'entité qui porte la clé. Une association dont les deux bouts sont dans des modules différents apparaît une seule fois.


---

## 6. Ce que je n'ai pas pu vérifier

- **Les six énumérations** de la base centrale, absentes de ma copie du schéma.
- **Les verbes** : le mémoire n'en nomme que treize. Les 84 autres n'ont aucune source écrite, et ne peuvent qu'être proposés.
- **Les identifiants MERISE** des 76 entités non encore dessinées : ils n'existent nulle part, ni au mémoire ni au code. La convention est mécanique, mais elle reste une convention.