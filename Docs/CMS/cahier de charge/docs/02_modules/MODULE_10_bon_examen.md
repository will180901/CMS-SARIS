# Module 10 — Bon d'examen

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** V1 · **Historique** : v1.0 création

> Spécification « as-built » : le module est développé et déployé. Les faits renvoient au code réel
> sous `CMS/APP/CMS-SARIS/apps/api/src/modules/bon-examen` (backend) et
> `CMS/APP/CMS-SARIS/apps/web/src/modules/bon-examen` (frontend, intégré à la consultation). Termes,
> entités, paramètres (`PM-xx`) et décisions (`D-xxx`) alignés sur [[_SOURCE_systeme]], [[glossaire]],
> [[plan_modules]], [[modele_donnees_global]], [[parametres_metier]] et [[registre_decisions]].

---

## 1. Mission et périmètre

### 1.1 Mission

Le module Bon d'examen (`BonExamenModule`, [[plan_modules]] ligne 7) **émet et suit les
[[glossaire#Bon d'examen|bons d'examen]] complémentaires** (laboratoire, imagerie…) prescrits durant
une [[glossaire#Consultation|consultation]], puis recueille la **saisie des résultats** par
l'infirmier. Il porte le cycle de vie du bon (EN_ATTENTE → VALIDE → résultat reçu, ou ANNULE),
applique le **cloisonnement par site**, la **règle de couverture par catégorie de patient** (D-009) et
le **droit de prescription** (D-011), et fournit l'**impression A4 SARIS** du bon validé.

Source : `apps/api/src/modules/bon-examen/bon-examen.service.ts`,
`bon-examen.controller.ts`, `bon-examen.module.ts`.

### 1.2 Dans le périmètre (vérifié dans le code)

- **Émission d'un bon** depuis une consultation **ouverte** : indication clinique + une ou plusieurs
  lignes d'examen (types issus du référentiel), établissement destinataire optionnel
  (`BonExamenService.create`).
- **Lignes d'examen** (`LigneExamen`) : association bon ↔ `TypeExamen` (référentiel), créées en une
  transaction avec le bon.
- **Cycle de vie** : `EN_ATTENTE` (création) → `VALIDE` (transmis) ; `EN_ATTENTE`/`VALIDE` → `ANNULE`
  (motif obligatoire) (`validerOuAnnuler`, `annuler`).
- **Saisie des résultats** par l'infirmier sur un bon **VALIDE** : laboratoire, contenu,
  interprétation ; trace l'acteur (`saisirResultat`).
- **Modification** de l'indication / établissement **uniquement** tant que le bon est `EN_ATTENTE`
  (`update`).
- **Suppression définitive** d'un bon **sans résultat** (sinon refus pour traçabilité) (`delete`).
- **Cloisonnement par site systématique** : tout accès passe par `BonExamen → consultation → visite →
  siteId` (`getOrThrow`, `findAll`) — anti-IDOR cross-site.
- **Couverture par catégorie** : création réservée aux CDI et ayants droit (garde
  `assertPrestationCouverte(..., 'EXAMEN')`, `apps/api/src/common/droits-categorie.ts`).
- **Droit de prescription** : médecin-chef/admin libre, infirmier seulement sous délégation active
  (garde `assertPeutPrescrire`, `apps/api/src/common/prescription.ts`).
- **Impression A4** du bon validé (gabarit SARIS) côté frontend (`BonExamenPrintModal.tsx`).
- **Temps réel** (rafraîchissement live des listes via `@LiveRefresh('LIVE_BONS_EXAMEN')`) et **audit**
  des mutations (`@Audit('bon_examen', "Bon d'examen")`, D-014).
- **Filtres de liste** : par consultation, par patient, par statut (`BonExamenQueryDto`).

### 1.3 Hors périmètre (explicite)

- **Prescription de médicaments / retrait** : relève de l'ordonnance et du
  [[glossaire#Bon de pharmacie|bon de pharmacie]] (module `bon-pharmacie`, D-010), **pas** de ce module.
- **Décision de consultation** (CLOTURE_SIMPLE / PRESCRIPTION / EXAMEN_COMPLEMENTAIRE / EVACUATION) et
  clôture de la visite : portées par le module `consultation` (D-023). Le bon d'examen est un document
  **émis depuis** la consultation (contrat [[plan_modules#6. Contrats d'interface principaux|C-4]]).
- **Gestion du référentiel des types d'examen** (`TypeExamen`) : module `referentiels` (contrat C-6).
  Ici on ne fait que **lire/valider** les identifiants fournis.
- **Verrou de confidentialité** du dossier (D-006) : appliqué au dossier patient (module `patient`),
  non réimplémenté ici. *Effet sur la lecture des bons via le dossier : à confirmer.*
- **Statuts « RECU/CONSULTÉ » comme états du bon** : le code commente un cycle « → RECU → CONSULTÉ »,
  mais en base le **statut du bon** ne prend que `EN_ATTENTE` / `VALIDE` / `ANNULE` ; `RECU` est le
  statut du **résultat** (`ResultatExamen.statut`). Pas d'état « CONSULTÉ » matérialisé (à confirmer).
- **Pièces jointes / fichiers de résultat** (PDF labo scanné) : non gérés ; le résultat est **textuel**.

---

## 2. Acteurs et rôles

Rôles du catalogue (`packages/types/src/permissions.ts`, voir [[MODULE_02_acces_habilitations]], PM-46). Les
permissions `bon_examen.*` réellement affectées :

| Action / permission | ADMIN_SYSTEME | MEDECIN_CHEF | INFIRMIER | MEDECIN *(voir note)* |
|---------------------|:---:|:---:|:---:|:---:|
| `bon_examen.read` (consulter) | ✔ | ✔ | ✔ | — |
| `bon_examen.create` (émettre / modifier brouillon) | ✔ | ✔ | ✔ | — |
| `bon_examen.validate` (valider / annuler via `/statut`) | ✔ | ✔ | — | — |
| `bon_examen.cancel` (annuler, y compris bon validé) | ✔ | ✔ | ✔ | — |
| `bon_examen.delete` (supprimer définitivement) | ✔ | ✔ | — | — |
| `bon_examen.result` (saisir un résultat) | ✔ | ✔ | ✔ | — |

> `ADMIN_SYSTEME` détient `[...ALL_PERMISSIONS]` (D-004). `MEDECIN_CHEF` détient les 6 permissions.
> `INFIRMIER` détient `read, create, cancel, result` (mais **pas** `validate` ni `delete`).
> **Note** (D-003 « à régulariser ») : le rôle `MEDECIN` n'apparaît **pas** au catalogue
> `ROLE_PERMISSIONS` du code de référence ; tous les médecins sont `MEDECIN_CHEF`. La colonne MEDECIN
> est laissée vide en conséquence. À trancher/propager (voir [[registre_decisions]] D-003).

**Surcouche métier (au-delà de la permission) :**
- L'**émission** (`create`) requiert en plus, côté service : (a) le **droit de prescrire** (D-011) —
  l'infirmier doit avoir une **délégation active**, sinon `403` ; (b) la **couverture catégorie** (D-009)
  — patient CDI ou ayant droit, sinon `403`.
- **Catégories de patient** concernées ([[glossaire#Catégorie de patient]]) : `ASSURE_CDI` et
  `AYANT_DROIT_CDI` ouvrent droit au bon d'examen (prestation `EXAMEN`) ; `ASSURE_CDD`, `SOUS_TRAITANT`,
  `RIVERAIN` ne l'ouvrent **pas** (matrice `DroitCategoriePatient`, D-009).

---

## 3. Exigences fonctionnelles

> IDs `EF-10-xx`, atomiques et vérifiables. Source = controller/service/dto cités.

- **EF-10-01** — Le système liste les bons d'examen, filtrables par `consultationId`, `patientId` et
  `statut` (`EN_ATTENTE`|`VALIDE`|`ANNULE`|`TOUS`), triés par date de création décroissante
  (`findAll`, `BonExamenQueryDto`). Permission `bon_examen.read`.
- **EF-10-02** — Le système restreint **toute** lecture et écriture aux bons dont la consultation
  appartient au **site de l'appelant** (`consultation → visite → siteId`) ; un bon d'un autre site est
  introuvable (`404`) (`getOrThrow`, `findAll`).
- **EF-10-03** — Le système expose le détail d'un bon par identifiant, incluant ses lignes (avec type
  d'examen : code, libellé, domaine), ses résultats (du plus récent) et l'identité patient via la
  consultation (`findById`, `BON_INCLUDE`). Permission `bon_examen.read`.
- **EF-10-04** — Le système crée un bon rattaché à une consultation **OUVERTE** avec une indication
  clinique (1–2000 caractères, non vide) et **au moins une** ligne d'examen ; statut initial
  `EN_ATTENTE` (`create`, `CreateBonExamenDto`). Permission `bon_examen.create`.
- **EF-10-05** — À la création, le système **refuse** (`409`) si la consultation est clôturée, et
  `404` si la consultation est introuvable ou hors site (`create`).
- **EF-10-06** — À la création, le système **refuse** (`403`) si l'appelant n'a pas le droit de
  prescrire (RM-10-04) ou si la catégorie du patient n'ouvre pas droit au bon d'examen (RM-10-03).
- **EF-10-07** — À la création, le système **valide** que chaque `typeExamenId` correspond à un
  `TypeExamen` existant ; sinon `400` (`create`).
- **EF-10-08** — Le système permet de **modifier** l'indication clinique et/ou l'établissement d'un bon
  **uniquement** s'il est `EN_ATTENTE` ; sinon `409` (`update`, `UpdateBonExamenDto`). Permission
  `bon_examen.create`.
- **EF-10-09** — Le système permet de passer un bon `EN_ATTENTE` à `VALIDE` **ou** `ANNULE` via
  l'endpoint de statut ; toute autre transition est refusée (`409`) (`validerOuAnnuler`,
  `ValiderBonExamenDto`). Permission `bon_examen.validate`.
- **EF-10-10** — Lors d'une mise en statut `ANNULE` (via `/statut` ou `/annuler`), le système **exige
  un motif d'annulation** non vide (≤ 500 caractères) ; sinon `400` (`validerOuAnnuler`, `annuler`,
  `AnnulerBonExamenDto`).
- **EF-10-11** — Le système permet d'**annuler** un bon `EN_ATTENTE` **ou** `VALIDE` (motif
  obligatoire) ; un bon déjà annulé n'est pas ré-annulable (`409`) (`annuler`). Permission
  `bon_examen.cancel`.
- **EF-10-12** — Le système permet de **supprimer définitivement** un bon **uniquement s'il ne porte
  aucun résultat** ; sinon il invite à l'annuler (`409`, traçabilité). La suppression efface les lignes
  puis le bon dans une transaction (`delete`). Permission `bon_examen.delete`.
- **EF-10-13** — Le système permet de **saisir un résultat** sur un bon **VALIDE** : contenu obligatoire
  (1–5000 caractères), laboratoire et interprétation optionnels ; le résultat est créé en statut `RECU`
  et trace l'acteur de saisie (`saisirResultat`, `SaisirResultatDto`). Permission `bon_examen.result`.
- **EF-10-14** — Le système **refuse** (`409`) la saisie d'un résultat si le bon n'est pas `VALIDE`
  (`saisirResultat`).
- **EF-10-15** — Le système journalise (audit) toute mutation du module (création, mise à jour, statut,
  annulation, suppression, saisie de résultat) avec acteur, IP et statut (D-014,
  `@Audit('bon_examen', …)`).
- **EF-10-16** — Le système rafraîchit en **temps réel** les listes de bons des clients connectés après
  une mutation (`@LiveRefresh('LIVE_BONS_EXAMEN')`).
- **EF-10-17** — Le frontend permet d'**imprimer** un bon `VALIDE` au format A4 SARIS (indication,
  examens, identité patient, soignant, catégorie) (`BonExamenPrintModal.tsx`).
- **EF-10-18** — Le frontend **masque l'action « nouveau bon »** lorsque la catégorie du patient n'est
  pas éligible (`ASSURE_CDI` / `AYANT_DROIT_CDI`), le backend restant l'arbitre (`BonExamenCard.tsx`,
  `eligible`). *Garde d'ergonomie ; ne remplace pas RM-10-03.*

---

## 4. Cas d'utilisation

> IDs `CU-10-xx`. Critères « Étant donné / Quand / Alors ». Comportement hors-ligne : le module est
> servi par le backend embarqué du [[glossaire#Poste local|poste local]] (D-001/D-020) ; les mêmes
> règles s'appliquent localement, les changements étant synchronisés (LWW, D-016).

### CU-10-01 — Émettre un bon d'examen depuis une consultation

- **Acteur** : MEDECIN_CHEF (ou INFIRMIER délégué, ou ADMIN_SYSTEME).
- **Déclencheur** : depuis l'onglet « Décision » d'une consultation ouverte d'un patient CDI/ayant
  droit, l'acteur ouvre « Nouveau bon d'examen ».
- **Scénario nominal** : il saisit une indication clinique, sélectionne un ou plusieurs types d'examen
  (autocomplétion référentiel), valide → le bon est créé en `EN_ATTENTE` avec ses lignes ; la liste se
  rafraîchit.
- **Scénarios d'erreur** : consultation clôturée → `409` ; catégorie non couverte → `403` ;
  prescripteur non habilité (infirmier sans délégation) → `403` ; type d'examen invalide → `400` ;
  indication vide → `400`.
- **Hors-ligne** : création locale possible ; synchronisée à la reconnexion.
- **Critères** :
  - *Étant donné* une consultation **OUVERTE** d'un patient `ASSURE_CDI` et un prescripteur habilité,
    *quand* il émet un bon avec indication + ≥ 1 examen, *alors* un bon `EN_ATTENTE` est créé et listé.
  - *Étant donné* un patient `SOUS_TRAITANT`, *quand* on tente d'émettre un bon, *alors* la requête est
    refusée (`403`) et le frontend masque l'action.

### CU-10-02 — Valider un bon (transmission)

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME) — permission `bon_examen.validate`.
- **Déclencheur** : sur un bon `EN_ATTENTE`, action « Valider ».
- **Scénario nominal** : le statut passe à `VALIDE` ; le bon devient imprimable et ouvert à la saisie de
  résultat.
- **Scénarios d'erreur** : bon déjà `VALIDE`/`ANNULE` → `409` ; INFIRMIER (sans `validate`) → `403`.
- **Critères** :
  - *Étant donné* un bon `EN_ATTENTE`, *quand* un médecin-chef le valide, *alors* le statut devient
    `VALIDE`.

### CU-10-03 — Saisir le résultat d'un examen

- **Acteur** : INFIRMIER (ou MEDECIN_CHEF / ADMIN_SYSTEME) — permission `bon_examen.result`.
- **Déclencheur** : sur un bon `VALIDE`, action « Ajouter le résultat ».
- **Scénario nominal** : saisie du laboratoire (optionnel), du contenu (obligatoire) et de
  l'interprétation (optionnelle) → un `ResultatExamen` (`RECU`) est créé, tracé à l'auteur, et affiché.
- **Scénarios d'erreur** : bon non `VALIDE` → `409` ; contenu vide → `400`.
- **Hors-ligne** : saisie locale possible, synchronisée ensuite.
- **Critères** :
  - *Étant donné* un bon `VALIDE`, *quand* l'infirmier saisit un contenu de résultat, *alors* un
    résultat `RECU` est enregistré avec l'identité de l'auteur.
  - *Étant donné* un bon `EN_ATTENTE`, *quand* on tente de saisir un résultat, *alors* refus `409`.

### CU-10-04 — Annuler un bon

- **Acteur** : MEDECIN_CHEF, INFIRMIER, ADMIN_SYSTEME — permission `bon_examen.cancel`.
- **Déclencheur** : sur un bon `EN_ATTENTE` ou `VALIDE`, action « Annuler ».
- **Scénario nominal** : l'acteur saisit un motif → le statut passe à `ANNULE`, le motif est conservé.
- **Scénarios d'erreur** : motif vide → `400` ; bon déjà annulé → `409`.
- **Critères** :
  - *Étant donné* un bon `VALIDE`, *quand* on l'annule avec motif, *alors* le statut devient `ANNULE` et
    le motif est tracé.

### CU-10-05 — Supprimer un bon erroné (sans résultat)

- **Acteur** : MEDECIN_CHEF, ADMIN_SYSTEME — permission `bon_examen.delete`.
- **Déclencheur** : action « Supprimer » sur un bon créé par erreur.
- **Scénario nominal** : le bon **sans résultat** est supprimé (lignes + bon) ; il disparaît de la liste.
- **Scénarios d'erreur** : bon porteur d'un résultat → `409` (« annulez plutôt que de supprimer »).
- **Critères** :
  - *Étant donné* un bon sans résultat, *quand* on le supprime, *alors* il est retiré ; *étant donné* un
    bon avec résultat, *alors* la suppression est refusée.

### CU-10-06 — Imprimer un bon validé

- **Acteur** : tout rôle avec `bon_examen.read` (l'action d'impression apparaît sur un bon `VALIDE`).
- **Déclencheur** : action « Imprimer » sur un bon `VALIDE`.
- **Scénario nominal** : aperçu A4 SARIS (en-tête, identité patient, indication, liste d'examens,
  soignant, catégorie) puis impression navigateur.
- **Critères** :
  - *Étant donné* un bon `VALIDE`, *quand* on imprime, *alors* le gabarit A4 SARIS est rendu.

---

## 5. Données du module

> Détail et cardinalités globales : [[modele_donnees_global]]. Entités **propres** au module (schéma
> `packages/db/prisma/schema.prisma`) :

- **`BonExamen`** — `id`, `consultationId` (FK [[glossaire#Consultation|Consultation]]),
  `indicationClinik`, `etablissementId?`, `statut` (`EN_ATTENTE` par défaut),
  `motifAnnulation?`, `createdAt`, `updatedAt`, `deletedAt?` (soft-delete, D-015). Relations : `lignes`
  (`LigneExamen[]`), `resultats` (`ResultatExamen[]`).
- **`LigneExamen`** — `id`, `bonId` (FK `BonExamen`), `typeExamenId` (FK `TypeExamen`, référentiel).
  Une ligne = un examen demandé. *Pas de `deletedAt` (supprimée physiquement avec le bon).*
- **`ResultatExamen`** — `id`, `bonId` (FK `BonExamen`), `laboratoire?`, `contenu`, `interpretation?`,
  `statut` (`RECU` par défaut), `saisiePar` (id de l'acteur), `createdAt`, `updatedAt`, `deletedAt?`.

**Entités consommées (lecture, non possédées) :**
- **`Consultation` → `Visite` → `Patient` / `Site`** : pour le cloisonnement par site, l'identité
  patient et l'éligibilité (catégorie). Cf. [[glossaire#Dossier patient]].
- **`TypeExamen`** (référentiel) : code, libellé, domaine (statut `ACTIF` filtré côté frontend).
- **`CategoriePatient` / `DroitCategoriePatient`** : matrice de couverture `EXAMEN` (D-009).
- **`DelegationPrescription`** : droit de prescription de l'infirmier (D-011).

> Le champ `etablissementId` (établissement destinataire) est un identifiant optionnel ; **la cible
> exacte de cette FK est à confirmer** dans [[modele_donnees_global]] (non vérifiée ici).

---

## 6. Règles métier

> IDs `RM-10-xx`. Aucune valeur chiffrée n'est définie en dur : les longueurs ci-dessous sont des
> contraintes de DTO (validation), non des paramètres métier configurables.

- **RM-10-01** — **Cloisonnement par site** : un bon n'est lisible/modifiable que si sa consultation
  appartient au site de l'appelant (`BonExamen → consultation → visite → siteId`). Anti-IDOR cross-site
  (`getOrThrow`, `findAll`). (Cf. [[exigences_non_fonctionnelles]], confidentialité.)
- **RM-10-02** — **Émission sur consultation ouverte uniquement** : un bon ne peut être créé que si la
  consultation cible est `OUVERTE` ; sinon `409` (`create`).
- **RM-10-03** — **Couverture par catégorie (cœur recueil, D-009)** : la création d'un bon d'examen
  (prestation `EXAMEN`) est **réservée** aux catégories couvertes (`ASSURE_CDI`, `AYANT_DROIT_CDI`) selon
  la matrice `DroitCategoriePatient` ; sinon `403` (`assertPrestationCouverte`,
  `apps/api/src/common/droits-categorie.ts`).
- **RM-10-04** — **Droit de prescription (D-011)** : MEDECIN_CHEF/ADMIN_SYSTEME émettent librement ;
  l'INFIRMIER ne peut émettre que s'il dispose d'une **délégation active** couvrant la date du jour ;
  sinon `403` (`assertPeutPrescrire`, `apps/api/src/common/prescription.ts`).
- **RM-10-05** — **Brouillon mutable seulement en `EN_ATTENTE`** : l'indication et l'établissement ne
  sont modifiables que tant que le bon est `EN_ATTENTE` (`update`).
- **RM-10-06** — **Transitions de statut** : `EN_ATTENTE → {VALIDE, ANNULE}` ; `VALIDE → ANNULE` (via
  `/annuler`) ; aucune autre transition. Un bon `ANNULE` est terminal (`validerOuAnnuler`, `annuler`).
- **RM-10-07** — **Motif d'annulation obligatoire** : toute annulation exige un motif non vide
  (≤ 500 car.) ; il est conservé sur le bon (`motifAnnulation`).
- **RM-10-08** — **Résultat sur bon validé uniquement** : un `ResultatExamen` ne peut être saisi que sur
  un bon `VALIDE` (`saisirResultat`).
- **RM-10-09** — **Traçabilité du résultat / non-suppression** : un bon **porteur d'au moins un
  résultat** ne peut pas être supprimé (il doit être annulé) — préservation de la trace clinique
  (`delete`). Le résultat trace toujours son auteur (`saisiePar`).
- **RM-10-10** — **Au moins un examen** : un bon comporte au minimum une ligne d'examen
  (`ArrayMinSize(1)`), chaque `typeExamenId` devant exister (`create`).
- **RM-10-11** — **Contraintes de saisie (DTO)** : indication ≤ 2000 car. (non vide), motif ≤ 500 car.,
  contenu de résultat ≤ 5000 car. (non vide), laboratoire ≤ 500 car., interprétation ≤ 2000 car.
  (`bon-examen.dto.ts`). *Limites de validation, non des PM configurables.*

---

## 7. Interfaces (expose / consomme)

> Contrats [[plan_modules#6. Contrats d'interface principaux]]. Routes sous `/bons-examen`
> (`BonExamenController`), gardées par `JwtAuthGuard` + `PermissionsGuard`.

**Expose (endpoints) :**

| Méthode · route | Permission | Rôle fonctionnel |
|-----------------|-----------|------------------|
| `GET /bons-examen` | `bon_examen.read` | Lister (filtres consultation/patient/statut) — EF-10-01 |
| `GET /bons-examen/:id` | `bon_examen.read` | Détail — EF-10-03 |
| `POST /bons-examen` | `bon_examen.create` | Émettre — EF-10-04..07 |
| `PATCH /bons-examen/:id` | `bon_examen.create` | Modifier brouillon — EF-10-08 |
| `PATCH /bons-examen/:id/statut` | `bon_examen.validate` | Valider / annuler — EF-10-09/10 |
| `PATCH /bons-examen/:id/annuler` | `bon_examen.cancel` | Annuler (y c. validé) — EF-10-11 |
| `DELETE /bons-examen/:id` | `bon_examen.delete` | Supprimer (sans résultat) — EF-10-12 |
| `POST /bons-examen/:id/resultats` | `bon_examen.result` | Saisir un résultat — EF-10-13/14 |

**Contrats inter-modules (par la donnée, sauf mention) :**
- **C-4** — *émission de documents cliniques* : `Consultation` → `BonExamen`. Le bon est créé en
  référençant `consultationId` (état `OUVERTE`). Couplage par la donnée (pas d'`imports` direct).
- **C-5** — *saisie des résultats d'examen* : `BonExamen` → dossier `Patient`. Le résultat revient au
  dossier (lecture via la consultation/visite).
- **C-6** — *référentiels consommés* : `Referentiels` (`TypeExamen`, `CategoriePatient`,
  `DroitCategoriePatient`) → `BonExamen`.
- **C-9** — *authentification & autorisation* : `Security` → `BonExamenController`
  (`imports: [SecurityModule]`, gardes globales).
- **C-11** — *audit* : mutations → `AuditInterceptor` global (`@Audit`, D-014).
- **C-12** — *synchronisation offline-first* : `BonExamen`, `LigneExamen`, `ResultatExamen` portent
  `updatedAt`/`deletedAt` et entrent dans la sync LWW (D-015/D-016).

**Consomme :** `BonExamenService` est **exporté** par `BonExamenModule` (réutilisable). `PrismaService`
(accès base), `assertPeutPrescrire`, `assertPrestationCouverte` (gardes partagées).

---

## 8. Exigences non fonctionnelles spécifiques

> Cf. socle [[exigences_non_fonctionnelles]]. Spécificités du module :

- **Confidentialité / sécurité** : cloisonnement par site **sur toutes** les opérations (RM-10-01) ;
  le scope soignant n'est **pas** appliqué ici (le bon est rattaché à la consultation, déjà scopée par
  son module). *Volet « médecin non-superviseur » : non appliqué dans ce module (à confirmer si requis).*
- **Traçabilité** : audit persistant des mutations (D-014) ; non-suppression d'un bon porteur de
  résultat (RM-10-09) ; auteur de chaque résultat conservé (`saisiePar`).
- **Offline-first** : opérations disponibles sur le backend embarqué du poste local ; cohérence assurée
  par soft-delete + LWW (D-015/D-016).
- **Temps réel** : invalidation live des listes (`@LiveRefresh`), perçue côté frontend (React Query).
- **i18n** : libellés frontend bilingues FR/EN (`bonExamen.*`, react-i18next).
- **Impression** : gabarit A4 SARIS unifié (logo, charte), variante intégrée à la zone consultation
  (`BonExamenPrintModal`, `variant="inline"`).

---

## 9. Risques et points ouverts

- **Cycle « RECU/CONSULTÉ » documentaire vs réel** : les commentaires du code mentionnent un cycle
  `VALIDE → RECU → CONSULTÉ`, mais le **statut du bon** ne matérialise pas `RECU`/`CONSULTÉ` (ce sont
  l'état du résultat et un libellé d'affichage). À clarifier pour éviter toute confusion (à confirmer).
- **Rôle `MEDECIN`** (D-003) : absent du catalogue de permissions ; la matrice du §2 le laisse vide.
  Tant que la divergence « 3 vs 4 rôles » n'est pas tranchée, les droits du bon d'examen pour un éventuel
  `MEDECIN` restent **non définis**.
- **FK `etablissementId`** : cible exacte non vérifiée dans ce travail ; à documenter dans
  [[modele_donnees_global]].
- **Couverture catégorie côté frontend** : l'éligibilité affichée (`ASSURE_CDI`/`AYANT_DROIT_CDI` codés)
  duplique la matrice backend `DroitCategoriePatient` ; une évolution de la matrice (seed) ne se
  refléterait pas automatiquement dans le masquage UI (le backend reste l'arbitre, EF-10-18).
- **Interaction avec le verrou de confidentialité** (D-006) : effet sur la lecture des bons via un
  dossier verrouillé non analysé ici (à confirmer).
- **Dépendance forte à la consultation ouverte** (RM-10-02) : aucun bon ne peut être ajouté après
  clôture ; cohérent avec le flux « émission depuis la décision » mais à garder en tête pour tout besoin
  de complément a posteriori.
