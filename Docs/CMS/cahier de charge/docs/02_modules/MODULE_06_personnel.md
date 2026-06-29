# Module 06 — Personnel, Délégations & Employés SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » (le système est développé et déployé). Elle documente ce qui
> **existe réellement** dans le code, sans invention. Tout fait technique renvoie au chemin de
> code source (sous `CMS/APP/CMS-SARIS/`). Les chiffres ne sont jamais redéfinis ici :
> ils renvoient à [[parametres_metier]] (`PM-xx`) ; les décisions structurantes renvoient au
> [[registre_decisions]] (`D-xxx`) ; les entités au [[modele_donnees_global]] ; les termes
> au [[glossaire]] ; les contrats inter-modules à [[plan_modules]] (`C-x`).
>
> Sources de code lues : `apps/api/src/modules/personnel/*` (personnel médical, délégations de
> prescription, sociétés sous-traitantes) et `apps/api/src/modules/employe/*` (registre des
> employés SARIS) ; frontend `apps/web/src/modules/acteurs/tabs/*` ; catalogue
> `packages/types/src/permissions.ts` ; schéma `packages/db/prisma/schema.prisma`.

---

## 1. Mission et périmètre

### 1.1 Mission

Le module gère les **acteurs administratifs** de CMS SARIS — les personnes et entités
manipulées autour du parcours de soin mais qui ne sont **ni le patient ni l'acte clinique** :

1. le **personnel médical** (`PersonnelMedical`) — projection clinique des soignants
   (nom, prénom, matricule, métier, site) référencée par les consultations et délégations ;
2. les **délégations de prescription** (`DelegationPrescription`) — autorisation donnée par un
   médecin-chef à un infirmier de réaliser une consultation et de prescrire (cf. [[registre_decisions]] D-011) ;
3. les **sociétés sous-traitantes** (`SocieteSousTraitante`) — entreprises auxquelles sont
   rattachés les patients de catégorie sous-traitant ;
4. le **registre des employés SARIS** (`EmployeSaris`) — main-d'œuvre de l'entreprise reconnue
   par **matricule**, construite **dynamiquement** à l'accueil, qui sert d'autorité de
   résolution lors de la création d'un patient CDI/CDD ou du rattachement d'un ayant droit
   (cf. [[registre_decisions]] D-022).

Le module est porté par deux modules NestJS distincts (cf. [[plan_modules]]) :
- `PersonnelModule` (controllers `Personnel`, `Delegations`, `SousTraitants` ; service
  `PersonnelService` ; `imports: [PrismaModule]`) ;
- `EmployeModule` (controller `Employe` ; service `EmployeService` exporté ; `imports: [SecurityModule]`).

### 1.2 Périmètre couvert

- CRUD du personnel médical + activation/désactivation (toggle de statut dédié).
- Liste « soignants sélectionnables » (picker de triage) restreinte au personnel rattaché à un
  **compte utilisateur actif** de rôle clinique.
- CRUD des délégations de prescription + révocation (toggle ACTIVE/INACTIVE).
- CRUD des sociétés sous-traitantes + activation/désactivation.
- CRUD du registre des employés SARIS + **lookup par matricule** (reconnaissance à l'accueil)
  + résolution interne `ensureByMatricule` (consommée par le dossier patient).
- Garde d'unicité de matricule **tombstone-aware** (voit les enregistrements soft-supprimés).
- Suppression définitive **bloquée (409)** si l'entité est référencée → désactivation conseillée.

### 1.3 Hors-périmètre (explicite)

- **Le garde de prescription `assertPeutPrescrire`** (qui *applique* la délégation à un acte) vit
  dans le flux clinique (ordonnance / bon d'examen / bon de pharmacie), **pas** dans ce module.
  Ce module **crée et gère** les délégations ; il ne les *consomme* pas. Cf. [[registre_decisions]] D-011.
- **La gestion RH du personnel** (habilitations, absences, plannings, présences) : les modèles
  Prisma `HabilitationPersonnel`, `AbsencePersonnel`, `PlanningPermutation`, `PresenceJournaliere`
  **existent en base** mais sont **dormants** — aucun controller/endpoint ne les expose dans le
  code actuel du module (scope-creep retiré, cf. [[registre_decisions]] D-023). À ne pas documenter
  comme fonctionnalité active. *(À confirmer au déploiement : DROP des tables dormantes.)*
- **La granularité « par médicament » de la délégation** (`DelegationMedicamentAutorise`) a été
  retirée fonctionnellement ; le champ `perimetre` n'est qu'une **note textuelle** (D-011). La
  table enfant subsiste et est purgée à la suppression d'une délégation.
- **Les comptes utilisateurs, rôles et permissions** relèvent du module Accès & habilitations
  (`admin` / `security`), pas d'ici. Le lien `PersonnelMedical` ↔ `Utilisateur` (1-1) est *lu*
  ici (filtre des soignants) mais *administré* ailleurs.
- **L'identité « patiente » de l'employé** (dossier, allergies, visites) relève du module
  Dossier patient ; ici on ne tient que le **registre** d'autorité des matricules.
- **L'authenticité réelle d'un matricule** reste **déclarative** (vérification visuelle à chaque
  visite, recueil §9) ; aucun rapprochement avec un export RH externe (D-022).

---

## 2. Acteurs et rôles

Rôles d'habilitation du système : **3** au catalogue — `ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER` (pas de
clé `MEDECIN` : « MEDECIN » est une **profession** du personnel mappée au rôle `MEDECIN_CHEF`, cf.
[[registre_decisions]] D-003). Permissions vérifiées dans `packages/types/src/permissions.ts`.

| Acteur | Personnel | Sous-traitants | Délégations | Employés SARIS |
|--------|-----------|----------------|-------------|----------------|
| **ADMIN_SYSTEME** (super-admin, `[...ALL_PERMISSIONS]`) | CRUD complet | CRUD complet | CRUD + révoquer | CRUD complet |
| **MEDECIN_CHEF** (admin médical) | CRUD complet (`personnel.*`) | CRUD complet (`sous_traitant.*`) | CRUD + révoquer (`delegation.*`) | CRUD complet (`employe.*`) |
| **INFIRMIER** | — | — | — | `employe.read`, `employe.create` (reconnaître/enregistrer un travailleur à l'accueil) |
| *Tout rôle clinique* | — | — | — | `visite.read` → liste **soignants** (`GET /personnel/soignants`) |

- **Supervision / gouvernance RH médicale** = `MEDECIN_CHEF` (a hérité du périmètre de l'ancien
  `AGENT_RH`, cf. commentaire `permissions.ts`) et `ADMIN_SYSTEME`. Eux seuls administrent
  personnel, sous-traitants et délégations.
- **INFIRMIER** n'a **que** la lecture/création d'employés SARIS (accueil) et l'accès au picker
  soignants ; il n'administre pas les autres entités.
- **Catégories de patient** (cf. [[glossaire]]) interviennent indirectement : la catégorie
  **sous-traitant** s'appuie sur `SocieteSousTraitante` ; les catégories **CDI / ayant droit /
  CDD** s'appuient sur `EmployeSaris` (matricule). Le pilotage des droits aux bons par la
  catégorie est traité dans les modules cliniques (D-009), pas ici.

---

## 3. Exigences fonctionnelles

### 3.1 Personnel médical (`/personnel`)

- **EF-06-01** — Le système liste le personnel médical, avec filtres optionnels `statut`, `role`,
  `siteId` et recherche plein-texte (insensible à la casse) sur nom, prénom, matricule, trié par
  nom puis prénom. *(`GET /personnel`, perm `personnel.read`.)*
- **EF-06-02** — Le système expose la fiche d'un agent par identifiant. *(`GET /personnel/:id`,
  perm `personnel.read`, 404 si introuvable.)*
- **EF-06-03** — Le système liste les **soignants sélectionnables** (picker de triage) :
  uniquement le personnel `statut=ACTIF` rattaché à un **compte utilisateur ACTIF** de rôle
  `MEDECIN_CHEF` ou `INFIRMIER` ; liste légère (id, nom, prénom, matricule, rôle, statut, site),
  **sans filtre de site** (personnel partagé entre les deux sites). *(`GET /personnel/soignants`,
  perm `visite.read`.)*
- **EF-06-04** — Le système crée une fiche personnel (matricule, nom, prénom, `role` ∈
  {MEDECIN, INFIRMIER, SAGE_FEMME, TECHNICIEN_LAB, ADMINISTRATIF}, `siteId` optionnel).
  *(`POST /personnel`, perm `personnel.create`, 201.)*
- **EF-06-05** — Le système modifie les champs métier d'une fiche personnel, **sans** permettre
  de changer le statut par cette voie. *(`PATCH /personnel/:id`, perm `personnel.update`.)*
- **EF-06-06** — Le système active/désactive un agent (`ACTIF` / `INACTIF`) par un endpoint
  **dédié** exigeant une permission **plus forte** que la modification. *(`PATCH
  /personnel/:id/statut`, perm `personnel.delete`.)*
- **EF-06-07** — Le système supprime définitivement une fiche personnel, **sauf** si elle est
  référencée (compte, consultations, délégations…) → refus 409 invitant à la désactivation.
  *(`DELETE /personnel/:id`, perm `personnel.delete`.)*

### 3.2 Délégations de prescription (`/delegations`)

- **EF-06-08** — Le système liste les délégations (avec résumé médecin-chef + infirmier), triées
  par `dateDebut` décroissante. *(`GET /delegations`, perm `delegation.read`.)*
- **EF-06-09** — Le système expose une délégation par identifiant. *(`GET /delegations/:id`, perm
  `delegation.read`, 404 si introuvable.)*
- **EF-06-10** — Le système crée une délégation (médecin-chef → infirmier, période début/fin,
  `perimetre` textuel optionnel), après vérification de l'existence des deux personnels.
  *(`POST /delegations`, perm `delegation.create`, 201.)*
- **EF-06-11** — Le système modifie une délégation (parties, dates, périmètre). *(`PATCH
  /delegations/:id`, perm `delegation.update`.)*
- **EF-06-12** — Le système (dé)active une délégation via un toggle de statut `ACTIVE` /
  `INACTIVE` (révocation). *(`PATCH /delegations/:id/statut`, perm `delegation.revoke`.)*
- **EF-06-13** — Le système supprime définitivement une délégation, en retirant d'abord ses
  médicaments autorisés (enfants directs) dans une transaction. *(`DELETE /delegations/:id`,
  perm `delegation.delete`.)*

### 3.3 Sociétés sous-traitantes (`/sous-traitants`)

- **EF-06-14** — Le système liste les sociétés sous-traitantes, filtre `statut` optionnel et
  recherche (insensible casse) sur le nom, trié par nom. *(`GET /sous-traitants`, perm
  `sous_traitant.read`.)*
- **EF-06-15** — Le système expose une société par identifiant. *(`GET /sous-traitants/:id`, perm
  `sous_traitant.read`, 404 si introuvable.)*
- **EF-06-16** — Le système crée une société sous-traitante (nom), avec **unicité de nom**
  (insensible casse) → refus 409 si doublon. *(`POST /sous-traitants`, perm
  `sous_traitant.create`, 201.)*
- **EF-06-17** — Le système modifie le nom d'une société, en réappliquant l'unicité.
  *(`PATCH /sous-traitants/:id`, perm `sous_traitant.update`.)*
- **EF-06-18** — Le système active/désactive une société (`ACTIVE` / `INACTIVE`) via un endpoint
  dédié. *(`PATCH /sous-traitants/:id/statut`, perm `sous_traitant.delete`.)*
- **EF-06-19** — Le système supprime définitivement une société, **sauf** si elle est référencée
  (rattachements) → refus 409. *(`DELETE /sous-traitants/:id`, perm `sous_traitant.delete`.)*

### 3.4 Registre des employés SARIS (`/employes`)

- **EF-06-20** — Le système liste les employés SARIS, avec recherche (matricule/nom/prénom,
  insensible casse) et filtres `categorie` (`ASSURE_CDI` / `ASSURE_CDD` / `TOUS`) et `statut`
  (`ACTIF` / `INACTIF` / `TOUS`), trié par nom puis prénom. *(`GET /employes`, perm
  `employe.read`.)*
- **EF-06-21** — Le système expose un **lookup par matricule** renvoyant l'employé **ou `null`**
  avec un code **200 (jamais 404)** pour piloter l'auto-remplissage / l'enregistrement à
  l'accueil. *(`GET /employes/lookup/:matricule`, perm `employe.read`.)*
- **EF-06-22** — Le système enregistre un employé SARIS (matricule, nom, prénom, catégorie
  CDI/CDD obligatoires ; date de naissance, sexe, fonction, section paie, service, département
  optionnels), avec **unicité de matricule**. *(`POST /employes`, perm `employe.create`, 201.)*
- **EF-06-23** — Le système modifie un employé SARIS, statut `ACTIF`/`INACTIF` inclus, en
  réappliquant l'unicité de matricule. *(`PATCH /employes/:id`, perm `employe.update`.)*
- **EF-06-24** — Le système supprime un employé SARIS **sauf** s'il est rattaché à des dossiers
  patients (lien `Patient.employeId`) ou à des rattachements ayant droit → refus 409 invitant à
  la désactivation. *(`DELETE /employes/:id`, perm `employe.delete`.)*
- **EF-06-25** — Le système expose une résolution interne `ensureByMatricule` (trouve-ou-crée par
  matricule) **consommée par le dossier patient** lors de la création d'un patient CDI/CDD ou du
  rattachement d'un ayant droit à un CDI inconnu (contrat C-7, cf. [[plan_modules]]). *(Service
  exporté, non exposé en HTTP.)*

### 3.5 Transverses

- **EF-06-26** — Toute mutation des quatre zones est **journalisée** par l'audit global
  (`@Audit` sur chaque controller : `personnel`/`Personnel`, `delegation`/`Délégation`,
  `sous_traitant`/`Sous-traitant`, `employe`/`Employé SARIS`), cf. [[registre_decisions]] D-014.
- **EF-06-27** — Toute mutation rafraîchit en temps réel les listes correspondantes via
  l'invalidation live SSE (`@LiveRefresh` : `LIVE_ACTEURS` pour personnel/délégations/sous-traitants,
  `LIVE_EMPLOYES` pour le registre), cf. contrat C-8 [[plan_modules]].

---

## 4. Cas d'utilisation

### CU-06-01 — Reconnaître ou enregistrer un travailleur SARIS à l'accueil

- **Acteur** : INFIRMIER (ou MEDECIN_CHEF / ADMIN_SYSTEME).
- **Déclencheur** : un travailleur se présente au CMS ; l'agent d'accueil saisit son matricule.
- **Scénario nominal** :
  1. L'agent saisit le matricule → `GET /employes/lookup/:matricule`.
  2. Matricule connu → l'identité (nom, prénom, fonction, section, service, dépt, catégorie) est
     renvoyée et **pré-remplit** le dossier patient.
  3. Matricule inconnu → réponse `null` (200) → un bloc d'enregistrement du travailleur s'ouvre.
  4. L'agent renseigne l'identité + catégorie (CDI/CDD) → `POST /employes` → l'employé entre au
     registre et devient l'autorité de ce matricule.
- **Scénarios d'erreur** :
  - Matricule déjà au registre lors d'un `POST` → **409** (« le matricule existe déjà »).
  - Champ obligatoire manquant / catégorie hors {ASSURE_CDI, ASSURE_CDD} → **400** (validation DTO).
- **Hors-ligne** : opérationnel sur le backend local desktop (registre **global**, synchronisé
  LWW — cf. [[registre_decisions]] D-005/D-016) ; l'unicité de matricule reste contrôlée localement.
- **Critères** :
  - *Étant donné* un matricule absent du registre, *quand* l'agent fait un lookup, *alors* le
    système répond `null` avec un code 200 (et non 404).
  - *Étant donné* un matricule déjà enregistré, *quand* l'agent tente de le recréer, *alors* le
    système refuse en 409 sans créer de doublon.

### CU-06-02 — Déléguer la prescription à un infirmier

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME).
- **Déclencheur** : un médecin-chef veut habiliter un infirmier à consulter/prescrire sur une période.
- **Scénario nominal** :
  1. Le médecin-chef ouvre l'onglet Délégations et crée une délégation (lui-même → infirmier,
     dates début/fin, périmètre textuel optionnel) → `POST /delegations`.
  2. Le système vérifie l'existence des deux personnels et crée la délégation `statut=ACTIVE`.
  3. Tant que la délégation est active et dans sa période, l'infirmier peut prescrire (effet
     *appliqué* côté flux clinique par `assertPeutPrescrire`, hors de ce module — D-011).
  4. Le médecin-chef peut **révoquer** la délégation (`PATCH /delegations/:id/statut` → INACTIVE).
- **Scénarios d'erreur** :
  - Médecin-chef ou infirmier inexistant → **404** à la création.
  - `dateDebut`/`dateFin` non conformes (format date) → **400** (validation DTO).
  - Appelant sans `delegation.create` / `delegation.revoke` → **403**.
- **Hors-ligne** : la délégation (`PersonnelMedical` global) est synchronisée ; la décision
  d'autorisation de prescrire s'évalue localement à l'acte.
- **Critères** :
  - *Étant donné* une délégation active dans sa période, *quand* l'infirmier concerné prescrit,
    *alors* l'acte est autorisé (par le garde clinique, hors module).
  - *Étant donné* une délégation révoquée (INACTIVE), *quand* l'infirmier tente de prescrire,
    *alors* l'acte est refusé (403, côté flux clinique).

### CU-06-03 — Désactiver un agent du personnel référencé

- **Acteur** : MEDECIN_CHEF / ADMIN_SYSTEME.
- **Déclencheur** : un soignant quitte le centre alors qu'il a déjà des consultations/un compte.
- **Scénario nominal** :
  1. L'administrateur tente `DELETE /personnel/:id`.
  2. L'agent étant référencé (compte, consultations…), le système **refuse en 409** et conseille
     la désactivation.
  3. L'administrateur fait `PATCH /personnel/:id/statut` → `INACTIF` ; l'agent sort du picker
     soignants (EF-06-03) mais l'historique reste intact.
- **Scénarios d'erreur** :
  - Agent introuvable → **404**.
  - Tentative de désactivation avec seulement `personnel.update` (sans `personnel.delete`) → **403**.
- **Hors-ligne** : suppression = soft-delete bi-cible (tombstone) propagé par la synchronisation
  (cf. [[registre_decisions]] D-015) ; le matricule reste occupé en base (cf. RM-06-01).
- **Critères** :
  - *Étant donné* un agent référencé par des données existantes, *quand* on tente sa suppression,
    *alors* le système refuse (409) sans casser les références.
  - *Étant donné* un utilisateur disposant seulement de `personnel.update`, *quand* il appelle le
    toggle de statut, *alors* l'accès est refusé (403).

### CU-06-04 — Créer / gérer une société sous-traitante

- **Acteur** : MEDECIN_CHEF / ADMIN_SYSTEME.
- **Déclencheur** : un patient de catégorie sous-traitant doit être rattaché à une société.
- **Scénario nominal** : l'administrateur crée la société (`POST /sous-traitants`), la modifie,
  l'active/désactive (`PATCH .../statut`), ou la supprime si non référencée.
- **Scénarios d'erreur** :
  - Nom déjà existant (insensible casse) → **409** à la création ou modification.
  - Société référencée par des rattachements → **409** à la suppression.
- **Hors-ligne** : entité synchronisée (LWW) ; unicité de nom contrôlée localement.
- **Critères** :
  - *Étant donné* une société déjà nommée « X », *quand* on en crée une autre nommée « x »,
    *alors* le système refuse en 409 (comparaison insensible à la casse).

---

## 5. Données du module

Entités détaillées dans [[modele_donnees_global]] (§ « Acteurs & RH » et « Référentiels »).
Propres au module / centrales pour son fonctionnement :

| Entité | Rôle (résumé) | Renvoi |
|--------|---------------|--------|
| `PersonnelMedical` | Projection clinique du soignant (matricule unique, rôle métier, site, statut) ; relié 1-1 à `Utilisateur`, référencé par `Consultation` et les délégations. | [[modele_donnees_global]] |
| `DelegationPrescription` | Délégation médecin-chef → infirmier (dates, statut, `perimetre` textuel). | [[modele_donnees_global]] · D-011 |
| `DelegationMedicamentAutorise` | Enfant de la délégation (granularité retirée ; purgé à la suppression). | [[modele_donnees_global]] |
| `SocieteSousTraitante` | Société rattachée aux patients sous-traitants (nom, statut). | [[modele_donnees_global]] |
| `EmployeSaris` | Registre d'autorité des matricules SARIS (CDI/CDD), construit dynamiquement ; lié à `Patient.employeId` et `RattachementAyantDroitCdi.employeId`. | [[modele_donnees_global]] · D-022 |

Toutes ces entités portent les colonnes de synchronisation `updatedAt` (indexé) et `deletedAt`
(soft-delete / tombstone), conformément aux conventions de [[modele_donnees_global]].

**Métiers du personnel** (`ROLES_PERSONNEL`, descriptif, ≠ rôles de droits) : MEDECIN, INFIRMIER,
SAGE_FEMME, TECHNICIEN_LAB, ADMINISTRATIF — à ne pas confondre avec les rôles RBAC (cf.
[[registre_decisions]] D-003).

---

## 6. Règles métier

- **RM-06-01** — **Unicité de matricule tombstone-aware** : la création/modification de
  `PersonnelMedical` et `EmployeSaris` contrôle l'unicité du matricule sur le **client brut**
  (qui voit aussi les enregistrements soft-supprimés occupant le `@unique`) ; le message distingue
  « déjà utilisé » d'« appartient à un agent/employé supprimé ». Conséquence du soft-delete global
  (cf. [[registre_decisions]] D-015).
- **RM-06-02** — **Suppression non destructive si référencé** : la suppression définitive de
  personnel et de société est interceptée (Prisma P2003/P2014) et muée en **409** invitant à
  désactiver plutôt que supprimer. Pour l'employé SARIS, le blocage est explicite (comptage des
  `Patient.employeId` + `RattachementAyantDroitCdi.employeId` > 0 → 409).
- **RM-06-03** — **Séparation des privilèges activation vs édition** : le changement de statut
  (`/statut`) exige la permission de suppression (`*.delete`), strictement supérieure à la
  permission d'édition (`*.update`) ; le DTO de modification ne contient **pas** le champ `statut`.
- **RM-06-04** — **Picker soignants restreint au système** : seul le personnel ACTIF **possédant
  un compte utilisateur ACTIF** de rôle clinique (`MEDECIN_CHEF`/`INFIRMIER`) est proposé comme
  soignant ; il n'existe pas de répertoire de personnel sélectionnable hors comptes (recueil).
- **RM-06-05** — **Délégation : périmètre = note, pas filtre** : la délégation autorise « réaliser
  une consultation et prescrire » globalement ; `perimetre` est une note textuelle non appliquée
  à la prescription, la granularité par médicament ayant été retirée (cf. [[registre_decisions]] D-011).
- **RM-06-06** — **Application de la délégation hors module** : l'effet d'une délégation (autoriser
  l'infirmier à prescrire) est évalué par le garde `assertPeutPrescrire` du flux clinique, pas par
  ce module ; ce module ne fait que **créer/modifier/révoquer** la délégation.
- **RM-06-07** — **Lookup employé non bloquant** : le lookup par matricule renvoie toujours 200
  (employé ou `null`) ; il ne lève jamais 404 (l'UI gère le cas « inconnu » par un enregistrement).
- **RM-06-08** — **Catégorie d'employé restreinte** : `EmployeSaris.categorie` ∈ {`ASSURE_CDI`,
  `ASSURE_CDD`} (le registre ne contient que la main-d'œuvre SARIS sous contrat ; riverains et
  sous-traitants ne sont pas des employés).
- **RM-06-09** — **Personnel partagé entre sites** : la liste des soignants n'applique pas de
  filtre de site (le personnel est commun aux deux sites) ; `PersonnelMedical` est un modèle
  **global** côté synchronisation (cf. [[registre_decisions]] D-005).

> Aucune valeur chiffrée n'est définie en dur dans ce module. Les seuils transverses
> (rate-limit, sessions, etc.) relèvent de [[parametres_metier]].

---

## 7. Interfaces

### 7.1 Exposé (consommé par d'autres modules / le frontend)

| Élément | Description | Consommateur |
|---------|-------------|--------------|
| `GET /personnel/soignants` | Liste légère des soignants sélectionnables | Triage / Consultation (picker) — contrat lié à C-1 [[plan_modules]] |
| `EmployeService.ensureByMatricule()` | Résolution trouve-ou-crée par matricule (service exporté) | `PatientService` — **contrat C-7** [[plan_modules]] (D-022) |
| `EmployeService.findByMatricule()` | Lookup nullable | Dossier patient / accueil |
| `PersonnelService` (exporté) | Projection clinique du soignant | référencé via la donnée `Consultation.soignantId` |
| CRUD HTTP des 4 zones | Endpoints REST protégés par permissions | Frontend `apps/web/src/modules/acteurs/tabs/*` |

### 7.2 Consommé

| Dépendance | Nature | Contrat |
|------------|--------|---------|
| `SecurityModule` (gardes JWT + permissions) | autorisation de tous les endpoints | **C-9** [[plan_modules]] |
| `PrismaModule` | accès base (soft-delete + client `raw` tombstone-aware) | infrastructure (D-015) |
| `AuditInterceptor` (global) | journalisation des mutations (`@Audit`) | **C-11** [[plan_modules]] (D-014) |
| `NotificationModule` / `LiveRefreshInterceptor` | invalidation live SSE (`@LiveRefresh`) | **C-8** [[plan_modules]] |
| Module `sync/` | propagation globale des entités (LWW, tombstones) | **C-12** [[plan_modules]] (D-016) |

> Note : `PersonnelModule` n'importe que `PrismaModule` ; la protection de ses routes s'appuie sur
> les gardes exportées globalement par `SecurityModule` enregistré en amont (cf. observation
> as-built de [[plan_modules]] §4). `EmployeModule` importe explicitement `SecurityModule`.

---

## 8. Exigences non fonctionnelles spécifiques

- **Cohérence offline-first** : `PersonnelMedical` et `EmployeSaris` étant des modèles **globaux**
  (présents sur tous les postes pour gérer un patient muté ou un travailleur de tout site), leurs
  écritures doivent rester **résolubles par LWW** et leurs suppressions par **tombstone** ; aucune
  contrainte d'unicité ne doit casser la résurrection d'un enregistrement (d'où le contrôle sur le
  client `raw`, cf. RM-06-01). Cf. [[parametres_metier]] §5 (paramètres de synchronisation).
- **Intégrité référentielle douce** : aucune perte silencieuse — la suppression d'une entité
  référencée est refusée (409) plutôt que d'orpheliner des consultations/rattachements.
- **Traçabilité** : chaque mutation produit une ligne d'audit (acteur, IP réelle, statut) sans
  code applicatif additionnel (interceptor global).
- **Réactivité** : les listes des onglets Acteurs se rafraîchissent en temps réel (SSE) sans
  action manuelle de l'utilisateur.

---

## 9. Risques et points ouverts

- **Modèles RH dormants** (`HabilitationPersonnel`, `AbsencePersonnel`, `PlanningPermutation`,
  `PresenceJournaliere`, `DelegationMedicamentAutorise`) présents en base mais non exposés : DROP
  à régulariser au déploiement (cf. [[registre_decisions]] D-023). **À confirmer** : ne pas les
  documenter comme fonctionnalités actives.
- **Rôles d'habilitation = 3** : le catalogue ne contient pas la clé `MEDECIN` ; « MEDECIN » est une
  profession du personnel et tous les médecins reçoivent le rôle `MEDECIN_CHEF` (cf. [[registre_decisions]] D-003).
- **Authenticité déclarative des matricules** : le registre n'est pas adossé à un export RH ;
  un matricule peut être enregistré sur la seule foi de l'accueil (D-022, recueil §9). Risque de
  matricule erroné assumé (vérification visuelle).
- **`statut` de délégation non borné côté `update`** : `toggleDelegationStatut` accepte la valeur
  fournie par le DTO de toggle (`ACTIVE`/`INACTIVE`) ; aucune transition d'état chronologique
  (expiration automatique à `dateFin`) n'est gérée dans ce module — l'évaluation temporelle relève
  du garde clinique. **À confirmer** : comportement attendu à l'échéance `dateFin`.
- **Incohérence de codes statut entre entités** : personnel/employé utilisent `ACTIF`/`INACTIF`,
  société utilise `ACTIVE`/`INACTIVE`, délégation utilise `ACTIVE`/`INACTIVE`. Sans impact
  fonctionnel mais à connaître pour l'UI et les exports.
- **Legacy `RattachementAyantDroitCdi.cdiId`** conservé pour compatibilité à côté du nouveau
  `employeId` : double chemin de rattachement à surveiller (hors périmètre direct de ce module).
