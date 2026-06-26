# Document 15 — Matrice de Traçabilité

## 1. Objectif

Cette matrice relie les **besoins métier** aux **modules**, **règles de gestion**, **tables Prisma**, **écrans logiques** et **tests de recette**. Elle garantit qu'aucune fonctionnalité n'est décrite sans pouvoir être vérifiée, et assure la cohérence entre le cahier des charges, les règles métier (doc 13) et la recette (doc 11).

Le présent document décrit l'application **dans son état réalisé (« as-built »)**. Sauf mention explicite « *extension future* », **tous les besoins listés sont codés et opérationnels** dans la version livrée. Les sections distinguent clairement :

- **RÉALISÉ** — fonctionnalité présente dans le code et utilisable ;
- **EXTENSION FUTURE** — table/structure présente mais non exposée, ou besoin volontairement hors périmètre MVP.

### 1.1 Chiffres de référence (état réel vérifié sur le code)

| Élément | Valeur |
|---|---|
| Tables Prisma (`schema.prisma`) | **78** |
| Migrations | **21** |
| Permissions granulaires (`packages/types/src/permissions.ts`) | **110** |
| Rôles | **6** (`ADMIN_SYSTEME`, `ADMIN_MEDICAL`, `MEDECIN_CHEF`, `INFIRMIER`, `INFIRMIER_DELEGUE`, `AGENT_RH`) |
| Modules MVP livrés | **8** + **3 transversaux** (messagerie, notifications, CGU) |

> **Note de nommage** : les tables sont déclarées en PascalCase dans `schema.prisma` (ex. `Utilisateur`, `JournalAudit`). Dans cette matrice elles sont citées sous leur nom de modèle Prisma, qui fait foi.

---

## 2. Matrice principale besoins ↔ modules ↔ tables ↔ tests

### 2.1 Sécurité, Administration et Audit — RÉALISÉ

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Contrôler l'accès utilisateur (login + bcrypt 12 rounds, JWT + refresh 7 j) | Sécurité | R-SEC-001 à R-SEC-007 | `Utilisateur`, `Role`, `Permission`, `UtilisateurRole`, `RolePermission`, `UtilisateurPermission`, `SessionUtilisateur` | Connexion, gestion des comptes | T-SEC-01 |
| Protéger les rôles sensibles par TOTP (secret chiffré AES-GCM + codes de secours) | Sécurité | R-SEC-008 à R-SEC-009 | `ConfigurationTotp`, `CodeSecoursTotp` | Vérification TOTP | T-SEC-02 |
| Gérer le cycle de vie des sessions | Sécurité | R-SEC-010 à R-SEC-012, R-SEC-025 à R-SEC-032 | `SessionUtilisateur` | Sessions actives, déconnexion forcée | T-SEC-06 |
| Gérer les dérogations de permissions (GRANT / REVOKE individuels) | Sécurité | R-SEC-006, R-SEC-007 | `UtilisateurPermission` | Gestion fine des droits | T-SEC-07 |
| Tracer les connexions (IP réelle + géolocalisation hors-ligne) | Audit | R-SEC-019 à R-SEC-021 | `JournalAuthentification` | Journal d'authentification | T-SEC-03 |
| Tracer les actions critiques (intercepteur global `@Audit` persistant) | Audit | R-SEC-013, R-SEC-014, R-SEC-017, R-SEC-018 | `JournalAudit` | Journal d'audit | T-SEC-04 |
| Gérer les alertes d'anomalie | Audit | R-SEC-022 | `AlerteAnomalie` | Alertes d'audit | T-SEC-05 |
| Gérer les paramètres techniques du système | Administration | R-SEC-023 à R-SEC-024 | `ParametreSysteme` | Paramètres système | T-ADM-01 |
| Sauvegarder et restaurer la configuration (sauvegarde réelle, cron quotidien 02h00, rétention 30) | Administration | R-SEC-023, R-SYNC-008 | `SauvegardeSysteme` | Sauvegardes et restauration | T-ADM-02 |
| Gérer les préférences personnelles du compte | Sécurité | R-SEC-004 | `PreferenceUtilisateur` | Paramètres utilisateur | T-SEC-08 |

### 2.2 Référentiels et droits — RÉALISÉ (CRUD complet, suppression 409-safe, temps réel `LIVE_REFERENTIELS`)

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Configurer les sites | Référentiels | R-REF-001 | `Site` | Sites | T-REF-01 |
| Configurer les catégories et droits patients | Référentiels | R-REF-002 à R-REF-004, R-REF-021 | `CategoriePatient`, `DroitCategoriePatient` | Catégories et droits | T-REF-02 |
| Standardiser les motifs de consultation | Référentiels | R-REF-009, R-REF-026 | `MotifConsultation` | Motifs de consultation | T-REF-03 |
| Standardiser les pathologies de référence | Référentiels | R-REF-017 à R-REF-020, R-REF-029, R-REF-030 | `PathologieReference` | Pathologies | T-REF-04 |
| Encadrer les médicaments de référence | Référentiels | R-REF-007 à R-REF-008, R-REF-022, R-REF-023 | `MedicamentReference`, `ContreIndicationMedicament` | Médicaments de référence | T-REF-05 |
| Gérer les contre-indications médicamenteuses | Référentiels | R-REF-008, R-REF-024 | `ContreIndicationMedicament` | Contre-indications | T-REF-05 |
| Gérer les types d'examens | Référentiels | R-REF-012, R-REF-025 | `TypeExamen` | Types d'examens | T-REF-06 |
| Gérer les établissements de référence | Référentiels | R-REF-014, R-REF-027, R-REF-028 | `EtablissementReference` | Établissements | T-REF-08 |
| Gérer les sociétés sous-traitantes | Référentiels | R-REF-013 | `SocieteSousTraitante` | Sociétés | T-REF-07 |

### 2.3 Acteurs administratifs — RÉALISÉ (personnel, sociétés, délégations, rattachements)

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Gérer le personnel médical | Acteurs | R-ACT-001 à R-ACT-008 | `PersonnelMedical`, `HabilitationPersonnel` | Personnel médical | T-ACT-01 |
| Accorder une délégation de prescription (+ médicaments autorisés) | Acteurs | R-ACT-009 à R-ACT-013 | `DelegationPrescription`, `DelegationMedicamentAutorise` | Délégations | T-ACT-03 |
| Rattacher un ayant droit CDI (+ historique) | Acteurs | R-ACT-014 à R-ACT-018, R-ACT-023 à R-ACT-034 | `RattachementAyantDroitCdi`, `HistoriqueRattachementAyantDroit` | Ayants droit | T-ACT-04 |
| Rattacher un sous-traitant (+ historique) | Acteurs | R-ACT-019 à R-ACT-022, R-ACT-035 à R-ACT-048 | `RattachementSousTraitant`, `HistoriqueRattachementSousTraitant` | Sous-traitants | T-ACT-05 |
| Planifier permutations, présences et absences du personnel | Acteurs | R-ACT-002 à R-ACT-006 | `PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel` | Planning et présence | T-ACT-02 *(extension future — voir §6)* |

### 2.4 Dossier patient — RÉALISÉ

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Créer un dossier patient | Dossier patient | R-PAT-001 à R-PAT-007, R-PAT-023 à R-PAT-025 | `Patient`, `IdentitePatient` | Création de dossier | T-PAT-01 |
| Éviter les doublons et fusionner les dossiers | Dossier patient | R-PAT-002, R-PAT-003, R-PAT-017, R-PAT-018, R-PAT-034 | `Patient`, `IdentitePatient`, `FusionDossierPatient` | Recherche / fusion patient | T-PAT-02 |
| Gérer les changements de catégorie (historisés) | Dossier patient | R-PAT-007 à R-PAT-009, R-PAT-026 à R-PAT-034 | `HistoriqueCategoriePatient` | Catégorie patient | T-PAT-03 |
| Gérer allergies et antécédents | Dossier patient | R-PAT-010 à R-PAT-012 | `AllergiePatient`, `AntecedentPatient` | Alertes médicales | T-PAT-04 |
| Gérer les alertes médicales | Dossier patient | R-PAT-011, R-PAT-012 | `AlerteMedicale` | Alertes médicales | T-PAT-04 |
| Gérer les constantes vitales | Dossier patient | R-PAT-013 | `ConstanteVitale` | Constantes | T-PAT-05 |
| Gérer le contact d'urgence | Dossier patient | R-PAT-014 | `ContactUrgence` | Contact d'urgence | T-PAT-06 |
| Pré-saisir des données médicales | Dossier patient | R-PAT-015 | `PreSaisieMedicale` | Pré-saisie | T-PAT-08 |
| Suivre une grossesse | Dossier patient | R-PAT-019 à R-PAT-021, R-PAT-035 à R-PAT-050 | `SuiviGrossesse`, `ConsultationPrenatale`, `AlerteMedicale` | Suivi grossesse | T-PAT-07 *(suivi complet = extension future — voir §6)* |

### 2.5 Accueil et triage — RÉALISÉ (offline complet)

> **Évolution as-built** : la notion de **priorité a été retirée de l'interface** — la file fonctionne **par ordre d'arrivée**. La colonne `priorite` a été **supprimée de la base** (migration `remove_priorite`).

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Ouvrir une visite au triage | Accueil | R-TRI-001 à R-TRI-004, R-TRI-019, R-TRI-020, R-TRI-023, R-TRI-024 | `Visite`, `VisiteEvenement` | Ouverture de visite | T-TRI-01 |
| Saisir les constantes (IMC auto + alertes valeurs anormales) | Accueil | R-TRI-006 à R-TRI-008, R-TRI-016 à R-TRI-018, R-TRI-030 | `ConstanteVitale` | Saisie des constantes | T-TRI-02 |
| Gérer la file d'attente (ordre d'arrivée, temps réel) | Accueil | R-TRI-009, R-TRI-021, R-TRI-022, R-TRI-024 | `Visite` | File d'attente | T-TRI-05 |
| Orienter le patient vers le soignant | Accueil | R-TRI-010, R-TRI-027 | `Visite`, `DelegationPrescription` | Orientation | T-TRI-03 |
| Clôturer ou annuler une visite | Accueil | R-TRI-011 à R-TRI-013 | `Visite`, `VisiteEvenement` | Clôture de visite | T-TRI-04 |
| Gérer une visite hors ligne | Accueil, Offline | R-TRI-015, R-TRI-025, R-TRI-026, R-TRI-029 | `Visite`, `FileMutation` | Triage hors ligne | T-OFF-01 |

### 2.6 Consultation et actes — RÉALISÉ

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Ouvrir une consultation et poser un diagnostic | Consultation | R-CON-001 à R-CON-006 | `Consultation`, `DiagnosticConsultation` | Consultation | T-CON-01 |
| Formaliser la conclusion / décision médicale | Consultation | R-CON-005, R-CON-006 | `Consultation` | Décision médicale | T-CON-02 |
| Créer une ordonnance (avec délégation de prescription) | Actes prescrits | R-CON-007 à R-CON-010, R-CON-026 à R-CON-029, R-CON-041 à R-CON-044 | `Ordonnance`, `LigneOrdonnance`, `DelegationPrescription` | Prescription | T-CON-03 |
| Contrôler les risques à la prescription (allergies, contre-indications, grossesse) + validation | Actes prescrits | R-CON-011 à R-CON-017, R-CON-030 à R-CON-040 | `AllergiePatient`, `ContreIndicationMedicament`, `SuiviGrossesse` | Contrôles d'ordonnance | T-CON-04 |
| Créer un bon d'examen | Actes prescrits | R-CON-018 à R-CON-019, R-CON-046 à R-CON-051 | `BonExamen`, `LigneExamen` | Demande d'examen | T-CON-05 |
| Saisir et consulter un résultat d'examen | Actes prescrits | R-CON-020 à R-CON-022, R-CON-052 à R-CON-060 | `ResultatExamen` | Résultat d'examen | T-CON-06 |
| Ouvrir et clôturer un suivi chronique | Consultation | R-CON-023, R-CON-024, R-CON-061 à R-CON-068 | `SuiviChronique` | Suivi chronique | T-CON-07 |
| Générer des documents A4 imprimables (ordonnance, bon, synthèse) | Consultation, Documents | R-CON-009, R-CON-019 | `Ordonnance`, `BonExamen`, `Consultation` | Aperçu / impression A4 | T-DOC-01 |
| Bloquer la délivrance physique des médicaments (hors MVP) | Actes prescrits | R-CON-025, R-SCOPE-003 | `Ordonnance` | Prescription | T-SCOPE-01 |

### 2.7 Sorties critiques — RÉALISÉ

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Créer et suivre une évacuation | Sorties critiques | R-SOR-001 à R-SOR-008, R-SOR-021 à R-SOR-025 | `Evacuation`, `SuiviEvacuation` | Fiche d'évacuation | T-SOR-01 |
| Mettre à jour le suivi post-évacuation | Sorties critiques | R-SOR-006 à R-SOR-008 | `SuiviEvacuation` | Suivi d'évacuation | T-SOR-02 |
| Qualifier et suivre un accident du travail | Sorties critiques | R-SOR-009 à R-SOR-018, R-SOR-026 à R-SOR-055 | `AccidentTravail`, `SuiviAccidentTravail` | Fiche AT | T-SOR-03 |
| Gérer reprise / prolongation / consolidation / rechute AT | Sorties critiques | R-SOR-014 à R-SOR-018 | `SuiviAccidentTravail` | Suivi AT | T-SOR-04 |
| Générer les fiches A4 imprimables (évacuation, AT) | Sorties critiques, Documents | R-SOR-005, R-SOR-013 | `Evacuation`, `AccidentTravail` | Aperçu / impression A4 | T-DOC-01 |
| Exclure la transmission CNSS automatique (hors MVP) | Sorties critiques | R-SOR-019, R-SOR-046 | `AccidentTravail` | Fiche AT | T-SCOPE-02 |

### 2.8 Synchronisation offline-first — RÉALISÉ

| Besoin métier | Module | Règles liées | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|---|
| Travailler sans réseau (PWA Workbox + file de rejeu IndexedDB) | Offline | R-SYNC-001 à R-SYNC-007, R-SYNC-021 à R-SYNC-030 | `PosteLocal`, `FileMutation` | Indicateur de connexion | T-OFF-02 |
| Synchroniser au retour réseau (`useSyncEngine`, `LIVE_SYNC`) | Offline | R-SYNC-008 à R-SYNC-012, R-SYNC-031 à R-SYNC-041 | `FileMutation`, `JournalSynchronisation` | Synchronisation | T-OFF-03 |
| Résoudre un conflit de synchronisation | Offline | R-SYNC-013 à R-SYNC-016, R-SYNC-042 à R-SYNC-050 | `ConflitSynchronisation`, `ResolutionConflit` | Conflits | T-OFF-04 |
| Alerter et superviser la désynchronisation | Offline | R-SYNC-017 à R-SYNC-020, R-SYNC-051 à R-SYNC-060 | `JournalSynchronisation`, `AlerteTechnique` | Supervision sync | T-OFF-05 |
| Gérer les paramètres métier configurables (+ historique) | Offline, Administration | R-SYNC-019 | `ParametreMetier`, `HistoriqueParametreMetier` | Paramètres métier | T-OFF-05 |

### 2.9 Modules transversaux ajoutés (au-delà des 8 modules MVP) — RÉALISÉ

| Besoin métier | Module | Tables principales | Écran logique | Test de recette |
|---|---|---|---|---|
| Communiquer en interne, chiffré au repos (AES-256-GCM), 1-1 et groupes (cap 50), PJ chiffrées, notes vocales, réactions emoji, accusés 3 états, présence, suppression 2 niveaux | Messagerie interne | `Conversation`, `ConversationParticipant`, `Message`, `MessageMasque`, `MessageReaction`, `MessagePieceJointe` | Messagerie (split-panel) | T-MSG-01 à T-MSG-05 |
| Notifier en temps réel (flux SSE → invalidations react-query, sons UI, gestion au survol / multiple / tout) | Notifications | `Notification`, `NotificationLecture` | Cloche de notifications | T-NOT-01, T-NOT-02 |
| Faire accepter les CGU versionnées (charte 7 sections, porte bloquante `CguGate`, acceptation tracée date + version) | CGU | `PreferenceUtilisateur` (`cguAccepteeLe`, `cguVersion`) | Modale CGU (login + paramètres) | T-CGU-01 |
| Sécuriser la messagerie en production (rate-limit 40/min/utilisateur, anti-IDOR cross-site, magic-bytes + sanitize nom de fichier, cloisonnement par site) | Messagerie / Sécurité | `Message`, `MessagePieceJointe`, `ConversationParticipant` | Messagerie | T-MSG-04 |
| Faire pivoter / versionner la clé de chiffrement (format `v2:keyId`, `MESSAGE_ENC_KEYS` + fichier Vault-ready) + ré-encryption | Messagerie / Sécurité | `Message`, `MessagePieceJointe` | Synchronisation > Messagerie (ré-encryption) | T-MSG-06 |

---

## 3. Catalogue des tests référencés

> **Avertissement sur l'état réel des tests** : voir §5. Les tests ci-dessous décrivent les **scénarios de recette** ; ils sont aujourd'hui exécutés **manuellement** (recette fonctionnelle E2E navigateur, plus `tsc` typecheck et build). **Aucune suite de tests automatisés étendue** n'est encore en place — c'est une limite assumée et une extension future.

| ID test | Description |
|---|---|
| T-SEC-01 | Connexion avec rôle autorisé et refus avec rôle non autorisé. |
| T-SEC-02 | Activation TOTP (secret chiffré + codes de secours), connexion avec code valide, rejet d'un code invalide. |
| T-SEC-03 | Journalisation des connexions réussies et des échecs successifs menant au blocage ; IP réelle et géolocalisation présentes. |
| T-SEC-04 | Présence d'une action critique dans le journal d'audit via l'intercepteur `@Audit` ; vérification que le journal n'est pas modifiable. |
| T-SEC-05 | Détection et traitement d'une anomalie d'audit avec commentaire d'investigation. |
| T-SEC-06 | Révocation d'une session active et déconnexion forcée par un administrateur. |
| T-SEC-07 | Dérogation de permission (GRANT puis REVOKE) appliquée immédiatement à l'utilisateur. |
| T-SEC-08 | Modification d'une préférence personnelle (thème, densité) sans impact sur les autres comptes. |
| T-ADM-01 | Modification d'un paramètre système et vérification de l'effet. |
| T-ADM-02 | Sauvegarde réelle de configuration, restauration non destructive et vérification du déclenchement du cron quotidien. |
| T-REF-01 | Création, modification, désactivation et suppression 409-safe d'un site. |
| T-REF-02 | Modification d'un droit de catégorie et application immédiate au triage (temps réel). |
| T-REF-03 | Utilisation d'un motif actif ; vérification qu'un motif inactif ne s'affiche pas. |
| T-REF-04 | Sélection d'une pathologie en diagnostic de consultation. |
| T-REF-05 | Blocage d'une prescription selon une contre-indication absolue. |
| T-REF-06 | Demande d'examen à partir d'un type d'examen actif. |
| T-REF-07 | Suspension d'une société et vérification de l'impact sur les sous-traitants rattachés. |
| T-REF-08 | Désactivation d'un établissement de référence et vérification qu'il ne peut plus être sélectionné. |
| T-ACT-01 | Création d'un profil personnel médical et attribution d'une habilitation. |
| T-ACT-02 | Saisie du planning, confirmation de présence et enregistrement d'une absence *(extension future — structures présentes, UI non exposée)*. |
| T-ACT-03 | Création d'une délégation active puis suspension immédiate avec vérification du blocage. |
| T-ACT-04 | Rattachement d'un ayant droit à un CDI, suspension du CDI et vérification de l'impact (historisé). |
| T-ACT-05 | Rattachement d'un sous-traitant, suspension de la société et vérification de l'impact (historisé). |
| T-PAT-01 | Création d'un dossier patient avec identité complète. |
| T-PAT-02 | Détection d'un doublon à la création, fusion de deux dossiers. |
| T-PAT-03 | Changement de catégorie avec historisation et vérification des droits appliqués. |
| T-PAT-04 | Allergie / alerte médicale saisie et visible lors de la consultation et à la prescription. |
| T-PAT-05 | Constantes vitales historisées avec date et visite. |
| T-PAT-06 | Contact d'urgence visible lors de la création d'une évacuation. |
| T-PAT-07 | Ouverture d'un suivi grossesse, alerte médicale créée, contrôle grossesse à la prescription. |
| T-PAT-08 | Pré-saisie médicale enregistrée et reprise lors de la consultation. |
| T-TRI-01 | Ouverture d'une visite avec affichage des droits et des alertes actives ; trace dans `VisiteEvenement`. |
| T-TRI-02 | Saisie des constantes avec calcul IMC et déclenchement d'une alerte pour valeur anormale. |
| T-TRI-03 | Orientation vers médecin ou infirmier délégué avec vérification de la délégation. |
| T-TRI-04 | Clôture de visite et retrait automatique de la file d'attente active. |
| T-TRI-05 | File d'attente par ordre d'arrivée ; calcul du temps d'attente (sans notion de priorité). |
| T-CON-01 | Ouverture d'une consultation depuis la file d'attente et saisie du diagnostic. |
| T-CON-02 | Saisie de la conclusion et de la décision médicale. |
| T-CON-03 | Création d'une ordonnance valide avec posologie et durée (y compris via délégation). |
| T-CON-04 | Blocage d'une contre-indication absolue ; justification obligatoire pour une relative ; alerte grossesse. |
| T-CON-05 | Création d'un bon d'examen avec indication clinique. |
| T-CON-06 | Saisie d'un résultat d'examen avec alerte si résultat anormal. |
| T-CON-07 | Ouverture et clôture d'un suivi chronique avec motif de clôture. |
| T-DOC-01 | Génération et aperçu A4 (ordonnance, bon d'examen, évacuation, AT, synthèse) avec logo réel. |
| T-SOR-01 | Création d'une évacuation urgente avec alerte prioritaire et suivi post-évacuation. |
| T-SOR-02 | Mise à jour du suivi post-évacuation ; alerte si aucun retour après délai. |
| T-SOR-03 | Qualification d'un accident du travail par le médecin chef. |
| T-SOR-04 | Reprise de travail, prolongation d'arrêt, consolidation et rechute AT. |
| T-OFF-01 | Visite créée hors ligne avec mutation locale et indicateur PENDING. |
| T-OFF-02 | Travail local sans réseau : création patient, visite et consultation avec données locales (Dexie). |
| T-OFF-03 | Retour de connexion : synchronisation automatique des mutations et mise à jour Dexie. |
| T-OFF-04 | Conflit de synchronisation détecté : résolution et journalisation. |
| T-OFF-05 | Alerte de désynchronisation après dépassement du délai configurable. |
| T-MSG-01 | Envoi / réception d'un message 1-1 chiffré ; déchiffrement correct au repos. |
| T-MSG-02 | Création d'un groupe (cap 50) et diffusion d'un message à tous les participants. |
| T-MSG-03 | Pièce jointe chiffrée (image/vidéo/audio/doc ≤ 16 Mo) et note vocale ; aperçu et lecture. |
| T-MSG-04 | Refus d'accès cross-site (anti-IDOR), rejet d'un fichier au mauvais type (magic-bytes), rate-limit 40/min. |
| T-MSG-05 | Accusés 3 états (envoyé / remis / lu), présence, suppression « pour moi » et « pour tous » (≤ 15 min). |
| T-MSG-06 | Rotation de clé (`v1` → `v2:keyId`) et ré-encryption non destructive ; lecture des deux formats. |
| T-NOT-01 | Réception d'une notification temps réel (SSE) et invalidation react-query correspondante. |
| T-NOT-02 | Notification de réaction emoji ; suppression au survol / multiple / tout. |
| T-CGU-01 | Porte bloquante `CguGate` à la connexion ; acceptation tracée (date + version) ; re-demande si version obsolète. |
| T-SCOPE-01 | Vérification de l'absence de délivrance physique des médicaments dans le MVP. |
| T-SCOPE-02 | Vérification de l'absence de transmission CNSS automatique dans le MVP. |

---

## 4. Couverture par module

| Module | Besoins couverts | Tests référencés | Règles couvertes | État |
|---|---|---|---|---|
| Sécurité + Administration + Audit | 10 | T-SEC-01 à T-SEC-08, T-ADM-01, T-ADM-02 | R-SEC-001 à R-SEC-032 | RÉALISÉ |
| Référentiels + Droits | 9 | T-REF-01 à T-REF-08 | R-REF-001 à R-REF-030 | RÉALISÉ |
| Acteurs administratifs | 5 | T-ACT-01 à T-ACT-05 | R-ACT-001 à R-ACT-048 | RÉALISÉ (planning/présence = extension) |
| Dossier patient | 9 | T-PAT-01 à T-PAT-08 | R-PAT-001 à R-PAT-050 | RÉALISÉ |
| Accueil et triage | 6 | T-TRI-01 à T-TRI-05, T-OFF-01 | R-TRI-001 à R-TRI-030 | RÉALISÉ (offline complet) |
| Consultation + Actes | 9 | T-CON-01 à T-CON-07, T-DOC-01 | R-CON-001 à R-CON-068 | RÉALISÉ |
| Sorties critiques | 6 | T-SOR-01 à T-SOR-04, T-DOC-01, T-SCOPE-02 | R-SOR-001 à R-SOR-055 | RÉALISÉ |
| Synchronisation offline | 5 | T-OFF-02 à T-OFF-05 | R-SYNC-001 à R-SYNC-060 | RÉALISÉ |
| Messagerie interne (transversal) | 6 | T-MSG-01 à T-MSG-06 | — | RÉALISÉ |
| Notifications (transversal) | 1 | T-NOT-01, T-NOT-02 | — | RÉALISÉ |
| CGU (transversal) | 1 | T-CGU-01 | — | RÉALISÉ |
| Documents imprimables (transversal) | 1 | T-DOC-01 | — | RÉALISÉ |
| **Total** | **68** | **74** | **~430 règles** | — |

---

## 5. Honnêteté sur la stratégie de test

L'équipe distingue ce qui est **vérifié** de ce qui reste à outiller :

- **En place** : recette fonctionnelle **E2E manuelle au navigateur** sur les scénarios ci-dessus ; **vérification de types** (`tsc`) ; **build** de production (`vite build` côté web, build NestJS côté API).
- **Non encore en place (extension future)** : **suite de tests automatisés étendue** (unitaires, intégration, E2E automatisés type Playwright, couverture mesurée et CI bloquante). Les ID de test du §3 décrivent donc des **scénarios de recette** servant de référence, exécutés manuellement à ce jour.

Cette transparence est volontaire : la matrice ne présente pas l'automatisation des tests comme acquise.

---

## 6. Périmètre — réalisé vs extensions futures

### 6.1 Réalisé (livré et opérationnel)

Les **8 modules MVP** (Sécurité/Admin/Audit, Référentiels, Acteurs, Dossier patient, Triage, Consultation/Actes, Sorties critiques, Synchronisation offline) ainsi que les **3 modules transversaux** (Messagerie chiffrée, Notifications temps réel, CGU versionnées) et les **documents A4 imprimables** sont **codés et fonctionnels** sur **79 tables**, **110 permissions** et **6 rôles**.

### 6.2 Extensions futures (hors périmètre MVP)

| Sujet | Statut dans le code |
|---|---|
| Planning / présence / absence du personnel | Tables présentes (`PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel`, `HabilitationPersonnel`) mais **UI non exposée**. |
| Suivi de grossesse complet | Tables présentes (`SuiviGrossesse`, `ConsultationPrenatale`) ; suivi avancé à étoffer. |
| Gestion des stocks, délivrance physique, réapprovisionnement | **Hors périmètre** (blocage MVP — T-SCOPE-01). |
| Transmission CNSS automatique | **Hors périmètre** (T-SCOPE-02). |
| Reporting directionnel agrégé | **Hors périmètre** MVP. |
| Internationalisation multilingue (i18n) | Préférence `langue` présente, contenu non traduit. |
| Suite de tests automatisés étendue + CI | À mettre en place (voir §5). |
