# Document 08 - Sorties Critiques

> **Statut de réalisation : MODULE RÉALISÉ (as-built).**
> Le module *Sorties critiques* est **codé, opérationnel et intégré** dans l'application
> CMS SARIS. Il couvre les **évacuations médicales** (avec suivi), les **accidents du
> travail** (avec suivi), et s'appuie sur le **suivi chronique** issu du module
> Consultation/actes. Les fiches **A4 imprimables** (évacuation et accident du travail)
> sont disponibles avec le gabarit documentaire unifié de l'application.
>
> Ce document décrit l'objectif fonctionnel **et** l'état réel de l'implémentation.
> Les éléments restant hors périmètre du MVP (transmission externe automatisée,
> reporting centralisé agrégé) sont explicitement signalés comme **extensions futures**.

---

## 1. Objectif

Gérer les situations sensibles qui sortent du parcours de soins courant et qui exigent
une traçabilité renforcée :

- **Évacuation médicale** : orientation d'un patient vers un établissement de référence
  externe, avec transmission des informations cliniques et suivi du devenir.
- **Accident du travail (AT)** : déclaration, qualification médicale, description des
  lésions et suivi de l'évolution (arrêt, reprise, consolidation, séquelles).
- **Suivi chronique** : programme de suivi d'une pathologie chronique ouvert depuis une
  consultation (réalisé dans le module Consultation/actes, restitué ici comme sortie
  longue durée du parcours courant).

Chaque sortie critique est **rattachée à la consultation** qui l'a déclenchée, **cloisonnée
par site**, **auditée** et restituable sous forme de **fiche A4 imprimable**.

---

## 2. Acteurs concernés

| Acteur | Rôle vis-à-vis des sorties critiques |
|---|---|
| Médecin chef (`MEDECIN_CHEF`) | Décide l'évacuation, qualifie l'AT, met à jour le suivi, clôture les dossiers |
| Administrateur médical (`ADMIN_MEDICAL`) | Supervision, consultation, gestion selon dérogations de permissions |
| Infirmier (`INFIRMIER`) | Lecture et alimentation du suivi selon permissions accordées |
| Infirmier délégué (`INFIRMIER_DELEGUE`) | Idem infirmier, selon permissions et délégations |
| Agent RH (`AGENT_RH`) | Lecture du volet administratif des accidents du travail selon permissions |
| Administrateur système (`ADMIN_SYSTEME`) | Super-administrateur : accès complet au catalogue (110 permissions) |

> Les accès sont gouvernés par le **catalogue de 110 permissions** et le système de
> **rôles + dérogations** (GRANT/REVOKE par utilisateur). Voir les permissions du module
> à la section 11.

---

## 3. Données manipulées (modèle as-built)

Le module repose sur **4 tables Prisma** dédiées (groupe *Sorties critiques*), complétées
par la table `SuiviChronique` (groupe *Consultation/actes*). Les champs ci-dessous
correspondent au schéma réel (`packages/db/prisma/schema.prisma`).

### 3.1 `Evacuation`

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | Clé primaire |
| `consultationId` | string **unique** | Rattachement obligatoire à une consultation (1 évacuation par consultation) |
| `motifId` | string? | Motif d'évacuation (référentiel `MotifConsultation`) |
| `niveauUrgence` | string | `BASSE` / `MOYENNE` / `HAUTE` / `CRITIQUE` |
| `etablissementId` | string? | Établissement de destination (`EtablissementReference`) |
| `infosCliniques` | string? | Informations cliniques à transmettre (jusqu'à 5000 caractères) |
| `statut` | string | `EN_COURS` (défaut) → `CLOTURE` / `ANNULE` |
| `motifAnnulation` | string? | Justification en cas d'annulation |
| `createdAt` | datetime | Horodatage de création |

### 3.2 `SuiviEvacuation`

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | Clé primaire |
| `evacuationId` | string | Évacuation rattachée |
| `notes` | string | Note de suivi (jusqu'à 2000 caractères) |
| `statut` | string | Étape : `EN_COURS` / `EN_TRANSPORT` / `ADMIS` / `CLOTURE` |
| `createdAt` | datetime | Horodatage |
| `createdBy` | string? | Auteur du suivi |

### 3.3 `AccidentTravail`

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | Clé primaire |
| `consultationId` | string **unique** | Rattachement obligatoire à une consultation |
| `dateAccident` | datetime | Date de l'accident |
| `heureAccident` | string? | Heure « HH:MM » |
| `lieu` | string | Lieu de l'accident |
| `circonstances` | string | Circonstances détaillées (jusqu'à 5000 caractères) |
| `lesions` | string | Description des lésions (jusqu'à 2000 caractères) |
| `gravite` | string | `LEGER` / `MODERE` / `GRAVE` / `DECES` |
| `temoins` | string? | Témoins éventuels |
| `statut` | string | `OUVERT` (défaut) → `CLOTURE` / `ANNULE` |
| `motifAnnulation` | string? | Justification en cas d'annulation |
| `createdAt` | datetime | Horodatage de création |

### 3.4 `SuiviAccidentTravail`

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | Clé primaire |
| `accidentId` | string | Accident rattaché |
| `type` | string | `ARRET_TRAVAIL` / `REPRISE` / `CONSULTATION_CONTROLE` / `GUERISON` / `CONSOLIDATION` |
| `dateDebut` | datetime? | Début d'arrêt / d'épisode |
| `dateFin` | datetime? | Fin d'arrêt / reprise |
| `dateReevaluation` | datetime? | Prochaine réévaluation |
| `sequelles` | boolean? | Présence de séquelles |
| `descriptionSeq` | string? | Description des séquelles |
| `tauxIncapacite` | float? | Taux d'incapacité éventuel |
| `createdAt` | datetime | Horodatage |
| `createdBy` | string? | Auteur du suivi |

### 3.5 `SuiviChronique` (module Consultation/actes, restitué ici)

| Champ | Type | Notes |
|---|---|---|
| `id` | uuid | Clé primaire |
| `patientId` | string? | Patient suivi |
| `consultationId` | string? | Consultation d'ouverture |
| `pathologieId` | string | Pathologie chronique (`PathologieReference`) |
| `frequenceSuivi` | string? | Fréquence de suivi |
| `objectifs` | string? | Objectifs thérapeutiques |
| `statut` | string | `ACTIF` (défaut) → clôturé / annulé |
| `motifCloture` / `motifAnnulation` | string? | Justifications |
| `createdAt` / `closedAt` | datetime | Horodatages |

### 3.6 Données liées (référentiels et dossier)

- **Établissement de référence** (`EtablissementReference`) — destination d'évacuation.
- **Motif** (`MotifConsultation`) — motif d'évacuation.
- **Contact d'urgence** (`ContactUrgence`) — issu du dossier patient.
- **Pathologie de référence** (`PathologieReference`) — pour le suivi chronique.

---

## 4. Processus principal : évacuation (as-built)

1. Depuis une **consultation** ouverte, le médecin déclenche une évacuation.
2. Il sélectionne le **niveau d'urgence** (`BASSE`, `MOYENNE`, `HAUTE`, `CRITIQUE`).
3. Il choisit le **motif** et l'**établissement de destination** (référentiels).
4. Il saisit les **informations cliniques** à transmettre.
5. Le système crée l'évacuation au statut `EN_COURS` et l'**audite** automatiquement.
6. Le **suivi d'évacuation** est alimenté au fil de l'eau via des entrées horodatées :
   `EN_COURS` → `EN_TRANSPORT` → `ADMIS` → `CLOTURE`.
7. Le médecin **clôture** l'évacuation (statut `CLOTURE`) lorsque le devenir est connu.
8. À tout moment avant clôture, l'évacuation peut être **annulée** (statut `ANNULE`)
   avec motif obligatoire.
9. Une **fiche A4 imprimable** de l'évacuation est disponible (gabarit documentaire unifié).

> **Règle d'unicité (réalisée)** : une consultation porte au plus une évacuation
> (`consultationId` unique). Une évacuation active ou clôturée bloque la recréation.

---

## 5. Processus principal : accident de travail (as-built)

1. Depuis une **consultation**, le médecin déclare un accident du travail.
2. Il saisit **date**, **heure**, **lieu**, **circonstances**, **lésions**, **témoins**.
3. Il qualifie la **gravité** (`LEGER`, `MODERE`, `GRAVE`, `DECES`).
4. Le système crée la déclaration au statut `OUVERT` et l'**audite**.
5. Le **suivi médical** est alimenté par des entrées typées :
   `ARRET_TRAVAIL`, `REPRISE`, `CONSULTATION_CONTROLE`, `GUERISON`, `CONSOLIDATION`
   (avec dates, séquelles, taux d'incapacité éventuel).
6. Un suivi de type `GUERISON` ou `CONSOLIDATION` conduit à la **clôture** du dossier
   (statut `CLOTURE`).
7. Avant clôture, la déclaration peut être **annulée** (statut `ANNULE`) avec motif.
8. Une **fiche A4 imprimable** de l'accident du travail est disponible.

> **Règle d'unicité (réalisée)** : une consultation porte au plus une déclaration d'AT
> (`consultationId` unique).

---

## 6. Cas alternatifs et règles métier (as-built)

- **Annulation d'évacuation** : possible uniquement sur une évacuation `EN_COURS`,
  motif obligatoire.
- **Clôture d'évacuation** : possible uniquement sur une évacuation `EN_COURS`.
- **Annulation d'AT** : possible uniquement sur une déclaration `OUVERT`, motif obligatoire.
- **Clôture d'AT** : possible uniquement sur une déclaration `OUVERT`.
- **Rattachement obligatoire** : évacuation et AT exigent une consultation existante.
- **Cloisonnement par site** : toutes les requêtes sont filtrées par le site de
  l'utilisateur (anti-fuite inter-sites).
- **Traçabilité** : toute création/mise à jour/annulation/clôture/suppression est
  **journalisée** par l'intercepteur d'audit global (`@Audit`, IP + géolocalisation).
- **Suppression 409-safe** : la suppression d'une sortie critique respecte les
  contraintes d'intégrité (refus 409 si données liées non supprimables).

> **Note — notion de priorité retirée de l'UI** : conformément à la décision produit,
> la priorité n'est plus exposée dans l'interface (file par ordre d'arrivée au triage) ;
> le niveau d'urgence d'évacuation reste, lui, une donnée clinique pleinement gérée.

---

## 7. États et statuts (valeurs réelles)

**Évacuation** (`Evacuation.statut`)

- `EN_COURS` (défaut)
- `CLOTURE`
- `ANNULE`

**Étapes de suivi d'évacuation** (`SuiviEvacuation.statut`)

- `EN_COURS`
- `EN_TRANSPORT`
- `ADMIS`
- `CLOTURE`

**Niveau d'urgence d'évacuation** (`Evacuation.niveauUrgence`)

- `BASSE` · `MOYENNE` · `HAUTE` · `CRITIQUE`

**Accident du travail** (`AccidentTravail.statut`)

- `OUVERT` (défaut)
- `CLOTURE`
- `ANNULE`

**Gravité d'accident** (`AccidentTravail.gravite`)

- `LEGER` · `MODERE` · `GRAVE` · `DECES`

**Types de suivi d'accident** (`SuiviAccidentTravail.type`)

- `ARRET_TRAVAIL` · `REPRISE` · `CONSULTATION_CONTROLE` · `GUERISON` · `CONSOLIDATION`

**Suivi chronique** (`SuiviChronique.statut`)

- `ACTIF` (défaut) → clôturé / annulé

---

## 8. API REST (endpoints réalisés)

Module NestJS `sorties-critiques` (contrôleurs `EvacuationsController` et
`AccidentsTravailController`), protégé par `JwtAuthGuard` + `PermissionsGuard`,
audité via `@Audit`.

### 8.1 Évacuations — `/evacuations`

| Méthode | Route | Permission requise |
|---|---|---|
| `GET` | `/evacuations` | `evacuation.read` |
| `GET` | `/evacuations/:id` | `evacuation.read` |
| `POST` | `/evacuations` | `evacuation.create` |
| `PATCH` | `/evacuations/:id` | `evacuation.update` |
| `POST` | `/evacuations/:id/suivi` | `evacuation.update` |
| `PATCH` | `/evacuations/:id/annuler` | `evacuation.cancel` (+ `evacuation.update`) |
| `PATCH` | `/evacuations/:id/cloturer` | `evacuation.close` |
| `DELETE` | `/evacuations/:id` | `evacuation.delete` |

### 8.2 Accidents du travail — `/accidents-travail`

| Méthode | Route | Permission requise |
|---|---|---|
| `GET` | `/accidents-travail` | `accident_travail.read` |
| `GET` | `/accidents-travail/:id` | `accident_travail.read` |
| `POST` | `/accidents-travail` | `accident_travail.create` |
| `PATCH` | `/accidents-travail/:id` | `accident_travail.update` |
| `POST` | `/accidents-travail/:id/suivi` | `accident_travail.update` |
| `PATCH` | `/accidents-travail/:id/annuler` | `accident_travail.cancel` (+ `accident_travail.update`) |
| `PATCH` | `/accidents-travail/:id/cloturer` | `accident_travail.close` |
| `DELETE` | `/accidents-travail/:id` | `accident_travail.delete` |

---

## 9. Écrans réalisés (frontend)

Module web `sorties-critiques` (React 19 + TanStack Query) :

- **Page Sorties critiques** (`SortiesCritiquesPage.tsx`) — liste des cas critiques
  (évacuations et accidents du travail) avec filtres par statut.
- **Carte d'évacuation** (`EvacuationCard.tsx`) — synthèse, niveau d'urgence, statut.
- **Carte d'accident du travail** (`AccidentTravailCard.tsx`) — synthèse, gravité, statut.
- **Tiroir de détail** (`SortieDetailDrawer.tsx`) — détail complet d'une sortie + suivi.
- **Fiche A4 imprimable — Évacuation** (`EvacuationPrintModal.tsx`) — aperçu intégré et
  impression au gabarit documentaire unifié (logo réel, mise en page A4 monochrome).
- **Fiche A4 imprimable — Accident du travail** (`AccidentTravailPrintModal.tsx`) — idem.

> Les fiches A4 partagent le **gabarit documentaire unifié** de l'application
> (ordonnance, bon d'examen, évacuation, accident, suivi, synthèse dossier) :
> en-tête logo, traçabilité, rendu monochrome adapté à l'impression.

---

## 10. Notifications et temps réel

- **Notifications temps réel** : le flux **SSE** de l'application propage les
  invalidations react-query (carte d'invalidations clinique + `LIVE` silencieux),
  de sorte que les listes de sorties critiques se rafraîchissent automatiquement.
- **Audit** : toute action sensible (création, suivi, annulation, clôture, suppression)
  est tracée avec IP et géolocalisation.

> **Extension future** : alertes métier dédiées (ex. évacuation `CRITIQUE` en tête de
> tableau de bord, AT proche d'un délai de traitement, rechute déclarée) — non couvertes
> spécifiquement par le module en l'état ; relèvent du reporting / des alertes avancées.

---

## 11. Permissions (catalogue réel)

Le module dispose de **deux groupes de 6 permissions** dans le catalogue
(`packages/types/src/permissions.ts`), plus le suivi chronique :

**Évacuation**

| Permission | Code |
|---|---|
| Lire | `evacuation.read` |
| Créer | `evacuation.create` |
| Mettre à jour (dont suivi) | `evacuation.update` |
| Annuler | `evacuation.cancel` |
| Clôturer | `evacuation.close` |
| Supprimer | `evacuation.delete` |

**Accident du travail**

| Permission | Code |
|---|---|
| Lire | `accident_travail.read` |
| Créer | `accident_travail.create` |
| Mettre à jour (dont suivi) | `accident_travail.update` |
| Annuler | `accident_travail.cancel` |
| Clôturer | `accident_travail.close` |
| Supprimer | `accident_travail.delete` |

**Suivi chronique** (module Consultation/actes)

| Permission | Code |
|---|---|
| Lire | `suivi_chronique.read` |
| Créer | `suivi_chronique.create` |
| Mettre à jour | `suivi_chronique.update` |
| Clôturer | `suivi_chronique.close` |
| Annuler | `suivi_chronique.cancel` |
| Supprimer | `suivi_chronique.delete` |

> Ces permissions s'inscrivent dans le **catalogue global de 110 permissions** et le
> système de **6 rôles** + dérogations (GRANT/REVOKE par utilisateur).

---

## 12. Dépendances

- **Consultation/actes** : déclenche évacuation, AT et suivi chronique
  (rattachement par `consultationId`).
- **Dossier patient** : fournit identité, contact d'urgence et historique.
- **Référentiels** : fournit motifs, établissements de référence, pathologies.
- **Triage** : fournit le contexte initial de la visite.
- **Audit** : trace toutes les actions sensibles (intercepteur global).
- **Notifications / temps réel** : propage les rafraîchissements via SSE.
- **Documents imprimables** : gabarit A4 unifié pour les fiches.

---

## 13. Critères d'acceptation (vérifiés sur le code)

- Une évacuation et un AT ne peuvent être créés **que rattachés à une consultation**
  (`consultationId` requis et unique). ✔
- Le **niveau d'urgence** d'évacuation est borné aux valeurs `BASSE`/`MOYENNE`/`HAUTE`/`CRITIQUE`. ✔
- Un AT conserve **circonstances, lésions, gravité et suivi** complet. ✔
- Le **suivi d'AT** trace arrêt, reprise, contrôle, guérison et consolidation,
  avec séquelles et taux d'incapacité éventuels. ✔
- Les transitions de statut sont **contrôlées** (annulation/clôture uniquement sur
  l'état actif). ✔
- Les données sont **cloisonnées par site** et **auditées**. ✔
- Les fiches **A4 imprimables** d'évacuation et d'AT sont disponibles. ✔
- La transmission externe automatisée et le reporting centralisé **ne sont pas requis**
  pour valider le MVP (extensions futures). ✔

---

## 14. Points de risque et limites

- **Transmission externe (CNSS / établissements)** : la transmission automatisée vers des
  systèmes tiers n'est **pas** dans le périmètre actuel ; elle relève d'une discipline
  organisationnelle et constitue une **extension future**.
- **Reporting directionnel agrégé** : les alertes métier avancées et le reporting
  centralisé sont des **extensions futures**.
- **Sensibilité des données AT** : les informations d'accident du travail sont sensibles ;
  elles sont **cloisonnées par site** et protégées par permissions, mais leur diffusion
  externe doit rester encadrée.
- **Évacuation sans retour d'information** : si aucun suivi n'est renseigné, le dossier
  reste `EN_COURS` ; la complétude dépend de l'alimentation manuelle du suivi.
- **Tests automatisés** : il n'existe **pas** de suite de tests automatisés étendue sur ce
  module (validation par contrôles de type `tsc`, build, et essais manuels au navigateur) ;
  une couverture de tests automatisés est une **extension future**.

---

### Annexe — Extensions futures (hors périmètre MVP)

- Transmission automatisée CNSS / établissements de référence.
- Reporting directionnel agrégé et alertes métier avancées (urgence critique, délais AT,
  rechutes) au-delà du temps réel SSE actuel.
- Échange de pièces / documents structurés avec les destinataires d'évacuation.
- Suite de tests automatisés dédiée au module.
