# INV-02 — Inventaire du modèle de données

> **Statut** : extrait · **Date d’extraction** : 2026-08-10
> **Sources** : `packages/db/prisma/schema.prisma` (PostgreSQL) et `packages/db/prisma/sqlite/schema.prisma` (réplique locale)
> **Méthode** : analyse automatique des blocs `model` et `enum`, appariement des deux extrémités de chaque relation, puis relecture.
> **Nature de la preuve** : `IMPLÉMENTÉ`.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Modèles (tables) PostgreSQL | **88** |
| Modèles présents dans la réplique SQLite | **88** — soit **100 %** |
| Énumérations | **6** |
| Relations (associations) | **97** |
| Modèles à suppression logique (`deletedAt`) | **47** sur 88 |
| Champs au total | **967** |
| Modèles sans aucune relation | **6** (voir § 5) |

### 1.1 Répartition par domaine

| Domaine (section du schéma) | Modèles | Champs | Relations internes |
|---|---:|---:|---:|
| SÉCURITÉ & AUDIT | 18 | 170 | 13 |
| RÉFÉRENTIELS | 12 | 104 | 2 |
| ACTEURS ADMINISTRATIFS | 12 | 121 | 10 |
| DOSSIER PATIENT | 13 | 163 | 13 |
| ACCUEIL & TRIAGE | 3 | 54 | 2 |
| CONSULTATION & ACTES PRESCRITS | 11 | 163 | 12 |
| SORTIES CRITIQUES | 2 | 21 | 1 |
| SUIVI DE TRAITEMENT | 2 | 27 | 1 |
| MESSAGERIE INTERNE (chiffrée) | 7 | 71 | 6 |
| SYNCHRONISATION OFFLINE | 8 | 73 | 5 |
| **Total** | **88** | **967** | **97** |

### 1.2 Entités les plus connectées

Le degré de connexion (nombre d’associations) désigne objectivement le cœur du modèle.

| Rang | Entité | Degré | Domaine |
|---:|---|---:|---|
| 1 | `Patient` | 18 | DOSSIER PATIENT |
| 2 | `Consultation` | 13 | CONSULTATION & ACTES PRESCRITS |
| 3 | `Utilisateur` | 11 | SÉCURITÉ & AUDIT |
| 4 | `PersonnelMedical` | 8 | ACTEURS ADMINISTRATIFS |
| 5 | `Message` | 7 | MESSAGERIE INTERNE (chiffrée) |
| 6 | `Visite` | 6 | ACCUEIL & TRIAGE |
| 7 | `Ordonnance` | 6 | CONSULTATION & ACTES PRESCRITS |
| 8 | `DelegationPrescription` | 5 | ACTEURS ADMINISTRATIFS |
| 9 | `BonExamen` | 4 | CONSULTATION & ACTES PRESCRITS |
| 10 | `Site` | 3 | RÉFÉRENTIELS |

---

## 2. Conventions de lecture

| Notation | Sens |
|---|---|
| **PK** | Clé primaire (`@id`) |
| **FK** | Clé étrangère : le champ porte `@relation(fields: […])` |
| **U** | Contrainte d’unicité (`@unique`) |
| `Type?` | Champ **facultatif** (`NULL` autorisé) |
| `Type[]` | Collection |
| `0..1`, `1`, `0..*` | Multiplicités UML, à reporter **telles quelles** sur le diagramme de classes |

**Lecture d’une ligne de relation.** `Patient — 0..* → Visite` se lit : *un patient est associé à zéro ou plusieurs visites*. La multiplicité s’écrit sur le diagramme **à l’extrémité de l’entité comptée**, jamais à côté de l’entité qui compte.

---

## 3. Noyau proposé pour le diagramme de classes (UML-CLS-01)

Les 88 modèles ne peuvent pas figurer sur une seule planche lisible. Le diagramme de classes du chapitre 7 retient **29 classes**, soit 59 entités écartées, sélectionnées sur deux critères explicites :

1. **degré de connexion ≥ 2** dans les domaines cliniques, acteurs et référentiels ;
2. **deux exceptions justifiées par le poids métier** : `ConstanteVitale` (donnée centrale du triage) et `DroitCategoriePatient` (matrice qui porte la règle d’éligibilité aux prestations).

Les modèles écartés ne disparaissent pas : ils sont intégralement décrits au § 4 du présent inventaire.

> 📌 **Correction du 19 août 2026.** Ce paragraphe annonçait **27 classes**. La fiche de dessin `UML-CLS-01` les énumère une par une, de C01 à C29, et conclut elle-même à **29 classes sur 88**. L'énumération l'emporte sur le décompte : le nombre a été porté à 29, et le nombre d'entités écartées de 61 à 59. Le mémoire dit 29 : les trois sources concordent désormais.
>
> Le dictionnaire de données complet, autrefois annexe D, a été retiré du mémoire. Il est archivé dans `99_archive/annexes_retirees_du_memoire/`, et le § 4 ci-dessous le remplace.

| Classe retenue | Degré | Champs | Domaine |
|---|---:|---:|---|
| `Patient` | 18 | 36 | DOSSIER PATIENT |
| `IdentitePatient` | 1 | 12 | DOSSIER PATIENT |
| `Visite` | 6 | 22 | ACCUEIL & TRIAGE |
| `ConstanteVitale` | 1 | 23 | ACCUEIL & TRIAGE |
| `Consultation` | 13 | 37 | CONSULTATION & ACTES PRESCRITS |
| `DiagnosticConsultation` | 2 | 8 | CONSULTATION & ACTES PRESCRITS |
| `Ordonnance` | 6 | 18 | CONSULTATION & ACTES PRESCRITS |
| `LigneOrdonnance` | 3 | 15 | CONSULTATION & ACTES PRESCRITS |
| `BonExamen` | 4 | 14 | CONSULTATION & ACTES PRESCRITS |
| `LigneExamen` | 2 | 6 | CONSULTATION & ACTES PRESCRITS |
| `BonPharmacie` | 3 | 15 | CONSULTATION & ACTES PRESCRITS |
| `LigneBonPharmacie` | 2 | 10 | CONSULTATION & ACTES PRESCRITS |
| `Evacuation` | 3 | 14 | SORTIES CRITIQUES |
| `Utilisateur` | 11 | 29 | SÉCURITÉ & AUDIT |
| `Role` | 2 | 6 | SÉCURITÉ & AUDIT |
| `Permission` | 2 | 6 | SÉCURITÉ & AUDIT |
| `UtilisateurRole` | 2 | 3 | SÉCURITÉ & AUDIT |
| `RolePermission` | 2 | 3 | SÉCURITÉ & AUDIT |
| `PersonnelMedical` | 8 | 18 | ACTEURS ADMINISTRATIFS |
| `DelegationPrescription` | 5 | 14 | ACTEURS ADMINISTRATIFS |
| `Site` | 3 | 11 | RÉFÉRENTIELS |
| `CategoriePatient` | 3 | 9 | RÉFÉRENTIELS |
| `DroitCategoriePatient` | 1 | 8 | RÉFÉRENTIELS |
| `PathologieReference` | 3 | 11 | RÉFÉRENTIELS |
| `MedicamentReference` | 3 | 10 | RÉFÉRENTIELS |
| `TypeExamen` | 2 | 9 | RÉFÉRENTIELS |
| `EmployeSaris` | 2 | 17 | ACTEURS ADMINISTRATIFS |
| `RattachementAyantDroitCdi` | 3 | 13 | ACTEURS ADMINISTRATIFS |
| `RattachementSousTraitant` | 3 | 11 | ACTEURS ADMINISTRATIFS |

**Domaines volontairement absents du diagramme de classes**, avec leur motif :

| Domaine écarté | Modèles | Motif |
|---|---:|---|
| Messagerie interne | 7 | Sous-système autonome, sans lien structurel avec le parcours de soin ; mérite sa propre planche si le jury le demande |
| Synchronisation offline | 8 | Relève de l’architecture technique (chapitre 7.5, déploiement), pas du modèle métier |
| Audit, notifications, sessions | 8 | Traces techniques transverses, sans valeur pour la compréhension du domaine |
| Historiques et journaux | 6 | Tables de journalisation dérivées des entités déjà représentées |

---

## 4. Tableau des relations — données de tracé du diagramme de classes

Les **97 associations** du modèle. Ce tableau est la source directe de la fiche de dessin `UML-CLS-01` : chaque ligne se trace telle quelle.

| # | Entité A | Rôle A → B | Mult. côté B | Entité B | Rôle B → A | Mult. côté A | Porteur FK | Colonne FK | Suppression |
|---:|---|---|:---:|---|---|:---:|---|---|---|
| 1 | `Patient` | alertesMedicales | 0..* | `AlerteMedicale` | patient | 1 | `AlerteMedicale` | `patientId` | Restrict (défaut) |
| 2 | `Patient` | allergies | 0..* | `AllergiePatient` | patient | 1 | `AllergiePatient` | `patientId` | Restrict (défaut) |
| 3 | `Patient` | antecedents | 0..* | `AntecedentPatient` | patient | 1 | `AntecedentPatient` | `patientId` | Restrict (défaut) |
| 4 | `Patient` | contactUrgence | 0..1 | `ContactUrgence` | patient | 1 | `ContactUrgence` | `patientId` | Restrict (défaut) |
| 5 | `Patient` | donneesEmploi | 0..1 | `DonneesEmploi` | patient | 1 | `DonneesEmploi` | `patientId` | Restrict (défaut) |
| 6 | `Patient` | fusionCible | 0..1 | `FusionDossierPatient` | cible | 1 | `FusionDossierPatient` | `cibleId` | Restrict (défaut) |
| 7 | `Patient` | fusionSource | 0..1 | `FusionDossierPatient` | source | 1 | `FusionDossierPatient` | `sourceId` | Restrict (défaut) |
| 8 | `Patient` | historiquesCateg | 0..* | `HistoriqueCategoriePatient` | patient | 1 | `HistoriqueCategoriePatient` | `patientId` | Restrict (défaut) |
| 9 ⭐ | `Patient` | identite | 0..1 | `IdentitePatient` | patient | 1 | `IdentitePatient` | `patientId` | Restrict (défaut) |
| 10 | `Patient` | modeVie | 0..1 | `ModeViePatient` | patient | 1 | `ModeViePatient` | `patientId` | Restrict (défaut) |
| 11 | `Patient` | preSaisies | 0..* | `PreSaisieMedicale` | patient | 1 | `PreSaisieMedicale` | `patientId` | Restrict (défaut) |
| 12 | `Patient` | suiviGrossesse | 0..* | `SuiviGrossesse` | patient | 1 | `SuiviGrossesse` | `patientId` | Restrict (défaut) |
| 13 ⭐ | `Patient` | visites | 0..* | `Visite` | patient | 1 | `Visite` | `patientId` | Restrict (défaut) |
| 14 ⭐ | `Consultation` | bonsExamen | 0..* | `BonExamen` | consultation | 1 | `BonExamen` | `consultationId` | Restrict (défaut) |
| 15 ⭐ | `Consultation` | bonsPharmacie | 0..* | `BonPharmacie` | consultation | 1 | `BonPharmacie` | `consultationId` | Restrict (défaut) |
| 16 | `Consultation` | certificats | 0..* | `CertificatMedical` | consultation | 1 | `CertificatMedical` | `consultationId` | Restrict (défaut) |
| 17 ⭐ | `Consultation` | diagnostics | 0..* | `DiagnosticConsultation` | consultation | 1 | `DiagnosticConsultation` | `consultationId` | Restrict (défaut) |
| 18 ⭐ | `Consultation` | evacuation | 0..1 | `Evacuation` | consultation | 1 | `Evacuation` | `consultationId` | Restrict (défaut) |
| 19 ⭐ | `Consultation` | ordonnances | 0..* | `Ordonnance` | consultation | 1 | `Ordonnance` | `consultationId` | Restrict (défaut) |
| 20 | `Consultation` | suiviChronique | 0..* | `SuiviChronique` | consultation | 0..1 | `SuiviChronique` | `consultationId` | Restrict (défaut) |
| 21 | `Consultation` | suiviTraitement | 0..1 | `SuiviTraitement` | consultation | 1 | `SuiviTraitement` | `consultationId` | Restrict (défaut) |
| 22 | `Utilisateur` | configTotp | 0..1 | `ConfigurationTotp` | utilisateur | 1 | `ConfigurationTotp` | `utilisateurId` | Restrict (défaut) |
| 23 | `Utilisateur` | conversations | 0..* | `ConversationParticipant` | utilisateur | 1 | `ConversationParticipant` | `utilisateurId` | Restrict (défaut) |
| 24 | `Utilisateur` | journauxAudit | 0..* | `JournalAudit` | utilisateur | 0..1 | `JournalAudit` | `utilisateurId` | Restrict (défaut) |
| 25 | `Utilisateur` | journauxAuth | 0..* | `JournalAuthentification` | utilisateur | 0..1 | `JournalAuthentification` | `utilisateurId` | Restrict (défaut) |
| 26 | `Utilisateur` | messagesEnvoyes | 0..* | `Message` | expediteur | 1 | `Message` | `expediteurId` | Restrict (défaut) |
| 27 | `Utilisateur` | permissionsOverrides | 0..* | `UtilisateurPermission` | utilisateur | 1 | `UtilisateurPermission` | `utilisateurId` | Cascade |
| 28 ⭐ | `Utilisateur` | personnelMedical | 0..1 | `PersonnelMedical` | utilisateur | 0..1 | `Utilisateur` | `personnelMedicalId` | Restrict (défaut) |
| 29 | `Utilisateur` | preferences | 0..1 | `PreferenceUtilisateur` | utilisateur | 1 | `PreferenceUtilisateur` | `utilisateurId` | Cascade |
| 30 | `Utilisateur` | roles | 0..* | `UtilisateurRole` | utilisateur | 1 | `UtilisateurRole` | `utilisateurId` | Restrict (défaut) |
| 31 | `Utilisateur` | sessions | 0..* | `SessionUtilisateur` | utilisateur | 1 | `SessionUtilisateur` | `utilisateurId` | Restrict (défaut) |
| 32 ⭐ | `Utilisateur` | site | 1 | `Site` | utilisateurs | 0..* | `Utilisateur` | `siteId` | Restrict (défaut) |
| 33 | `PersonnelMedical` | absences | 0..* | `AbsencePersonnel` | personnel | 1 | `AbsencePersonnel` | `personnelId` | Restrict (défaut) |
| 34 ⭐ | `PersonnelMedical` | consultations | 0..* | `Consultation` | soignant | 1 | `Consultation` | `soignantId` | Restrict (défaut) |
| 35 ⭐ | `PersonnelMedical` | delegationsDonnees | 0..* | `DelegationPrescription` | medecinChef | 1 | `DelegationPrescription` | `medecinChefId` | Restrict (défaut) |
| 36 ⭐ | `PersonnelMedical` | delegationsRecues | 0..* | `DelegationPrescription` | infirmier | 1 | `DelegationPrescription` | `infirmierId` | Restrict (défaut) |
| 37 | `PersonnelMedical` | habilitations | 0..* | `HabilitationPersonnel` | personnel | 1 | `HabilitationPersonnel` | `personnelId` | Restrict (défaut) |
| 38 | `PersonnelMedical` | plannings | 0..* | `PlanningPermutation` | personnel | 1 | `PlanningPermutation` | `personnelId` | Restrict (défaut) |
| 39 | `PersonnelMedical` | presences | 0..* | `PresenceJournaliere` | personnel | 1 | `PresenceJournaliere` | `personnelId` | Restrict (défaut) |
| 40 | `Message` | masques | 0..* | `MessageMasque` | message | 1 | `MessageMasque` | `messageId` | Cascade |
| 41 | `Message` | piecesJointes | 0..* | `MessagePieceJointe` | message | 1 | `MessagePieceJointe` | `messageId` | Cascade |
| 42 | `Message` | reactions | 0..* | `MessageReaction` | message | 1 | `MessageReaction` | `messageId` | Cascade |
| 43 | `Message` | replyTo | 0..1 | `Message` | replies | 0..* | `Message` | `replyToId` | SetNull |
| 44 ⭐ | `Ordonnance` | bonsExamen | 0..* | `BonExamen` | ordonnance | 0..1 | `BonExamen` | `ordonnanceId` | Restrict (défaut) |
| 45 ⭐ | `Ordonnance` | bonsPharmacie | 0..* | `BonPharmacie` | ordonnance | 0..1 | `BonPharmacie` | `ordonnanceId` | Restrict (défaut) |
| 46 ⭐ | `Ordonnance` | lignes | 0..* | `LigneOrdonnance` | ordonnance | 1 | `LigneOrdonnance` | `ordonnanceId` | Restrict (défaut) |
| 47 ⭐ | `Visite` | constantes | 0..* | `ConstanteVitale` | visite | 1 | `ConstanteVitale` | `visiteId` | Restrict (défaut) |
| 48 ⭐ | `Visite` | consultations | 0..* | `Consultation` | visite | 1 | `Consultation` | `visiteId` | Restrict (défaut) |
| 49 | `Visite` | evenements | 0..* | `VisiteEvenement` | visite | 1 | `VisiteEvenement` | `visiteId` | Cascade |
| 50 ⭐ | `DelegationPrescription` | consultations | 0..* | `Consultation` | delegation | 0..1 | `Consultation` | `delegationId` | Restrict (défaut) |
| 51 | `DelegationPrescription` | medicamentsAutorises | 0..* | `DelegationMedicamentAutorise` | delegation | 1 | `DelegationMedicamentAutorise` | `delegationId` | Restrict (défaut) |
| 52 ⭐ | `DelegationPrescription` | ordonnances | 0..* | `Ordonnance` | delegation | 0..1 | `Ordonnance` | `delegationId` | Restrict (défaut) |
| 53 ⭐ | `BonExamen` | lignes | 0..* | `LigneExamen` | bon | 1 | `LigneExamen` | `bonId` | Restrict (défaut) |
| 54 | `BonExamen` | resultats | 0..* | `ResultatExamen` | bon | 1 | `ResultatExamen` | `bonId` | Restrict (défaut) |
| 55 ⭐ | `BonPharmacie` | lignes | 0..* | `LigneBonPharmacie` | bon | 1 | `LigneBonPharmacie` | `bonId` | Restrict (défaut) |
| 56 ⭐ | `CategoriePatient` | droits | 0..* | `DroitCategoriePatient` | categorie | 1 | `DroitCategoriePatient` | `categorieId` | Restrict (défaut) |
| 57 | `CategoriePatient` | historiques | 0..* | `HistoriqueCategoriePatient` | nouvelleCategorie | 1 | `HistoriqueCategoriePatient` | `nouvelleCategId` | Restrict (défaut) |
| 58 ⭐ | `CategoriePatient` | patients | 0..* | `Patient` | categoriePatient | 1 | `Patient` | `categoriePatientId` | Restrict (défaut) |
| 59 | `Evacuation` | suivi | 0..* | `SuiviEvacuation` | evacuation | 1 | `SuiviEvacuation` | `evacuationId` | Restrict (défaut) |
| 60 | `MedicamentReference` | contreIndications | 0..* | `ContreIndicationMedicament` | medicament | 1 | `ContreIndicationMedicament` | `medicamentId` | Restrict (défaut) |
| 61 ⭐ | `MedicamentReference` | lignesBonPharmacie | 0..* | `LigneBonPharmacie` | medicament | 0..1 | `LigneBonPharmacie` | `medicamentId` | Restrict (défaut) |
| 62 ⭐ | `MedicamentReference` | lignesOrdonnance | 0..* | `LigneOrdonnance` | medicament | 0..1 | `LigneOrdonnance` | `medicamentId` | Restrict (défaut) |
| 63 | `PathologieReference` | antecedents | 0..* | `AntecedentPatient` | pathologie | 0..1 | `AntecedentPatient` | `pathologieId` | Restrict (défaut) |
| 64 ⭐ | `PathologieReference` | diagnostics | 0..* | `DiagnosticConsultation` | pathologie | 1 | `DiagnosticConsultation` | `pathologieId` | Restrict (défaut) |
| 65 | `PathologieReference` | suivis | 0..* | `SuiviChronique` | pathologie | 1 | `SuiviChronique` | `pathologieId` | Restrict (défaut) |
| 66 | `RattachementAyantDroitCdi` | historiques | 0..* | `HistoriqueRattachementAyantDroit` | rattachement | 1 | `HistoriqueRattachementAyantDroit` | `rattachementId` | Restrict (défaut) |
| 67 ⭐ | `RattachementAyantDroitCdi` | patient | 1 | `Patient` | rattachementsAD | 0..* | `RattachementAyantDroitCdi` | `patientId` | Restrict (défaut) |
| 68 | `RattachementSousTraitant` | historiques | 0..* | `HistoriqueRattachementSousTraitant` | rattachement | 1 | `HistoriqueRattachementSousTraitant` | `rattachementId` | Restrict (défaut) |
| 69 ⭐ | `RattachementSousTraitant` | patient | 1 | `Patient` | rattachementsST | 0..* | `RattachementSousTraitant` | `patientId` | Restrict (défaut) |
| 70 ⭐ | `Site` | patients | 0..* | `Patient` | siteCreation | 1 | `Patient` | `siteCreationId` | Restrict (défaut) |
| 71 ⭐ | `Site` | visites | 0..* | `Visite` | site | 1 | `Visite` | `siteId` | Restrict (défaut) |
| 72 | `ConfigurationTotp` | codesSecours | 0..* | `CodeSecoursTotp` | config | 1 | `CodeSecoursTotp` | `configId` | Restrict (défaut) |
| 73 | `ConflitSynchronisation` | resolution | 0..1 | `ResolutionConflit` | conflit | 1 | `ResolutionConflit` | `conflitId` | Restrict (défaut) |
| 74 | `ConsultationPrenatale` | consultation | 0..1 | `Consultation` | consultationsPrenat | 0..* | `ConsultationPrenatale` | `consultationId` | Restrict (défaut) |
| 75 | `Conversation` | messages | 0..* | `Message` | conversation | 1 | `Message` | `conversationId` | Cascade |
| 76 | `Conversation` | participants | 0..* | `ConversationParticipant` | conversation | 1 | `ConversationParticipant` | `conversationId` | Cascade |
| 77 ⭐ | `EmployeSaris` | patients | 0..* | `Patient` | employe | 0..1 | `Patient` | `employeId` | Restrict (défaut) |
| 78 ⭐ | `EmployeSaris` | rattachementsAyantDroit | 0..* | `RattachementAyantDroitCdi` | employe | 0..1 | `RattachementAyantDroitCdi` | `employeId` | Restrict (défaut) |
| 79 | `EtablissementReference` | evacuations | 0..* | `Evacuation` | etablissement | 0..1 | `Evacuation` | `etablissementId` | Restrict (défaut) |
| 80 | `EtablissementReference` | ordonnances | 0..* | `Ordonnance` | etablissement | 0..1 | `Ordonnance` | `etablissementId` | Restrict (défaut) |
| 81 | `JournalSynchronisation` | conflits | 0..* | `ConflitSynchronisation` | journal | 1 | `ConflitSynchronisation` | `journalId` | Restrict (défaut) |
| 82 | `Permission` | overrides | 0..* | `UtilisateurPermission` | permission | 1 | `UtilisateurPermission` | `permissionId` | Cascade |
| 83 | `Permission` | roles | 0..* | `RolePermission` | permission | 1 | `RolePermission` | `permissionId` | Restrict (défaut) |
| 84 | `PosteLocal` | fileMutations | 0..* | `FileMutation` | posteLocal | 1 | `FileMutation` | `posteLocalId` | Restrict (défaut) |
| 85 | `PosteLocal` | journauxSync | 0..* | `JournalSynchronisation` | posteLocal | 1 | `JournalSynchronisation` | `posteLocalId` | Restrict (défaut) |
| 86 | `Role` | permissions | 0..* | `RolePermission` | role | 1 | `RolePermission` | `roleId` | Restrict (défaut) |
| 87 | `Role` | utilisateurs | 0..* | `UtilisateurRole` | role | 1 | `UtilisateurRole` | `roleId` | Restrict (défaut) |
| 88 | `SuiviGrossesse` | consultationsPrenat | 0..* | `ConsultationPrenatale` | suivi | 1 | `ConsultationPrenatale` | `suiviId` | Restrict (défaut) |
| 89 | `SuiviTraitement` | fiches | 0..* | `FicheSuiviTraitement` | suiviTraitement | 1 | `FicheSuiviTraitement` | `suiviTraitementId` | Restrict (défaut) |
| 90 ⭐ | `TypeExamen` | lignes | 0..* | `LigneExamen` | typeExamen | 1 | `LigneExamen` | `typeExamenId` | Restrict (défaut) |
| 91 ⭐ | `TypeExamen` | lignesOrdonnance | 0..* | `LigneOrdonnance` | typeExamen | 0..1 | `LigneOrdonnance` | `typeExamenId` | Restrict (défaut) |
| 92 | `MotifConsultation` | visites | 0..* | `Visite` | motifPrincipal | 1 | `Visite` | `motifPrincipalId` | Restrict (défaut) |
| 93 | `Notification` | lectures | 0..* | `NotificationLecture` | notification | 1 | `NotificationLecture` | `notificationId` | Cascade |
| 94 | `ParametreMetier` | historiques | 0..* | `HistoriqueParametreMetier` | parametre | 1 | `HistoriqueParametreMetier` | `parametreId` | Restrict (défaut) |
| 95 | `SocieteSousTraitante` | rattachements | 0..* | `RattachementSousTraitant` | societe | 1 | `RattachementSousTraitant` | `societeId` | Restrict (défaut) |
| 96 | `TypeCertificat` | certificats | 0..* | `CertificatMedical` | typeCertificat | 1 | `CertificatMedical` | `typeCertificatId` | Restrict (défaut) |
| 97 | `TypeConsultation` | consultations | 0..* | `Consultation` | typeConsultation | 0..1 | `Consultation` | `typeConsultationId` | Restrict (défaut) |

⭐ = association entre deux classes du noyau, **à tracer sur UML-CLS-01**. Les autres alimentent le dictionnaire de données.

Associations à tracer sur le noyau : **34**.

---

## 5. Énumérations — machines à états du modèle

Ces six énumérations portent les états contraints par la base. Elles sont reprises et complétées dans **INV-07** (transitions autorisées et interdites).

| Énumération | Valeurs | Portée |
|---|---|---|
| `StatutCompte` | `ACTIF` · `DESACTIVE` · `BLOQUE` | Cycle de vie d’un compte utilisateur |
| `ModeOverridePermission` | `GRANT` · `REVOKE` | Sens d’une dérogation individuelle de permission |
| `StatutPatient` | `ACTIF` · `ARCHIVE` · `DECEDE` · `FUSIONNE` | Cycle de vie d’un dossier patient |
| `StatutVisite` | `EN_ATTENTE` · `EN_COURS` · `CLOTUREE` · `ANNULEE` | Cycle de vie d’une visite (parcours de triage) |
| `TypeEvenementVisite` | `STATUT_CHANGE` · `PRIORITE_CHANGE` · `SOIGNANT_CHANGE` · `NOTES_UPDATE` | Nature d’un événement journalisé sur une visite |
| `StatutConsultation` | `OUVERTE` · `CLOTUREE` · `ANNULEE` | Cycle de vie d’une consultation |

> ⚠️ Ces six énumérations ne couvrent pas tous les états du système. **46 champs `statut` supplémentaires** sont typés `String` et contraints par le code applicatif, non par la base (bons, évacuations, délégations…). INV-07 les reconstitue ; le chapitre 7 doit signaler ce choix de conception.

---

## 6. Modèles sans aucune relation

Six modèles n’ont aucune association. Ce sont des tables de configuration ou de journalisation autonomes ; elles **ne figurent pas au diagramme de classes** mais doivent apparaître au schéma relationnel (chapitre 8) et au dictionnaire de données.

| Modèle | Domaine | Champs | Rôle |
|---|---|---:|---|
| `AlerteAnomalie` | SÉCURITÉ & AUDIT | 8 | Alerte de sécurité levée par la supervision |
| `ParametreSysteme` | SÉCURITÉ & AUDIT | 6 | Paramètre global de l’application (clé/valeur) |
| `SauvegardeSysteme` | SÉCURITÉ & AUDIT | 10 | Trace d’une sauvegarde de configuration |
| `RapportGenere` | SÉCURITÉ & AUDIT | 6 | Trace d’un rapport produit et téléchargé |
| `AlerteTechnique` | SYNCHRONISATION OFFLINE | 6 | Alerte technique de la synchronisation |
| `SyncState` | MESSAGERIE INTERNE (chiffrée) | 6 | Curseur de synchronisation d’un poste local |

---

## 7. Inventaire détaillé des 88 modèles

### SÉCURITÉ & AUDIT

#### `Utilisateur`

***noyau UML-CLS-01** · suppression logique · degré 11 · `packages/db/prisma/schema.prisma:14`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `login` | `String` | U |  |  |
| `email` | `String` | U |  |  |
| `passwordHash` | `String` |  |  |  |
| `statut` | `StatutCompte` |  | `ACTIF` |  |
| `motDePasseTemp` | `Boolean` |  | `false` |  |
| `tentativesEchec` | `Int` |  | `0` |  |
| `blocageJusquA` | `DateTime?` |  |  |  |
| `blocageMinutes` | `Int` |  | `0` |  |
| `siteId` | `String` |  |  |  |
| `personnelMedicalId` | `String?` | U |  |  |
| `photoUrl` | `String?` |  |  |  |
| `lastSeenAt` | `DateTime?` |  |  | présence : dernière activité (messagerie) |
| `createdAt` | `DateTime` |  | `now(` |  |
| `updatedAt` | `DateTime` |  |  |  |
| `createdBy` | `String?` |  |  |  |
| `updatedBy` | `String?` |  |  |  |

Associations : `site` → `Site` · `personnelMedical` → `PersonnelMedical?` · `roles` → `UtilisateurRole[]` · `permissionsOverrides` → `UtilisateurPermission[]` · `sessions` → `SessionUtilisateur[]` · `configTotp` → `ConfigurationTotp?` · `preferences` → `PreferenceUtilisateur?` · `journauxAudit` → `JournalAudit[]` · `journauxAuth` → `JournalAuthentification[]` · `conversations` → `ConversationParticipant[]` · `messagesEnvoyes` → `Message[]`

Contraintes de table : `@@index([updatedAt])`

#### `Role`

***noyau UML-CLS-01** · degré 2 · `packages/db/prisma/schema.prisma:119`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |

Associations : `utilisateurs` → `UtilisateurRole[]` · `permissions` → `RolePermission[]`

Contraintes de table : `@@index([updatedAt])`

#### `Permission`

***noyau UML-CLS-01** · degré 2 · `packages/db/prisma/schema.prisma:130`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `module` | `String` |  |  |  |

Associations : `roles` → `RolePermission[]` · `overrides` → `UtilisateurPermission[]`

Contraintes de table : `@@index([updatedAt])`

#### `UtilisateurPermission`

*degré 2 · `packages/db/prisma/schema.prisma:146`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `utilisateurId` | `String` |  |  |  |
| `permissionId` | `String` |  |  |  |
| `mode` | `ModeOverridePermission` |  |  |  |
| `motif` | `String?` |  |  |  |
| `accordePar` | `String?` |  |  | id de l'admin auteur de la dérogation |
| `createdAt` | `DateTime` |  | `now(` |  |
| `updatedAt` | `DateTime` |  |  |  |

Associations : `utilisateur` → `Utilisateur` · `permission` → `Permission`

Contraintes de table : `@@unique([utilisateurId, permissionId])` · `@@index([utilisateurId])`

#### `UtilisateurRole`

*degré 2 · `packages/db/prisma/schema.prisma:168`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `utilisateurId` | `String` |  |  |  |
| `roleId` | `String` |  |  |  |

Associations : `utilisateur` → `Utilisateur` · `role` → `Role`

Contraintes de table : `@@id([utilisateurId, roleId])` · `@@index([updatedAt])`

#### `RolePermission`

*degré 2 · `packages/db/prisma/schema.prisma:179`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `roleId` | `String` |  |  |  |
| `permissionId` | `String` |  |  |  |

Associations : `role` → `Role` · `permission` → `Permission`

Contraintes de table : `@@id([roleId, permissionId])` · `@@index([updatedAt])`

#### `ConfigurationTotp`

*degré 2 · `packages/db/prisma/schema.prisma:217`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `utilisateurId` | `String` | U |  |  |
| `secretChiffre` | `String` |  |  |  |
| `actif` | `Boolean` |  | `false` |  |
| `activatedAt` | `DateTime?` |  |  |  |

Associations : `utilisateur` → `Utilisateur` · `codesSecours` → `CodeSecoursTotp[]`

#### `PreferenceUtilisateur`

*degré 1 · `packages/db/prisma/schema.prisma:53`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `utilisateurId` | `String` | **PK** |  |  |
| `theme` | `String` |  | `"auto"` | clair | sombre | auto |
| `densite` | `String` |  | `"confort"` | confort | compact |
| `langue` | `String` |  | `"fr"` | fr | en |
| `pageAccueil` | `String` |  | `"dashboard"` | route après connexion |
| `lignesParPage` | `Int` |  | `25` | INERTE : le défaut réel est 10, dans PREF_DEFAULTS (me.service.ts) — les deux ch |
| `notifEmail` | `Boolean` |  | `true` | notifications par e-mail |
| `notifApp` | `Boolean` |  | `true` | notifications dans l'application (cloche) |
| `cguAccepteeLe` | `DateTime?` |  |  | date d'acceptation des conditions d'utilisation |
| `cguVersion` | `String?` |  |  | version des CGU acceptée (re-demande si obsolète) |
| `updatedAt` | `DateTime` |  |  |  |

Associations : `utilisateur` → `Utilisateur`

#### `Notification`

*degré 1 · `packages/db/prisma/schema.prisma:74`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `destinataireId` | `String?` |  |  | individuelle si renseigné |
| `siteId` | `String?` |  |  | diffusion : null = tous les sites (système global) |
| `requiredPermission` | `String?` |  |  | diffusion : permission requise pour voir |
| `type` | `String` |  |  | VISITE_CREE, CONSULTATION_CLOTUREE, SYSTEME… |
| `niveau` | `String` |  | `"INFO"` | INFO | SUCCES | AVERTISSEMENT | CRITIQUE |
| `titre` | `String` |  |  |  |
| `message` | `String` |  |  |  |
| `entiteType` | `String?` |  |  |  |
| `entiteId` | `String?` |  |  |  |
| `lien` | `String?` |  |  | route frontend (navigation au clic) |
| `createdById` | `String?` |  |  | acteur à l'origine |
| `concernedPersonnelIds` | `String[]` |  | `[]` |  |

Associations : `lectures` → `NotificationLecture[]`

Contraintes de table : `@@index([destinataireId])` · `@@index([siteId])` · `@@index([createdAt])`

#### `NotificationLecture`

*degré 1 · `packages/db/prisma/schema.prisma:99`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `notificationId` | `String` |  |  |  |
| `utilisateurId` | `String` |  |  |  |
| `readAt` | `DateTime` |  | `now(` |  |
| `masque` | `Boolean` |  | `false` | « supprimée pour moi » : masquée du feed de cet utilisateur |

Associations : `notification` → `Notification`

Contraintes de table : `@@unique([notificationId, utilisateurId])` · `@@index([updatedAt])` · `@@index([utilisateurId])`

#### `SessionUtilisateur`

*degré 1 · `packages/db/prisma/schema.prisma:190`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `utilisateurId` | `String` |  |  |  |
| `posteLocalId` | `String?` |  |  |  |
| `refreshTokenHash` | `String` |  |  |  |
| `ipAdresse` | `String?` |  |  |  |
| `userAgent` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `expiresAt` | `DateTime` |  |  |  |
| `revokedAt` | `DateTime?` |  |  |  |
| `derniereActiviteAt` | `DateTime?` |  |  |  |
| `appareilId` | `String?` |  |  |  |

Associations : `utilisateur` → `Utilisateur`

Contraintes de table : `@@index([utilisateurId, revokedAt])`

#### `CodeSecoursTotp`

*degré 1 · `packages/db/prisma/schema.prisma:227`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `configId` | `String` |  |  |  |
| `codeHash` | `String` |  |  |  |
| `utilise` | `Boolean` |  | `false` |  |
| `utilisedAt` | `DateTime?` |  |  |  |

Associations : `config` → `ConfigurationTotp`

#### `JournalAudit`

*degré 1 · `packages/db/prisma/schema.prisma:236`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `utilisateurId` | `String?` |  |  |  |
| `action` | `String` |  |  |  |
| `module` | `String` |  |  |  |
| `entiteType` | `String?` |  |  |  |
| `entiteId` | `String?` |  |  |  |
| `avantJson` | `Json?` |  |  |  |
| `apresJson` | `Json?` |  |  |  |
| `ipAdresse` | `String?` |  |  |  |
| `statut` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `utilisateur` → `Utilisateur?`

#### `JournalAuthentification`

*degré 1 · `packages/db/prisma/schema.prisma:251`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `utilisateurId` | `String?` |  |  |  |
| `login` | `String` |  |  |  |
| `resultat` | `String` |  |  |  |
| `ipAdresse` | `String?` |  |  |  |
| `userAgent` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `utilisateur` → `Utilisateur?`

#### `AlerteAnomalie`

*degré 0 · `packages/db/prisma/schema.prisma:262`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `type` | `String` |  |  |  |
| `message` | `String` |  |  |  |
| `statut` | `String` |  | `"OUVERTE"` |  |
| `investigPar` | `String?` |  |  |  |
| `investigAt` | `DateTime?` |  |  |  |
| `commentaire` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

#### `ParametreSysteme`

*degré 0 · `packages/db/prisma/schema.prisma:273`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `cle` | `String` | U |  |  |
| `valeur` | `String` |  |  |  |
| `description` | `String?` |  |  |  |
| `updatedAt` | `DateTime` |  |  |  |
| `updatedBy` | `String?` |  |  |  |

#### `SauvegardeSysteme`

*degré 0 · `packages/db/prisma/schema.prisma:282`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `type` | `String` |  |  |  |
| `statut` | `String` |  |  |  |
| `declenchePar` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `perimetre` | `String?` |  |  | 'CONFIGURATION' |
| `contenuJson` | `String?` |  |  | snapshot JSON |
| `taille` | `Int?` |  |  | octets du snapshot |
| `finishedAt` | `DateTime?` |  |  |  |
| `message` | `String?` |  |  |  |

#### `RapportGenere`

*degré 0 · `packages/db/prisma/schema.prisma:303`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `type` | `String` |  |  | HEBDOMADAIRE | MENSUEL | ANNUEL |
| `periodeDebut` | `DateTime` |  |  |  |
| `periodeFin` | `DateTime` |  |  |  |
| `contenuJson` | `String` |  |  | snapshot JSON (mêmes données que dashboard.statistiques) |
| `genereLe` | `DateTime` |  | `now(` |  |

Contraintes de table : `@@index([type, periodeDebut])`

### RÉFÉRENTIELS

#### `Site`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:318`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |
| `localisation` | `String?` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `utilisateurs` → `Utilisateur[]` · `patients` → `Patient[]` · `visites` → `Visite[]`

Contraintes de table : `@@index([updatedAt])`

#### `CategoriePatient`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:335`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIVE"` |  |

Associations : `droits` → `DroitCategoriePatient[]` · `patients` → `Patient[]` · `historiques` → `HistoriqueCategoriePatient[]`

Contraintes de table : `@@index([updatedAt])`

#### `PathologieReference`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:390`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |
| `chronique` | `Boolean` |  | `false` |  |
| `statut` | `String` |  | `"ACTIVE"` |  |
| `confidentialiteRenforcee` | `Boolean` |  | `false` |  |

Associations : `diagnostics` → `DiagnosticConsultation[]` · `suivis` → `SuiviChronique[]` · `antecedents` → `AntecedentPatient[]`

Contraintes de table : `@@index([updatedAt])`

#### `MedicamentReference`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:409`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `nomGenerique` | `String` |  |  |  |
| `nomCommercial` | `String?` |  |  |  |
| `familleThera` | `String?` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |

Associations : `contreIndications` → `ContreIndicationMedicament[]` · `lignesOrdonnance` → `LigneOrdonnance[]` · `lignesBonPharmacie` → `LigneBonPharmacie[]`

Contraintes de table : `@@index([updatedAt])`

#### `TypeExamen`

***noyau UML-CLS-01** · suppression logique · degré 2 · `packages/db/prisma/schema.prisma:436`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |
| `domaine` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |

Associations : `lignes` → `LigneExamen[]` · `lignesOrdonnance` → `LigneOrdonnance[]`

Contraintes de table : `@@index([updatedAt])`

#### `EtablissementReference`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:463`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `nom` | `String` |  |  |  |
| `type` | `String` |  |  |  |
| `localisation` | `String?` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |

Associations : `evacuations` → `Evacuation[]` · `ordonnances` → `Ordonnance[]`

Contraintes de table : `@@index([updatedAt])`

#### `DroitCategoriePatient`

***noyau UML-CLS-01** · degré 1 · `packages/db/prisma/schema.prisma:349`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `categorieId` | `String` |  |  |  |
| `typePrestation` | `String` |  |  |  |
| `couvert` | `Boolean` |  | `true` |  |
| `plafondConsultations` | `Int?` |  |  |  |
| `periode` | `String?` |  |  |  |

Associations : `categorie` → `CategoriePatient`

Contraintes de table : `@@index([updatedAt])`

#### `MotifConsultation`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:362`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |
| `triageAllege` | `Boolean` |  | `false` |  |

Associations : `visites` → `Visite[]`

Contraintes de table : `@@index([updatedAt])`

#### `TypeConsultation`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:378`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |

Associations : `consultations` → `Consultation[]`

Contraintes de table : `@@index([updatedAt])`

#### `ContreIndicationMedicament`

*degré 1 · `packages/db/prisma/schema.prisma:424`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `medicamentId` | `String` |  |  |  |
| `condition` | `String` |  |  |  |
| `typeCondition` | `String` |  |  |  |
| `gravite` | `String` |  |  |  |

Associations : `medicament` → `MedicamentReference`

Contraintes de table : `@@index([updatedAt])`

#### `TypeCertificat`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:450`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `code` | `String` | U |  |  |
| `libelle` | `String` |  |  |  |
| `modeleTexte` | `String?` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |

Associations : `certificats` → `CertificatMedical[]`

Contraintes de table : `@@index([updatedAt])`

#### `SocieteSousTraitante`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:477`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `nom` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIVE"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `rattachements` → `RattachementSousTraitant[]`

Contraintes de table : `@@index([updatedAt])`

### ACTEURS ADMINISTRATIFS

#### `PersonnelMedical`

***noyau UML-CLS-01** · suppression logique · degré 8 · `packages/db/prisma/schema.prisma:493`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `nom` | `String` |  |  |  |
| `prenom` | `String` |  |  |  |
| `matricule` | `String` | U |  |  |
| `role` | `String` |  |  |  |
| `siteId` | `String?` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `utilisateur` → `Utilisateur?` · `habilitations` → `HabilitationPersonnel[]` · `plannings` → `PlanningPermutation[]` · `presences` → `PresenceJournaliere[]` · `absences` → `AbsencePersonnel[]` · `delegationsDonnees` → `DelegationPrescription[]` · `delegationsRecues` → `DelegationPrescription[]` · `consultations` → `Consultation[]`

Contraintes de table : `@@index([updatedAt])`

#### `DelegationPrescription`

***noyau UML-CLS-01** · suppression logique · degré 5 · `packages/db/prisma/schema.prisma:567`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `medecinChefId` | `String` |  |  |  |
| `infirmierId` | `String` |  |  |  |
| `dateDebut` | `DateTime` |  |  |  |
| `dateFin` | `DateTime` |  |  |  |
| `statut` | `String` |  | `"ACTIVE"` |  |
| `perimetre` | `String?` |  |  |  |

Associations : `medecinChef` → `PersonnelMedical` · `infirmier` → `PersonnelMedical` · `medicamentsAutorises` → `DelegationMedicamentAutorise[]` · `ordonnances` → `Ordonnance[]` · `consultations` → `Consultation[]`

Contraintes de table : `@@index([updatedAt])`

#### `RattachementAyantDroitCdi`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:623`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `cdiId` | `String?` |  |  | (legacy) id du patient CDI rattaché — conservé pour compat |
| `employeId` | `String?` |  |  | CDI rattaché dans le registre des employés SARIS (nouveau modèle) |
| `typeLien` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |
| `dateDebut` | `DateTime` |  |  |  |
| `dateFin` | `DateTime?` |  |  |  |

Associations : `historiques` → `HistoriqueRattachementAyantDroit[]` · `patient` → `Patient` · `employe` → `EmployeSaris?`

Contraintes de table : `@@index([updatedAt])`

#### `RattachementSousTraitant`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:650`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `societeId` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |
| `dateDebut` | `DateTime` |  |  |  |
| `dateFin` | `DateTime?` |  |  |  |

Associations : `historiques` → `HistoriqueRattachementSousTraitant[]` · `patient` → `Patient` · `societe` → `SocieteSousTraitante`

Contraintes de table : `@@index([updatedAt])`

#### `EmployeSaris`

***noyau UML-CLS-01** · suppression logique · degré 2 · `packages/db/prisma/schema.prisma:601`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `matricule` | `String` | U |  |  |
| `nom` | `String` |  |  |  |
| `prenom` | `String` |  |  |  |
| `dateNaissance` | `DateTime?` |  |  |  |
| `sexe` | `String?` |  |  |  |
| `fonction` | `String?` |  |  |  |
| `sectionPaie` | `String?` |  |  |  |
| `service` | `String?` |  |  |  |
| `departement` | `String?` |  |  |  |
| `categorie` | `String` |  |  | ASSURE_CDI | ASSURE_CDD |
| `statut` | `String` |  | `"ACTIF"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `patients` → `Patient[]` · `rattachementsAyantDroit` → `RattachementAyantDroitCdi[]`

Contraintes de table : `@@index([updatedAt])`

#### `HabilitationPersonnel`

*degré 1 · `packages/db/prisma/schema.prisma:516`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `personnelId` | `String` |  |  |  |
| `type` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIVE"` |  |
| `dateDebut` | `DateTime` |  |  |  |
| `dateFin` | `DateTime?` |  |  |  |

Associations : `personnel` → `PersonnelMedical`

Contraintes de table : `@@index([updatedAt])`

#### `PlanningPermutation`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:529`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `personnelId` | `String` |  |  |  |
| `siteId` | `String` |  |  |  |
| `dateDebut` | `DateTime` |  |  |  |
| `dateFin` | `DateTime` |  |  |  |

Associations : `personnel` → `PersonnelMedical`

Contraintes de table : `@@index([updatedAt])`

#### `PresenceJournaliere`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:542`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `personnelId` | `String` |  |  |  |
| `siteId` | `String` |  |  |  |
| `date` | `DateTime` |  |  |  |
| `present` | `Boolean` |  |  |  |

Associations : `personnel` → `PersonnelMedical`

Contraintes de table : `@@index([updatedAt])`

#### `AbsencePersonnel`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:555`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `personnelId` | `String` |  |  |  |
| `date` | `DateTime` |  |  |  |
| `motif` | `String` |  |  |  |

Associations : `personnel` → `PersonnelMedical`

Contraintes de table : `@@index([updatedAt])`

#### `DelegationMedicamentAutorise`

*degré 1 · `packages/db/prisma/schema.prisma:586`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `delegationId` | `String` |  |  |  |
| `medicamentId` | `String` |  |  |  |

Associations : `delegation` → `DelegationPrescription`

Contraintes de table : `@@index([updatedAt])`

#### `HistoriqueRattachementAyantDroit`

*degré 1 · `packages/db/prisma/schema.prisma:641`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `rattachementId` | `String` |  |  |  |
| `evenement` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `createdBy` | `String?` |  |  |  |

Associations : `rattachement` → `RattachementAyantDroitCdi`

#### `HistoriqueRattachementSousTraitant`

*degré 1 · `packages/db/prisma/schema.prisma:666`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `rattachementId` | `String` |  |  |  |
| `evenement` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `createdBy` | `String?` |  |  |  |

Associations : `rattachement` → `RattachementSousTraitant`

### DOSSIER PATIENT

#### `Patient`

***noyau UML-CLS-01** · suppression logique · degré 18 · `packages/db/prisma/schema.prisma:679`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `siteId` | `String?` |  |  |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `numeroPatient` | `String` | U |  |  |
| `matricule` | `String?` | U |  | Matricule employeur (travailleur CDI) — base du rattachement des ayants droit ;  |
| `employeId` | `String?` |  |  | Lien vers le registre des employés SARIS (si ce patient EST un employé CDI/CDD) |
| `siteCreationId` | `String` |  |  |  |
| `categoriePatientId` | `String` |  |  |  |
| `statut` | `StatutPatient` |  | `ACTIF` |  |
| `version` | `Int` |  | `1` |  |
| `verrouille` | `Boolean` |  | `false` |  |
| `verrouilleParId` | `String?` |  |  |  |
| `verrouilleLe` | `DateTime?` |  |  |  |
| `motifVerrou` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `createdBy` | `String?` |  |  |  |
| `updatedAt` | `DateTime` |  |  |  |
| `updatedBy` | `String?` |  |  |  |

Associations : `siteCreation` → `Site` · `categoriePatient` → `CategoriePatient` · `employe` → `EmployeSaris?` · `identite` → `IdentitePatient?` · `contactUrgence` → `ContactUrgence?` · `donneesEmploi` → `DonneesEmploi?` · `modeVie` → `ModeViePatient?` · `allergies` → `AllergiePatient[]` · `antecedents` → `AntecedentPatient[]` · `alertesMedicales` → `AlerteMedicale[]` · `historiquesCateg` → `HistoriqueCategoriePatient[]` · `visites` → `Visite[]` · `preSaisies` → `PreSaisieMedicale[]` · `suiviGrossesse` → `SuiviGrossesse[]` · `rattachementsAD` → `RattachementAyantDroitCdi[]` · `rattachementsST` → `RattachementSousTraitant[]` · `fusionSource` → `FusionDossierPatient?` · `fusionCible` → `FusionDossierPatient?`

Contraintes de table : `@@index([siteId, updatedAt])` · `@@index([updatedAt])`

#### `AntecedentPatient`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:818`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `type` | `String` |  |  |  |
| `pathologieId` | `String?` |  |  |  |
| `description` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |

Associations : `patient` → `Patient` · `pathologie` → `PathologieReference?`

Contraintes de table : `@@index([updatedAt])`

#### `HistoriqueCategoriePatient`

*degré 2 · `packages/db/prisma/schema.prisma:851`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `ancienneCategId` | `String?` |  |  |  |
| `nouvelleCategId` | `String` |  |  |  |
| `dateEffet` | `DateTime` |  |  |  |
| `motif` | `String?` |  |  |  |
| `createdBy` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `patient` → `Patient` · `nouvelleCategorie` → `CategoriePatient`

#### `FusionDossierPatient`

*degré 2 · `packages/db/prisma/schema.prisma:864`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `sourceId` | `String` | U |  |  |
| `cibleId` | `String` | U |  |  |
| `createdBy` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `source` → `Patient` · `cible` → `Patient`

#### `SuiviGrossesse`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:889`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `datePrevueAccouch` | `DateTime` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |
| `devenir` | `String?` |  |  |  |
| `dateFinReelle` | `DateTime?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `patient` → `Patient` · `consultationsPrenat` → `ConsultationPrenatale[]`

Contraintes de table : `@@index([updatedAt])`

#### `ConsultationPrenatale`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:905`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `suiviId` | `String` |  |  |  |
| `consultationId` | `String?` |  |  |  |
| `termeSemaines` | `Int` |  |  |  |
| `poids` | `Float?` |  |  |  |
| `tension` | `String?` |  |  |  |
| `notes` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `suivi` → `SuiviGrossesse` · `consultation` → `Consultation?`

Contraintes de table : `@@index([updatedAt])`

#### `IdentitePatient`

***noyau UML-CLS-01** · suppression logique · degré 1 · `packages/db/prisma/schema.prisma:731`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` | U |  |  |
| `nom` | `String` |  |  |  |
| `prenom` | `String` |  |  |  |
| `dateNaissance` | `DateTime?` |  |  |  |
| `sexe` | `String?` |  |  |  |
| `telephone` | `String?` |  |  |  |
| `adresse` | `String?` |  |  |  |
| `photoUrl` | `String?` |  |  |  |

Associations : `patient` → `Patient`

Contraintes de table : `@@index([updatedAt])`

#### `DonneesEmploi`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:753`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` | U |  |  |
| `fonction` | `String?` |  |  |  |
| `sectionPaie` | `String?` |  |  |  |
| `service` | `String?` |  |  |  |
| `departement` | `String?` |  |  |  |

Associations : `patient` → `Patient`

Contraintes de table : `@@index([updatedAt])`

#### `ModeViePatient`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:768`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` | U |  |  |
| `tabac` | `String?` |  |  |  |
| `alcool` | `String?` |  |  |  |
| `drogues` | `String?` |  |  |  |
| `activitePhysique` | `String?` |  |  |  |
| `alimentation` | `String?` |  |  |  |
| `sommeil` | `String?` |  |  |  |
| `troublesSommeil` | `String?` |  |  |  |
| `sedentarite` | `String?` |  |  |  |
| `portCharges` | `String?` |  |  |  |
| `automedication` | `String?` |  |  |  |
| `observations` | `String?` |  |  |  |

Associations : `patient` → `Patient`

Contraintes de table : `@@index([updatedAt])`

#### `ContactUrgence`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:789`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` | U |  |  |
| `nom` | `String` |  |  |  |
| `prenom` | `String` |  |  |  |
| `telephone` | `String` |  |  |  |
| `lien` | `String` |  |  |  |

Associations : `patient` → `Patient`

Contraintes de table : `@@index([updatedAt])`

#### `AllergiePatient`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:803`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `substance` | `String` |  |  |  |
| `gravite` | `String` |  |  |  |
| `confirme` | `Boolean` |  | `false` |  |
| `statut` | `String` |  | `"ACTIVE"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `patient` → `Patient`

Contraintes de table : `@@index([updatedAt])`

#### `AlerteMedicale`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:835`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `type` | `String` |  |  |  |
| `message` | `String` |  |  |  |
| `gravite` | `String` |  |  |  |
| `statut` | `String` |  | `"ACTIVE"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `resolvedAt` | `DateTime?` |  |  |  |

Associations : `patient` → `Patient`

Contraintes de table : `@@index([updatedAt])`

#### `PreSaisieMedicale`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:874`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `visiteId` | `String?` |  |  |  |
| `type` | `String` |  |  |  |
| `contenu` | `Json` |  |  |  |
| `valide` | `Boolean` |  | `false` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `patient` → `Patient`

Contraintes de table : `@@index([updatedAt])`

### ACCUEIL & TRIAGE

#### `Visite`

***noyau UML-CLS-01** · suppression logique · degré 6 · `packages/db/prisma/schema.prisma:926`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String` |  |  |  |
| `siteId` | `String` |  |  |  |
| `motifPrincipalId` | `String` |  |  |  |
| `statut` | `StatutVisite` |  | `EN_ATTENTE` |  |
| `soignantId` | `String?` |  |  |  |
| `notesAccueil` | `String?` |  |  | Observations cliniques saisies au triage |
| `motifAnnulation` | `String?` |  |  | Renseigné uniquement si statut=ANNULEE |
| `typeCloture` | `String?` |  |  | AVEC_CONSULTATION | SANS_CONSULTATION (si CLOTUREE) |
| `dateOuverture` | `DateTime` |  | `now(` |  |
| `dateCloture` | `DateTime?` |  |  |  |
| `creerHorsLigne` | `Boolean` |  | `false` |  |
| `version` | `Int` |  | `1` |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `updatedAt` | `DateTime` |  |  |  |

Associations : `patient` → `Patient` · `site` → `Site` · `motifPrincipal` → `MotifConsultation` · `constantes` → `ConstanteVitale[]` · `consultations` → `Consultation[]` · `evenements` → `VisiteEvenement[]`

Contraintes de table : `@@index([updatedAt])`

#### `VisiteEvenement`

*degré 1 · `packages/db/prisma/schema.prisma:964`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `visiteId` | `String` |  |  |  |
| `type` | `TypeEvenementVisite` |  |  |  |
| `ancienneVal` | `String?` |  |  | Valeur avant (statut/priorité/soignantId) |
| `nouvelleVal` | `String?` |  |  | Valeur après |
| `acteurId` | `String` |  |  | Personnel qui a fait l'action |
| `commentaire` | `String?` |  |  | Motif (annulation, ré-évaluation, etc.) |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `visite` → `Visite`

Contraintes de table : `@@index([visiteId, createdAt])`

#### `ConstanteVitale`

***noyau UML-CLS-01** · suppression logique · degré 1 · `packages/db/prisma/schema.prisma:986`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `visiteId` | `String` |  |  |  |
| `patientId` | `String` |  |  |  |
| `temperature` | `Float?` |  |  |  |
| `tensionSystolique` | `Int?` |  |  |  |
| `tensionDiastolique` | `Int?` |  |  |  |
| `frequenceCardiaque` | `Int?` |  |  |  |
| `frequenceRespiratoire` | `Int?` |  |  |  |
| `saturationO2` | `Float?` |  |  |  |
| `poids` | `Float?` |  |  |  |
| `taille` | `Float?` |  |  |  |
| `imc` | `Float?` |  |  |  |
| `glycemie` | `Float?` |  |  |  |
| `etatConscience` | `String?` |  |  |  |
| `scoreGlasgow` | `Int?` |  |  |  |
| `etatGeneral` | `String?` |  |  |  |
| `hydratation` | `String?` |  |  |  |
| `coloration` | `String?` |  |  |  |
| `saisiePar` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `visite` → `Visite`

Contraintes de table : `@@index([updatedAt])`

### CONSULTATION & ACTES PRESCRITS

#### `Consultation`

***noyau UML-CLS-01** · suppression logique · degré 13 · `packages/db/prisma/schema.prisma:1019`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `visiteId` | `String` |  |  |  |
| `soignantId` | `String` |  |  |  |
| `delegationId` | `String?` |  |  |  |
| `statut` | `StatutConsultation` |  | `OUVERTE` |  |
| `anamneseDateDebut` | `DateTime?` |  |  |  |
| `anamneseDuree` | `String?` |  |  |  |
| `anamneseModeDebut` | `String?` |  |  |  |
| `anamneseSymptomes` | `String?` |  |  |  |
| `examenClinique` | `String?` |  |  |  |
| `conclusion` | `String?` |  |  |  |
| `decisionMedicale` | `String?` |  |  |  |
| `motifAnnulation` | `String?` |  |  | Motif de l'annulation (traçabilité, si statut ANNULEE) |
| `typeConsultationId` | `String?` |  |  |  |
| `reposJours` | `Int?` |  |  |  |
| `reposInclutJour` | `Boolean?` |  | `false` |  |
| `dateReprise` | `DateTime?` |  |  |  |
| `version` | `Int` |  | `1` |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `closedAt` | `DateTime?` |  |  |  |
| `pickedUpById` | `String?` |  |  | Utilisateur.id qui a la consultation en main (verrou souple) |
| `pickedUpAt` | `DateTime?` |  |  |  |

Associations : `visite` → `Visite` · `soignant` → `PersonnelMedical` · `delegation` → `DelegationPrescription?` · `diagnostics` → `DiagnosticConsultation[]` · `ordonnances` → `Ordonnance[]` · `bonsExamen` → `BonExamen[]` · `bonsPharmacie` → `BonPharmacie[]` · `suiviChronique` → `SuiviChronique[]` · `evacuation` → `Evacuation?` · `suiviTraitement` → `SuiviTraitement?` · `consultationsPrenat` → `ConsultationPrenatale[]` · `typeConsultation` → `TypeConsultation?` · `certificats` → `CertificatMedical[]`

Contraintes de table : `@@index([updatedAt])`

#### `Ordonnance`

***noyau UML-CLS-01** · suppression logique · degré 6 · `packages/db/prisma/schema.prisma:1082`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `consultationId` | `String` |  |  |  |
| `prescripteurId` | `String` |  |  |  |
| `delegationId` | `String?` |  |  |  |
| `statut` | `String` |  | `"BROUILLON"` |  |
| `typeOrdonnance` | `String?` |  |  |  |
| `indicationClinik` | `String?` |  |  |  |
| `etablissementId` | `String?` |  |  |  |
| `motifAnnulation` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `consultation` → `Consultation` · `delegation` → `DelegationPrescription?` · `etablissement` → `EtablissementReference?` · `lignes` → `LigneOrdonnance[]` · `bonsExamen` → `BonExamen[]` · `bonsPharmacie` → `BonPharmacie[]`

Contraintes de table : `@@index([updatedAt])`

#### `BonExamen`

***noyau UML-CLS-01** · suppression logique · degré 4 · `packages/db/prisma/schema.prisma:1133`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `consultationId` | `String` |  |  |  |
| `ordonnanceId` | `String?` |  |  |  |
| `indicationClinik` | `String` |  |  |  |
| `etablissementId` | `String?` |  |  |  |
| `statut` | `String` |  | `"EN_ATTENTE"` |  |
| `motifAnnulation` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `consultation` → `Consultation` · `ordonnance` → `Ordonnance?` · `lignes` → `LigneExamen[]` · `resultats` → `ResultatExamen[]`

Contraintes de table : `@@index([updatedAt])`

#### `LigneOrdonnance`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:1110`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `ordonnanceId` | `String` |  |  |  |
| `medicamentId` | `String?` |  |  |  |
| `posologie` | `String?` |  |  |  |
| `duree` | `String?` |  |  |  |
| `voieAdmin` | `String?` |  |  |  |
| `quantite` | `String?` |  |  |  |
| `instructions` | `String?` |  |  |  |
| `justification` | `String?` |  |  |  |
| `typeExamenId` | `String?` |  |  |  |

Associations : `ordonnance` → `Ordonnance` · `medicament` → `MedicamentReference?` · `typeExamen` → `TypeExamen?`

Contraintes de table : `@@index([updatedAt])`

#### `BonPharmacie`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:1188`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `consultationId` | `String` |  |  |  |
| `prescripteurId` | `String` |  |  |  |
| `ordonnanceId` | `String?` |  |  |  |
| `statut` | `String` |  | `"EN_ATTENTE"` | EN_ATTENTE | DELIVRE | ANNULE |
| `observations` | `String?` |  |  |  |
| `delivreLe` | `DateTime?` |  |  |  |
| `delivrePar` | `String?` |  |  |  |
| `motifAnnulation` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `consultation` → `Consultation` · `ordonnance` → `Ordonnance?` · `lignes` → `LigneBonPharmacie[]`

Contraintes de table : `@@index([updatedAt])`

#### `DiagnosticConsultation`

***noyau UML-CLS-01** · degré 2 · `packages/db/prisma/schema.prisma:1069`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `consultationId` | `String` |  |  |  |
| `pathologieId` | `String` |  |  |  |
| `type` | `String` |  | `"PRINCIPAL"` |  |
| `certitude` | `String` |  | `"CONFIRME"` |  |

Associations : `consultation` → `Consultation` · `pathologie` → `PathologieReference`

Contraintes de table : `@@index([updatedAt])`

#### `LigneExamen`

***noyau UML-CLS-01** · degré 2 · `packages/db/prisma/schema.prisma:1158`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `bonId` | `String` |  |  |  |
| `typeExamenId` | `String` |  |  |  |

Associations : `bon` → `BonExamen` · `typeExamen` → `TypeExamen`

Contraintes de table : `@@index([updatedAt])`

#### `LigneBonPharmacie`

***noyau UML-CLS-01** · suppression logique · degré 2 · `packages/db/prisma/schema.prisma:1211`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `bonId` | `String` |  |  |  |
| `medicamentId` | `String?` |  |  |  |
| `libelle` | `String` |  |  |  |
| `posologie` | `String?` |  |  |  |
| `quantite` | `String?` |  |  |  |

Associations : `bon` → `BonPharmacie` · `medicament` → `MedicamentReference?`

Contraintes de table : `@@index([updatedAt])`

#### `SuiviChronique`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:1226`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `patientId` | `String?` |  |  |  |
| `consultationId` | `String?` |  |  |  |
| `pathologieId` | `String` |  |  |  |
| `frequenceSuivi` | `String?` |  |  |  |
| `objectifs` | `String?` |  |  |  |
| `statut` | `String` |  | `"ACTIF"` |  |
| `motifCloture` | `String?` |  |  |  |
| `motifAnnulation` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `closedAt` | `DateTime?` |  |  |  |

Associations : `pathologie` → `PathologieReference` · `consultation` → `Consultation?`

Contraintes de table : `@@index([updatedAt])`

#### `CertificatMedical`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:1246`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `consultationId` | `String` |  |  |  |
| `typeCertificatId` | `String` |  |  |  |
| `dateApplication` | `DateTime?` |  |  |  |
| `dureeJours` | `Int?` |  |  |  |
| `dateFin` | `DateTime?` |  |  |  |
| `contenu` | `String?` |  |  |  |
| `statut` | `String` |  | `"EMIS"` |  |
| `motifAnnulation` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `consultation` → `Consultation` · `typeCertificat` → `TypeCertificat`

Contraintes de table : `@@index([updatedAt])`

#### `ResultatExamen`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:1169`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `bonId` | `String` |  |  |  |
| `laboratoire` | `String?` |  |  |  |
| `contenu` | `String` |  |  |  |
| `interpretation` | `String?` |  |  |  |
| `statut` | `String` |  | `"RECU"` |  |
| `saisiePar` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `bon` → `BonExamen`

Contraintes de table : `@@index([updatedAt])`

### SORTIES CRITIQUES

#### `Evacuation`

***noyau UML-CLS-01** · suppression logique · degré 3 · `packages/db/prisma/schema.prisma:1269`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `consultationId` | `String` | U |  |  |
| `motifId` | `String?` |  |  |  |
| `niveauUrgence` | `String` |  |  |  |
| `etablissementId` | `String?` |  |  |  |
| `infosCliniques` | `String?` |  |  |  |
| `statut` | `String` |  | `"EN_COURS"` |  |
| `motifAnnulation` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `consultation` → `Consultation` · `etablissement` → `EtablissementReference?` · `suivi` → `SuiviEvacuation[]`

Contraintes de table : `@@index([updatedAt])`

#### `SuiviEvacuation`

*degré 1 · `packages/db/prisma/schema.prisma:1288`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `evacuationId` | `String` |  |  |  |
| `notes` | `String` |  |  |  |
| `statut` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `createdBy` | `String?` |  |  |  |

Associations : `evacuation` → `Evacuation`

### SUIVI DE TRAITEMENT

#### `SuiviTraitement`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:1305`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `consultationId` | `String` | U |  |  |
| `motif` | `String` |  |  |  |
| `statut` | `String` |  | `"EN_COURS"` |  |
| `motifCloture` | `String?` |  |  |  |
| `motifAnnulation` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `closedAt` | `DateTime?` |  |  |  |

Associations : `consultation` → `Consultation` · `fiches` → `FicheSuiviTraitement[]`

Contraintes de table : `@@index([updatedAt])`

#### `FicheSuiviTraitement`

*degré 1 · `packages/db/prisma/schema.prisma:1322`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `suiviTraitementId` | `String` |  |  |  |
| `temperature` | `Float?` |  |  |  |
| `tensionSystolique` | `Int?` |  |  |  |
| `tensionDiastolique` | `Int?` |  |  |  |
| `frequenceCardiaque` | `Int?` |  |  |  |
| `frequenceRespiratoire` | `Int?` |  |  |  |
| `saturationO2` | `Int?` |  |  |  |
| `poids` | `Float?` |  |  |  |
| `noteEvolution` | `String?` |  |  |  |
| `medicamentsAdministres` | `String?` |  |  |  |
| `resultatExamen` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `createdBy` | `String?` |  |  |  |

Associations : `suiviTraitement` → `SuiviTraitement`

### MESSAGERIE INTERNE (chiffrée)

#### `Message`

*suppression logique · degré 7 · `packages/db/prisma/schema.prisma:1482`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `conversationId` | `String` |  |  |  |
| `expediteurId` | `String` |  |  |  |
| `type` | `String` |  | `"TEXTE"` | TEXTE | SYSTEME (événement de groupe : ajout/retrait/promotion/renommage/départ) |
| `contenuChiffre` | `String` |  |  | contenu AES-256-GCM (jamais en clair) |
| `replyToId` | `String?` |  |  | message cité (réponse) |
| `epingle` | `Boolean` |  | `false` |  |
| `transfere` | `Boolean` |  | `false` | transféré depuis une autre conversation |
| `createdAt` | `DateTime` |  | `now(` |  |
| `updatedAt` | `DateTime` |  |  |  |
| `editedAt` | `DateTime?` |  |  |  |
| `deletedAt` | `DateTime?` |  |  |  |

Associations : `conversation` → `Conversation` · `expediteur` → `Utilisateur` · `piecesJointes` → `MessagePieceJointe[]` · `reactions` → `MessageReaction[]` · `masques` → `MessageMasque[]` · `replyTo` → `Message?` · `replies` → `Message[]`

Contraintes de table : `@@index([conversationId])` · `@@index([conversationId, createdAt])` · `@@index([replyToId])`

#### `Conversation`

*suppression logique · degré 2 · `packages/db/prisma/schema.prisma:1448`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `type` | `String` |  | `"DIRECT"` | DIRECT | GROUPE |
| `titre` | `String?` |  |  | titre des conversations de groupe |
| `description` | `String?` |  |  | description du groupe |
| `photoUrl` | `String?` |  |  | photo du groupe (data URL Base64, même convention que les autres photos) |
| `siteId` | `String?` |  |  |  |
| `createdById` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `updatedAt` | `DateTime` |  |  |  |

Associations : `participants` → `ConversationParticipant[]` · `messages` → `Message[]`

Contraintes de table : `@@index([updatedAt])`

#### `ConversationParticipant`

*degré 2 · `packages/db/prisma/schema.prisma:1465`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `conversationId` | `String` |  |  |  |
| `utilisateurId` | `String` |  |  |  |
| `estAdmin` | `Boolean` |  | `false` | admin de groupe (le créateur est identifié via Conversation.createdById, pas dup |
| `muted` | `Boolean` |  | `false` | notifications de CETTE conversation désactivées pour cet utilisateur |
| `lastReadAt` | `DateTime?` |  |  |  |
| `joinedAt` | `DateTime` |  | `now(` |  |

Associations : `conversation` → `Conversation` · `utilisateur` → `Utilisateur`

Contraintes de table : `@@unique([conversationId, utilisateurId])` · `@@index([updatedAt])` · `@@index([utilisateurId])`

#### `MessageMasque`

*degré 1 · `packages/db/prisma/schema.prisma:1511`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `messageId` | `String` |  |  |  |
| `utilisateurId` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `message` → `Message`

Contraintes de table : `@@unique([messageId, utilisateurId])` · `@@index([updatedAt])` · `@@index([utilisateurId])`

#### `MessageReaction`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:1524`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `messageId` | `String` |  |  |  |
| `utilisateurId` | `String` |  |  |  |
| `emoji` | `String` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `message` → `Message`

Contraintes de table : `@@unique([messageId, utilisateurId, emoji])` · `@@index([updatedAt])` · `@@index([messageId])`

#### `MessagePieceJointe`

*suppression logique · degré 1 · `packages/db/prisma/schema.prisma:1539`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `updatedAt` | `DateTime` |  | `now(` |  |
| `deletedAt` | `DateTime?` |  |  |  |
| `id` | `String` | **PK** | `uuid(` |  |
| `messageId` | `String` |  |  |  |
| `nomFichier` | `String` |  |  |  |
| `mimeType` | `String` |  |  |  |
| `taille` | `Int` |  |  | octets (taille en clair, avant chiffrement) |
| `contenuChiffre` | `String` |  |  | octets AES-256-GCM (base64, jamais en clair) |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `message` → `Message`

Contraintes de table : `@@index([updatedAt])` · `@@index([messageId])`

#### `SyncState`

> Curseur de synchronisation par poste/appareil et par site (serveur central).

*degré 0 · `packages/db/prisma/schema.prisma:1557`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `posteLocalId` | `String` |  |  |  |
| `siteId` | `String` |  |  |  |
| `lastPulledAt` | `DateTime` |  | `now(` |  |
| `lastPushedAt` | `DateTime?` |  |  |  |
| `updatedAt` | `DateTime` |  |  |  |

Contraintes de table : `@@unique([posteLocalId, siteId])` · `@@index([siteId])`

### SYNCHRONISATION OFFLINE

#### `PosteLocal`

*degré 2 · `packages/db/prisma/schema.prisma:1344`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `siteId` | `String` |  |  |  |
| `libelle` | `String` |  |  |  |
| `dernierUtilisateurId` | `String?` |  |  |  |
| `derniereSyncAt` | `DateTime?` |  |  |  |
| `masque` | `Boolean` |  | `false` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `fileMutations` → `FileMutation[]` · `journauxSync` → `JournalSynchronisation[]`

#### `JournalSynchronisation`

*degré 2 · `packages/db/prisma/schema.prisma:1377`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `posteLocalId` | `String` |  |  |  |
| `startedAt` | `DateTime` |  | `now(` |  |
| `finishedAt` | `DateTime?` |  |  |  |
| `statut` | `String` |  | `"EN_COURS"` |  |
| `nbMutations` | `Int` |  | `0` |  |
| `nbConflits` | `Int` |  | `0` |  |

Associations : `posteLocal` → `PosteLocal` · `conflits` → `ConflitSynchronisation[]`

#### `ConflitSynchronisation`

*degré 2 · `packages/db/prisma/schema.prisma:1389`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `journalId` | `String` |  |  |  |
| `mutationUuid` | `String` |  |  |  |
| `entiteType` | `String` |  |  |  |
| `entiteId` | `String` |  |  |  |
| `typeConflit` | `String` |  |  |  |
| `valeurLocale` | `Json` |  |  |  |
| `valeurServeur` | `Json` |  |  |  |
| `statut` | `String` |  | `"EN_ATTENTE"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `resolution` → `ResolutionConflit?` · `journal` → `JournalSynchronisation`

#### `FileMutation`

*degré 1 · `packages/db/prisma/schema.prisma:1359`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `mutationUuid` | `String` | U |  |  |
| `posteLocalId` | `String` |  |  |  |
| `module` | `String` |  |  |  |
| `entiteType` | `String` |  |  |  |
| `entiteId` | `String` |  |  |  |
| `action` | `String` |  |  |  |
| `payloadJson` | `Json` |  |  |  |
| `statut` | `String` |  | `"PENDING"` |  |
| `ordreLocal` | `BigInt` |  |  |  |
| `createdLocalAt` | `DateTime` |  |  |  |
| `sentAt` | `DateTime?` |  |  |  |
| `serverAckedAt` | `DateTime?` |  |  |  |
| `errorMessage` | `String?` |  |  |  |

Associations : `posteLocal` → `PosteLocal`

#### `ResolutionConflit`

*degré 1 · `packages/db/prisma/schema.prisma:1404`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `conflitId` | `String` | U |  |  |
| `resolution` | `String` |  |  |  |
| `auteur` | `String` |  |  |  |
| `justification` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |

Associations : `conflit` → `ConflitSynchronisation`

#### `ParametreMetier`

*degré 1 · `packages/db/prisma/schema.prisma:1423`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `cle` | `String` | U |  |  |
| `valeur` | `String` |  |  |  |
| `description` | `String?` |  |  |  |
| `updatedAt` | `DateTime` |  |  |  |
| `updatedBy` | `String?` |  |  |  |

Associations : `historiques` → `HistoriqueParametreMetier[]`

#### `HistoriqueParametreMetier`

*degré 1 · `packages/db/prisma/schema.prisma:1433`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `parametreId` | `String` |  |  |  |
| `ancienneVal` | `String` |  |  |  |
| `nouvelleVal` | `String` |  |  |  |
| `motif` | `String?` |  |  |  |
| `createdAt` | `DateTime` |  | `now(` |  |
| `createdBy` | `String?` |  |  |  |

Associations : `parametre` → `ParametreMetier`

#### `AlerteTechnique`

*degré 0 · `packages/db/prisma/schema.prisma:1414`*

| Champ | Type | Clé | Défaut | Note |
|---|---|---|---|---|
| `id` | `String` | **PK** | `uuid(` |  |
| `type` | `String` |  |  |  |
| `message` | `String` |  |  |  |
| `siteId` | `String?` |  |  |  |
| `statut` | `String` |  | `"OUVERTE"` |  |
| `createdAt` | `DateTime` |  | `now(` |  |

---

## 8. Écarts et points de vigilance

| # | Constat | Conséquence documentaire |
|---|---|---|
| E-01 | Les schémas PostgreSQL et SQLite comportent **exactement les mêmes 88 modèles**. La réplique locale n’est pas un sous-ensemble. | Le chapitre 7 peut affirmer que le poste autonome dispose du modèle complet — c’est un argument fort du mode hors-ligne. |
| E-02 | **47 modèles sur 88** portent `deletedAt` : la suppression est logique, jamais physique. | À expliquer au chapitre 7 : c’est ce qui permet à la synchronisation de propager une suppression (tombstone). |
| E-03 | Une **auto-association** existe sur `Message` (`replyTo` / `replies`, relation nommée `MessageReplies`). | Si une planche messagerie est produite, l’auto-association doit être tracée en boucle sur la classe. |
| E-04 | 6 modèles sans relation, dont `SyncState` classé dans la section « messagerie » du fichier alors qu’il relève de la synchronisation. | Classement corrigé dans la documentation ; l’écart de section est un détail d’organisation du fichier source, non une erreur de modèle. |
| E-05 | 46 champs de statut sont des `String` libres, non des énumérations. | Les machines à états correspondantes ne sont **pas garanties par la base**. À dire honnêtement au chapitre 7 et à traiter en limite au chapitre de conclusion. |

---

## 9. Alimente

| Destination | Usage |
|---|---|
| Fiche UML-CLS-01 → Figures 7.1 à 7.5 | Classes, attributs, associations et **multiplicités** du § 4 |
| Fiche SCH-REL-01 → Figure 8.1 | Schéma relationnel : tables, PK, FK |
| Fiche SCH-MPD-01 → Figure 8.2 | Modèle physique : types SQL, contraintes, index (croiser avec les 41 migrations) |
| ~~Annexe D~~ | Dictionnaire de données — **annexe retirée du mémoire**. Les 88 modèles et leurs champs sont décrits au § 4 du présent inventaire |
| Chapitre 7 § 7.1 | Justification du choix PostgreSQL + réplique SQLite |
| INV-07 | Machines à états, à partir des 6 énumérations et des 46 champs de statut |

