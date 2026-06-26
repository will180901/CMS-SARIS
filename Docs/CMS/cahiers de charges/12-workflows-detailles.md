# Document 12 - Workflows Détaillés

## 1. Objectif

Ce document décrit les processus métier de CMS SARIS étape par étape, tels qu'ils sont **réellement implémentés** (état as-built). Il transforme les modules en parcours compréhensibles par un développeur, un chef de projet, un encadreur ou un futur utilisateur, et sert de base au rapport de soutenance.

Sauf mention explicite « EXTENSION FUTURE », tous les workflows décrits ci-dessous sont **codés et fonctionnels** dans l'application livrée.

## 2. Contexte technique

L'application repose sur un monorepo Turborepo + pnpm (`apps/web`, `apps/api`, `packages/ui`, `packages/types`, `packages/db`).

- **Frontend :** React 19 + Vite 7 + TypeScript + Tailwind v4 + shadcn/ui ; Zustand ; TanStack Query/Table ; Dexie.js (IndexedDB hors ligne) ; vite-plugin-pwa (Workbox) ; recharts ; emoji-mart ; @ffmpeg/ffmpeg.
- **Backend :** NestJS 11 + Prisma 6 + PostgreSQL 16 ; otplib (TOTP) ; bcrypt (12 rounds) ; JWT (+ refresh 7 jours) ; @nestjs/throttler ; @nestjs/schedule (cron) ; multer ; helmet ; geoip-lite ; `node:crypto` (AES-256-GCM).
- **Volumétrie du modèle :** 79 tables Prisma, 22 migrations.
- **Sécurité applicative :** 110 permissions (catalogue `packages/types/src/permissions.ts`), 6 rôles : `ADMIN_SYSTEME`, `ADMIN_MEDICAL`, `MEDECIN_CHEF`, `INFIRMIER`, `INFIRMIER_DELEGUE`, `AGENT_RH`.

## 3. Convention de lecture

Chaque workflow précise :

- le déclencheur ;
- les acteurs ;
- les préconditions ;
- le déroulement nominal ;
- les variantes ;
- les données modifiées (tables Prisma concernées) ;
- les règles critiques ;
- le résultat attendu ;
- le statut de réalisation.

## 4. Synthèse des workflows

| Réf. | Workflow | Domaine | Statut |
| --- | --- | --- | --- |
| WF-01 | Initialisation du système | Admin / Référentiels | Réalisé |
| WF-02 | Création d'un utilisateur | Sécurité | Réalisé |
| WF-03 | Connexion sécurisée (mot de passe + TOTP) | Sécurité | Réalisé |
| WF-04 | Gestion des référentiels | Référentiels | Réalisé |
| WF-05 | Création d'un dossier patient | Dossier patient | Réalisé |
| WF-06 | Changement de catégorie patient | Dossier patient | Réalisé |
| WF-07 | Enregistrement d'un ayant droit CDI | Acteurs administratifs | Réalisé |
| WF-08 | Enregistrement d'un sous-traitant | Acteurs administratifs | Réalisé |
| WF-09 | Délégation de prescription | Acteurs administratifs | Réalisé |
| WF-10 | Ouverture d'une visite au triage | Accueil / Triage | Réalisé |
| WF-11 | Consultation médicale standard | Consultation / Actes | Réalisé |
| WF-12 | Prescription sécurisée (ordonnance) | Consultation / Actes | Réalisé |
| WF-13 | Bon d'examen et résultat | Consultation / Actes | Réalisé |
| WF-14 | Suivi chronique | Consultation / Actes | Réalisé |
| WF-15 | Évacuation sanitaire | Sorties critiques | Réalisé |
| WF-16 | Accident de travail | Sorties critiques | Réalisé |
| WF-17 | Travail hors ligne | Synchronisation | Réalisé |
| WF-18 | Retour en ligne et synchronisation | Synchronisation | Réalisé |
| WF-19 | Messagerie interne chiffrée | Messagerie | Réalisé |
| WF-20 | Réaction emoji et accusés de lecture | Messagerie | Réalisé |
| WF-21 | Notifications temps réel (SSE) | Transversal | Réalisé |
| WF-22 | Acceptation des conditions d'utilisation | Transversal | Réalisé |
| WF-23 | Sauvegarde et restauration de configuration | Admin / Sync | Réalisé |
| WF-24 | Rotation et versioning de la clé de chiffrement | Sécurité / Messagerie | Réalisé |
| WF-25 | Audit et journal d'authentification | Sécurité / Audit | Réalisé |
| WF-26 | Génération de documents imprimables A4 | Transversal | Réalisé |
| WF-27 | Fusion de dossiers patients | Dossier patient | Réalisé |
| WF-28 | Planning et présence du personnel | Acteurs administratifs | Extension future |
| WF-29 | Suivi de grossesse complet | Dossier patient | Extension future |

## WF-01 - Initialisation du système

**Déclencheur :** première mise en service du système.

**Acteurs :** administrateur système, administrateur médical.

**Préconditions :**

- l'application est installée ;
- la base de données est vide ou en mode initialisation ;
- au moins un compte administrateur système existe.

**Déroulement nominal :**

1. L'administrateur système se connecte.
2. Il configure les paramètres techniques : durée de session, politique de mot de passe, sauvegardes, seuils d'alerte.
3. Il crée les premiers rôles et permissions (catalogue de 110 permissions, 6 rôles standard).
4. Il crée le compte administrateur médical.
5. L'administrateur médical configure les sites (Moutéla, Nkayi).
6. Il configure les catégories de patients et leurs droits.
7. Il alimente les référentiels médicaux : pathologies, médicaments de référence (et contre-indications), types d'examen, motifs de consultation.
8. Il configure les sociétés sous-traitantes et les établissements de référence.
9. Le système journalise toutes les actions via l'intercepteur d'audit global.

**Variantes :**

- Si un référentiel obligatoire est vide, les modules consommateurs affichent un état « configuration incomplète ».
- Si une catégorie n'a pas de droits définis, aucun patient ne peut être enregistré dans cette catégorie.

**Données modifiées :** `Site`, `CategoriePatient`, `DroitCategoriePatient`, `PathologieReference`, `MedicamentReference`, `ContreIndicationMedicament`, `TypeExamen`, `MotifConsultation`, `EtablissementReference`, `SocieteSousTraitante`, `ParametreSysteme`, `ParametreMetier`, `JournalAudit`.

**Règles critiques :** R-REF-001 à R-REF-010, R-SEC-001 à R-SEC-012.

**Résultat attendu :** le système est prêt pour l'enregistrement des utilisateurs, patients et visites.

**Statut :** Réalisé.

## WF-02 - Création d'un utilisateur

**Déclencheur :** arrivée d'un nouvel utilisateur.

**Acteurs :** administrateur système.

**Préconditions :**

- le rôle cible existe ;
- le site principal existe si nécessaire ;
- l'identifiant n'est pas déjà utilisé.

**Déroulement nominal :**

1. L'administrateur ouvre l'écran de gestion des comptes.
2. Il saisit l'identité, le contact, le ou les rôles et le site principal.
3. Le système contrôle l'unicité de l'identifiant et de l'e-mail.
4. Le système génère ou impose un mot de passe temporaire (haché bcrypt à 12 rounds).
5. Le compte est créé avec le statut `ACTIF`.
6. L'administrateur peut accorder des dérogations de permissions (GRANT/REVOKE) au-delà des rôles.
7. L'utilisateur devra changer son mot de passe à la première connexion.
8. L'action est journalisée.

**Variantes :**

- Si l'utilisateur est rattaché à un rôle sensible, le TOTP est obligatoire à l'activation.
- Si le compte existe déjà mais est désactivé, la réactivation est proposée au lieu d'une nouvelle création.

**Données modifiées :** `Utilisateur`, `UtilisateurRole`, `UtilisateurPermission`, `Role`, `JournalAudit`, `JournalAuthentification`.

**Règles critiques :** R-SEC-001 à R-SEC-018.

**Résultat attendu :** l'utilisateur peut se connecter selon ses droits.

**Statut :** Réalisé.

## WF-03 - Connexion sécurisée (mot de passe + TOTP)

**Déclencheur :** l'utilisateur ouvre l'application.

**Acteurs :** tout utilisateur.

**Préconditions :**

- le compte existe et est actif ;
- l'application dispose des données locales nécessaires si elle est hors ligne.

**Déroulement nominal :**

1. L'utilisateur saisit son identifiant et son mot de passe.
2. Le système vérifie le compte et compare le mot de passe (bcrypt).
3. Si le rôle exige le TOTP, le système demande le code à 6 chiffres (otplib). L'utilisateur peut aussi saisir un code de secours.
4. Le secret TOTP est stocké chiffré (AES-256-GCM) ; les codes de secours sont à usage unique.
5. Le système crée une session et délivre un JWT (avec jeton de rafraîchissement valable 7 jours).
6. Les permissions effectives (rôles + dérogations) sont chargées.
7. L'utilisateur accède au tableau de bord adapté à son rôle.
8. L'événement est journalisé avec l'IP réelle et la géolocalisation (geoip-lite).

**Variantes :**

- Mot de passe incorrect : tentative enregistrée dans le journal d'authentification.
- Trop d'échecs : compte bloqué et alerte d'anomalie générée.
- TOTP invalide : refus de connexion.
- Code de secours utilisé : marqué comme consommé.
- Hors ligne : connexion autorisée seulement si l'utilisateur possède une session locale valide ou un cache d'identité autorisé.

**Données modifiées :** `SessionUtilisateur`, `JournalAuthentification`, `AlerteAnomalie`, `CodeSecoursTotp`.

**Règles critiques :** R-SEC-019 à R-SEC-032.

**Résultat attendu :** l'utilisateur est connecté avec les permissions correctes.

**Statut :** Réalisé.

## WF-04 - Gestion des référentiels

**Déclencheur :** besoin d'ajouter, corriger ou supprimer une donnée de référence.

**Acteurs :** administrateur médical.

**Préconditions :**

- l'utilisateur possède le droit de gestion du référentiel ;
- le type de référentiel existe.

**Déroulement nominal :**

1. L'administrateur médical choisit le référentiel (sites, catégories patients + droits, motifs, pathologies, médicaments + contre-indications, types d'examen, établissements).
2. Il recherche l'entrée existante.
3. Si elle n'existe pas, il crée une nouvelle entrée.
4. Si elle existe, il modifie les champs autorisés (CRUD complet : création, lecture, modification, suppression).
5. Le système contrôle le code, le libellé et les contraintes.
6. Le système sauvegarde et historise si nécessaire.
7. Les modules consommateurs sont rafraîchis en temps réel via l'événement `LIVE_REFERENTIELS` (SSE).

**Variantes :**

- Suppression 409-safe : une entrée déjà référencée par des données métier ne peut être supprimée (réponse HTTP 409) ; elle peut être désactivée.
- Une modification de droits de catégorie exige une justification.
- Une société suspendue déclenche la suspension logique des sous-traitants rattachés.

**Données modifiées :** tables de référentiel concernées et `HistoriqueParametreMetier`.

**Règles critiques :** R-REF-001 à R-REF-030.

**Résultat attendu :** les listes métier restent cohérentes, contrôlées et synchronisées en direct.

**Statut :** Réalisé.

## WF-05 - Création d'un dossier patient

**Déclencheur :** patient inconnu au triage ou création administrative.

**Acteurs :** infirmier, agent RH, administrateur médical.

**Préconditions :**

- la catégorie patient existe ;
- les droits de la catégorie sont définis ;
- le patient a été recherché.

**Déroulement nominal :**

1. L'utilisateur recherche par nom, prénom, date de naissance, matricule ou téléphone.
2. Le système affiche les dossiers proches (déduplication).
3. L'utilisateur confirme qu'aucun dossier existant ne correspond.
4. Il saisit l'identité et la catégorie.
5. Le système crée le dossier patient.
6. Il crée l'identité administrative.
7. Il renseigne le contact d'urgence, les allergies, antécédents et alertes médicales si requis.
8. L'action est auditée.

**Variantes :**

- Doublon probable : création bloquée ou confirmation renforcée.
- Patient ayant droit : rattachement CDI obligatoire.
- Patient sous-traitant : société active obligatoire.

**Données modifiées :** `Patient`, `IdentitePatient`, `ContactUrgence`, `AllergiePatient`, `AntecedentPatient`, `AlerteMedicale`, `HistoriqueCategoriePatient`.

**Règles critiques :** R-PAT-001 à R-PAT-025.

**Résultat attendu :** un dossier patient unique et exploitable existe.

**Statut :** Réalisé.

## WF-06 - Changement de catégorie patient

**Déclencheur :** changement administratif : CDD vers CDI, sous-traitant vers CDI, correction de catégorie.

**Acteurs :** agent RH, administrateur médical.

**Préconditions :**

- le patient existe ;
- la nouvelle catégorie existe ;
- le justificatif est connu hors système ou référencé dans la note.

**Déroulement nominal :**

1. L'utilisateur ouvre le dossier patient.
2. Il demande un changement de catégorie.
3. Il indique ancienne catégorie, nouvelle catégorie, date d'effet et motif.
4. Le système contrôle les droits de l'utilisateur.
5. Le système enregistre l'historique.
6. La catégorie active du patient est mise à jour.
7. Les prochains contrôles de droits utilisent la nouvelle catégorie.

**Variantes :**

- Changement refusé : l'ancienne catégorie reste active.
- Changement rétroactif : date d'effet obligatoire et audit renforcé.

**Données modifiées :** `Patient`, `HistoriqueCategoriePatient`, `JournalAudit`.

**Règles critiques :** R-PAT-026 à R-PAT-034.

**Résultat attendu :** les droits du patient reflètent sa catégorie actuelle.

**Statut :** Réalisé.

## WF-07 - Enregistrement d'un ayant droit CDI

**Déclencheur :** agent RH enregistre un conjoint ou enfant rattaché à un CDI.

**Acteurs :** agent RH.

**Préconditions :**

- le CDI de référence possède un dossier actif ;
- le CDI est actif ;
- la catégorie `AYANT_DROIT_CDI` existe.

**Déroulement nominal :**

1. L'agent RH recherche le CDI.
2. Il vérifie que le CDI est actif.
3. Il crée ou sélectionne le dossier de l'ayant droit.
4. Il saisit le type de lien familial.
5. Le système crée le rattachement.
6. Les droits de l'ayant droit deviennent dépendants du CDI.
7. L'action est auditée.

**Variantes :**

- CDI inactif : rattachement refusé.
- Limite d'ayants droit atteinte : demande bloquée ou soumise à validation selon paramètre.
- Divorce, majorité ou décision RH : rattachement suspendu (historisé).

**Données modifiées :** `RattachementAyantDroitCdi`, `HistoriqueRattachementAyantDroit`, `Patient`.

**Règles critiques :** R-ACT-020 à R-ACT-034.

**Résultat attendu :** l'ayant droit est connu et ses droits sont contrôlables.

**Statut :** Réalisé.

## WF-08 - Enregistrement d'un sous-traitant

**Déclencheur :** agent RH enregistre un employé d'une société prestataire.

**Acteurs :** agent RH.

**Préconditions :**

- la société existe et est active ;
- la catégorie `SOUS_TRAITANT` existe.

**Déroulement nominal :**

1. L'agent RH recherche la société.
2. Il vérifie son statut.
3. Il crée ou sélectionne le dossier patient.
4. Il rattache le patient à la société.
5. Le système applique les droits restreints.
6. L'historique de rattachement est enregistré.

**Variantes :**

- Société suspendue : rattachement refusé.
- Changement de prestataire : transfert vers une nouvelle société.
- Fin de mission : rattachement clôturé (historisé).

**Données modifiées :** `RattachementSousTraitant`, `HistoriqueRattachementSousTraitant`, `Patient`.

**Règles critiques :** R-ACT-035 à R-ACT-048.

**Résultat attendu :** le sous-traitant est pris en charge selon ses droits restreints.

**Statut :** Réalisé.

## WF-09 - Délégation de prescription

**Déclencheur :** le médecin chef autorise un infirmier à prescrire dans un cadre limité.

**Acteurs :** médecin chef.

**Préconditions :**

- l'infirmier possède un profil actif ;
- les médicaments de référence existent ;
- le médecin chef est habilité.

**Déroulement nominal :**

1. Le médecin chef ouvre le profil du personnel médical concerné.
2. Il crée une délégation.
3. Il définit le périmètre : durée, actes, médicaments autorisés.
4. Le système enregistre la délégation et les médicaments autorisés.
5. La prescription par l'infirmier devient possible dans ce périmètre.
6. Toute prescription déléguée garde l'identifiant de la délégation.

**Variantes :**

- Délégation expirée : prescription refusée.
- Médicament hors périmètre : non visible ou bloqué.
- Délégation suspendue : effet immédiat.

**Données modifiées :** `DelegationPrescription`, `DelegationMedicamentAutorise`, `PersonnelMedical`.

**Règles critiques :** R-ACT-010 à R-ACT-019, R-CON-030 à R-CON-041.

**Résultat attendu :** la délégation est traçable et sûre.

**Statut :** Réalisé.

## WF-10 - Ouverture d'une visite au triage

**Déclencheur :** arrivée d'un patient au CMS.

**Acteurs :** infirmier.

**Préconditions :**

- le patient existe ou peut être créé ;
- les droits de sa catégorie sont configurés.

**Déroulement nominal :**

1. L'infirmier recherche le patient (déduplication intégrée).
2. Il ouvre une nouvelle visite (acte atomique : pas de double ouverture).
3. Le système affiche catégorie, droits et alertes médicales.
4. L'infirmier saisit les constantes vitales et le motif.
5. Le système calcule l'IMC si taille et poids sont disponibles.
6. Le système signale automatiquement les constantes anormales (alertes auto).
7. L'infirmier oriente le patient vers le soignant.
8. La visite entre dans la file d'attente, affichée en temps réel et triée **par ordre d'arrivée**.

**Variantes :**

- Patient inconnu : création du dossier (WF-05).
- Droits suspendus : alerte visible.
- Hors ligne : visite stockée localement et rejouée à la reconnexion (WF-17/WF-18).

> **Note :** la notion de priorité a été retirée de l'interface ; la file est strictement par ordre d'arrivée. La colonne `priorite` a été **supprimée de la base** (migration `remove_priorite`).

**Données modifiées :** `Visite`, `VisiteEvenement`, `ConstanteVitale`, `PreSaisieMedicale`.

**Règles critiques :** R-TRI-001 à R-TRI-030.

**Résultat attendu :** le patient est officiellement entré dans le parcours de soins.

**Statut :** Réalisé.

## WF-11 - Consultation médicale standard

**Déclencheur :** patient sélectionné depuis la file d'attente.

**Acteurs :** médecin chef, infirmier délégué si autorisé.

**Préconditions :**

- une visite est active ;
- le patient possède un dossier ;
- le soignant est habilité.

**Déroulement nominal :**

1. Le soignant ouvre la consultation.
2. Le système affiche dossier, alertes et constantes.
3. Le soignant saisit l'examen clinique.
4. Il sélectionne ou saisit le diagnostic.
5. Il rédige la conclusion et choisit une décision médicale.
6. Il enregistre la consultation.
7. Selon la décision, un workflow spécialisé démarre (prescription, examen, suivi, évacuation, accident).

**Variantes :**

- Alerte critique : confirmation de lecture.
- Consultation déléguée : périmètre limité (WF-09).
- Consultation incomplète : clôture refusée.

**Données modifiées :** `Consultation`, `DiagnosticConsultation`.

**Règles critiques :** R-CON-001 à R-CON-020.

**Résultat attendu :** la décision médicale est tracée.

**Statut :** Réalisé.

## WF-12 - Prescription sécurisée (ordonnance)

**Déclencheur :** décision médicale `PRESCRIPTION`.

**Acteurs :** médecin chef, infirmier délégué.

**Préconditions :**

- consultation ouverte ;
- médicaments de référence disponibles ;
- allergies et grossesse connues si renseignées.

**Déroulement nominal :**

1. Le soignant crée une ordonnance.
2. Il recherche un médicament de référence.
3. Il saisit posologie, durée et instructions.
4. Le système vérifie automatiquement allergies, antécédents, grossesse et contre-indications.
5. Les lignes valides sont ajoutées.
6. L'ordonnance est validée.
7. Le système conserve l'ordonnance comme acte prescrit et permet la génération du document A4 imprimable (WF-26).

**Variantes :**

- Contre-indication absolue : ligne bloquée.
- Contre-indication relative : justification obligatoire.
- Infirmier délégué : médicaments filtrés selon la délégation.
- Ordonnance abandonnée : brouillon annulé.

**Données modifiées :** `Ordonnance`, `LigneOrdonnance`, `JournalAudit`.

**Règles critiques :** R-CON-021 à R-CON-045.

**Résultat attendu :** l'ordonnance est médicalement contrôlée, traçable et imprimable.

**Statut :** Réalisé.

## WF-13 - Bon d'examen et résultat

**Déclencheur :** décision médicale `EXAMEN_COMPLEMENTAIRE`.

**Acteurs :** médecin chef, personnel autorisé pour la saisie du résultat.

**Préconditions :**

- consultation ouverte ou clôturée avec décision d'examen ;
- type d'examen disponible.

**Déroulement nominal :**

1. Le médecin crée une demande d'examen (bon d'examen).
2. Il choisit le ou les types d'examen.
3. Il saisit l'indication clinique.
4. Il choisit éventuellement un établissement de référence.
5. La demande passe en attente de résultat ; le bon A4 peut être imprimé (WF-26).
6. Quand le résultat revient, il est saisi.
7. Le médecin peut compléter le diagnostic.
8. Le bon d'examen est rafraîchi en temps réel (LIVE).

**Variantes :**

- Examen non autorisé selon droits : alerte ou blocage.
- Résultat partiel : statut maintenu en attente partielle.
- Examen annulé : motif obligatoire.

**Données modifiées :** `BonExamen`, `LigneExamen`, `ResultatExamen`.

**Règles critiques :** R-CON-046 à R-CON-060.

**Résultat attendu :** les examens et résultats restent attachés au dossier.

**Statut :** Réalisé.

## WF-14 - Suivi chronique

**Déclencheur :** décision médicale `SUIVI_CHRONIQUE`.

**Acteurs :** médecin chef.

**Préconditions :**

- pathologie chronique disponible ;
- patient actif.

**Déroulement nominal :**

1. Le médecin choisit la pathologie chronique.
2. Il définit le protocole de suivi.
3. Il fixe les objectifs et la fréquence.
4. Les consultations futures peuvent être rattachées au suivi.
5. Le suivi est clôturé avec motif quand il se termine.

**Variantes :**

- Suivi déjà actif : rattachement à l'existant.
- Changement de protocole : historique dans les notes de consultation.

**Données modifiées :** `SuiviChronique`, `Consultation`.

**Règles critiques :** R-CON-061 à R-CON-068.

**Résultat attendu :** le patient bénéficie d'un suivi longitudinal.

**Statut :** Réalisé.

## WF-15 - Évacuation sanitaire

**Déclencheur :** décision médicale `EVACUATION`.

**Acteurs :** médecin chef.

**Préconditions :**

- consultation active ou juste clôturée ;
- motif d'évacuation disponible ;
- établissement de référence disponible si destination connue.

**Déroulement nominal :**

1. Le médecin crée la fiche d'évacuation.
2. Il saisit motif, urgence et destination.
3. Il complète les éléments cliniques transmis.
4. Il confirme la décision et peut imprimer la fiche A4 (WF-26).
5. Le suivi post-évacuation est ouvert.
6. Les informations de retour sont ajoutées quand disponibles.
7. L'évacuation est clôturée.

**Variantes :**

- Évacuation immédiate : signalement prioritaire.
- Refus patient : annulation avec motif.
- Retour d'information absent : relance interne.

**Données modifiées :** `Evacuation`, `SuiviEvacuation`.

**Règles critiques :** R-SOR-001 à R-SOR-025.

**Résultat attendu :** la sortie critique est documentée et suivie.

**Statut :** Réalisé.

## WF-16 - Accident de travail

**Déclencheur :** décision médicale `ACCIDENT_TRAVAIL`.

**Acteurs :** médecin chef, agent RH en lecture administrative limitée.

**Préconditions :**

- consultation active ou juste clôturée ;
- patient connu ;
- type d'accident disponible.

**Déroulement nominal :**

1. Le médecin crée la fiche AT.
2. Le système vérifie l'éligibilité.
3. Le médecin saisit circonstances, lieu, heure et témoins.
4. Il décrit les lésions.
5. Il indique gravité et arrêt éventuel.
6. Le suivi AT est alimenté jusqu'à reprise, consolidation ou rechute.
7. Le dossier AT est clôturé ; la fiche A4 peut être imprimée (WF-26).

**Variantes :**

- Patient non éligible : trace médicale possible, qualification administrative refusée.
- Rechute : nouvel événement rattaché au dossier AT.
- Donnée sensible : accès RH limité.

**Données modifiées :** `AccidentTravail`, `SuiviAccidentTravail`.

**Règles critiques :** R-SOR-026 à R-SOR-055.

**Résultat attendu :** l'AT est médicalement documenté et administrativement exploitable.

**Statut :** Réalisé.

## WF-17 - Travail hors ligne

**Déclencheur :** perte de réseau sur un site.

**Acteurs :** tous les utilisateurs actifs.

**Préconditions :**

- l'utilisateur est autorisé localement ;
- les données minimales sont disponibles localement (cache PWA Workbox).

**Déroulement nominal :**

1. Le système détecte la perte de connexion.
2. L'indicateur passe en mode hors ligne (chip dans l'en-tête).
3. Les utilisateurs continuent les actions autorisées.
4. Chaque mutation est enregistrée dans la file de rejeu IndexedDB (`apps/web/src/lib/sync.ts`, Dexie.js).
5. Les identifiants locaux évitent les collisions.
6. Les données sensibles restent chiffrées localement.

**Variantes :**

- Cache insuffisant : action refusée avec message clair.
- Session expirée hors ligne : reconnexion locale selon règle de sécurité.
- Appareil perdu : données illisibles sans authentification.

**Données modifiées :** `FileMutation`, `JournalSynchronisation`, tables métier concernées (rejeu différé).

**Règles critiques :** R-SYNC-001 à R-SYNC-030.

**Résultat attendu :** le CMS continue à fonctionner malgré la coupure.

**Statut :** Réalisé.

## WF-18 - Retour en ligne et synchronisation

**Déclencheur :** retour de la connexion réseau.

**Acteurs :** système, administrateur système en supervision.

**Préconditions :**

- une file locale peut contenir des mutations ;
- le serveur central est joignable.

**Déroulement nominal :**

1. Le système détecte le retour réseau (`useSyncEngine`).
2. Il bloque les doublons de synchronisation.
3. Il envoie les mutations dans l'ordre via la file de rejeu.
4. Il récupère les données distantes utiles.
5. Il détecte les conflits.
6. Il résout automatiquement les conflits simples.
7. Il place les conflits complexes en résolution manuelle.
8. Il indique la fin de synchronisation et diffuse l'événement `LIVE_SYNC`.

**Variantes :**

- Synchronisation interrompue : reprise au dernier point stable.
- Conflit patient ou consultation : résolution administrateur.
- File trop grande : alerte technique.

**Données modifiées :** `FileMutation`, `JournalSynchronisation`, `ConflitSynchronisation`, `ResolutionConflit`, `AlerteTechnique`, `PosteLocal`.

**Règles critiques :** R-SYNC-031 à R-SYNC-060.

**Résultat attendu :** les sites redeviennent cohérents sans perte de données.

**Statut :** Réalisé.

## WF-19 - Messagerie interne chiffrée

**Déclencheur :** un utilisateur veut communiquer avec un collègue ou un groupe.

**Acteurs :** tout utilisateur authentifié (cloisonnement par site).

**Préconditions :**

- l'utilisateur est connecté ;
- le ou les destinataires existent et appartiennent à un périmètre autorisé.

**Déroulement nominal :**

1. L'utilisateur ouvre la messagerie (interface split-panel : liste des conversations à gauche, fil à droite).
2. Il sélectionne ou crée une conversation 1-1 ou un groupe (capacité maximale 50 participants).
3. Il rédige un message et l'envoie (envoi optimiste, affichage immédiat).
4. Le contenu et les pièces jointes sont **chiffrés au repos en AES-256-GCM** côté serveur avant stockage.
5. Le destinataire reçoit le message en temps réel via le flux SSE et le badge de non-lus se met à jour.
6. L'utilisateur peut joindre des médias chiffrés (image, vidéo, audio, document, jusqu'à 16 Mo), enregistrer des notes vocales, citer/répondre, réagir par emoji.

**Variantes :**

- Pièce jointe : contrôle MIME, vérification des magic-bytes, neutralisation du nom de fichier ; image compressée, vidéo découpée via ffmpeg.wasm si nécessaire.
- Suppression à deux niveaux : « pour moi » (table `MessageMasque`, message toujours visible des autres) ou « pour tout le monde » (possible ≤ 15 minutes après l'envoi).
- Modification : possible ≤ 15 minutes après l'envoi.
- Tentative d'accès à une conversation d'un autre site : refusée (anti-IDOR).
- Dépassement du débit : limitation à 40 requêtes/minute/utilisateur (throttler).

**Données modifiées :** `Conversation`, `ConversationParticipant`, `Message`, `MessageMasque`, `MessagePieceJointe`.

**Règles critiques :** R-MSG-001 à R-MSG-030 (confidentialité, cloisonnement, intégrité des pièces jointes, fenêtre de modification/suppression).

**Résultat attendu :** échange interne sécurisé, chiffré au repos et cloisonné par site.

**Statut :** Réalisé.

## WF-20 - Réaction emoji et accusés de lecture

**Déclencheur :** un message est reçu ou un utilisateur réagit à un message.

**Acteurs :** participants à une conversation.

**Préconditions :**

- une conversation et un message existent ;
- les participants sont connectés (présence suivie).

**Déroulement nominal :**

1. À l'ouverture du fil par le destinataire, le message est **marqué comme lu instantanément** et l'accusé passe à l'état « lu » (✓✓ bleu) en temps réel chez l'expéditeur.
2. Les accusés suivent trois états : envoyé (✓), remis (✓✓ gris : destinataire en ligne ou `lastSeenAt` ≥ date de création), lu (✓✓ bleu).
3. La présence (en ligne / vu à) est calculée via le `PresenceService` (SSE + champ `Utilisateur.lastSeenAt`).
4. Un utilisateur réagit à une bulle avec un emoji (jeu Apple, sprite local, zéro CDN).
5. La réaction est enregistrée (toggle) et affichée sous forme de chip.
6. Le système **génère une notification de réaction** à destination de l'auteur du message (WF-21).
7. Les changements d'accusé et de réaction sont diffusés en temps réel (événements SSE `MESSAGE_STATUS`).

**Variantes :**

- Réaction déjà posée : un nouveau clic la retire (toggle).
- Conversation de groupe : l'option « Détails » affiche le détail des lectures par participant.
- Message supprimé pour tous : réactions et accusés associés deviennent caducs.

**Données modifiées :** `MessageReaction`, `Message` (statut de lecture), `Notification`, `NotificationLecture`, `Utilisateur` (`lastSeenAt`).

**Règles critiques :** R-MSG-031 à R-MSG-045 (accusés temps réel, notification de réaction, présence).

**Résultat attendu :** retour social immédiat (réactions) et traçabilité fine de la lecture des messages.

**Statut :** Réalisé.

## WF-21 - Notifications temps réel (SSE)

**Déclencheur :** un événement métier survient (nouveau message, réaction, mise à jour clinique, synchronisation, sauvegarde).

**Acteurs :** tout utilisateur connecté.

**Préconditions :**

- l'utilisateur dispose d'une session active ;
- un canal SSE est ouvert depuis le client.

**Déroulement nominal :**

1. Le backend émet un événement sur le flux SSE (stream) dédié à l'utilisateur.
2. Le client reçoit l'événement et **invalide les requêtes react-query** correspondantes (carte d'invalidations clinique + invalidations LIVE silencieuses).
3. Les notifications visibles (type MESSAGE, réaction, etc.) sont affichées avec un son UI (réglable).
4. L'utilisateur peut supprimer une notification au survol, en supprimer plusieurs ou tout effacer.
5. La suppression « pour moi » est portée par le champ `masque` de `NotificationLecture` (la notification reste disponible techniquement).

**Variantes :**

- Plusieurs onglets ouverts : un seul canal SSE propre est privilégié pour éviter la saturation du pool.
- Notification de type MESSAGE : émise sans le contenu du message (confidentialité).
- Reconnexion : le flux SSE est rétabli automatiquement.

**Données modifiées :** `Notification`, `NotificationLecture`.

**Règles critiques :** R-NOTIF-001 à R-NOTIF-020 (diffusion temps réel, confidentialité du contenu, suppression « pour moi »).

**Résultat attendu :** interface vivante et cohérente, mise à jour sans rechargement manuel.

**Statut :** Réalisé.

## WF-22 - Acceptation des conditions d'utilisation

**Déclencheur :** connexion d'un utilisateur n'ayant pas accepté la version courante des CGU.

**Acteurs :** tout utilisateur authentifié.

**Préconditions :**

- l'utilisateur est authentifié ;
- une version de charte est publiée (version courante : v1-2026.06, 7 sections).

**Déroulement nominal :**

1. Après authentification, le système vérifie si l'utilisateur a accepté la version courante des CGU.
2. Si ce n'est pas le cas, la porte bloquante `CguGate` s'affiche dans l'AppShell et empêche l'accès aux modules.
3. L'utilisateur consulte la charte (7 sections) puis accepte.
4. Le système enregistre l'acceptation (date + version) sur le profil utilisateur.
5. L'accès aux modules est débloqué.

**Variantes :**

- L'utilisateur peut relire les CGU à tout moment depuis les paramètres et depuis l'écran de connexion (`ConditionsModal`).
- Publication d'une nouvelle version : tous les utilisateurs doivent l'accepter de nouveau à la prochaine connexion.

**Données modifiées :** `Utilisateur` (date et version d'acceptation des CGU).

**Règles critiques :** R-CGU-001 à R-CGU-010 (porte bloquante, traçabilité de l'acceptation, versioning).

**Résultat attendu :** acceptation des CGU tracée et opposable, conditionnant l'accès.

**Statut :** Réalisé.

## WF-23 - Sauvegarde et restauration de configuration

**Déclencheur :** action manuelle de l'administrateur ou planification automatique quotidienne.

**Acteurs :** administrateur système.

**Préconditions :**

- l'utilisateur possède le droit de sauvegarde/restauration ;
- le module de synchronisation est accessible.

**Déroulement nominal :**

1. L'administrateur ouvre l'écran de synchronisation (3 zones : terrain hors ligne, sauvegardes de configuration, volumétrie).
2. Il déclenche une sauvegarde de configuration : le système sérialise la configuration réelle (`contenuJson`) dans un enregistrement de sauvegarde.
3. Une tâche planifiée (@nestjs/schedule, cron quotidien à 02h00) crée automatiquement une sauvegarde, avec une rétention de 30 entrées.
4. Pour restaurer, l'administrateur sélectionne une sauvegarde existante.
5. Le système applique une restauration **non destructive** de la configuration.
6. L'opération est diffusée en temps réel (`LIVE_SYNC`) et auditée.

**Variantes :**

- Rétention dépassée : les sauvegardes les plus anciennes sont purgées.
- Restauration : ne supprime pas les données métier existantes (non destructive).

**Données modifiées :** `SauvegardeSysteme`, tables de configuration concernées (restauration), `JournalAudit`.

**Règles critiques :** R-SAUV-001 à R-SAUV-015 (sauvegarde réelle, restauration non destructive, rétention, planification).

**Résultat attendu :** la configuration peut être sauvegardée, planifiée et restaurée sans perte de données.

**Statut :** Réalisé.

## WF-24 - Rotation et versioning de la clé de chiffrement

**Déclencheur :** rotation périodique ou compromission supposée de la clé de chiffrement de la messagerie.

**Acteurs :** administrateur système (exploitation).

**Préconditions :**

- les clés sont gérées via `MESSAGE_ENC_KEYS` (+ clé courante `CURRENT`), avec support d'un fichier externe (Vault-ready : `MESSAGE_ENC_KEYS_FILE`) ;
- les messages chiffrés sont préfixés par l'identifiant de version de clé (format `v2:keyId`, le format v1 hérité restant lisible).

**Déroulement nominal :**

1. L'administrateur ajoute une nouvelle clé au trousseau et la désigne comme clé courante.
2. Les nouveaux messages sont chiffrés avec la nouvelle clé (préfixe de version mis à jour).
3. Les anciens messages restent déchiffrables grâce à l'identifiant de version stocké avec chaque contenu.
4. Un outil de ré-encryption (endpoint `POST /synchronisation/messagerie/rechiffrer`) permet de re-chiffrer les contenus v1 vers v2 de façon non destructive.
5. L'opération est journalisée.

**Variantes :**

- Clé courante absente en production : avertissement au démarrage.
- Ré-encryption de masse : à exécuter au moment d'une rotation réelle (outil testé en rotation, exécution massive non encore lancée en exploitation).

**Données modifiées :** `Message`, `MessagePieceJointe` (contenus re-chiffrés), `JournalAudit`.

**Règles critiques :** R-SEC-040 à R-SEC-055 (versioning de clé, lisibilité rétro-compatible, ré-encryption non destructive).

**Résultat attendu :** la clé de chiffrement peut être renouvelée sans rendre les anciens messages illisibles.

**Statut :** Réalisé.

## WF-25 - Audit et journal d'authentification

**Déclencheur :** toute mutation sensible (création, modification, suppression) sur les modules cliniques et de configuration ; toute tentative d'authentification.

**Acteurs :** système (transparent pour l'utilisateur), administrateurs en consultation.

**Préconditions :**

- l'intercepteur d'audit global (`@Audit` + `AuditInterceptor` enregistré comme `APP_INTERCEPTOR`) est actif.

**Déroulement nominal :**

1. À chaque mutation marquée `@Audit` sur les controllers cliniques et de configuration, l'intercepteur enregistre l'action dans le journal d'audit persistant.
2. L'enregistrement capture l'auteur, l'action, la cible, l'adresse IP réelle, la géolocalisation et le statut (succès/échec).
3. Les tentatives de connexion (succès, échec, blocage) alimentent le journal d'authentification.
4. Les anomalies (échecs répétés, comportements suspects) génèrent des alertes.
5. Les administrateurs consultent ces journaux ; les actions des comptes administrateurs auto-audités sont exclues du bruit.

**Variantes :**

- IP derrière un proxy : résolue via la configuration de confiance (`TRUST_PROXY`).
- Action en échec : journalisée avec le statut correspondant.

**Données modifiées :** `JournalAudit`, `JournalAuthentification`, `AlerteAnomalie`.

**Règles critiques :** R-SEC-033 à R-SEC-039 (traçabilité persistante, capture IP + géo, séparation des journaux).

**Résultat attendu :** traçabilité complète et opposable des actions sensibles et des accès.

**Statut :** Réalisé.

## WF-26 - Génération de documents imprimables A4

**Déclencheur :** un acte médical ou administratif doit être imprimé ou archivé.

**Acteurs :** médecin chef, infirmier (selon l'acte), administrateur médical.

**Préconditions :**

- l'acte source existe (ordonnance, bon d'examen, évacuation, accident, suivi, dossier patient) ;
- le gabarit A4 est disponible.

**Déroulement nominal :**

1. L'utilisateur ouvre l'acte concerné.
2. Il demande l'aperçu du document.
3. Le système génère un document A4 selon un gabarit unifié (logo réel, fond « verre », rendu monochrome).
4. L'aperçu s'affiche dans la zone de droite, intégré à l'écran.
5. L'utilisateur imprime ou enregistre le document.

**Variantes :**

- Documents disponibles : ordonnance, bon d'examen, fiche d'évacuation, fiche d'accident de travail, fiche de suivi, synthèse de dossier patient.

**Données modifiées :** aucune (génération en lecture à partir des données existantes).

**Règles critiques :** R-DOC-001 à R-DOC-010 (gabarit unifié, fidélité des données, lisibilité).

**Résultat attendu :** documents médicaux et administratifs imprimables, homogènes et professionnels.

**Statut :** Réalisé.

## WF-27 - Fusion de dossiers patients

**Déclencheur :** détection d'un doublon de dossier patient.

**Acteurs :** administrateur médical.

**Préconditions :**

- deux dossiers patients distincts sont identifiés comme correspondant à la même personne ;
- l'utilisateur possède le droit de fusion.

**Déroulement nominal :**

1. L'administrateur identifie le dossier source et le dossier cible.
2. Il déclenche la fusion.
3. Le système consolide les données (identité, contacts, allergies, antécédents, alertes, visites, actes) vers le dossier conservé.
4. L'opération de fusion est tracée.
5. Les références sont mises à jour de façon cohérente.

**Variantes :**

- Conflit d'informations : arbitrage par l'administrateur.
- Fusion auditée : conservation de la trace de l'opération.

**Données modifiées :** `FusionDossierPatient`, `Patient`, tables rattachées du dossier, `JournalAudit`.

**Règles critiques :** R-PAT-051 à R-PAT-060 (intégrité, traçabilité de la fusion).

**Résultat attendu :** un dossier unique consolidé, sans perte d'historique.

**Statut :** Réalisé.

## WF-28 - Planning et présence du personnel (EXTENSION FUTURE)

> **Statut : extension future.** Les tables `PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel`, `HabilitationPersonnel` sont **présentes dans le schéma** mais ne sont **pas encore exposées** par une interface complète. Le workflow ci-dessous décrit la cible.

**Déclencheur :** planification hebdomadaire ou mensuelle.

**Acteurs :** administrateur médical, médecin chef.

**Déroulement cible :**

1. Préparer le planning inter-sites.
2. Affecter chaque membre du personnel à un site et une date.
3. Valider le planning.
4. Confirmer les présences réelles le jour même.
5. Signaler les absences.
6. Calculer les alertes de couverture (médecin chef indisponible, infirmier sans délégation sur site isolé).

**Données concernées :** `PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel`, `HabilitationPersonnel`.

**Règles critiques :** R-ACT-001 à R-ACT-019.

**Résultat cible :** chaque site connaît le personnel réellement disponible.

## WF-29 - Suivi de grossesse complet (EXTENSION FUTURE)

> **Statut : extension future.** Les tables `SuiviGrossesse` et `ConsultationPrenatale` existent dans le schéma ; le parcours complet de suivi prénatal (consultations programmées, alertes de risque dédiées) constitue une évolution prévue au-delà du MVP.

**Déclencheur :** décision médicale de suivi de grossesse.

**Acteurs :** médecin chef.

**Déroulement cible :**

1. Ouvrir le suivi de grossesse et saisir les informations initiales.
2. Créer l'alerte grossesse active.
3. Enregistrer les consultations prénatales.
4. Tenir compte de la grossesse dans les prescriptions (déjà actif via les contrôles d'ordonnance, WF-12).
5. Clôturer le suivi avec le devenir.

**Données concernées :** `SuiviGrossesse`, `ConsultationPrenatale`, `AlerteMedicale`.

**Règles critiques :** R-PAT-035 à R-PAT-050.

**Résultat cible :** grossesse suivie de bout en bout et visible dans les actes médicaux.

## 5. Note sur la qualité et les tests

L'application est validée par vérification de typage (`tsc`), build de production et plusieurs scénarios de tests E2E manuels en navigateur (notamment messagerie, chiffrement, accusés de lecture, CGU, sauvegarde/restauration, rotation de clé en rotation simple).

Une **suite de tests automatisés étendue** (tests unitaires/intégration systématiques, E2E automatisés) n'est pas en place à ce jour : elle constitue une **limite assumée** et une **extension future**, au même titre que la gestion des stocks, la délivrance physique des médicaments, le réapprovisionnement, la transmission CNSS, le reporting directionnel agrégé, le planning/présence du personnel et l'internationalisation multilingue.
