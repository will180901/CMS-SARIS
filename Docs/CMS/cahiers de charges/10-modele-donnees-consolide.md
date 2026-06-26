# Document 10 - Modèle de Données Consolidé (état réalisé / as-built)

## 1. Objectif

Décrire le modèle de données **réellement implémenté** dans CMS SARIS, tel qu'il
existe dans le schéma Prisma de production. Ce document fait foi pour la
soutenance : il reflète l'état *as-built* de la base de données, et non une
simple cible théorique.

Le modèle compte **79 tables** (modèles Prisma), couvrant les 8 modules MVP, les
modules transversaux ajoutés (messagerie interne chiffrée, notifications temps
réel, suivi des CGU) et la couche de synchronisation offline-first.

> Source de vérité : `packages/db/prisma/schema.prisma` — 79 modèles, 22 migrations
> appliquées. PostgreSQL 16, accès via Prisma 6 (ORM) sous NestJS 11.

## 2. Conventions

- Les modèles sont nommés en `PascalCase` côté Prisma ; les tables physiques
  PostgreSQL générées suivent la même casse (pas de `@@map` dans le schéma).
- Chaque table métier possède un identifiant stable `id` de type `String` en
  `uuid` (`@default(uuid())`).
- Les entités sensibles conservent des champs de traçabilité : `createdAt`,
  `updatedAt`, `createdBy`, `updatedBy` selon les besoins.
- Les suppressions physiques sont évitées pour les données médicales :
  suppression logique par champ `statut`, suppression « soft » par `deletedAt`
  (messagerie), ou suppression *hard delete* protégée 409 quand des références
  bloquantes existent (référentiels et configuration).
- Les statuts sont explicites, souvent typés par `enum` Prisma
  (`StatutCompte`, `StatutPatient`, `StatutVisite`, `StatutConsultation`,
  `ModeOverridePermission`, `TypeEvenementVisite`).
- Les anciennes valeurs importantes sont historisées dans des tables dédiées
  (`Historique*`, `VisiteEvenement`, `JournalAudit`).

## 3. Vue d'ensemble par domaine

Le modèle est organisé en **dix domaines** fonctionnels. Le tableau suivant
donne le décompte officiel des tables.

| # | Domaine | Tables | Réalisé |
|---|---------|:------:|:------:|
| 1 | Sécurité, Administration et Audit | 15 | Oui |
| 2 | Notifications temps réel | 2 | Oui |
| 3 | Référentiels et Droits | 10 | Oui |
| 4 | Acteurs Administratifs | 11 | Oui (partiel, voir §4.4) |
| 5 | Dossier Patient | 11 | Oui |
| 6 | Accueil et Triage | 3 | Oui |
| 7 | Consultation et Actes Prescrits | 8 | Oui |
| 8 | Sorties Critiques | 4 | Oui |
| 9 | Synchronisation et Technique | 8 | Oui |
| 10 | Messagerie interne chiffrée | 6 | Oui |
| | **Total** | **78** | |

## 4. Entités par domaine

### 4.1 Sécurité, Administration et Audit (15 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Utilisateur` | Compte applicatif : login, e-mail, `passwordHash` (bcrypt 12 rounds), `statut` (`ACTIF`/`DESACTIVE`/`BLOQUE`), gestion des tentatives d'échec et du blocage temporaire, rattachement à un `Site` et éventuellement à un `PersonnelMedical`, `lastSeenAt` (présence messagerie). |
| `PreferenceUtilisateur` | Réglages personnels 1-1 (thème, densité, langue, page d'accueil, pagination, notifications) ; trace l'acceptation des CGU via `cguAccepteeLe` + `cguVersion`. |
| `Role` | Rôle métier (`code` unique) — 6 rôles : ADMIN_SYSTEME, ADMIN_MEDICAL, MEDECIN_CHEF, INFIRMIER, INFIRMIER_DELEGUE, AGENT_RH. |
| `Permission` | Permission atomique (`code` unique, `module`) — catalogue de 110 permissions. |
| `RolePermission` | Table d'association rôle ↔ permission. |
| `UtilisateurRole` | Table d'association utilisateur ↔ rôle (multi-rôles). |
| `UtilisateurPermission` | Dérogation par utilisateur : `mode` `GRANT`/`REVOKE`, avec motif et auteur. Permissions effectives = (rôles ∪ GRANTs) − REVOKEs. |
| `SessionUtilisateur` | Sessions JWT/refresh : `refreshTokenHash`, IP, user-agent, expiration, révocation. |
| `ConfigurationTotp` | Double authentification : `secretChiffre` (AES-256-GCM), activation. |
| `CodeSecoursTotp` | Codes de secours TOTP hachés, marqués à usage unique. |
| `JournalAudit` | Audit persistant des mutations (action, module, entité, `avantJson`/`apresJson`, IP, statut) — alimenté par un intercepteur global `@Audit`. |
| `JournalAuthentification` | Journal des tentatives de connexion (login, résultat, IP, user-agent). |
| `AlerteAnomalie` | Anomalies de sécurité/audit détectées, avec cycle d'investigation. |
| `ParametreSysteme` | Paramètres techniques clé/valeur du système. |
| `SauvegardeSysteme` | Sauvegardes : `perimetre` (`CONFIGURATION`), `contenuJson` (snapshot réel restaurable), taille, statut — alimenté par le cron quotidien. |

### 4.2 Notifications temps réel (2 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Notification` | Notification individuelle (`destinataireId`) ou diffusion (par `siteId` + `requiredPermission`) ; type, niveau, titre, message, entité liée et lien de navigation. |
| `NotificationLecture` | État « lu » par utilisateur (`readAt`) + champ `masque` (« supprimée pour moi »), unique par (notification, utilisateur). |

Le flux temps réel s'appuie sur SSE (server-sent events) avec invalidation
ciblée des caches react-query côté client.

### 4.3 Référentiels et Droits (10 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Site` | Site / centre médical (code, libellé, localisation, statut). |
| `CategoriePatient` | Catégorie de patient (CDI, ayant droit, sous-traitant…). |
| `DroitCategoriePatient` | Droits de prise en charge par catégorie : type de prestation, couverture, plafond de consultations, période. |
| `MotifConsultation` | Motifs de consultation (utilisés au triage). |
| `PathologieReference` | Référentiel de pathologies, indicateur `chronique`. |
| `MedicamentReference` | Référentiel médicamenteux (générique, commercial, famille thérapeutique). |
| `ContreIndicationMedicament` | Contre-indications par médicament (condition, type, gravité) — exploitées au contrôle d'ordonnance. |
| `TypeExamen` | Types d'examen complémentaire (code, libellé, domaine). |
| `EtablissementReference` | Établissements de référence pour les évacuations. |
| `SocieteSousTraitante` | Sociétés sous-traitantes (rattachement des ayants droit ST). |

CRUD **complet** sur tous ces référentiels, suppression *hard delete* protégée
409 si références bloquantes, propagation temps réel (`LIVE_REFERENTIELS`).

### 4.4 Acteurs Administratifs (11 tables)

| Modèle | Rôle fonctionnel | État |
|--------|------------------|------|
| `PersonnelMedical` | Personnel soignant/administratif (nom, matricule, rôle, site). | Réalisé |
| `HabilitationPersonnel` | Habilitations du personnel (type, période, statut). | Réalisé |
| `DelegationPrescription` | Délégation de prescription médecin chef → infirmier (période, périmètre, statut). | Réalisé |
| `DelegationMedicamentAutorise` | Médicaments autorisés dans le cadre d'une délégation. | Réalisé |
| `RattachementAyantDroitCdi` | Rattachement d'un ayant droit à un agent CDI (lien, période). | Réalisé |
| `HistoriqueRattachementAyantDroit` | Historique d'évènements du rattachement ayant droit. | Réalisé |
| `RattachementSousTraitant` | Rattachement d'un patient à une société sous-traitante. | Réalisé |
| `HistoriqueRattachementSousTraitant` | Historique d'évènements du rattachement ST. | Réalisé |
| `PlanningPermutation` | Planning / permutations du personnel. | Table présente, **non exposée** (extension) |
| `PresenceJournaliere` | Présence journalière du personnel. | Table présente, **non exposée** (extension) |
| `AbsencePersonnel` | Absences du personnel (date, motif). | Table présente, **non exposée** (extension) |

> Note : les tables de planning, présence et absence sont définies dans le schéma
> mais ne sont pas exposées par l'interface ; elles constituent une base pour une
> extension future « gestion RH du personnel ».

### 4.5 Dossier Patient (11 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Patient` | Dossier patient (numéro unique, site de création, catégorie, statut `ACTIF`/`ARCHIVE`/`DECEDE`/`FUSIONNE`, versionnement). |
| `IdentitePatient` | Identité 1-1 (nom, prénom, naissance, sexe, contacts, photo). |
| `ContactUrgence` | Contact d'urgence 1-1 (nom, téléphone, lien de parenté). |
| `AllergiePatient` | Allergies (substance, gravité, confirmation, statut). |
| `AntecedentPatient` | Antécédents médicaux (type, description, statut). |
| `AlerteMedicale` | Alertes médicales (type, message, gravité, résolution). |
| `HistoriqueCategoriePatient` | Historique des changements de catégorie (effet, motif). |
| `FusionDossierPatient` | Traçabilité de fusion de dossiers (source → cible). |
| `PreSaisieMedicale` | Pré-saisie médicale (contenu JSON, validation). |
| `SuiviGrossesse` | Suivi de grossesse (date prévue, devenir). *(socle ; suivi complet = extension)* |
| `ConsultationPrenatale` | Consultation prénatale rattachée à un suivi de grossesse. *(socle ; extension)* |

### 4.6 Accueil et Triage (3 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Visite` | Ouverture de visite : motif principal, statut (`EN_ATTENTE`/`EN_COURS`/`CLOTUREE`/`ANNULEE`), soignant orienté, notes d'accueil, type/motif de clôture, indicateur `creerHorsLigne`, versionnement. |
| `VisiteEvenement` | Journal d'audit interne de la visite (changement de statut/soignant/notes) via `enum TypeEvenementVisite`. |
| `ConstanteVitale` | Constantes au triage : température, tensions, FC, SpO2, poids, taille, IMC calculé, glycémie. |

> La file d'attente, l'orientation et la clôture sont gérées par les champs de
> `Visite` (pas de table dédiée). La notion de **priorité** a été retirée de
> l'interface (file par ordre d'arrivée) ; les valeurs `enum`/colonnes
> historiques sont conservées en base mais non réintroduites côté UI.

### 4.7 Consultation et Actes Prescrits (8 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Consultation` | Acte clinique : examen, conclusion, décision médicale, statut (`OUVERTE`/`CLOTUREE`/`ANNULEE`), délégation éventuelle, verrou souple (`pickedUpById`). |
| `DiagnosticConsultation` | Diagnostic rattaché à une pathologie de référence (type, certitude). |
| `Ordonnance` | Ordonnance (prescripteur, délégation, statut, motif d'annulation). |
| `LigneOrdonnance` | Ligne d'ordonnance : médicament, posologie, durée, voie, instructions, justification. |
| `BonExamen` | Bon d'examen (indication clinique, établissement, statut). |
| `LigneExamen` | Type d'examen demandé sur un bon. |
| `ResultatExamen` | Résultat d'examen (laboratoire, contenu, interprétation, statut). |
| `SuiviChronique` | Suivi de pathologie chronique (fréquence, objectifs, clôture). |

> Les contrôles d'ordonnance (allergies, contre-indications, grossesse) sont
> appliqués applicativement à partir de `AllergiePatient`,
> `ContreIndicationMedicament` et `SuiviGrossesse` avant validation.

### 4.8 Sorties Critiques (4 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Evacuation` | Évacuation (1-1 avec consultation) : motif, niveau d'urgence, établissement, infos cliniques, statut. |
| `SuiviEvacuation` | Suivi de l'évacuation (notes, statut). |
| `AccidentTravail` | Accident du travail (1-1 avec consultation) : date, lieu, circonstances, lésions, gravité, témoins. |
| `SuiviAccidentTravail` | Suivi de l'AT (arrêts, réévaluation, séquelles, taux d'incapacité). |

### 4.9 Synchronisation et Technique (8 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `PosteLocal` | Poste local rattaché à un site (dernière synchronisation). |
| `FileMutation` | File de mutations offline : `mutationUuid` unique, module, entité, action, `payloadJson`, statut, ordre local, horodatages d'accusé serveur. |
| `JournalSynchronisation` | Journal de session de synchronisation (mutations, conflits). |
| `ConflitSynchronisation` | Conflit détecté (valeur locale vs serveur, type, statut). |
| `ResolutionConflit` | Résolution d'un conflit (choix, auteur, justification). |
| `AlerteTechnique` | Alertes techniques par site. |
| `ParametreMetier` | Paramètres métier clé/valeur. |
| `HistoriqueParametreMetier` | Historique des changements de paramètres métier. |

> Côté client, l'offline-first repose sur Dexie.js (IndexedDB) et
> vite-plugin-pwa (Workbox). La sauvegarde/restauration de configuration est
> **réelle** (snapshot `contenuJson`, restauration non destructive, cron
> quotidien à 02h00 via `@nestjs/schedule`, rétention 30 jours, `LIVE_SYNC`).

### 4.10 Messagerie interne chiffrée (6 tables)

| Modèle | Rôle fonctionnel |
|--------|------------------|
| `Conversation` | Conversation `DIRECT` ou `GROUPE` (titre, site, créateur). |
| `ConversationParticipant` | Participant (dernier message lu `lastReadAt`), unique par (conversation, utilisateur). |
| `Message` | Message : `contenuChiffre` (AES-256-GCM, jamais en clair), citation (`replyToId`), `editedAt`/`deletedAt`. |
| `MessageMasque` | « Supprimer pour moi » : masque un message pour un utilisateur précis. |
| `MessageReaction` | Réaction emoji (unique par message/utilisateur/emoji). |
| `MessagePieceJointe` | Pièce jointe chiffrée (nom, MIME, taille en clair, `contenuChiffre` base64 AES-256-GCM). |

> Fonctionnalités : 1-1 et groupes (cap 50), pièces jointes image/vidéo/audio/
> document (16 Mo), notes vocales, accusés de lecture à 3 états, présence,
> suppression à 2 niveaux (pour moi / pour tous ≤ 15 min), réactions, badge
> non-lus temps réel. Sécurité : chiffrement au repos avec rotation/versioning
> de clé (`v2:keyId`, `MESSAGE_ENC_KEYS` + fichier Vault-ready), rate-limit
> 40/min/utilisateur, anti-IDOR cross-site, contrôle magic-bytes + assainissement
> des noms de fichiers, cloisonnement par site.

## 5. Relations principales

- Un `Utilisateur` appartient à un `Site`, porte plusieurs `UtilisateurRole`,
  des `UtilisateurPermission` (dérogations), des `SessionUtilisateur`, une
  `ConfigurationTotp`, une `PreferenceUtilisateur`, et peut être lié 1-1 à un
  `PersonnelMedical`.
- Un `Role` agrège des `Permission` via `RolePermission`.
- Un `Patient` possède une `IdentitePatient` (1-1), un `ContactUrgence` (1-1),
  et plusieurs `AllergiePatient`, `AntecedentPatient`, `AlerteMedicale`,
  `HistoriqueCategoriePatient`, `Visite`.
- Une `Visite` est rattachée à un `Patient`, un `Site` et un
  `MotifConsultation` ; elle porte des `ConstanteVitale`, des `VisiteEvenement`
  et peut donner lieu à des `Consultation`.
- Une `Consultation` appartient à une `Visite`, à un `PersonnelMedical`
  (soignant), éventuellement à une `DelegationPrescription` ; elle porte
  `DiagnosticConsultation`, `Ordonnance`, `BonExamen`, `SuiviChronique`, et au
  plus une `Evacuation` (1-1) et un `AccidentTravail` (1-1).
- Une `Ordonnance` contient plusieurs `LigneOrdonnance`, chacune référençant un
  `MedicamentReference`.
- Un `BonExamen` contient plusieurs `LigneExamen` (→ `TypeExamen`) et reçoit des
  `ResultatExamen`.
- Une `DelegationPrescription` lie un médecin chef à un infirmier et limite les
  `MedicamentReference` via `DelegationMedicamentAutorise`.
- Une `Notification` est lue/masquée par utilisateur via `NotificationLecture`.
- Une `Conversation` regroupe des `ConversationParticipant` et des `Message` ;
  un `Message` porte des `MessagePieceJointe`, `MessageReaction`, `MessageMasque`
  et peut citer un autre `Message` (`replyToId`).
- Une `FileMutation` est rattachée à un `PosteLocal` et référence l'entité
  modifiée et le module source ; les `ConflitSynchronisation` sont rattachés à
  un `JournalSynchronisation` et résolus par `ResolutionConflit`.

## 6. Contraintes fortes

- Un `Patient` ne doit pas avoir deux dossiers actifs pour la même personne
  (dédoublonnage au triage, fusion tracée par `FusionDossierPatient`).
- Une `Visite` doit toujours être rattachée à un `Patient`.
- Une `Consultation` doit toujours être rattachée à une `Visite`.
- Une `Ordonnance` / `BonExamen` doit toujours être rattaché à une
  `Consultation`.
- Une `Evacuation` / `AccidentTravail` est en relation 1-1 avec une
  `Consultation` (`@unique`).
- Une mutation offline doit avoir un identifiant unique local
  (`FileMutation.mutationUuid @unique`).
- Une ligne d'ordonnance doit être contrôlée (allergies / contre-indications /
  grossesse) avant validation.
- Au plus une dérogation par (utilisateur, permission)
  (`UtilisateurPermission @@unique`).
- Au plus une réaction par (message, utilisateur, emoji)
  (`MessageReaction @@unique`).

## 7. États métier (enums et statuts)

Typés par `enum` Prisma ou champs `statut` documentés :

- `StatutCompte` : ACTIF, DESACTIVE, BLOQUE.
- `StatutPatient` : ACTIF, ARCHIVE, DECEDE, FUSIONNE.
- `StatutVisite` : EN_ATTENTE, EN_COURS, CLOTUREE, ANNULEE.
- `StatutConsultation` : OUVERTE, CLOTUREE, ANNULEE.
- `ModeOverridePermission` : GRANT, REVOKE.
- `TypeEvenementVisite` : STATUT_CHANGE, PRIORITE_CHANGE, SOIGNANT_CHANGE,
  NOTES_UPDATE.
- Statuts texte documentés : Ordonnance, BonExamen, ResultatExamen, Evacuation,
  AccidentTravail, SuiviChronique, SuiviGrossesse, FileMutation,
  ConflitSynchronisation, SauvegardeSysteme.

## 8. Dictionnaire détaillé par table

Le dictionnaire de données exhaustif (champ par champ : type, nullabilité,
contraintes, relations entrantes/sortantes, règles métier, sensibilité) est
maintenu dans le document **14 - Dictionnaire de Données**. La source faisant
foi reste `packages/db/prisma/schema.prisma`.

## 9. Périmètre exclu (extensions futures)

Aucune table n'est créée pour les fonctionnalités hors périmètre MVP suivantes ;
elles sont documentées comme extensions :

- gestion des stocks et mouvements de stock ;
- délivrance physique des médicaments et réapprovisionnement ;
- commandes fournisseurs ;
- transmission CNSS ;
- reporting / export centralisé et agrégé directionnel ;
- suivi de grossesse complet (le socle `SuiviGrossesse`/`ConsultationPrenatale`
  existe) ;
- gestion RH du personnel : planning / présence / absence (tables
  `PlanningPermutation`, `PresenceJournaliere`, `AbsencePersonnel` présentes mais
  non exposées) ;
- internationalisation multilingue ;
- suite de tests automatisés étendue.

## 10. Limites assumées

- Pas de suite de tests automatisés étendue : la validation repose sur la
  vérification de types (`tsc`), le build et des tests E2E navigateur manuels.
  C'est une limite reconnue, à présenter comme axe d'amélioration, non comme un
  acquis.
- Trois tables d'acteurs RH (planning/présence/absence) sont modélisées mais non
  exploitées par l'interface : socle volontaire pour une extension future.

## 11. Points de vigilance de conception

- Équilibre normalisation : éviter de trop fusionner (système fragile) ou de
  trop éclater (MVP lourd). Le découpage actuel privilégie un modèle logique
  clair et une implémentation physique pragmatique.
- Données sensibles : secrets TOTP, contenus de messagerie et pièces jointes sont
  chiffrés au repos (AES-256-GCM) ; les mots de passe sont hachés (bcrypt). Les
  journaux d'audit ne doivent jamais contenir de secrets en clair.
- Cohérence des chiffres de référence : **79 tables**, **22 migrations**, **110
  permissions**, **6 rôles** — toute évolution du schéma doit mettre à jour ces
  compteurs et le document 14.
