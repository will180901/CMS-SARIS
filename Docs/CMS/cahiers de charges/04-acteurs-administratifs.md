# Document 04 - Acteurs Administratifs

> **Statut de réalisation (as-built, juin 2026) : MODULE CODÉ ET OPÉRATIONNEL.**
> Le module « Acteurs administratifs » est intégralement implémenté côté API (NestJS) et côté Web (React 19) : personnel médical, délégations de prescription, sociétés sous-traitantes, et rattachements administratifs des patients (ayant-droit CDI / sous-traitant).
> Certaines briques évoquées dans la vision initiale (habilitations détaillées, planning inter-sites, pointage des présences, gestion des absences) sont **prévues au schéma de données mais non exposées par des endpoints ni des écrans** dans la version actuelle : elles relèvent des extensions futures (cf. §14). Le présent document distingue explicitement le **réalisé** de l'**extension future**.

## 1. Objectif

Gérer les personnes et rattachements administratifs qui influencent la prise en charge : personnel médical de l'établissement, délégations de prescription, ayants droit CDI et sociétés sous-traitantes.

Le module fournit le référentiel humain et contractuel exploité par le triage (qui peut prescrire, qui est rattaché à qui) et par la consultation (vérification des délégations de prescription).

## 2. Acteurs concernés

- **Administrateur médical** (`ADMIN_MEDICAL`) : gouvernance du personnel, des sous-traitants et des délégations.
- **Médecin chef** (`MEDECIN_CHEF`) : seul habilité à accorder, modifier, révoquer et supprimer une délégation de prescription.
- **Agent RH** (`AGENT_RH`) : gestion du personnel, des sociétés sous-traitantes et des rattachements administratifs des dossiers patients (ayants droit / sous-traitants).
- **Administrateur système** (`ADMIN_SYSTEME`) : super-administrateur disposant de l'intégralité du catalogue de permissions (accès complet, y compris les acteurs administratifs).
- **Infirmier / Infirmier délégué** : lecture du personnel et des délégations dans le cadre de leur activité.

> Les droits exacts par action sont détaillés au §10. Ils s'appuient sur le modèle de permissions granulaires de l'application (formule effective : `permissions des rôles ∪ dérogations GRANT − dérogations REVOKE`).

## 3. Données manipulées

### 3.1 Données réellement gérées par le module (CRUD complet)

- **Personnel médical** (`PersonnelMedical`) : matricule unique, nom, prénom, rôle métier, site de rattachement, statut.
- **Délégation de prescription** (`DelegationPrescription`) : médecin chef délégant, infirmier bénéficiaire, période de validité (date début / date fin), périmètre textuel, statut.
- **Médicament autorisé par délégation** (`DelegationMedicamentAutorise`) : liste des médicaments couverts par une délégation (relation N-N avec le référentiel médicaments).
- **Société sous-traitante** (`SocieteSousTraitante`) : nom unique, statut.
- **Rattachement ayant droit CDI** (`RattachementAyantDroitCdi`) : lien entre un patient ayant droit et l'assuré CDI de référence, type de lien de parenté, période.
- **Rattachement sous-traitant** (`RattachementSousTraitant`) : lien entre un patient et la société sous-traitante dont il dépend, période.
- **Historiques de rattachement** (`HistoriqueRattachementAyantDroit`, `HistoriqueRattachementSousTraitant`) : traçabilité des transitions d'état.

> Les rattachements (ayant droit CDI et sous-traitant) sont rattachés au **dossier patient** : ils sont créés et édités depuis l'écran du patient (module 04 « Dossier patient »), via les endpoints `POST/PATCH/DELETE /patients/:id/rattachements-ad` et `.../rattachements-st`. Ils sont toutefois fonctionnellement administratifs et donc décrits ici.

### 3.2 Données présentes au schéma mais non exposées dans cette version (extension future)

- **Habilitation** (`HabilitationPersonnel`) : habilitations techniques détaillées par agent.
- **Planning inter-sites** (`PlanningPermutation`) : calendrier et permutations.
- **Présence journalière** (`PresenceJournaliere`) : pointage quotidien.
- **Absence** (`AbsencePersonnel`) : congés et arrêts.

Ces tables existent dans le modèle relationnel mais ne disposent ni d'endpoints API ni d'écrans dans la version actuelle (cf. §14).

## 4. Processus principal (réalisé)

1. L'agent autorisé (RH ou administrateur médical) crée ou met à jour une fiche de **personnel médical**.
2. Le **médecin chef** accorde éventuellement une **délégation de prescription** à un infirmier, en définissant la période de validité, le périmètre et la liste des médicaments autorisés.
3. Les **rattachements administratifs** (ayants droit CDI, sous-traitants) sont créés depuis le dossier patient et historisés à chaque transition.
4. Le triage et la consultation lisent ces données : présence d'une délégation valide pour autoriser une prescription par un infirmier délégué, rattachement du patient pour déterminer son support administratif.
5. Les **sociétés sous-traitantes** sont gérées indépendamment (création, activation/désactivation), et servent de cible aux rattachements sous-traitants des patients.
6. Le changement de **statut** d'un acteur (désactivation d'un agent, d'une société, d'une délégation) impacte sa visibilité et son exploitabilité immédiate.

## 5. Cas alternatifs (réalisés)

- Un infirmier sans délégation active ne dispose pas de la permission de prescrire (les droits de prescription d'un `INFIRMIER_DELEGUE` reposent sur l'existence d'une délégation).
- Une délégation désactivée (statut `INACTIVE`) n'est plus exploitable.
- Une fiche de personnel, une délégation ou une société référencée par des données existantes ne peut pas être **supprimée définitivement** : la suppression est bloquée (HTTP 409) et l'utilisateur est invité à **désactiver** l'acteur plutôt qu'à le supprimer (préservation de l'intégrité référentielle).
- Une société sous-traitante désactivée reste consultable mais signalée comme inactive ; les rattachements existants conservent leur historique.
- Un matricule déjà attribué provoque un refus de création/mise à jour (conflit 409).

## 6. Règles métier (réalisées)

- **Le médecin chef est seul habilité à accorder, modifier, révoquer et supprimer une délégation** de prescription (permissions `delegation.*` attribuées à `MEDECIN_CHEF` et, en gouvernance, à `ADMIN_MEDICAL`).
- Une délégation définit une **période de validité** (date début / date fin) et un **périmètre** (texte libre + liste de médicaments autorisés).
- Le **matricule** du personnel médical est **unique** dans l'établissement.
- Le **nom** d'une société sous-traitante est **unique** (comparaison insensible à la casse).
- La désactivation d'un acteur (personnel, société, délégation) passe par un **endpoint dédié** protégé par une permission de niveau « delete/revoke », distincte de la simple permission de modification : un utilisateur ne disposant que du droit de mise à jour ne peut pas désactiver un acteur.
- Les changements de rattachement administratif sont **historisés** (tables d'historique dédiées).
- La **suppression définitive est non destructive par défaut** : elle échoue proprement si l'acteur est encore référencé, orientant vers la désactivation.

## 7. États et statuts (tels qu'implémentés)

> Les statuts ci-dessous reflètent les valeurs réellement validées par les DTO et persistées en base. La vision initiale prévoyait des états plus riches (ABSENT, SUSPENDU, TRANSFERE, EXPIREE…) qui relèvent des extensions futures (planning/présence/absence non codés).

**Personnel médical** (`PersonnelMedical.statut`) :

- `ACTIF`
- `INACTIF`

**Rôle métier du personnel** (`PersonnelMedical.role`) :

- `MEDECIN`
- `INFIRMIER`
- `SAGE_FEMME`
- `TECHNICIEN_LAB`
- `ADMINISTRATIF`

**Délégation de prescription** (`DelegationPrescription.statut`) :

- `ACTIVE`
- `INACTIVE`

**Société sous-traitante** (`SocieteSousTraitante.statut`) :

- `ACTIVE`
- `INACTIVE`

**Rattachement (ayant droit CDI / sous-traitant)** (`statut`) :

- `ACTIF`
- `INACTIF`

**Lien de parenté (rattachement ayant droit CDI)** (`typeLien`) :

- `CONJOINT`
- `ENFANT`
- `PARENT`
- `AUTRE`

## 8. Endpoints API (réalisés)

### 8.1 Personnel médical — `/personnel`

| Méthode | Route | Permission | Description |
|---|---|---|---|
| `GET` | `/personnel` | `personnel.read` | Liste filtrée (recherche nom/prénom/matricule, rôle, site, statut) |
| `GET` | `/personnel/:id` | `personnel.read` | Détail d'un agent |
| `POST` | `/personnel` | `personnel.create` | Création (matricule unique) |
| `PATCH` | `/personnel/:id` | `personnel.update` | Modification des champs métier |
| `PATCH` | `/personnel/:id/statut` | `personnel.delete` | Activer / désactiver (`ACTIF` / `INACTIF`) |
| `DELETE` | `/personnel/:id` | `personnel.delete` | Suppression définitive (409 si référencé) |

### 8.2 Délégations de prescription — `/delegations`

| Méthode | Route | Permission | Description |
|---|---|---|---|
| `GET` | `/delegations` | `delegation.read` | Liste (avec médecin chef, infirmier, médicaments autorisés) |
| `GET` | `/delegations/:id` | `delegation.read` | Détail d'une délégation |
| `POST` | `/delegations` | `delegation.create` | Création (médecin chef, infirmier, période, périmètre, médicaments) |
| `PATCH` | `/delegations/:id` | `delegation.update` | Modification (remplace intégralement la liste des médicaments si fournie) |
| `PATCH` | `/delegations/:id/statut` | `delegation.revoke` | Activer / révoquer (`ACTIVE` / `INACTIVE`) |
| `DELETE` | `/delegations/:id` | `delegation.delete` | Suppression définitive (retire d'abord les médicaments liés) |

### 8.3 Sociétés sous-traitantes — `/sous-traitants`

| Méthode | Route | Permission | Description |
|---|---|---|---|
| `GET` | `/sous-traitants` | `sous_traitant.read` | Liste filtrée (recherche nom, statut) |
| `GET` | `/sous-traitants/:id` | `sous_traitant.read` | Détail |
| `POST` | `/sous-traitants` | `sous_traitant.create` | Création (nom unique) |
| `PATCH` | `/sous-traitants/:id` | `sous_traitant.update` | Modification |
| `PATCH` | `/sous-traitants/:id/statut` | `sous_traitant.delete` | Activer / désactiver (`ACTIVE` / `INACTIVE`) |
| `DELETE` | `/sous-traitants/:id` | `sous_traitant.delete` | Suppression définitive (409 si référencé) |

### 8.4 Rattachements administratifs — exposés sous `/patients/:id` (dossier patient)

| Méthode | Route | Permission | Description |
|---|---|---|---|
| `POST` | `/patients/:id/rattachements-ad` | `patient.rattachement.manage` | Rattacher un ayant droit à un assuré CDI |
| `PATCH` | `/patients/:id/rattachements-ad/:rId` | `patient.rattachement.manage` | Modifier le rattachement ayant droit |
| `DELETE` | `/patients/:id/rattachements-ad/:rId` | `patient.rattachement.manage` | Supprimer le rattachement ayant droit |
| `POST` | `/patients/:id/rattachements-st` | `patient.rattachement.manage` | Rattacher un patient à une société sous-traitante |
| `PATCH` | `/patients/:id/rattachements-st/:rId` | `patient.rattachement.manage` | Modifier le rattachement sous-traitant |
| `DELETE` | `/patients/:id/rattachements-st/:rId` | `patient.rattachement.manage` | Supprimer le rattachement sous-traitant |

> **Sécurité transversale.** Tous les endpoints ci-dessus sont protégés par `JwtAuthGuard` (authentification JWT) puis `PermissionsGuard` (vérification de la permission requise). Toutes les mutations sont **auditées** (journal d'audit persistant : module, action, entité, IP, statut) et déclenchent une **invalidation temps réel** côté clients connectés (événement live `LIVE_ACTEURS` diffusé via SSE, rafraîchissement silencieux des listes).

## 9. Écrans réalisés

L'écran principal **« Acteurs administratifs »** (`ActeursPage`) est une page à onglets segmentés :

- **Personnel médical** (`PersonnelTab`) : liste, création, édition, activation/désactivation, suppression. Compteur d'agents actifs.
- **Délégations** (`DelegationsTab`) : liste des délégations avec médecin chef, infirmier et médicaments autorisés ; création, édition, révocation, suppression. Compteur de délégations actives.
- **Sous-traitants** (`SousTraitantsTab`) : liste des sociétés, création, édition, activation/désactivation, suppression. Compteur de sociétés actives.

> La visibilité de chaque onglet est conditionnée par la permission de lecture correspondante ; chaque action (créer / modifier / révoquer / supprimer) est gardée par sa permission backend dédiée. L'onglet par défaut est le premier auquel l'utilisateur a accès.

Les **rattachements (ayants droit CDI et sous-traitants)** se gèrent depuis l'**écran du dossier patient** (onglet rattachements), conformément au choix d'architecture qui rattache ces données au patient.

### Écrans relevant des extensions futures (non réalisés)

- Habilitations détaillées.
- Planning inter-sites.
- Présence du jour / pointage.
- Alertes de couverture médicale par site.

## 10. Permissions (catalogue réel)

Le module mobilise les permissions granulaires suivantes (extraites du catalogue applicatif) :

| Domaine | Permissions |
|---|---|
| Personnel | `personnel.read`, `personnel.create`, `personnel.update`, `personnel.delete` |
| Délégations | `delegation.read`, `delegation.create`, `delegation.update`, `delegation.revoke`, `delegation.delete` |
| Sous-traitants | `sous_traitant.read`, `sous_traitant.create`, `sous_traitant.update`, `sous_traitant.delete` |
| Rattachements | `patient.rattachement.manage` |

Attribution effective par rôle (telle qu'implémentée) :

| Action | Rôles autorisés |
|---|---|
| Gérer le personnel médical (CRUD + désactivation) | `ADMIN_MEDICAL`, `AGENT_RH`, `ADMIN_SYSTEME` |
| Consulter le personnel | `ADMIN_MEDICAL`, `AGENT_RH`, `MEDECIN_CHEF`, `ADMIN_SYSTEME` |
| Accorder / modifier / révoquer / supprimer une délégation | `MEDECIN_CHEF`, `ADMIN_MEDICAL`, `ADMIN_SYSTEME` |
| Consulter les délégations | `MEDECIN_CHEF`, `ADMIN_MEDICAL`, `INFIRMIER_DELEGUE`, `ADMIN_SYSTEME` |
| Gérer les sociétés sous-traitantes (CRUD + désactivation) | `ADMIN_MEDICAL`, `AGENT_RH`, `ADMIN_SYSTEME` |
| Consulter les sociétés sous-traitantes | `ADMIN_MEDICAL`, `AGENT_RH`, `MEDECIN_CHEF`, `ADMIN_SYSTEME` |
| Gérer les rattachements (ayants droit / sous-traitants) | `AGENT_RH`, `MEDECIN_CHEF`, `INFIRMIER`, `INFIRMIER_DELEGUE`, `ADMIN_MEDICAL`, `ADMIN_SYSTEME` |

> Le rôle `ADMIN_SYSTEME` est un super-administrateur qui dispose de l'intégralité du catalogue de permissions ; il couvre donc l'ensemble des actions ci-dessus. Des **dérogations individuelles** (GRANT / REVOKE, motivées et auditées) peuvent par ailleurs affiner les droits d'un utilisateur donné.

## 11. Dépendances

- **Triage** lit le personnel et les rattachements administratifs des patients pour la prise en charge.
- **Consultation** vérifie l'existence d'une délégation valide pour autoriser une prescription par un infirmier délégué.
- **Référentiels** fournissent les sites (rattachement du personnel) et les médicaments (médicaments autorisés par délégation).
- **Dossier patient** héberge les rattachements (ayant droit CDI / sous-traitant) et leur historique.
- **Notifications temps réel (SSE)** diffusent les invalidations `LIVE_ACTEURS` pour synchroniser les écrans ouverts sur plusieurs postes.
- **Audit** journalise toutes les mutations du module.

## 12. Critères d'acceptation (vérifiés)

- Un agent, une société ou une délégation référencé(e) par des données existantes ne peut être supprimé(e) définitivement : un message 409 invite à le désactiver.
- La désactivation d'un acteur exige une permission de niveau supérieur à la simple modification.
- Le matricule du personnel et le nom d'une société sont uniques ; toute collision est refusée.
- Une délégation peut être créée avec une période, un périmètre et une liste de médicaments autorisés, et révoquée par mise à jour de statut.
- Les rattachements administratifs sont créés depuis le dossier patient et historisés.
- Chaque écran et chaque action respecte sa permission dédiée (visibilité d'onglet et boutons conditionnés).

## 13. Points de risque

- Les rattachements RH peuvent être inexacts si les justificatifs ne sont pas contrôlés hors système (contrôle administratif externe).
- Les délégations doivent rester simples (médecin → infirmier, période, médicaments) pour éviter les erreurs médicales.
- L'absence des briques planning / présence / absence dans cette version implique que la **couverture médicale d'un site n'est pas calculée automatiquement** ; ce contrôle reste manuel (cf. §14).

## 14. Périmètre — réalisé vs extensions futures

| Brique | État | Précision |
|---|---|---|
| Personnel médical (CRUD, statut, recherche) | **Réalisé** | API `/personnel` + onglet Web |
| Délégations de prescription (CRUD, révocation, médicaments) | **Réalisé** | API `/delegations` + onglet Web |
| Sociétés sous-traitantes (CRUD, statut) | **Réalisé** | API `/sous-traitants` + onglet Web |
| Rattachements ayant droit CDI / sous-traitant + historiques | **Réalisé** | API sous `/patients/:id`, écran dossier patient |
| Habilitations techniques détaillées | **Extension future** | Table présente, non exposée |
| Planning inter-sites / permutations | **Extension future** | Table présente, non exposée |
| Pointage des présences journalières | **Extension future** | Table présente, non exposée |
| Gestion des absences / remplacements | **Extension future** | Table présente, non exposée |
| Alertes automatiques de couverture médicale | **Extension future** | Dépend du planning/présence |

> **Hors périmètre fonctionnel global du projet** (rappel, non spécifique à ce module) : gestion des stocks et de la délivrance physique des médicaments, interfaçage CNSS / tiers payant externes, paie et RH étendue.

## 15. Synthèse technique

- **Backend** : module NestJS `personnel` regroupant trois contrôleurs (`PersonnelController`, `DelegationsController`, `SousTraitantsController`) et un service `PersonnelService` ; persistance via Prisma (PostgreSQL). Rattachements gérés par le module `patient`.
- **Frontend** : module React `acteurs` (`ActeursPage` + onglets `PersonnelTab`, `DelegationsTab`, `SousTraitantsTab`), consommant l'API via hooks React Query.
- **Sécurité** : authentification JWT, permissions granulaires par endpoint, audit persistant des mutations, suppression non destructive (409 si référencé).
- **Temps réel** : diffusion d'événements `LIVE_ACTEURS` via flux SSE pour rafraîchissement silencieux multi-postes.
