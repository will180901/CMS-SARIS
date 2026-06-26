# Document 03 - Référentiels et Droits

> **Statut de réalisation (as-built).** Le module Référentiels est **intégralement codé et opérationnel**. Il offre un **CRUD complet** (création, lecture, modification, désactivation, suppression définitive sécurisée) sur six familles de référentiels, avec des **permissions granulaires par entité et par action**, une **mise à jour temps réel** des écrans consommateurs et un **journal d'audit** sur toutes les mutations. Ce document décrit ce qui est réellement implémenté ; les éléments qui restent en extension future sont signalés explicitement.

## 1. Objectif

Centraliser les données stables du système — sites, catégories de patients, motifs de consultation, pathologies, médicaments et types d'examen — afin d'éviter les saisies libres incohérentes. Chaque liste déroulante métier de l'application (triage, consultation, prescription, bon d'examen) est alimentée par ces référentiels, ce qui garantit la cohérence et l'exploitabilité des données cliniques.

## 2. Acteurs concernés

- **Administrateur système** (`ADMIN_SYSTEME`) : accès complet à l'ensemble du catalogue de référentiels (création, modification, désactivation, suppression).
- **Administrateur médical** (`ADMIN_MEDICAL`) : gouvernance des référentiels cliniques (création de motifs, pathologies, médicaments).
- **Médecin chef** (`MEDECIN_CHEF`) : consultation des référentiels et création des motifs.
- **Infirmier** et **Infirmier délégué** : consultation des listes alimentant le triage et la consultation.
- **Agent RH** (`AGENT_RH`) : consultation des référentiels nécessaires aux rattachements (les sociétés sous-traitantes elles-mêmes sont gérées dans le module Acteurs administratifs — cf. document 04).

> La couverture exacte de chaque rôle est définie par la matrice de permissions (section 10) et reste entièrement reconfigurable depuis l'écran d'administration des rôles.

## 3. Données manipulées

### 3.1 Référentiels couverts par le CRUD applicatif (réalisés)

Le module expose le contrôleur REST `/referentiels` qui pilote six familles de données de référence :

| Référentiel | Endpoint racine | Champs principaux | Statuts |
|---|---|---|---|
| **Site** | `/referentiels/sites` | `code` (unique, ≤ 20), `libelle` (≤ 100), `localisation` (≤ 200) | `ACTIF` / `INACTIF` |
| **Motif de consultation** | `/referentiels/motifs` | `code` (unique, ≤ 30), `libelle` (≤ 100) | `ACTIF` / `INACTIF` |
| **Pathologie de référence** | `/referentiels/pathologies` | `code` (unique, ≤ 30), `libelle` (≤ 150), `chronique` (booléen) | `ACTIVE` / `INACTIVE` |
| **Médicament de référence** | `/referentiels/medicaments` | `nomGenerique` (≤ 150), `nomCommercial` (≤ 150), `familleThera` (≤ 100) | `ACTIF` / `INACTIF` |
| **Catégorie de patient** | `/referentiels/categories-patient` | `code` (unique, ≤ 30), `libelle` (≤ 100) | `ACTIVE` / `INACTIVE` |
| **Type d'examen** | `/referentiels/types-examen` | `code` (unique, ≤ 30), `libelle` (≤ 100), `domaine` (`BIOLOGIE` / `IMAGERIE` / `SPECIALISE`) | `ACTIF` / `INACTIF` |

> Le marquage `chronique` d'une pathologie alimente directement le module Suivi chronique (le suivi ne peut être ouvert que sur une pathologie marquée chronique).

### 3.2 Tables présentes au schéma mais gérées hors de ce module

Le schéma de données (79 tables au total) prévoit également des entités de référence rattachées à d'autres modules ou réservées à des extensions ultérieures :

- **Société sous-traitante** : table présente, gérée par le module **Acteurs administratifs** (`/personnel/sous-traitants`, document 04), pas par l'écran Référentiels.
- **Établissement de référence** : utilisé comme destination dans les **Sorties critiques** (évacuations, document 06).
- **Droit de catégorie patient**, **Contre-indication médicament** : tables présentes au schéma, **non encore exposées** par une interface CRUD dédiée — voir section 14 (extensions futures).
- **Paramètre métier** et **historique de paramètre** : la configuration système (sécurité, mot de passe, notifications, établissement) est gérée par l'écran **Paramètres** du module Administration (document 02), avec versionnage et restauration.

## 4. Processus principal (réalisé)

1. Un acteur habilité ouvre l'écran Référentiels (`ReferentielsPage`), organisé en onglets (Sites, Motifs, Pathologies, Médicaments, Catégories, Examens).
2. Il crée une entrée via un panneau latéral (`DrawerShell`) ou modifie une entrée existante.
3. À la création, le système contrôle l'**unicité du code** (réponse `409 Conflict` si le code existe déjà : « Code … déjà utilisé »).
4. Le système applique la **validation des champs** (obligatoires, longueurs maximales, énumérations) via les DTO `class-validator` côté API.
5. Dès l'enregistrement, l'entrée devient disponible dans tous les modules consommateurs, et tous les écrans concernés se **rafraîchissent en temps réel** (événement `LIVE_REFERENTIELS` diffusé par SSE, sans bruit ni notification visible).
6. Toute mutation (création, modification, changement de statut, suppression) est **auditée** automatiquement (module `referentiel`, entité `Référentiel`, IP, statut succès/erreur) dans le journal d'audit persistant.

## 5. Cas alternatifs (réalisés)

- **Désactivation plutôt que suppression.** Une entrée obsolète encore utile à l'historique se désactive (passage en `INACTIF` / `INACTIVE`) plutôt que d'être supprimée.
- **Suppression définitive sécurisée.** La suppression physique (`DELETE`) est possible, mais le système la **bloque (`409 Conflict`)** si l'entrée est référencée par des données existantes (violation de contrainte de clé étrangère Prisma `P2003` / `P2014`). Le message invite alors l'opérateur à désactiver l'entrée à la place : « Suppression impossible : … est référencé(e) par des données existantes. Désactivez-le plutôt. »
- **Code déjà utilisé.** Une tentative de création avec un code existant échoue proprement en `409 Conflict` sans corrompre l'existant.
- **Anciens dossiers préservés.** Une entrée désactivée reste lisible dans les dossiers historiques ; elle n'apparaît simplement plus dans les listes proposées pour les nouvelles opérations (filtre `statut`).

## 6. Règles métier (réalisées)

- Les listes déroulantes métier (motif de visite, motif de consultation, pathologie de diagnostic, médicament prescrit, type d'examen, catégorie de patient) sont **toujours alimentées par un référentiel**, jamais par saisie libre.
- Les catégories de patients sont gérées **dans ce module**, pas en dur dans le code.
- Un médicament de référence sert aux prescriptions (ordonnances) **sans suivi de stock** : la gestion des stocks et la délivrance physique restent **hors périmètre** (cf. section 14).
- Une pathologie peut être marquée `chronique`, ce qui conditionne l'ouverture d'un suivi chronique sur cette pathologie.
- Un type d'examen porte un `domaine` (`BIOLOGIE`, `IMAGERIE`, `SPECIALISE`) exploité par le module Bon d'examen.
- La **séparation modification / changement de statut** est appliquée au niveau API : le champ `statut` est retiré des DTO de modification ; il ne peut être changé que via la route dédiée `…/:id/statut`, protégée par la permission `…delete`. Cela empêche un utilisateur disposant uniquement du droit de modification de désactiver une entrée par un PATCH classique.

## 7. États et statuts (réalisés)

Les entités de référentiel utilisent un statut binaire actif/inactif, sous deux orthographes selon l'entité :

- **Sites, motifs, médicaments, types d'examen** : `ACTIF` / `INACTIF`.
- **Pathologies, catégories de patients** : `ACTIVE` / `INACTIVE`.

Le service normalise automatiquement la valeur reçue vers la bonne forme attendue par chaque entité ; l'API accepte les quatre valeurs en entrée pour la robustesse.

> Les statuts `SUSPENDU` / `ARCHIVE` et le cycle de vie des sociétés sous-traitantes (`ACTIVE` / `SUSPENDUE` / `CLOTUREE`) relèvent du module Acteurs administratifs (document 04) et ne s'appliquent pas aux six référentiels de ce module.

## 8. Écrans attendus (réalisés)

Écran unique `ReferentielsPage` organisé en onglets, chacun avec liste, recherche, filtre par statut, pagination, panneau de création/édition et confirmation de suppression :

- **Sites** (`SitesTab`).
- **Catégories de patients** (`CategoriesTab`).
- **Pathologies** (`PathologiesTab`) — avec badge « chronique ».
- **Médicaments de référence** (`MedicamentsTab`).
- **Types d'examen** (`ExamensTab`) — avec badge de domaine.
- **Motifs de consultation** (`MotifsTab`).

Composants transverses réutilisés : `TabToolbar` (recherche + filtre statut), `PaginationBar`, `DrawerShell` (panneau latéral d'édition), `ConfirmDialog` (confirmation de suppression), `StatutBadge`, `EmptyState`, `SkeletonRows`.

> Les écrans Contre-indications, Droits de catégorie, Motifs d'évacuation, Types d'accident de travail, Établissements de référence et Paramètres métier listés dans la spécification initiale ne sont **pas** rendus par ce module : ils relèvent d'autres documents (02, 04, 06) ou d'extensions futures (section 14).

## 9. Notifications et alertes (réalisées)

- **Rafraîchissement temps réel silencieux.** Toute mutation d'un référentiel déclenche un événement `LIVE_REFERENTIELS` diffusé par flux SSE ; les écrans consommateurs invalident leurs caches React Query et se rechargent automatiquement, sans cloche ni son ni toast (mécanisme `@LiveRefresh` / `broadcastLive`).
- **Audit persistant.** Chaque création, modification, changement de statut ou suppression est enregistrée dans le journal d'audit (utilisateur, action, module, entité, IP, statut, horodatage), consultable depuis l'écran Audit de l'administration.

## 10. Permissions (réalisées — granularité par entité et par action)

Le module n'utilise plus une permission unique « modifier les référentiels » : il applique **19 permissions distinctes** (1 lecture globale + 3 actions × 6 entités), ce qui permet d'accorder, par exemple, la création de motifs sans donner accès aux sites.

### 10.1 Catalogue des permissions du module

| Permission | Libellé |
|---|---|
| `referentiel.read` | Consulter les référentiels (lecture globale partagée) |
| `referentiel.site.create` / `.update` / `.delete` | Créer / Modifier / Désactiver ou supprimer un site |
| `referentiel.motif.create` / `.update` / `.delete` | Créer / Modifier / Désactiver ou supprimer un motif de consultation |
| `referentiel.pathologie.create` / `.update` / `.delete` | Créer / Modifier / Désactiver ou supprimer une pathologie |
| `referentiel.medicament.create` / `.update` / `.delete` | Créer / Modifier / Désactiver ou supprimer un médicament |
| `referentiel.categorie.create` / `.update` / `.delete` | Créer / Modifier / Désactiver ou supprimer une catégorie de patient |
| `referentiel.examen.create` / `.update` / `.delete` | Créer / Modifier / Désactiver ou supprimer un type d'examen |

> Convention : la permission `…delete` gouverne **à la fois** le changement de statut (`PATCH …/:id/statut`) **et** la suppression définitive (`DELETE …/:id`), tandis que `…update` ne couvre que la modification des champs métier (le statut en est volontairement exclu).

### 10.2 Affectation par rôle (matrice par défaut, reconfigurable)

| Action | Rôles disposant du droit par défaut |
|---|---|
| Lire les référentiels (`referentiel.read`) | Tous les profils habilités (admin système, admin médical, médecin chef, infirmiers, agent RH) |
| Gérer l'intégralité des référentiels (les 18 actions create/update/delete) | Administrateur système |
| Créer motifs, pathologies, médicaments | Administrateur médical, médecin chef |
| Créer des motifs de consultation | Infirmier délégué |

> La formule effective de calcul des droits est `(permissions des rôles ∪ dérogations GRANT) − dérogations REVOKE`, appliquée à chaque endpoint par le `PermissionsGuard`. Des dérogations individuelles (GRANT/REVOKE motivées et auditées) peuvent affiner ces droits par utilisateur depuis l'administration.

## 11. Dépendances (réalisées)

- **Triage** lit les sites, catégories de patients et motifs de consultation.
- **Consultation** lit les pathologies (diagnostics) et les motifs.
- **Prescription / Ordonnance** lit les médicaments de référence.
- **Bon d'examen** lit les types d'examen (et leur domaine).
- **Suivi chronique** dépend du marquage `chronique` des pathologies.
- **Dossier patient** lit les catégories de patients (et leur historique de changement).

> La gestion des contre-indications médicamenteuses par un moteur de prescription, et l'exploitation des droits de couverture par catégorie, ne sont pas encore branchées (extensions futures, section 14).

## 12. Critères d'acceptation (vérifiés)

- Une liste déroulante métier provient toujours d'un référentiel, jamais d'une saisie libre. ✅
- Une entrée inactive n'est plus proposée pour les nouvelles opérations (filtre par statut), mais reste lisible dans les anciens dossiers. ✅
- L'unicité du code est garantie à la création (`409 Conflict`). ✅
- La suppression d'une entrée référencée est bloquée (`409 Conflict`) et orientée vers la désactivation. ✅
- Toute mutation est auditée et déclenche un rafraîchissement temps réel des écrans consommateurs. ✅
- La séparation des droits modification / désactivation empêche un contournement par PATCH. ✅

## 13. Points de risque

- Un référentiel mal alimenté (codes manquants) prive les modules consommateurs de leurs listes : le seed initial fournit un jeu de base (sites, motifs, pathologies, médicaments, catégories, types d'examen).
- L'absence de saisie libre reste essentielle à l'exploitabilité statistique des données.
- La double orthographe de statut (`ACTIF/INACTIF` vs `ACTIVE/INACTIVE`) est masquée par la normalisation serveur, mais doit être respectée par tout nouveau consommateur d'API.

## 14. Hors périmètre et extensions futures

Conformément au périmètre du MVP, les éléments suivants ne sont **pas** réalisés et constituent des extensions ultérieures :

- **Gestion de stock et délivrance physique des médicaments** : le médicament de référence sert uniquement à la prescription ; aucun inventaire, mouvement ou dispensation n'est suivi.
- **Droits de couverture par catégorie de patient** : table prévue au schéma (`DroitCategoriePatient`), sans interface ni moteur d'application des droits de prise en charge.
- **Contre-indications médicamenteuses** : table prévue au schéma (`ContreIndicationMedicament`), sans moteur de vérification automatique à la prescription.
- **Référentiels secondaires** (motifs d'évacuation, types d'accident de travail, établissements de référence en tant que catalogue éditable) : pour l'instant saisis au fil de l'eau dans les modules Sorties critiques et Acteurs administratifs, sans écran de référentiel dédié.
- **Intégration aux organismes externes** (ex. CNSS) : hors périmètre.
