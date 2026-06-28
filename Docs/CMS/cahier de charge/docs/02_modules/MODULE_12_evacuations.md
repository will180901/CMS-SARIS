# Module 12 — Sorties critiques & Évacuations

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » du module **Évacuations** (répertoire backend `sorties-critiques`).
> Faits issus de la lecture directe du code ; chiffres et décisions référencés par identifiant,
> jamais recopiés. Source de vérité : [[_SOURCE_systeme]] · décisions [[registre_decisions]] ·
> paramètres [[parametres_metier]] · modules [[plan_modules]] · entités [[modele_donnees_global]] ·
> termes [[glossaire]].
>
> **Chemins de code (vérité)** :
> - `apps/api/src/modules/sorties-critiques/sorties-critiques.controller.ts`
> - `apps/api/src/modules/sorties-critiques/sorties-critiques.service.ts`
> - `apps/api/src/modules/sorties-critiques/dto/evacuation.dto.ts`
> - `apps/api/src/modules/sorties-critiques/sorties-critiques.module.ts`
> - `apps/web/src/modules/sorties-critiques/` (page, hooks, API, composants, impression)

---

## 1. Mission et périmètre

### 1.1 Mission

Gérer le **cycle de vie d'une évacuation médicale** : un patient vu en consultation est orienté
vers une **structure de soins supérieure** (sortie critique). Le module assure le **déclenchement**
de l'évacuation depuis la décision de consultation, son **suivi par étapes** (transport, admission),
sa **clôture** et son **annulation**, avec un cloisonnement multi-site strict.

L'évacuation est l'une des **quatre décisions finales de consultation** retenues lors de l'alignement
sur le recueil ([[registre_decisions]] D-023) : `CLOTURE_SIMPLE`, `PRESCRIPTION`,
`EXAMEN_COMPLEMENTAIRE`, **`EVACUATION`**. Voir [[glossaire]] « Évacuation ».

### 1.2 Périmètre couvert (réel)

- Initiation d'une évacuation rattachée à **une** consultation (relation 1‑à‑1).
- Niveau d'urgence (BASSE / MOYENNE / HAUTE / CRITIQUE), informations cliniques, motif et
  établissement de destination optionnels.
- Suivi par **entrées datées** (notes + statut d'étape) : `EN_COURS`, `EN_TRANSPORT`, `ADMIS`, `CLOTURE`.
- Mise à jour, **clôture** (directe ou via une entrée de suivi `CLOTURE`), **annulation** (motif),
  **suppression** définitive.
- **Re-saisie** : ré-activation d'une évacuation antérieurement annulée pour la même consultation.
- Notification temps réel à l'initiation ([[plan_modules]] C-8).
- Page de **pilotage transversal** (liste, KPI, recherche, filtre par statut) et **impression A4**
  (composant `EvacuationPrintModal`).

### 1.3 Hors-périmètre (explicite)

- **« Sorties critiques » au sens large** : le libellé historique est retiré ; seul le flux
  **Évacuation** est conservé ([[registre_decisions]] D-023). Pas de gestion d'autres types de
  sortie (sortie administrative, décès, contre-avis médical… : *non implémentés*).
- **Accident du travail** : modèle Prisma `AccidentTravail` présent en base mais **dormant**, hors
  périmètre du recueil ([[registre_decisions]] D-023). Non couvert par ce module.
- **Référentiel des établissements de destination** : le module **consomme** `EtablissementReference`
  mais ne porte **pas** son CRUD (à confirmer : gestion via [[plan_modules]] module `referentiels`).
- **Transport / logistique réelle** (ambulance, accusé de réception de l'hôpital tiers) : non géré ;
  le suivi est purement déclaratif (notes saisies par le soignant).
- **Choix de la décision de consultation** lui-même : il relève du module `consultation`
  ([[plan_modules]] C-4) ; ce module reçoit la création de l'évacuation.

---

## 2. Acteurs et rôles

Rôles du système (4 — [[registre_decisions]] D-003, [[parametres_metier]] PM-46) :

| Acteur | Droits sur le module (permissions `evacuation.*`) | Source |
|--------|---------------------------------------------------|--------|
| **ADMIN_SYSTEME** | **Toutes** (`read, create, update, cancel, close, delete`) — super-admin, catalogue complet ([[registre_decisions]] D-004) | `permissions.ts` (`ALL_PERMISSIONS`) |
| **MEDECIN_CHEF** | **Toutes** (`read, create, update, cancel, close, delete`) | `permissions.ts` (bloc `MEDECIN_CHEF`) |
| **MEDECIN** | *(rôle absent du catalogue de droits — à confirmer, [[registre_decisions]] D-003)* | `permissions.ts` |
| **INFIRMIER** | **Aucune** permission `evacuation.*` n'est affectée par défaut | `permissions.ts` (bloc `INFIRMIER`) |

> Cohérence [[glossaire]] : « Évacuation … réservée au médecin-chef ». Vérifié dans le code :
> seuls `MEDECIN_CHEF` (et `ADMIN_SYSTEME`, super-admin) reçoivent les permissions d'évacuation ;
> l'infirmier ne les a pas. La granularité par action existe néanmoins au catalogue
> (`evacuation.cancel`, `evacuation.close`, `evacuation.delete` distinctes) et permet une
> ré-attribution fine par un administrateur.

**Catégories de patient** : sans incidence sur l'évacuation (contrairement aux bons d'examen /
pharmacie pilotés par catégorie, [[registre_decisions]] D-009). L'évacuation relève des **premiers
soins / orientation**, ouverts à toutes catégories.

---

## 3. Exigences fonctionnelles

> IDs **EF-12-xx**. Atomiques et vérifiables. Permissions et endpoints d'après
> `sorties-critiques.controller.ts`.

- **EF-12-01** — Le module expose la consultation de la **liste** des évacuations du site de
  l'utilisateur (`GET /evacuations`, permission `evacuation.read`).
- **EF-12-02** — Le module expose le **détail** d'une évacuation par identifiant
  (`GET /evacuations/:id`, `evacuation.read`).
- **EF-12-03** — La liste est **filtrable** par `consultationId`, `patientId` et `statut`
  (`EN_COURS` / `CLOTURE` / `ANNULE` / `TOUS`) — `EvacuationQueryDto`.
- **EF-12-04** — Un utilisateur habilité peut **initier** une évacuation rattachée à une consultation
  (`POST /evacuations`, `evacuation.create`), en fournissant `consultationId`, `niveauUrgence` et
  `infosCliniques` (obligatoires), `motifId` et `etablissementId` (optionnels).
- **EF-12-05** — `niveauUrgence` est contraint à l'ensemble **{BASSE, MOYENNE, HAUTE, CRITIQUE}**
  (`CreateEvacuationDto`).
- **EF-12-06** — `infosCliniques` est obligatoire, non vide, **≤ 5000 caractères** ; `motifId` et
  `etablissementId`, s'ils sont fournis, sont des **UUID** (`CreateEvacuationDto`).
- **EF-12-07** — À l'initiation, une **notification** temps réel `EVACUATION_INITIEE` est émise vers
  les porteurs de `evacuation.read` du site (cloche + SSE), de niveau **CRITIQUE** si l'urgence est
  CRITIQUE, **AVERTISSEMENT** sinon ([[plan_modules]] C-8).
- **EF-12-08** — Un utilisateur habilité peut **modifier** une évacuation active (`PATCH /evacuations/:id`,
  `evacuation.update`) : `niveauUrgence`, `etablissementId`, `infosCliniques` (`UpdateEvacuationDto`,
  tous optionnels).
- **EF-12-09** — Un utilisateur habilité peut **ajouter une entrée de suivi**
  (`POST /evacuations/:id/suivi`, `evacuation.update`) avec `notes` (≤ 2000 car., obligatoire) et
  `statut` ∈ {EN_COURS, EN_TRANSPORT, ADMIS, CLOTURE} (`AddSuiviEvacuationDto`).
- **EF-12-10** — Une entrée de suivi de statut **`CLOTURE`** **clôture automatiquement** l'évacuation
  (transition `statut → CLOTURE`).
- **EF-12-11** — Chaque entrée de suivi conserve son **auteur** (`createdBy`) et sa **date**
  (`createdAt`) ; le suivi est restitué **du plus récent au plus ancien**.
- **EF-12-12** — Un utilisateur habilité peut **clôturer directement** une évacuation
  (`PATCH /evacuations/:id/cloturer`, `evacuation.close`).
- **EF-12-13** — Un utilisateur habilité peut **annuler** une évacuation avec **motif obligatoire**
  (≤ 1000 car.) (`PATCH /evacuations/:id/annuler`, `evacuation.cancel` **et** `evacuation.update`).
- **EF-12-14** — Un utilisateur habilité peut **supprimer définitivement** une évacuation et ses
  suivis (`DELETE /evacuations/:id`, `evacuation.delete`).
- **EF-12-15** — Toutes les opérations sont **cloisonnées par site** : une évacuation dont la
  consultation appartient à un autre site est traitée comme **inexistante (404)**.
- **EF-12-16** — Toutes les **mutations** du module sont **auditées** (décorateur `@Audit('evacuation',
  'Évacuation')` sur le controller → `AuditInterceptor` global, [[plan_modules]] C-11,
  [[registre_decisions]] D-014).
- **EF-12-17** — Le frontend fournit une **page transversale** « Évacuations » (`/sorties-critiques`,
  menu protégé par `evacuation.read`) listant les évacuations avec **recherche patient**, **filtre
  par statut** et un **KPI « évacuations en cours »**.
- **EF-12-18** — Le frontend permet l'**impression A4** d'une évacuation (`EvacuationPrintModal`,
  gabarit SARIS — *à confirmer*).
- **EF-12-19** — Depuis la décision de consultation `EVACUATION`, la clôture de la consultation est
  **bloquée** tant qu'aucune évacuation active n'existe (le blocage tombe dès qu'une évacuation non
  `ANNULE` est rattachée) — règle portée côté `consultation` ([[plan_modules]] C-4).

---

## 4. Cas d'utilisation

> IDs **CU-12-xx**. Critères « Étant donné / Quand / Alors ». Comportement hors-ligne : le module
> est servi par le **backend embarqué** du desktop en mode local ([[registre_decisions]] D-001,
> D-020) ; les notifications SSE temps réel ne partent qu'en ligne (en local, propagation par la
> synchronisation, [[registre_decisions]] D-016).

### CU-12-01 — Initier une évacuation

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME).
- **Déclencheur** : en consultation, la décision retenue est `EVACUATION`.
- **Scénario nominal** :
  1. L'acteur saisit niveau d'urgence, informations cliniques, (option) motif et établissement.
  2. Le système vérifie que la consultation existe **et appartient au site** de l'acteur.
  3. Le système crée l'évacuation au statut `EN_COURS` et émet la notification `EVACUATION_INITIEE`.
- **Scénarios d'erreur** :
  - Consultation introuvable / hors site → **404**.
  - Une évacuation **active ou clôturée** existe déjà pour cette consultation → **409**
    (`existingEvacuationId` renvoyé) — cf. RM-12-02.
  - `niveauUrgence` invalide ou `infosCliniques` vide / > 5000 car. → **400**.
- **Hors-ligne** : création possible sur le backend local ; la notification SSE temps réel ne part
  qu'en ligne, l'évacuation se propage par synchronisation.
- **Critères** :
  - *Étant donné* une consultation du site sans évacuation, *quand* l'acteur initie une évacuation
    valide, *alors* elle est créée au statut `EN_COURS` et une notification est émise.
  - *Étant donné* une consultation d'un autre site, *quand* l'acteur tente l'initiation, *alors* le
    système répond 404.

### CU-12-02 — Suivre une évacuation (transport, admission)

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME).
- **Déclencheur** : évolution de la prise en charge (départ, arrivée à l'établissement).
- **Scénario nominal** :
  1. L'acteur ajoute une entrée de suivi (notes + statut `EN_TRANSPORT` ou `ADMIS`).
  2. Le système enregistre l'entrée datée et signée (auteur).
- **Scénarios d'erreur** :
  - Évacuation déjà `CLOTURE` ou `ANNULE` → **409**.
  - `notes` vide / > 2000 car. ou `statut` hors ensemble → **400**.
- **Critères** :
  - *Étant donné* une évacuation `EN_COURS`, *quand* l'acteur ajoute un suivi `ADMIS`, *alors* une
    entrée datée apparaît en tête de l'historique et l'évacuation reste `EN_COURS`.

### CU-12-03 — Clôturer une évacuation

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME).
- **Déclencheur** : la prise en charge à l'établissement de destination est confirmée.
- **Scénario nominal (deux voies)** :
  1. Clôture **directe** (`evacuation.close`) ; **ou**
  2. Ajout d'une entrée de suivi de statut `CLOTURE` (`evacuation.update`) qui clôture en cascade.
- **Scénarios d'erreur** : évacuation pas au statut `EN_COURS` → **409** (RM-12-04).
- **Critères** :
  - *Étant donné* une évacuation `EN_COURS`, *quand* l'acteur la clôture, *alors* son statut devient
    `CLOTURE` et elle n'est plus modifiable.

### CU-12-04 — Annuler une évacuation

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME).
- **Déclencheur** : déclenchement erroné ou abandon de l'orientation.
- **Scénario nominal** : l'acteur fournit un **motif** ; le statut passe à `ANNULE`, le motif est
  conservé.
- **Scénarios d'erreur** : évacuation pas au statut `EN_COURS` → **409** ; motif vide → **400**.
- **Critères** :
  - *Étant donné* une évacuation `EN_COURS`, *quand* l'acteur l'annule avec un motif, *alors* son
    statut devient `ANNULE` et le motif est affiché dans le détail.

### CU-12-05 — Re-saisir une évacuation après annulation

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME).
- **Déclencheur** : nécessité de ré-orienter le même patient pour la **même consultation** après une
  annulation.
- **Scénario nominal** : l'acteur ré-initie une évacuation pour cette consultation ; le système
  **réactive** l'enregistrement annulé (réinitialise les données, **purge l'ancien suivi**, remet
  `EN_COURS`, efface le motif d'annulation), dans une transaction.
- **Scénario d'erreur** : si une évacuation **active ou clôturée** existe (non annulée) → **409**.
- **Critères** :
  - *Étant donné* une évacuation `ANNULE` sur une consultation, *quand* l'acteur ré-initie, *alors*
    elle repasse `EN_COURS` avec les nouvelles données et un historique de suivi vide.

### CU-12-06 — Piloter / consulter les évacuations du centre

- **Acteur** : tout porteur de `evacuation.read` (MEDECIN_CHEF, ADMIN_SYSTEME).
- **Déclencheur** : suivi global depuis le menu « Évacuations ».
- **Scénario nominal** : l'acteur ouvre la page, voit le KPI « en cours », filtre par statut,
  recherche un patient, ouvre le détail (drawer) et, selon ses droits et le statut, clôture/annule
  ou ouvre la consultation d'origine ; il peut **imprimer** l'évacuation.
- **Scénarios d'erreur** : aucune évacuation → état vide ; filtre sans résultat → état vide filtré.
- **Critères** :
  - *Étant donné* des évacuations du site, *quand* l'acteur filtre sur `EN_COURS`, *alors* seules
    les évacuations en cours sont listées et le KPI reflète leur nombre.

### CU-12-07 — Supprimer définitivement une évacuation

- **Acteur** : porteur de `evacuation.delete` (MEDECIN_CHEF, ADMIN_SYSTEME).
- **Déclencheur** : nettoyage d'une saisie erronée.
- **Scénario nominal** : l'évacuation et **tous ses suivis** sont supprimés (transaction).
- **Scénario d'erreur** : évacuation hors site → **404**.
- **Critères** :
  - *Étant donné* une évacuation du site, *quand* l'acteur la supprime, *alors* elle et ses suivis
    disparaissent et l'opération renvoie `{ deleted: true }`.

---

## 5. Données du module

> Détail et relations dans [[modele_donnees_global]]. Entités **propres** ou centrales pour ce module
> (schéma `packages/db/prisma/schema.prisma`) :

- **`Evacuation`** — entité racine. Clés/colonnes notables :
  `consultationId` (**@unique** → relation 1‑à‑1 avec `Consultation`), `niveauUrgence`,
  `motifId?`, `etablissementId?` (→ `EtablissementReference`), `infosCliniques?`,
  `statut` (défaut `EN_COURS`), `motifAnnulation?`, `createdAt`, `updatedAt`, `deletedAt?`
  (soft-delete, [[registre_decisions]] D-015), index sur `updatedAt`.
- **`SuiviEvacuation`** — entrées de suivi (1‑à‑n depuis `Evacuation`) :
  `evacuationId`, `notes`, `statut`, `createdAt`, `createdBy?`.
- **`EtablissementReference`** (consommée, non possédée) — destination d'évacuation :
  `nom`, `type`, `localisation?`, `statut`. CRUD **hors module** (référentiels — à confirmer).
- **`Consultation`** (consommée) — origine de l'évacuation ; le module remonte patient/identité via
  `Consultation → Visite → Patient → IdentitePatient` pour l'affichage et le cloisonnement par
  `Visite.siteId`.

**Statuts d'évacuation (valeurs observées)** : `EN_COURS`, `CLOTURE`, `ANNULE`.
**Statuts d'étape de suivi** : `EN_COURS`, `EN_TRANSPORT`, `ADMIS`, `CLOTURE`. *(Stockés en chaînes,
pas d'enum Prisma dédié — à confirmer côté [[modele_donnees_global]].)*

---

## 6. Règles métier

> IDs **RM-12-xx**. Toute valeur chiffrée renvoie à [[parametres_metier]]. Source :
> `sorties-critiques.service.ts`.

- **RM-12-01** — **Unicité par consultation** : au plus une évacuation **vivante** par consultation
  (contrainte `@unique` sur `consultationId`).
- **RM-12-02** — **Blocage de recréation** : si une évacuation **active (`EN_COURS`) ou clôturée**
  existe pour la consultation, toute nouvelle initiation est refusée (**409**, `existingEvacuationId`
  renvoyé).
- **RM-12-03** — **Réactivation d'une annulée** : si l'unique évacuation de la consultation est
  `ANNULE` (ou un tombstone soft-deleté), l'initiation la **réactive** (reset des données + **purge
  du suivi** + `EN_COURS` + `motifAnnulation` effacé), au lieu d'en créer une seconde.
- **RM-12-04** — **Garde de transition d'annulation/clôture** : seules les évacuations **`EN_COURS`**
  peuvent être **annulées** ou **clôturées** (`PATCH .../annuler`, `.../cloturer`) ; sinon **409**.
- **RM-12-05** — **Garde de mutation** : une évacuation `CLOTURE` ou `ANNULE` ne peut plus être
  **modifiée** ni recevoir de **suivi** (→ **409**).
- **RM-12-06** — **Clôture en cascade par le suivi** : une entrée de suivi `CLOTURE` fait passer
  l'évacuation à `CLOTURE` (transaction unique avec la création de l'entrée).
- **RM-12-07** — **Cloisonnement multi-site** : l'accès est restreint aux évacuations dont la
  consultation d'origine appartient au site (JWT `siteId`) de l'appelant ; sinon **404** (anti-IDOR,
  [[registre_decisions]] D-007 pour le principe de scope). *Note : le scope est **par site**, pas par
  soignant initiateur (l'évacuation n'a pas de champ soignant propre).* 
- **RM-12-08** — **Niveau de notification** : la notification d'initiation est `CRITIQUE` si
  `niveauUrgence = CRITIQUE`, `AVERTISSEMENT` sinon (RM dérivée de PM — voir [[parametres_metier]]
  PM-40 « notifications de sorties critiques »).
- **RM-12-09** — **Traçabilité du suivi** : chaque entrée de suivi est horodatée (`createdAt`) et
  attribuée à son auteur (`createdBy`, identité de session) ; restitution **anté-chronologique**.
- **RM-12-10** — **Suppression complète** : la suppression d'une évacuation supprime aussi **ses
  suivis** (transaction) ; opération réservée à `evacuation.delete`.
- **RM-12-11** — **Bornes de saisie** : `infosCliniques` ≤ 5000 car. ; `notes` de suivi ≤ 2000 car. ;
  `motifAnnulation` ≤ 1000 car. *(valeurs codées dans les DTO — à intégrer à [[parametres_metier]] si
  elles doivent devenir configurables ; aujourd'hui constantes de validation, pas des PM).* 

---

## 7. Interfaces

> Contrats [[plan_modules]]. Le module est `SortiesCritiquesModule` ; il **importe** `SecurityModule`
> et `NotificationModule` (`sorties-critiques.module.ts`).

### 7.1 Ce que le module **expose**

- **API REST `/evacuations`** (consommée par le frontend `sorties.api.ts` / hooks `useSorties.ts`) :
  | Méthode | Route | Permission | Effet |
  |---------|-------|-----------|-------|
  | GET | `/evacuations` | `evacuation.read` | Liste filtrée (site) |
  | GET | `/evacuations/:id` | `evacuation.read` | Détail |
  | POST | `/evacuations` | `evacuation.create` | Initier (HTTP 201) |
  | PATCH | `/evacuations/:id` | `evacuation.update` | Modifier |
  | POST | `/evacuations/:id/suivi` | `evacuation.update` | Ajouter un suivi (HTTP 201) |
  | PATCH | `/evacuations/:id/annuler` | `evacuation.cancel` + `evacuation.update` | Annuler |
  | PATCH | `/evacuations/:id/cloturer` | `evacuation.close` | Clôturer |
  | DELETE | `/evacuations/:id` | `evacuation.delete` | Supprimer (HTTP 200) |
- **`SortiesCritiquesService`** est exporté par le module (réutilisable par d'autres modules ;
  pas de consommateur backend recensé à ce jour — à confirmer).

### 7.2 Ce que le module **consomme**

- **C-9** — [[plan_modules]] : `SecurityModule` (gardes `JwtAuthGuard` + `PermissionsGuard`) ;
  cloisonnement via `siteId` du JWT.
- **C-8** — [[plan_modules]] : `NotificationModule` (`NotificationService.emit`) pour
  `EVACUATION_INITIEE` (SSE temps réel + cloche). Réglage [[parametres_metier]] PM-40.
- **C-4** — [[plan_modules]] : couplage **par la donnée** avec `consultation` — l'évacuation est
  l'aboutissement de la décision de consultation `EVACUATION` (création depuis la consultation,
  blocage de clôture tant qu'aucune évacuation active, cf. EF-12-19).
- **C-11** — [[plan_modules]] : audit transverse via `AuditInterceptor` global
  ([[registre_decisions]] D-014).
- **C-12** — [[plan_modules]] : `Evacuation` et `SuiviEvacuation` participent à la **synchronisation
  offline-first** (soft-delete `deletedAt`, index `updatedAt`, LWW — [[registre_decisions]] D-015,
  D-016). *Note : `SuiviEvacuation` n'a pas de colonne `deletedAt`/`updatedAt` — sa portée de sync est
  à confirmer dans [[MODULE_16_synchronisation]].*
- Référentiel `EtablissementReference` (lecture pour la destination).

---

## 8. Exigences non fonctionnelles spécifiques

- **Cloisonnement / sécurité** : aucune fuite inter-site (404 sur ressource d'un autre site) ;
  lecture des tombstones via le client brut `raw` réservée au cas de réactivation
  ([[registre_decisions]] D-015).
- **Atomicité** : la réactivation (purge suivi + reset) et la clôture-par-suivi et la suppression sont
  exécutées en **transaction** Prisma (`$transaction`).
- **Temps réel** : notification d'initiation poussée par SSE en ligne ([[parametres_metier]] PM-40) ;
  hors-ligne, propagation par synchronisation (pas de SSE local) — [[registre_decisions]] D-020.
- **Offline-first** : toutes les opérations fonctionnent sur le backend embarqué (desktop mode local) ;
  réconciliation LWW à la reconnexion.
- **i18n** : interface bilingue FR/EN (namespace `sorties`, libellés d'urgence/statut traduits ;
  codes techniques humanisés à l'affichage).
- **Imprimable A4** : document d'évacuation au gabarit SARIS (`EvacuationPrintModal`).
- **Audit** : toute mutation journalisée (IP réelle, statut) — [[registre_decisions]] D-014.

---

## 9. Risques et points ouverts

- **Rôle `MEDECIN`** : absent du catalogue de droits ; l'évacuation est de fait limitée à
  `MEDECIN_CHEF` + `ADMIN_SYSTEME`. À trancher avec [[registre_decisions]] D-003 (3 vs 4 rôles).
- **Scope par site vs par soignant** : l'activité clinique est en principe scopée à l'initiateur
  ([[registre_decisions]] D-007), mais l'évacuation n'a **pas** de champ soignant et est scopée
  **par site**. Cohérence à confirmer (acceptable car flux supervisé par le médecin-chef).
- **Synchronisation de `SuiviEvacuation`** : modèle sans `updatedAt`/`deletedAt` — comportement de
  sync et de soft-delete à préciser dans [[MODULE_16_synchronisation]] ; risque sur la réplication des entrées
  de suivi et sur leur purge à la réactivation (hard-delete des suivis lors du reset).
- **CRUD `EtablissementReference`** : la gestion du référentiel des établissements de destination
  n'est pas dans ce module ; sa localisation exacte ([[plan_modules]] `referentiels`) est **à
  confirmer** ; sans entrée référentiel, l'`etablissementId` reste optionnel et l'orientation n'est
  que textuelle (`infosCliniques`).
- **DROP des tables dormantes** : `AccidentTravail` (et autres hors-recueil) restent en base
  ([[registre_decisions]] D-023) ; re-baseline des migrations à régulariser au déploiement.
- **Bornes de saisie non paramétrées** : 5000 / 2000 / 1000 caractères sont codées en dur dans les
  DTO ; à promouvoir en [[parametres_metier]] si une configuration est souhaitée.
- **Double permission sur l'annulation** : `annuler` exige `evacuation.cancel` **et**
  `evacuation.update` ; toute ré-attribution de rôle doit conserver les deux pour ne pas casser
  l'action (point d'attention de gouvernance).
