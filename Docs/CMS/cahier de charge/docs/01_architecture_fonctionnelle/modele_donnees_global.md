# Modèle de données global — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document de référence transversal. Il décrit les entités persistées du système
> **tel que construit** (as-built) et leurs relations clés. Tous les documents de
> module ([[MODULE_08_triage]], [[MODULE_09_consultation]], [[MODULE_07_dossier_patient]], [[MODULE_10_bon_examen]],
> [[MODULE_12_evacuations]], [[MODULE_02_acces_habilitations]], [[MODULE_13_messagerie]], [[MODULE_05_referentiels]],
> [[MODULE_16_synchronisation]]…) référencent ce document plutôt que de redéfinir les entités.
>
> Source de vérité : `packages/db/prisma/schema.prisma` (schéma PostgreSQL du serveur
> central) ; un schéma SQLite dérivé (`packages/db/prisma/sqlite/schema.prisma`)
> équipe l'application desktop offline-first. Voir [[plan_modules]] et
> le brief canonique `_SOURCE_systeme.md`.

---

## 1. Conventions générales du modèle

Ces conventions sont vérifiées dans `packages/db/prisma/schema.prisma`.

- **Identifiants** : la très grande majorité des entités utilisent un `id` de type
  **UUID** (`@id @default(uuid())`). Les tables de jointure (`UtilisateurRole`,
  `RolePermission`) utilisent une clé primaire composite.
- **Soft-delete** : les entités sujettes à suppression logique portent une colonne
  **`deletedAt DateTime?`** (tombstone). La suppression réelle est non destructive
  côté offline-first ; la purge des tombstones est gérée par le module de
  synchronisation. Cf. [[MODULE_16_synchronisation]].
- **Horodatage de synchronisation** : la plupart des entités synchronisées portent
  **`updatedAt`** (mis à jour automatiquement) **indexé** (`@@index([updatedAt])`),
  qui sert de base à la résolution **LWW** (last-write-wins) du module `sync/`.
  Certaines entités-journal (audit, historiques, événements) sont **append-only** et
  ne portent ni `updatedAt` ni `deletedAt`.
- **Versionnage optimiste** : `Patient`, `Visite`, `Consultation` portent un champ
  **`version Int @default(1)`** servant à détecter les écritures concurrentes.
- **Traçabilité** : plusieurs entités portent `createdBy` / `updatedBy` (id de
  l'auteur). Les journaux dédiés (`JournalAudit`, `JournalAuthentification`,
  historiques) complètent cette traçabilité.
- **Volumétrie** : le schéma PostgreSQL compte **87 modèles** (`model …`) au
  26/06/2026 ; l'ordre de grandeur canonique communiqué dans les docs est **~79
  tables**. *(Écart à confirmer : le décompte machine sur le schéma actuel donne 87 ;
  retenir le chiffre réel du schéma comme référence.)*

---

## 2. Cartographie par domaine

Le schéma est organisé en blocs fonctionnels (en commentaires de section dans le
fichier Prisma).

| Domaine | Entités principales |
| --- | --- |
| Sécurité & audit | `Utilisateur`, `Role`, `Permission`, `RolePermission`, `UtilisateurRole`, `UtilisateurPermission`, `SessionUtilisateur`, `ConfigurationTotp`, `CodeSecoursTotp`, `PreferenceUtilisateur`, `Notification`, `NotificationLecture`, `JournalAudit`, `JournalAuthentification`, `AlerteAnomalie`, `ParametreSysteme`, `SauvegardeSysteme` |
| Référentiels | `Site`, `CategoriePatient`, `DroitCategoriePatient`, `MotifConsultation`, `TypeConsultation`, `PathologieReference`, `MedicamentReference`, `ContreIndicationMedicament`, `TypeExamen`, `TypeCertificat`, `EtablissementReference`, `SocieteSousTraitante` |
| Acteurs administratifs / RH | `PersonnelMedical`, `HabilitationPersonnel`, `PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel`, `DelegationPrescription`, `DelegationMedicamentAutorise`, `EmployeSaris`, `RattachementAyantDroitCdi`, `RattachementSousTraitant` (+ historiques) |
| Dossier patient | `Patient`, `IdentitePatient`, `ContactUrgence`, `DonneesEmploi`, `ModeViePatient`, `AllergiePatient`, `AntecedentPatient`, `AlerteMedicale`, `HistoriqueCategoriePatient`, `FusionDossierPatient`, `PreSaisieMedicale`, `SuiviGrossesse`, `ConsultationPrenatale` |
| Accueil & triage | `Visite`, `VisiteEvenement`, `ConstanteVitale` |
| Consultation & actes prescrits | `Consultation`, `DiagnosticConsultation`, `Ordonnance`, `LigneOrdonnance`, `BonExamen`, `LigneExamen`, `ResultatExamen`, `BonPharmacie`, `LigneBonPharmacie`, `SuiviChronique`, `CertificatMedical` |
| Sorties critiques | `Evacuation`, `SuiviEvacuation`, `AccidentTravail`, `SuiviAccidentTravail` |
| Synchronisation offline | `PosteLocal`, `FileMutation`, `JournalSynchronisation`, `ConflitSynchronisation`, `ResolutionConflit`, `AlerteTechnique`, `ParametreMetier`, `HistoriqueParametreMetier`, `SyncState` |
| Messagerie interne | `Conversation`, `ConversationParticipant`, `Message`, `MessageMasque`, `MessageReaction`, `MessagePieceJointe` |

---

## 3. Entités principales et relations clés

### 3.1 Sécurité, identité & habilitations

- **`Utilisateur`** — compte de connexion (login/email uniques, `passwordHash`,
  `statut` ACTIF/DESACTIVE/BLOQUE, gestion des tentatives d'échec et du blocage).
  Rattaché à un **`Site`** (`siteId`) et, optionnellement, à un **`PersonnelMedical`**
  (1-1, `personnelMedicalId` unique). Porte `lastSeenAt` (présence messagerie).
  Relations : rôles (`UtilisateurRole`), dérogations (`UtilisateurPermission`),
  sessions, TOTP, préférences, journaux, conversations, messages envoyés.
- **`Role` / `Permission` / `RolePermission` / `UtilisateurRole`** — modèle RBAC.
  Le catalogue comprend **~110 permissions** (cf. `packages/types/src/permissions.ts`)
  pour **4 rôles** (ADMIN_SYSTEME, MEDECIN_CHEF, MEDECIN, INFIRMIER — cf.
  [[MODULE_02_acces_habilitations]]). Permissions effectives = (permissions des rôles ∪ GRANT)
  − REVOKE.
- **`UtilisateurPermission`** — dérogation par utilisateur (`mode` GRANT/REVOKE,
  `motif`, `accordePar`), au plus une par couple (utilisateur, permission).
- **`SessionUtilisateur`** — session de rafraîchissement (refresh token haché, IP,
  user-agent, expiration, révocation) ; support de la **session unique** et de la
  révocation immédiate.
- **`ConfigurationTotp` / `CodeSecoursTotp`** — 2FA TOTP : secret **chiffré at-rest**
  (`secretChiffre`), codes de secours hachés à usage unique.
- **`PreferenceUtilisateur`** (1-1) — thème, densité, langue, page d'accueil,
  pagination, notifications, **acceptation des CGU** (`cguAccepteeLe`, `cguVersion`).

### 3.2 Dossier patient (cross-site)

- **`Patient`** — dossier centralisé **suivant le patient sur tous les sites**.
  `numeroPatient` unique, **`matricule`** employeur unique optionnel (base du
  rattachement des ayants droit CDI), `employeId` (lien vers `EmployeSaris` si le
  patient est lui-même un employé), `categoriePatientId` (pilote les droits aux bons,
  cf. `DroitCategoriePatient`), `statut` (ACTIF/ARCHIVE/DECEDE/FUSIONNE).
  **Verrou de confidentialité** posé par le médecin-chef : `verrouille`,
  `verrouilleParId`, `verrouilleLe`, `motifVerrou` (permission `patient.lock`).
- **Sous-entités 1-1** : `IdentitePatient` (état civil, téléphone, adresse, photo),
  `ContactUrgence`, `DonneesEmploi` (fonction, section paie, service, département),
  `ModeViePatient` (tabac, alcool, activité, sommeil… — recueil au triage).
- **Sous-entités 1-N** : `AllergiePatient`, `AntecedentPatient`, `AlerteMedicale`
  (alertes cliniques avec gravité/résolution), `HistoriqueCategoriePatient`,
  `PreSaisieMedicale`, `SuiviGrossesse` (+ `ConsultationPrenatale`).
- **`FusionDossierPatient`** — trace une fusion de doublons (source → cible).
- **Rattachements** : `RattachementAyantDroitCdi` (ayant droit ↔ employé CDI, par
  matricule, avec historique), `RattachementSousTraitant` (patient ↔
  `SocieteSousTraitante`, avec historique).

### 3.3 Accueil & triage

- **`Visite`** — passage du patient (file par **ordre d'arrivée**, pas de priorité).
  Lie `Patient`, `Site`, `MotifConsultation` (`motifPrincipalId`) ; `statut`
  EN_ATTENTE/EN_COURS/CLOTUREE/ANNULEE ; `soignantId`, `notesAccueil`, `typeCloture`
  (AVEC/SANS_CONSULTATION), `creerHorsLigne`. Relations : `ConstanteVitale`,
  `Consultation`, `VisiteEvenement`.
- **`ConstanteVitale`** — mesures (température, tension, FC, SpO₂, poids, taille, IMC,
  glycémie) + **signes généraux** (conscience, Glasgow, état général, hydratation,
  coloration). Rattachée à une `Visite` (et au `patientId`).
- **`VisiteEvenement`** — piste d'audit append-only des changements de la visite
  (statut, soignant, notes).

### 3.4 Consultation & actes prescrits

- **`Consultation`** — pilotée par la décision médicale. Lie `Visite`, `PersonnelMedical`
  (`soignantId`), `TypeConsultation`, optionnellement `DelegationPrescription`.
  `statut` OUVERTE/CLOTUREE/ANNULEE ; champs cliniques (`examenClinique`,
  `conclusion`, `decisionMedicale`), **repos** (`reposJours`, `dateReprise`), **verrou
  souple de prise en charge** (`pickedUpById`, `pickedUpAt`), `closedAt`.
- **`DiagnosticConsultation`** — diagnostic(s) liés à une `PathologieReference`
  (type PRINCIPAL/…, certitude).
- **`Ordonnance` / `LigneOrdonnance`** — prescription médicamenteuse ; lignes liées à
  `MedicamentReference` (posologie, durée, voie, instructions).
- **`BonExamen` / `LigneExamen` / `ResultatExamen`** — demande d'examens
  (`TypeExamen`, établissement) et saisie des résultats reçus.
- **`BonPharmacie` / `LigneBonPharmacie`** — bon de retrait de médicaments gratuits,
  **distinct de l'ordonnance**, réservé selon la catégorie patient ; lignes
  optionnellement liées à `MedicamentReference`.
- **`CertificatMedical`** — certificat (type, durée, dates, contenu) issu d'une
  consultation.
- **`SuiviChronique`** — suivi d'une pathologie chronique rattaché à une consultation.

### 3.5 Sorties critiques

- **`Evacuation`** (1-1 avec `Consultation`) — niveau d'urgence, motif,
  `EtablissementReference`, statut ; `SuiviEvacuation` (étapes append-only).
- **`AccidentTravail`** (1-1 avec `Consultation`) — circonstances, lésions, gravité ;
  `SuiviAccidentTravail` (évolution, séquelles, taux d'incapacité).

### 3.6 Référentiels

Tables de paramétrage portant `code` unique, `libelle`, `statut`, `updatedAt`,
`deletedAt` : `Site`, `CategoriePatient` (+ `DroitCategoriePatient` : prestation
couverte, plafond, période), `MotifConsultation`, `TypeConsultation`,
`PathologieReference` (drapeau `chronique`), `MedicamentReference`
(+ `ContreIndicationMedicament`), `TypeExamen`, `TypeCertificat`,
`EtablissementReference`, `SocieteSousTraitante`. Registre **`EmployeSaris`**
(main-d'œuvre SARIS reconnue par `matricule`, base des ayants droit CDI). Cf.
[[MODULE_05_referentiels]].

### 3.7 Messagerie interne (chiffrée)

- **`Conversation`** (DIRECT/GROUPE, cloisonnée par `siteId`) ↔
  **`ConversationParticipant`** (`lastReadAt` pour les accusés).
- **`Message`** — `contenuChiffre` **AES-256-GCM** (jamais en clair), citation
  (`replyToId`), `editedAt`, `deletedAt`. Relations : `MessagePieceJointe`
  (médias chiffrés), `MessageReaction` (emoji, unique par utilisateur/emoji),
  `MessageMasque` (« supprimer pour moi »). Cf. [[MODULE_13_messagerie]].

### 3.8 Notifications

- **`Notification`** — individuelle (`destinataireId`) ou **diffusion**
  (`siteId` + `requiredPermission`) ; `type`, `niveau`, `lien` de navigation.
- **`NotificationLecture`** — état « lu » par utilisateur (compatible diffusion),
  avec `masque` (« supprimée pour moi »).

### 3.9 Synchronisation offline-first

- **`SyncState`** — **curseur de synchronisation** par poste et par site
  (`lastPulledAt`, `lastPushedAt`), unique sur (`posteLocalId`, `siteId`).
- **`PosteLocal`** — poste/appareil enregistré.
- **`FileMutation`** — file de mutations locales à pousser (UUID de mutation,
  `module`/`entiteType`/`entiteId`/`action`, `payloadJson`, `statut`, ordre local).
- **`JournalSynchronisation` / `ConflitSynchronisation` / `ResolutionConflit`** —
  journal d'une session de sync, conflits détectés (valeur locale vs serveur) et leur
  résolution.
- **`ParametreMetier` / `HistoriqueParametreMetier`**, `AlerteTechnique`,
  `SauvegardeSysteme` (snapshot JSON de configuration restaurable). Cf.
  [[MODULE_16_synchronisation]].

---

## 4. Dictionnaire de données synthétique

Pour chaque entité : rôle + champs notables. `id` = UUID sauf mention. Colonnes
de sync `updatedAt` / `deletedAt` indiquées par **U** (présent + indexé) et **D**
(soft-delete) ; **AO** = journal append-only (ni U ni D).

### Sécurité & audit

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| Utilisateur | Compte de connexion | login·, email·, passwordHash, statut, siteId, personnelMedicalId, lastSeenAt | U · D |
| Role | Rôle RBAC | code·, libelle | U |
| Permission | Permission unitaire | code·, module | U |
| RolePermission | Rôle↔permission | PK (roleId, permissionId) | U |
| UtilisateurRole | Utilisateur↔rôle | PK (utilisateurId, roleId) | U |
| UtilisateurPermission | Dérogation par utilisateur | mode (GRANT/REVOKE), motif, accordePar | (updatedAt) |
| SessionUtilisateur | Session/refresh | refreshTokenHash, ipAdresse, userAgent, expiresAt, revokedAt | — |
| ConfigurationTotp | 2FA TOTP | secretChiffre (at-rest), actif | — |
| CodeSecoursTotp | Code de secours TOTP | codeHash, utilise | — |
| PreferenceUtilisateur | Préférences compte | theme, langue, pageAccueil, cguAccepteeLe, cguVersion | (updatedAt) |
| Notification | Notification/diffusion | destinataireId, siteId, requiredPermission, type, niveau, lien | — |
| NotificationLecture | État « lu » par user | readAt, masque | U |
| JournalAudit | Journal d'audit | action, module, entite, avantJson/apresJson, ipAdresse, statut | AO |
| JournalAuthentification | Journal de connexion | login, resultat, ipAdresse, userAgent | AO |
| AlerteAnomalie | Alerte de sécurité | type, message, statut, investigPar | — |
| ParametreSysteme | Paramètre système | cle·, valeur | (updatedAt) |
| SauvegardeSysteme | Sauvegarde config | type, statut, perimetre, contenuJson, taille | — |

### Référentiels

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| Site | Site clinique | code·, libelle, localisation, statut | U · D |
| CategoriePatient | Catégorie (pilote droits) | code·, libelle, statut | U · D |
| DroitCategoriePatient | Droit par prestation | typePrestation, couvert, plafondConsultations, periode | U |
| MotifConsultation | Motif de visite | code·, libelle | U · D |
| TypeConsultation | Type de consultation | code·, libelle | U · D |
| PathologieReference | Pathologie | code·, libelle, chronique | U · D |
| MedicamentReference | Médicament | nomGenerique, nomCommercial, familleThera | U · D |
| ContreIndicationMedicament | Contre-indication | condition, typeCondition, gravite | U |
| TypeExamen | Type d'examen | code·, libelle, domaine | U · D |
| TypeCertificat | Type de certificat | code·, libelle, modeleTexte | U · D |
| EtablissementReference | Établissement (évac.) | nom, type, localisation | U · D |
| SocieteSousTraitante | Société sous-traitante | nom, statut | U · D |
| EmployeSaris | Registre employés SARIS | matricule·, nom, prenom, categorie (CDI/CDD), service | U · D |

### Acteurs & RH

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| PersonnelMedical | Soignant/personnel | nom, prenom, matricule·, role, siteId | U · D |
| HabilitationPersonnel | Habilitation/aptitude | type, statut, dateDebut/Fin | U |
| PlanningPermutation | Permutation de site | siteId, dateDebut/Fin | U · D |
| PresenceJournaliere | Présence quotidienne | date, present | U · D |
| AbsencePersonnel | Absence | date, motif | U · D |
| DelegationPrescription | Délégation de prescription | medecinChefId, infirmierId, dateDebut/Fin, perimetre | U · D |
| DelegationMedicamentAutorise | Médicament délégué | delegationId, medicamentId | U |
| RattachementAyantDroitCdi | Ayant droit ↔ CDI | patientId, employeId, typeLien, dateDebut/Fin | U · D |
| RattachementSousTraitant | Patient ↔ société | patientId, societeId, dateDebut/Fin | U · D |
| Historique* (3 entités) | Trace d'événement | evenement, createdBy | AO |

### Dossier patient

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| Patient | Dossier centralisé cross-site | numeroPatient·, matricule·, employeId, categoriePatientId, statut, version, verrouille | U · D |
| IdentitePatient | État civil (1-1) | nom, prenom, dateNaissance, sexe, telephone, photoUrl | U · D |
| ContactUrgence | Contact d'urgence (1-1) | nom, prenom, telephone, lien | U · D |
| DonneesEmploi | Données pro (1-1) | fonction, sectionPaie, service, departement | U · D |
| ModeViePatient | Mode de vie (1-1) | tabac, alcool, activitePhysique, sommeil… | U · D |
| AllergiePatient | Allergie | substance, gravite, confirme | U · D |
| AntecedentPatient | Antécédent | type, description | U · D |
| AlerteMedicale | Alerte clinique | type, message, gravite, resolvedAt | U · D |
| HistoriqueCategoriePatient | Changement de catégorie | ancienne/nouvelleCateg, dateEffet, motif | AO |
| FusionDossierPatient | Fusion de doublons | sourceId·, cibleId· | AO |
| PreSaisieMedicale | Pré-saisie | type, contenu (Json), valide | U · D |
| SuiviGrossesse | Suivi de grossesse | datePrevueAccouch, statut, devenir | U · D |
| ConsultationPrenatale | CPN | termeSemaines, poids, tension | U · D |

### Accueil & triage

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| Visite | Passage (file d'attente) | patientId, siteId, motifPrincipalId, statut, soignantId, typeCloture, creerHorsLigne, version | U · D |
| VisiteEvenement | Audit de visite | type, ancienne/nouvelleVal, acteurId | AO |
| ConstanteVitale | Constantes + signes généraux | temperature, tension*, FC, SpO₂, poids, IMC, glycemie, Glasgow | U · D |

### Consultation & actes

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| Consultation | Acte clinique | visiteId, soignantId, delegationId, statut, decisionMedicale, reposJours, pickedUpById, version | U · D |
| DiagnosticConsultation | Diagnostic | pathologieId, type, certitude | U |
| Ordonnance | Prescription médic. | consultationId, prescripteurId, delegationId, statut | U · D |
| LigneOrdonnance | Ligne d'ordonnance | medicamentId, posologie, duree, voieAdmin | U · D |
| BonExamen | Demande d'examens | consultationId, indicationClinik, etablissementId, statut | U · D |
| LigneExamen | Ligne d'examen | bonId, typeExamenId | U |
| ResultatExamen | Résultat d'examen | laboratoire, contenu, interpretation, statut | U · D |
| BonPharmacie | Bon de retrait médic. | consultationId, prescripteurId, statut, delivreLe | U · D |
| LigneBonPharmacie | Ligne de bon | medicamentId, libelle, posologie, quantite | U · D |
| CertificatMedical | Certificat | typeCertificatId, dureeJours, dateFin, contenu | U · D |
| SuiviChronique | Suivi chronique | pathologieId, frequenceSuivi, objectifs, statut | U · D |

### Sorties critiques

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| Evacuation | Évacuation (1-1 conso) | consultationId·, niveauUrgence, etablissementId, statut | U · D |
| SuiviEvacuation | Étape d'évacuation | notes, statut, createdBy | AO |
| AccidentTravail | Accident du travail (1-1) | dateAccident, lieu, lesions, gravite | U · D |
| SuiviAccidentTravail | Suivi accident | type, sequelles, tauxIncapacite | AO |

### Messagerie & notifications

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| Conversation | Fil (DIRECT/GROUPE) | type, titre, siteId | U · D |
| ConversationParticipant | Participant | utilisateurId, lastReadAt, joinedAt | U |
| Message | Message chiffré | contenuChiffre (AES-GCM), replyToId, editedAt | (updatedAt) · D |
| MessageMasque | « Supprimer pour moi » | messageId, utilisateurId | U |
| MessageReaction | Réaction emoji | emoji (unique par user) | U · D |
| MessagePieceJointe | Média chiffré | nomFichier, mimeType, taille, contenuChiffre | U · D |

### Synchronisation

| Entité | Rôle | Champs notables | U/D |
| --- | --- | --- | --- |
| SyncState | Curseur de sync | posteLocalId, siteId, lastPulledAt, lastPushedAt | (updatedAt) |
| PosteLocal | Poste/appareil | siteId, libelle, derniereSyncAt | — |
| FileMutation | Mutation à pousser | mutationUuid·, module, entiteType/Id, action, payloadJson, statut | — |
| JournalSynchronisation | Session de sync | startedAt, statut, nbMutations, nbConflits | — |
| ConflitSynchronisation | Conflit détecté | typeConflit, valeurLocale/Serveur, statut | — |
| ResolutionConflit | Résolution conflit | resolution, auteur, justification | — |
| AlerteTechnique | Alerte technique | type, message, siteId | — |
| ParametreMetier | Paramètre métier | cle·, valeur | (updatedAt) |
| HistoriqueParametreMetier | Trace de paramètre | ancienne/nouvelleVal, motif | AO |

*(`·` = champ unique ; « (updatedAt) » = `updatedAt` présent mais sans index dédié.)*

---

## 5. Relations structurantes (vue d'ensemble)

- **Site** est l'ancre de cloisonnement : `Utilisateur`, `Patient`, `Visite`,
  `Conversation`, `Notification`, `SyncState` y sont rattachés. Cf.
  [[plan_modules]] (multi-site).
- **Chaîne clinique** : `Patient` → `Visite` → `ConstanteVitale` puis `Consultation`
  → (`Ordonnance`, `BonExamen`+`ResultatExamen`, `BonPharmacie`, `CertificatMedical`,
  `Evacuation`, `AccidentTravail`, `SuiviChronique`, `DiagnosticConsultation`).
- **Identité du soignant** : `Utilisateur` (1-1) ↔ `PersonnelMedical` (acteur clinique
  référencé par `Consultation.soignantId` et les délégations).
- **Catégorie ⇒ droits** : `Patient.categoriePatientId` → `CategoriePatient` →
  `DroitCategoriePatient` (pilote l'accès aux bons, notamment `BonPharmacie`).
- **Ayants droit / sous-traitants** : `Patient.matricule` et `EmployeSaris.matricule`
  sont la clé de rattachement (`RattachementAyantDroitCdi`,
  `RattachementSousTraitant`).
- **Sync** : toute entité synchronisée expose `updatedAt`(+`deletedAt`) ; `FileMutation`
  /`SyncState` orchestrent le flux poste ↔ central (LWW).

---

## 6. Points à confirmer

- **Décompte de tables** : 87 modèles dans le schéma PG au 26/06/2026 vs. chiffre
  canonique « ~79 » des docs. À réconcilier (le schéma fait foi).
- **Schéma SQLite desktop** (`packages/db/prisma/sqlite/schema.prisma`) : supposé
  dérivé du PG ; différences éventuelles (types `Json`/`BigInt`) **à confirmer** sur le
  fichier réel.
