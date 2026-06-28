# Module 08 — Triage & File d'attente

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » : le module est développé et déployé. Les faits renvoient au code réel
> sous `CMS/APP/CMS-SARIS/apps/api/src/modules/triage` (backend) et
> `CMS/APP/CMS-SARIS/apps/web/src/modules/triage` (frontend). Termes, entités, paramètres (`PM-xx`) et
> décisions (`D-xxx`) alignés sur [[_SOURCE_systeme]], [[glossaire]], [[plan_modules]],
> [[modele_donnees_global]], [[parametres_metier]] et [[registre_decisions]].

---

## 1. Mission et périmètre

### 1.1 Mission

Le module Triage (`TriageModule`, [[plan_modules]] ligne 5) est la **première étape du parcours de soin**.
Il ouvre une **[[glossaire#Visite|visite]]** rattachée à un **[[glossaire#Dossier patient|patient]]** existant,
relève les **[[glossaire#Constantes vitales|constantes vitales]]** et place la visite dans la
**[[glossaire#File d'attente|file d'attente]]** consommée en [[glossaire#Consultation|consultation]].
La file est ordonnée **par ordre d'arrivée** — la notion de priorité a été supprimée (D-008).

### 1.2 Dans le périmètre (vérifié dans le code)

- Ouverture d'une visite dans un **acte de triage atomique** : visite + notes d'accueil + premières
  constantes en une seule transaction (`TriageService.create`).
- **Déduplication patient** : recherche d'un patient existant et garde « une seule visite ouverte par
  patient » avant ouverture (`triage.service.ts` § `create`) ; aide à la dédup d'identité côté frontend
  (`NouvelleVisiteDrawer.tsx`, `useFindSimilarPatients`).
- **File d'attente** active partagée (visites `EN_ATTENTE` / `EN_COURS` non encore parties en
  consultation), triée par heure d'arrivée, visites `EN_COURS` épinglées en tête.
- Saisie / ajout de **constantes vitales** et **signes généraux** (modèle « Jeannette »), avec calcul
  d'IMC automatique (`computeImc`).
- Transitions d'état de la visite : prise en charge (`EN_COURS`) et **annulation = remise en file**
  (motif obligatoire) ; assignation/retrait d'un soignant ; mise à jour des notes d'accueil.
- **Historique** des visites clôturées / annulées, scopé à l'initiateur pour les non-supervision (D-007).
- Suppression définitive d'une visite, sous garde-fous stricts (`visite.delete`).
- **Notification** temps réel à l'ouverture d'une visite (SSE, `NotificationService`).
- **Cloisonnement par site** : le `siteId` est forcé depuis la session ; aucune lecture/écriture
  cross-site.

### 1.3 Hors-périmètre (explicite)

- **Aucune priorité / triage médical priorisé** : pas de champ, badge, tri ou endpoint de priorité
  (D-008 ; colonnes DB droppées). À ne jamais réintroduire.
- **Pas de clôture de visite « sans consultation » depuis le triage** : une visite se clôture
  **uniquement** via une consultation (le module [[MODULE_09_consultation|Consultation]] pose `CLOTUREE`).
  La permission `visite.close` existe au catalogue mais n'est **pas** une cible de transition manuelle du
  triage (`TRANSITIONS` ne mène jamais à `CLOTUREE` depuis le triage). *Point ouvert §9.*
- **Pas de création / gestion du dossier patient** : le triage *référence* un patient existant ; la
  création de dossier relève du module [[MODULE_07_dossier_patient|Patient]] (le panneau de triage peut déléguer
  une création via `patient.create`, mais la logique appartient au module Patient).
- **Pas de conduite de consultation, de prescription ni de documents cliniques** : module Consultation et
  modules documentaires.
- **Pas de gestion de la confidentialité du dossier** (verrou médecin-chef) : module Patient (D-006).

---

## 2. Acteurs et rôles

Rôles du système (4, cf. [[glossaire#Rôle]], PM-46) ; le contrôle d'accès s'appuie sur le garde
`@RequirePermissions` (permissions `visite.*`, [[MODULE_02_acces_habilitations]]).

| Rôle | Accès triage (as-built) |
|------|--------------------------|
| **INFIRMIER** | Acteur principal de l'accueil : `visite.read`, `create`, `update`, `cancel`, `assign_soignant` (catalogue, `permissions.ts` lignes 380-381). **Pas** `visite.delete`. |
| **MEDECIN_CHEF** | Accueil/triage + **supervision** : voit tout l'historique du site ; dispose du jeu complet `visite.*` y compris `delete` (lignes 349-350). |
| **ADMIN_SYSTEME** | Super-administrateur : catalogue complet, donc toutes les permissions `visite.*` (D-004). Membre du groupe **supervision**. |
| **MEDECIN** | *Voir le point ouvert D-003* : le rôle `MEDECIN` n'existe pas comme clé au catalogue de droits (tous les médecins sont `MEDECIN_CHEF`). À confirmer. |

- **Supervision** = { `ADMIN_SYSTEME`, `MEDECIN_CHEF` } (constante `SUPERVISION_ROLES`,
  `triage.controller.ts` ligne 29) : seuls ces rôles voient l'**historique complet** du site
  (cf. [[glossaire#Supervision]], D-007). Les autres ne voient que les visites **dont ils sont
  l'initiateur** (`soignantId`).
- **Catégories de patient** : non discriminantes pour l'ouverture de visite au triage (toutes catégories
  ont droit à la consultation, D-009) ; la catégorie pilote les droits aux **bons** en aval, pas le
  triage. Les données administratives exigées à l'inscription dépendent de la catégorie (recueil §5),
  mais cette logique appartient au dossier Patient.

---

## 3. Exigences fonctionnelles (EF-08-xx)

| ID | Exigence (vérifiable) | Source code |
|----|------------------------|-------------|
| **EF-08-01** | Le système ouvre une visite pour un patient **existant et `ACTIF`** ; il refuse si le patient est introuvable (404) ou inactif (409). | `triage.service.ts` `create` |
| **EF-08-02** | Le système **interdit une seconde visite ouverte** pour un patient ayant déjà une visite `EN_ATTENTE` ou `EN_COURS` (409, avec l'`existingVisiteId`). | `create` (garde `existing`) |
| **EF-08-03** | L'ouverture exige un **motif principal actif** ; motif introuvable → 404, motif inactif → 409. | `create` |
| **EF-08-04** | L'ouverture est un **acte atomique** : visite + notes d'accueil + premières constantes sont créées dans une seule transaction. | `create` (`$transaction`) |
| **EF-08-05** | À l'ouverture, le `siteId` de la visite est **forcé depuis la session** (pas depuis le corps de requête). | `triage.controller.ts` `create` |
| **EF-08-06** | Le système calcule l'**IMC automatiquement** à partir du poids et de la taille lors de la saisie de constantes. | `computeImc` |
| **EF-08-07** | La **file active** liste les visites `EN_ATTENTE`/`EN_COURS` **non encore parties en consultation** (sans consultation non-annulée), triées par heure d'arrivée, visites `EN_COURS` épinglées en tête. | `findAll`, tri `sorted` |
| **EF-08-08** | La file active est **partagée** entre tous les soignants du site (gestion collective de l'accueil) ; aucun filtrage par initiateur sur les visites actives. | `findAll` (filtre initiateur seulement si `isHistory`) |
| **EF-08-09** | L'**historique** (visites `CLOTUREE`/`ANNULEE`) n'est visible que de son initiateur pour les non-supervision ; la supervision voit tout l'historique du site. | `findAll` (`isHistory && !canReadAll`) |
| **EF-08-10** | Toute lecture/écriture est **cloisonnée au site de la session** ; impossible de lire/modifier une visite d'un autre site (404). | `getVisiteOrThrow`, `findById`, `findAll` |
| **EF-08-11** | Le système gère les **transitions d'état** selon la machine : `EN_ATTENTE → {EN_COURS, ANNULEE}` ; `EN_COURS → {ANNULEE}` ; états terminaux figés. Toute autre transition → 400. | `TRANSITIONS`, `updateStatut` |
| **EF-08-12** | L'**annulation** d'une visite exige un **motif d'annulation** non vide (400 sinon) ; elle est refusée si une consultation est `OUVERTE` (409). | `updateStatut` (cible `ANNULEE`) |
| **EF-08-13** | Le système permet d'**assigner ou retirer** un soignant (`ACTIF`) à une visite modifiable ; soignant introuvable → 404, inactif → 409. | `updateSoignant` |
| **EF-08-14** | Le système permet de **mettre à jour les notes d'accueil** d'une visite modifiable (max 2000 caractères). | `updateNotes`, DTO |
| **EF-08-15** | Le système permet d'**ajouter des constantes** à une visite modifiable ; au moins une valeur doit être renseignée (400 sinon). | `createConstantes` |
| **EF-08-16** | Toute modification métier (statut, soignant, notes, constantes) est **bloquée sur une visite terminale** (`CLOTUREE`/`ANNULEE`) → 409. | `assertModifiable`, `assertModifiable` dans transitions |
| **EF-08-17** | Chaque changement de statut / soignant / notes écrit un **événement d'audit append-only** (`VisiteEvenement` : type, ancienne/nouvelle valeur, acteur, commentaire). | `updateStatut`/`updateSoignant`/`updateNotes` |
| **EF-08-18** | L'ouverture d'une visite **émet une notification** SSE de portée site, visible des détenteurs de `visite.read`. | `notif.emit` (`VISITE_CREE`) |
| **EF-08-19** | La **suppression définitive** d'une visite est réservée à `visite.delete` et refusée si une consultation non-annulée y est rattachée, ou si une consultation annulée rattachée porte un document. | `deleteVisite` |
| **EF-08-20** | Le système expose les **visites d'un patient** (chronologie du dossier), en excluant les consultations soft-deletées de la timeline. | `findByPatient` |
| **EF-08-21** | Les **plages de validité** des constantes vitales sont contrôlées (ex. température 30–45 °C, SpO₂ 50–100 %, Glasgow 3–15) ; toute valeur hors plage est rejetée. | `CreateConstanteVitaleDto` |
| **EF-08-22** | Les mutations du contrôleur sont **journalisées à l'audit** (`@Audit('visite','Visite')`) et **rafraîchissent en direct** les listes (`@LiveRefresh('LIVE_TRIAGE', siteScoped)`). | `triage.controller.ts` décorateurs |

---

## 4. Cas d'utilisation (CU-08-xx)

> Comportement **hors-ligne** : en mode `local` (poste desktop, D-001/D-020), le backend NestJS embarqué
> sert ces mêmes endpoints sur SQLite ; les visites et constantes créées hors-ligne se synchronisent au
> central (LWW, D-016). Le cloisonnement site et les gardes s'appliquent identiquement côté local.

### CU-08-01 — Ouvrir une visite au triage

- **Acteur** : INFIRMIER (ou supervision).
- **Déclencheur** : un patient se présente à l'accueil.
- **Scénario nominal** : l'acteur recherche le patient existant, choisit le motif principal, saisit
  éventuellement les notes d'accueil et les premières constantes, valide → la visite est créée `EN_ATTENTE`,
  placée dans la file, une notification est émise, le détail s'ouvre.
- **Scénarios d'erreur** : patient introuvable (404) ; patient inactif (409) ; patient ayant **déjà** une
  visite ouverte (409 + `existingVisiteId`, l'UI propose d'ouvrir la visite existante) ; motif inactif
  ou introuvable (404/409) ; constante hors plage (400).
- **Hors-ligne** : ouverture possible sur le backend local ; synchro ultérieure.
- **Critères** :
  - *Étant donné* un patient `ACTIF` sans visite ouverte et un motif actif, *quand* l'acteur valide
    l'ouverture, *alors* une visite `EN_ATTENTE` est créée avec ses constantes en une transaction et une
    notification `VISITE_CREE` est émise.
  - *Étant donné* un patient ayant déjà une visite `EN_ATTENTE`/`EN_COURS`, *quand* l'acteur tente d'en
    ouvrir une seconde, *alors* le système répond 409 et renvoie l'identifiant de la visite existante.

### CU-08-02 — Consulter et trier la file d'attente

- **Acteur** : tout détenteur de `visite.read`.
- **Déclencheur** : ouverture de la page Triage.
- **Scénario nominal** : la file active (EN_ATTENTE/EN_COURS hors consultation) s'affiche, triée par
  heure d'arrivée, les visites EN_COURS en tête ; l'acteur filtre (recherche texte, soignant, motif, sens
  du tri — côté client) et sélectionne une visite.
- **Scénarios d'erreur** : aucune visite → état vide (invite à créer si `visite.create`).
- **Critères** : *Étant donné* des visites actives sur le site, *quand* l'acteur ouvre la page, *alors*
  seules les visites du site, non parties en consultation, sont listées par ordre d'arrivée.

### CU-08-03 — Prendre en charge une visite (mise en consultation)

- **Acteur** : INFIRMIER / médecin de garde.
- **Déclencheur** : la visite est appelée.
- **Scénario nominal** : la visite passe `EN_ATTENTE → EN_COURS` ; elle reste épinglée en tête de file ;
  un `VisiteEvenement STATUT_CHANGE` est tracé. *(L'ouverture effective de la consultation relève du
  module Consultation, contrat C-2.)*
- **Scénarios d'erreur** : transition interdite si la visite n'est pas `EN_ATTENTE` (400).
- **Critères** : *Étant donné* une visite `EN_ATTENTE`, *quand* l'acteur la prend en charge, *alors* son
  statut devient `EN_COURS` et un événement d'audit est écrit.

### CU-08-04 — Annuler une visite (remise en file / retrait)

- **Acteur** : détenteur de `visite.cancel`.
- **Déclencheur** : patient parti, doublon, erreur d'accueil.
- **Scénario nominal** : l'acteur saisit un **motif d'annulation** ; la visite passe `ANNULEE`
  (`dateCloture` posée), un événement est tracé.
- **Scénarios d'erreur** : motif manquant (400) ; consultation `OUVERTE` rattachée (409 — clôturer/annuler
  la consultation d'abord).
- **Critères** : *Étant donné* une visite active sans consultation ouverte, *quand* l'acteur l'annule avec
  un motif, *alors* elle devient `ANNULEE` et quitte la file active.

### CU-08-05 — Assigner / retirer un soignant

- **Acteur** : détenteur de `visite.assign_soignant`.
- **Scénario nominal** : l'acteur sélectionne un soignant `ACTIF` (ou `null` pour désassigner) → la visite
  est mise à jour, un `VisiteEvenement SOIGNANT_CHANGE` est tracé.
- **Scénarios d'erreur** : soignant introuvable (404) / inactif (409) ; visite terminale (409).
- **Critères** : *Étant donné* une visite modifiable, *quand* l'acteur change le soignant, *alors* la
  visite porte le nouveau soignant et l'historique l'enregistre.

### CU-08-06 — Saisir / compléter les constantes vitales

- **Acteur** : détenteur de `visite.update` (INFIRMIER).
- **Scénario nominal** : l'acteur saisit température, tension, FC, SpO₂, poids/taille, glycémie et signes
  généraux → l'IMC est calculé, la constante est enregistrée et historisée dans le dossier.
- **Scénarios d'erreur** : aucune valeur saisie (400) ; valeur hors plage (400) ; visite terminale (409).
- **Critères** : *Étant donné* une visite modifiable, *quand* l'acteur saisit au moins une constante
  valide, *alors* une `ConstanteVitale` est créée (IMC calculé) et rattachée à la visite et au patient.

### CU-08-07 — Consulter le détail d'une visite et son journal

- **Acteur** : détenteur de `visite.read` (du site).
- **Scénario nominal** : affichage du patient (identité, catégorie, allergies/alertes actives,
  antécédents), des constantes (récentes en tête) et du **journal d'événements** enrichi de l'acteur.
- **Scénarios d'erreur** : visite d'un autre site / inexistante → 404.
- **Critères** : *Étant donné* une visite du site, *quand* l'acteur l'ouvre, *alors* son détail et son
  journal append-only sont affichés.

### CU-08-08 — Supprimer définitivement une visite

- **Acteur** : détenteur de `visite.delete` (supervision).
- **Scénario nominal** : suppression définitive (hors soft-delete, via client `raw`) d'une visite
  **annulée** sans consultation, ou avec consultations **toutes annulées et sans document** ; constantes
  et événements supprimés en cascade ; l'action reste tracée au journal d'audit global.
- **Scénarios d'erreur** : consultation non annulée rattachée (409) ; consultation annulée portant un
  document (409).
- **Critères** : *Étant donné* une visite annulée sans document rattaché, *quand* la supervision la
  supprime, *alors* la visite et ses dépendances sont effacées définitivement et l'opération est auditée.

---

## 5. Données du module

Renvoi au modèle global : [[modele_donnees_global]] (domaine « Accueil & triage »). Entités propres :

- **`Visite`** — passage du patient dans la file (D-008 : ordre d'arrivée, pas de priorité).
  Champs clés : `patientId`, `siteId`, `motifPrincipalId`, `statut` (`EN_ATTENTE`/`EN_COURS`/`CLOTUREE`/
  `ANNULEE`), `soignantId`, `dateOuverture`, `dateCloture`, `typeCloture`, `motifAnnulation`,
  `notesAccueil`, `creerHorsLigne`, `version`. Relations : `ConstanteVitale`, `Consultation`,
  `VisiteEvenement`. Cf. [[modele_donnees_global]] ligne 276.
- **`ConstanteVitale`** — mesures + signes généraux : `temperature`, `tensionSystolique/Diastolique`,
  `frequenceCardiaque`, `saturationO2`, `poids`, `taille`, `imc` (calculé), `glycemie`, `etatConscience`,
  `scoreGlasgow`, `etatGeneral`, `hydratation`, `coloration`. Rattachée à `visiteId` + `patientId`,
  `saisiePar`. Cf. [[modele_donnees_global]] ligne 278.
- **`VisiteEvenement`** — piste d'audit **append-only** des changements de visite (`type` :
  `STATUT_CHANGE`, `SOIGNANT_CHANGE`, `NOTES_UPDATE` ; `ancienneVal`, `nouvelleVal`, `acteurId`,
  `commentaire`). Cf. [[modele_donnees_global]] ligne 277.
- *Référencées en lecture* : `Patient` (+ `identite`, `categoriePatient`, `allergies`, `alertesMedicales`,
  `antecedents`), `MotifConsultation`, `PersonnelMedical` (soignant/acteur), `Site`.

> Les plages numériques de `ConstanteVitale` sont **codées dans le DTO** (`CreateConstanteVitaleDto`) ;
> à harmoniser avec un éventuel `PM-xx` si elles deviennent configurables — *point ouvert §9*.

---

## 6. Règles métier (RM-08-xx)

| ID | Règle | Renvoi |
|----|-------|--------|
| **RM-08-01** | **File par ordre d'arrivée**, jamais par priorité. Tri par `dateOuverture` ; visites `EN_COURS` épinglées en tête. | D-008 ; pas de `PM` chiffré |
| **RM-08-02** | **Une seule visite ouverte par patient** (statut `EN_ATTENTE`/`EN_COURS`). | D-005 (règle conservée), `create` |
| **RM-08-03** | Une visite ne se **clôture que par une consultation** ; depuis le triage seules `EN_COURS` (prise en charge) et `ANNULEE` sont possibles. Pas de retour `EN_COURS → EN_ATTENTE`. | `TRANSITIONS` |
| **RM-08-04** | L'**annulation** exige un motif et est interdite tant qu'une consultation est `OUVERTE`. | `updateStatut` |
| **RM-08-05** | Toute modification métier est **interdite sur une visite terminale**. | `assertModifiable` |
| **RM-08-06** | L'**IMC** est calculé par la formule partagée unique (`computeImc`) — source unique. | `common/clinical` |
| **RM-08-07** | Au moins une constante doit être renseignée pour enregistrer une `ConstanteVitale`. | `createConstantes` |
| **RM-08-08** | **Cloisonnement site** : le `siteId` est imposé par la session ; toute entité hors-site est invisible (404). | D-005 (visite par site), contrôleur |
| **RM-08-09** | **Confidentialité par initiateur** : l'historique (clôturées/annulées) n'est visible que de son `soignantId`, sauf supervision. La file active reste partagée. | D-007 |
| **RM-08-10** | Tout changement d'état/soignant/notes produit un **événement d'audit append-only** ; les mutations sont aussi journalisées par l'audit global. | EF-08-17, D-014 |
| **RM-08-11** | La **suppression définitive** préserve la traçabilité : refusée si consultation non-annulée ou document rattaché ; utilise le client `raw` pour ne pas laisser de visite fantôme (les événements étant hors allow-list soft-delete). | D-015, `deleteVisite` |

> Aucune valeur chiffrée propre au module n'est paramétrée dans [[parametres_metier]] : le triage n'a pas
> de seuil configurable (les plages de constantes sont des bornes de validation codées, voir §5/§9).

---

## 7. Interfaces (contrats [[plan_modules]])

### 7.1 Endpoints exposés (`/triage/visites`, gardés JWT + permissions)

| Méthode · Route | Permission | Rôle (EF) |
|-----------------|------------|-----------|
| `GET /triage/visites` | `visite.read` | File active + historique scopé (EF-08-07/09/10) |
| `POST /triage/visites` | `visite.create` | Ouverture (EF-08-01..06) |
| `GET /triage/visites/patient/:patientId` | `visite.read` | Chronologie dossier (EF-08-20) |
| `GET /triage/visites/:id` | `visite.read` | Détail + journal (CU-08-07) |
| `DELETE /triage/visites/:id` | `visite.delete` | Suppression définitive (EF-08-19) |
| `PATCH /triage/visites/:id/statut` | `visite.update`/`cancel`/`close` | Transitions (EF-08-11/12) |
| `PATCH /triage/visites/:id/soignant` | `visite.assign_soignant` | Assignation (EF-08-13) |
| `PATCH /triage/visites/:id/notes` | `visite.update` | Notes d'accueil (EF-08-14) |
| `POST /triage/visites/:id/constantes` | `visite.update` | Constantes (EF-08-15) |

### 7.2 Contrats inter-modules (cf. [[plan_modules]] §6)

- **C-1** (Triage → Patient) : le triage **rattache** la visite à un patient existant (dédup) ; la visite
  entre dans la file. `TriageModule` importe `PrismaModule` + `NotificationModule`.
- **C-2** (Triage → Consultation) : la consultation **reprend** une visite triée (transition `EN_COURS`,
  clôture à l'envoi côté Consultation). Couplage **par la donnée `Visite`**, pas par `imports`.
- **C-8** (Triage → Notification) : émission de `VISITE_CREE` (SSE) + `@LiveRefresh('LIVE_TRIAGE')`.
- **C-9** (Security → Triage) : gardes JWT + permissions appliquées globalement.
- **C-11** (Triage → Audit) : `@Audit('visite','Visite')` → `AuditInterceptor` global.
- **C-12** (Triage ↔ Sync) : `Visite`, `ConstanteVitale`, `VisiteEvenement` sont synchronisées
  offline-first (LWW, tombstones), portée **par site** pour la visite (D-005/D-016).
- **C-6** (Référentiels → Triage) : `MotifConsultation`, `CategoriePatient` consommés en lecture.

### 7.3 Frontend consommateur

`apps/web/src/modules/triage` : page split-panel (`TriagePage.tsx`), file (`QueueCard`), détail
(`VisiteDetail` sous `PrivacyCurtain`), création (`NouvelleVisiteDrawer`), saisie constantes
(`ConstantesForm`), via hooks React Query (`useTriage.ts`) et API (`triage.api.ts`).

---

## 8. Exigences non fonctionnelles spécifiques

- **Temps réel** : la file se met à jour sans bouton « actualiser » (SSE + `@LiveRefresh` + invalidations
  React Query) ; horloge live en feuille isolée (perf). Cf. [[exigences_non_fonctionnelles]].
- **Offline-first** : tous les cas d'usage fonctionnent sur le backend local (desktop) ; synchro LWW
  (D-001/D-016). Le champ `creerHorsLigne` marque les visites ouvertes hors-ligne.
- **Confidentialité visuelle** : le détail de visite est protégé par le **[[glossaire#Rideau de
  confidentialité|rideau de confidentialité]]** (`PrivacyCurtain`).
- **Performance** : `findAll` charge une sélection compacte (alertes/allergies **critiques** seulement) ;
  enrichissement soignant/acteur par requêtes batchées (anti N+1) ; recherche/tri/filtres avancés
  effectués **côté client** (file compacte ; indexation pgtrgm à prévoir si le volume grossit, note DTO).
- **Responsive** : split empilé en mode compact (un seul panneau, bouton « Retour à la file »).
- **i18n** : libellés bilingues FR/EN (`react-i18next`, clés `triage.*`).
- **Atomicité** : l'acte de triage (visite + constantes) est transactionnel ; les transitions écrivent
  l'événement d'audit dans la même transaction.

---

## 9. Risques et points ouverts

- **`visite.close` orpheline** : la permission existe au catalogue et figure dans la signature
  `@RequirePermissions` de `PATCH .../statut`, mais `TRANSITIONS` ne mène **jamais** à `CLOTUREE` depuis
  le triage (clôture réservée à la consultation). À documenter/retirer pour éviter l'ambiguïté
  (cf. retrait de la « clôture sans consultation », D-023). *À confirmer.*
- **Rôle `MEDECIN`** : divergence « 3 vs 4 rôles » (D-003) — le catalogue ne contient pas `MEDECIN`. La
  matrice §2 reste à régulariser avec [[MODULE_02_acces_habilitations]].
- **Plages de constantes codées** : les bornes de `CreateConstanteVitaleDto` ne sont pas dans
  [[parametres_metier]]. Si elles doivent être ajustables (ou alertes cliniques dérivées), créer un
  `PM-xx`. *À confirmer.*
- **Dépendances de suppression à des tables dormantes** : `deleteVisite` compte encore des documents sur
  `suiviChronique`, `consultationPrenatale`, `accidentTravail` (modèles laissés **dormants** après
  retrait du scope-creep, D-023). Garde-fou inoffensif mais à nettoyer lors du DROP des tables dormantes.
- **Filtre `siteId` du query** : `findAll` accepte un `siteId` de requête mais le contrôleur le **force**
  depuis la session ; veiller à ce qu'aucun appelant ne contourne ce forçage (vérifié dans le contrôleur).
- **Charge de la file** : recherche/tri côté client — acceptable au volume actuel ; risque de dégradation
  si la file devient longue (mitigation prévue : `search` backend + pgtrgm, note DTO).

---

> Sources : `apps/api/src/modules/triage/{triage.controller.ts, triage.service.ts, dto/visite.dto.ts,
> triage.module.ts}`, `apps/web/src/modules/triage/*`, `packages/types/src/permissions.ts`
> (`visite.*`, lignes 31-37, 193-199, 349-350, 380-381). Faits non confirmés signalés « à confirmer ».
