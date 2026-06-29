# Module 11 — Bon de pharmacie

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** V1 · **Historique** : v1.0 création

> Spécification « as-built » d'un module **réellement développé**. Faits techniques issus de la lecture du code : backend `apps/api/src/modules/bon-pharmacie/` (controller, service, dto, module), gardes partagées `apps/api/src/common/prescription.ts` et `apps/api/src/common/droits-categorie.ts` ; frontend `apps/web/src/modules/bon-pharmacie/` (carte, hooks, impression). Termes, entités et identifiants alignés sur [[_SOURCE_systeme]], [[glossaire]], [[plan_modules]], [[modele_donnees_global]], [[parametres_metier]] et [[registre_decisions]].

---

## 1. Mission et périmètre

### 1.1 Mission

Le module **Bon de pharmacie** émet, en aval d'une **consultation**, un **bon de retrait de médicaments** (voucher) **distinct de l'ordonnance** (cf. [[glossaire]] « Bon de pharmacie », décision **D-010**). C'est le document qui matérialise la **prise en charge des médicaments** par le CMS pour les patients qui y ont droit. Il porte une ou plusieurs **lignes de médicaments**, suit un cycle de vie **EN_ATTENTE → DELIVRE / ANNULE**, et est **imprimable au format A4 SARIS**.

Son **émission est conditionnée par la catégorie du patient** : seuls le **personnel CDI** et ses **ayants droit** ouvrent droit à la prestation `MEDICAMENT` (règle centrale du recueil, décision **D-009**). Elle est en outre soumise au **droit de prescrire** (décision **D-011**).

Le module appartient au domaine **Parcours de soin clinique** ([[plan_modules]] §3). Classe NestJS `BonPharmacieModule` (`bon-pharmacie/bon-pharmacie.module.ts`), controller `BonPharmacieController` exposé sous `/bons-pharmacie`, service `BonPharmacieService` (exporté).

### 1.2 Dans le périmètre

- Création d'un bon rattaché à une **consultation OUVERTE** avec ≥ 1 ligne de médicament.
- Consultation des bons (liste filtrée, détail) cloisonnée par **site**.
- Marquage **« délivré »** (retrait effectué en pharmacie) et **annulation** avec motif obligatoire.
- **Suppression** définitive d'un bon (sous conditions).
- **Impression A4** du bon (gabarit SARIS).
- Application des deux gardes métier : **droit de prescrire** (D-011) et **droit de catégorie** sur `MEDICAMENT` (D-009).

### 1.3 Hors périmètre (explicite)

- **Prescription par ordonnance** : c'est un acte distinct, **non restreint par catégorie** ([[glossaire]] « Ordonnance », D-010). Le bon de pharmacie **ne remplace pas** et **ne reprend pas** les lignes d'ordonnance.
- **Gestion de stock / inventaire pharmacie** : le module **ne** tient **aucun** stock, ni mouvement, ni décrément de quantité. La « délivrance » est un simple changement d'état (pas de débit de stock). *Aucune entité de stock dans le code.*
- **Plafonds / quotas de prise en charge** : la table `DroitCategoriePatient` porte des champs `plafondConsultations`/`periode` ([[modele_donnees_global]] §3.6), mais le module **ne les applique pas** pour les médicaments (la garde teste uniquement `couvert = true`). *à confirmer si un plafonnement médicament est attendu.*
- **Contre-indications médicamenteuses** : le référentiel `ContreIndicationMedicament` existe mais **n'est pas contrôlé** à l'émission du bon (aucune vérification dans `BonPharmacieService.create`).
- **Bon d'examen** : prestation `EXAMEN`, traitée par un module distinct (`bon-examen`) — voir [[MODULE_10_bon_examen]] / module dédié.
- **Délivrance partielle / par ligne** : la délivrance s'applique au **bon entier**, pas ligne par ligne.

---

## 2. Acteurs et rôles

Rôles du système (3, cf. [[glossaire]] « Rôle », **D-003**) ; les droits sont portés par les permissions du catalogue `packages/types/src/permissions.ts` (clés `bon_pharmacie.*`). « MEDECIN » n'est **pas** un rôle : c'est une **profession** du personnel médical mappée au rôle `MEDECIN_CHEF` (tout médecin reçoit ce rôle).

| Permission | ADMIN_SYSTEME | MEDECIN_CHEF | INFIRMIER |
|---|:---:|:---:|:---:|
| `bon_pharmacie.read` | ✓ | ✓ | ✓ |
| `bon_pharmacie.create` | ✓ | ✓ | ✓ |
| `bon_pharmacie.deliver` | ✓ | ✓ | ✗ |
| `bon_pharmacie.cancel` | ✓ | ✓ | ✓ |
| `bon_pharmacie.delete` | ✓ | ✓ | ✗ |

> Lecture du code (`permissions.ts`) : `ADMIN_SYSTEME` possède **les 5** permissions (catalogue complet, **D-004**) ; `MEDECIN_CHEF` possède **les 5** ; l'INFIRMIER possède `read`, `create`, `cancel` mais **ni `deliver` ni `delete`**. Conformément à **D-003**, « MEDECIN » n'est pas un rôle au catalogue : c'est une profession mappée au rôle `MEDECIN_CHEF` (un médecin dispose des droits de `MEDECIN_CHEF`). Voir [[MODULE_02_acces_habilitations]].

**Droit de prescrire (orthogonal aux permissions, garde D-011, `assertPeutPrescrire`)** : à la **création** d'un bon, `MEDECIN_CHEF`/`ADMIN_SYSTEME` émettent librement ; un **INFIRMIER** ne peut émettre **que** s'il dispose d'une **délégation de prescription active** (`DelegationPrescription` couvrant le jour). Sinon : refus `403`.

**Catégories de patient concernées** (pilotent l'éligibilité, **D-009**, [[glossaire]]) :
- **Éligibles** (droit `MEDICAMENT`) : **ASSURE_CDI**, **AYANT_DROIT_CDI**.
- **Non éligibles** : **ASSURE_CDD**, **SOUS_TRAITANT**, **RIVERAIN** (et toute catégorie sans ligne `couvert=true` sur `MEDICAMENT`).

---

## 3. Exigences fonctionnelles

> IDs **EF-11-xx**. Vérifiables. Endpoints réels sous `/bons-pharmacie` (`bon-pharmacie.controller.ts`).

- **EF-11-01** — Le module expose la **consultation de la liste** des bons (`GET /bons-pharmacie`), filtrable par `consultationId`, `patientId` et `statut` (`EN_ATTENTE`|`DELIVRE`|`ANNULE`|`TOUS`), triée par date de création décroissante. Permission `bon_pharmacie.read`.
- **EF-11-02** — Le module expose le **détail d'un bon** (`GET /bons-pharmacie/:id`), incluant ses lignes (médicament, libellé, posologie, quantité) et le patient associé. Permission `bon_pharmacie.read`.
- **EF-11-03** — Le module permet de **créer un bon** (`POST /bons-pharmacie`) rattaché à une consultation, avec **au moins une ligne** de médicament (`ArrayMinSize(1)`). Permission `bon_pharmacie.create`. Réponse `201`.
- **EF-11-04** — Une **ligne** de bon porte : un `medicamentId` **optionnel** (UUID vers `MedicamentReference`), un **`libelle` obligatoire** (≤ 200 car.), une `posologie` optionnelle (≤ 200 car.), une `quantite` optionnelle (texte, ≤ 100 car.). Un `observations` optionnel (≤ 1000 car.) accompagne le bon.
- **EF-11-05** — La création est **refusée** si la **catégorie du patient** n'ouvre pas droit à la prestation `MEDICAMENT` (garde `assertPrestationCouverte`, `403`). Cf. RM-11-03.
- **EF-11-06** — La création est **refusée** si l'appelant n'a pas le **droit de prescrire** (garde `assertPeutPrescrire`, `403`). Cf. RM-11-02.
- **EF-11-07** — La création est **refusée** si la consultation cible est **introuvable sur le site** (`404`) ou **non OUVERTE** (`409`). Cf. RM-11-01.
- **EF-11-08** — Le module permet de **marquer un bon délivré** (`PATCH /bons-pharmacie/:id/delivrer`), enregistrant la date (`delivreLe`) et, optionnellement, l'agent qui a délivré (`delivrePar`, texte ≤ 100 car.). Permission `bon_pharmacie.deliver`.
- **EF-11-09** — Le module permet d'**annuler un bon** (`PATCH /bons-pharmacie/:id/annuler`) avec un **motif obligatoire** (`motifAnnulation`, ≤ 500 car.). Permission `bon_pharmacie.cancel`.
- **EF-11-10** — Le module permet de **supprimer définitivement un bon** (`DELETE /bons-pharmacie/:id`), avec suppression de ses lignes. Permission `bon_pharmacie.delete`. Réponse `200` (`{ id, deleted: true }`).
- **EF-11-11** — Chaque bon expose un **statut** parmi `EN_ATTENTE` (initial), `DELIVRE`, `ANNULE`, qui conditionne les transitions autorisées (cf. RM-11-04 à RM-11-06).
- **EF-11-12** — Toutes les lectures et actions sont **cloisonnées par site** : un bon n'est accessible que si sa consultation → visite → `siteId` correspond au site de l'utilisateur (anti-IDOR cross-site). Cf. RM-11-07.
- **EF-11-13** — Un bon est **imprimable au format A4 SARIS** depuis l'interface (modale d'impression intégrée à la zone de droite de la consultation).
- **EF-11-14** — Les mutations du module (création, délivrance, annulation, suppression) sont **journalisées à l'audit** (`@Audit('bon_pharmacie', 'Bon de pharmacie')`, intercepteur global, **D-014**) et déclenchent un **rafraîchissement temps réel** des listes (`@LiveRefresh('LIVE_BONS_PHARMACIE')`).
- **EF-11-15** — Côté interface, l'action **« Nouveau bon »** est **masquée** lorsque la catégorie patient n'est pas éligible (`ASSURE_CDI`/`AYANT_DROIT_CDI`), avec un état vide explicatif « Médicaments non pris en charge ». La garde backend reste l'arbitre (RM-11-03).

---

## 4. Cas d'utilisation

> IDs **CU-11-xx**. Critères « Étant donné / Quand / Alors ».

### CU-11-01 — Émettre un bon de pharmacie pour un patient éligible

- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME ; ou INFIRMIER **délégué**).
- **Déclencheur** : depuis une consultation **ouverte**, l'acteur ouvre « Nouveau bon » et sélectionne un ou plusieurs médicaments du référentiel.
- **Scénario nominal** :
  1. L'acteur ajoute des lignes (médicament du référentiel + posologie/quantité optionnelles) et, éventuellement, des observations.
  2. Il valide ; le système vérifie le droit de prescrire (D-011), l'état OUVERTE de la consultation et le droit de catégorie `MEDICAMENT` (D-009).
  3. Le bon est créé au statut `EN_ATTENTE` avec ses lignes (transaction unique).
- **Scénarios d'erreur** :
  - Consultation clôturée → `409` (CU bloqué, cf. RM-11-01).
  - Catégorie non éligible → `403` (RM-11-03).
  - Appelant sans droit de prescrire / infirmier sans délégation active → `403` (RM-11-02).
  - Aucune ligne → `400` (validation `ArrayMinSize(1)`).
- **Hors-ligne** : opération **enqueue** dans la file de rejeu offline (web : `OfflineQueuedError` silencieux côté toast ; desktop : backend local SQLite). La création est rejouée à la reconnexion ; les gardes s'appliquent au backend local. Cf. [[MODULE_16_synchronisation]], D-001/D-016.
- **Critères** : *Étant donné* un patient `ASSURE_CDI` ou `AYANT_DROIT_CDI` et une consultation `OUVERTE`, *quand* un prescripteur autorisé valide un bon avec ≥ 1 médicament, *alors* un bon `EN_ATTENTE` est créé et listé, l'action est auditée et la liste rafraîchie en direct.

### CU-11-02 — Tentative d'émission pour un patient non éligible

- **Acteur** : MEDECIN_CHEF / INFIRMIER délégué.
- **Déclencheur** : consultation d'un patient `SOUS_TRAITANT`, `RIVERAIN` ou `ASSURE_CDD`.
- **Scénario nominal** : l'interface **masque** « Nouveau bon » et affiche « Médicaments non pris en charge » (EF-11-15).
- **Scénario d'erreur (contournement API)** : un `POST` direct est **refusé `403`** par `assertPrestationCouverte` avec un message nommant la catégorie (RM-11-03).
- **Critères** : *Étant donné* un patient non éligible, *quand* on tente de créer un bon, *alors* le backend renvoie `403` quelle que soit l'interface.

### CU-11-03 — Marquer un bon comme délivré

- **Acteur** : titulaire de `bon_pharmacie.deliver` (MEDECIN_CHEF / ADMIN_SYSTEME).
- **Déclencheur** : le patient retire ses médicaments ; l'agent confirme la délivrance.
- **Scénario nominal** : le bon `EN_ATTENTE` passe `DELIVRE`, `delivreLe` = maintenant, `delivrePar` renseigné si fourni.
- **Scénarios d'erreur** : bon déjà `DELIVRE` ou `ANNULE` → `409` (seul un `EN_ATTENTE` peut être délivré, RM-11-04).
- **Hors-ligne** : rejouable via la file offline.
- **Critères** : *Étant donné* un bon `EN_ATTENTE`, *quand* l'agent le marque délivré, *alors* le statut devient `DELIVRE` avec horodatage, et la transition est tracée à l'audit.

### CU-11-04 — Annuler un bon avec motif

- **Acteur** : titulaire de `bon_pharmacie.cancel` (MEDECIN_CHEF / INFIRMIER / ADMIN_SYSTEME).
- **Déclencheur** : erreur de saisie ou retrait abandonné, **avant** délivrance.
- **Scénario nominal** : l'acteur saisit un **motif obligatoire** ; le bon `EN_ATTENTE` passe `ANNULE` (motif conservé).
- **Scénarios d'erreur** : bon déjà `ANNULE` → `409` ; bon `DELIVRE` → `409` (un bon délivré ne s'annule pas, RM-11-05) ; motif vide → `400`.
- **Critères** : *Étant donné* un bon `EN_ATTENTE`, *quand* l'acteur l'annule avec un motif, *alors* le statut devient `ANNULE` et le motif est enregistré.

### CU-11-05 — Supprimer un bon

- **Acteur** : titulaire de `bon_pharmacie.delete` (MEDECIN_CHEF / ADMIN_SYSTEME).
- **Déclencheur** : suppression d'un bon erroné non délivré.
- **Scénario nominal** : le bon et ses lignes sont supprimés (transaction) ; réponse `{ id, deleted: true }`.
- **Scénarios d'erreur** : côté interface, l'action de suppression est **indisponible** pour un bon `DELIVRE` (`statut !== 'DELIVRE'`). Bon introuvable sur le site → `404`.
- **Critères** : *Étant donné* un bon non délivré, *quand* un acteur habilité le supprime, *alors* le bon et ses lignes disparaissent et l'action est auditée.
- *As-built : la suppression côté service est une suppression Prisma `delete` enveloppée dans une transaction ; le soft-delete global (D-015) s'applique : `BonPharmacie`/`LigneBonPharmacie` sont sur l'allow-list `PrismaService` (suppression = pose d'un tombstone `deletedAt`, propagée par synchronisation).*

### CU-11-06 — Imprimer un bon

- **Acteur** : tout titulaire de `bon_pharmacie.read` (consultation du bon).
- **Déclencheur** : bouton « Imprimer » sur la carte du bon.
- **Scénario nominal** : ouverture de la modale d'impression A4 SARIS (composant `BonPharmaciePrintModal`, variante intégrée à la zone de droite), reprenant lignes, posologie, quantité, observations, soignant et catégorie.
- **Hors-ligne** : impression locale (rendu client), indépendante du réseau.
- **Critères** : *Étant donné* un bon existant, *quand* l'utilisateur l'imprime, *alors* un document A4 SARIS conforme est généré.

---

## 5. Données du module

Référence transverse : [[modele_donnees_global]] §3.4 (« Consultation & actes prescrits »).

**Entités propres au module** :

- **`BonPharmacie`** — bon de retrait de médicaments. Champs notables : `consultationId` (rattachement, **1 consultation → N bons**), `prescripteurId`, `statut` (`EN_ATTENTE`/`DELIVRE`/`ANNULE`), `observations`, `delivreLe`, `delivrePar`, `motifAnnulation`, `createdAt`. Colonnes de sync `updatedAt`/`deletedAt` (U·D).
- **`LigneBonPharmacie`** — ligne de médicament : `bonId`, `medicamentId` (optionnel → `MedicamentReference`), `libelle`, `posologie`, `quantite`. (U·D.)

**Entités consommées (lecture)** :

- **`Consultation`** (état `OUVERTE` requis à la création) et, par jointure, **`Visite`** (`siteId` pour le cloisonnement) et **`Patient`** (`categoriePatientId` pour l'éligibilité, identité pour l'impression).
- **`MedicamentReference`** (référentiel ; picker des lignes, libellés `nomGenerique`/`nomCommercial`).
- **`CategoriePatient`** + **`DroitCategoriePatient`** (matrice prestation, garde `MEDICAMENT`).
- **`DelegationPrescription`** (garde de prescription pour l'infirmier).

> Le `prescripteurId` enregistré est le `personnelMedicalId` de l'appelant, **à défaut** son `id` utilisateur (`user.personnelMedicalId ?? user.id`, cf. controller).

---

## 6. Règles métier

> IDs **RM-11-xx**. Aucune valeur chiffrée en dur n'est introduite ici (le module n'a pas de seuil numérique propre ; les délais/limites éventuels relèveraient de [[parametres_metier]]).

- **RM-11-01** — Un bon ne peut être créé que sur une **consultation OUVERTE** du **site** de l'utilisateur. Consultation introuvable → `404` ; statut ≠ `OUVERTE` → `409`. *(Source : `BonPharmacieService.create`.)*
- **RM-11-02** — **Droit de prescrire** (D-011) : `MEDECIN_CHEF`/`ADMIN_SYSTEME` prescrivent librement ; un `INFIRMIER` ne peut créer un bon **que** s'il dispose d'une **`DelegationPrescription` ACTIVE** couvrant la date du jour ; sinon `403`. *(Garde `assertPeutPrescrire`.)*
- **RM-11-03** — **Droit de catégorie** (D-009, **règle centrale du recueil**) : la création n'est autorisée que si la **catégorie** du patient ouvre droit à la prestation **`MEDICAMENT`** (`DroitCategoriePatient.couvert = true`) — c.-à-d. **CDI et ayants droit** uniquement ; sinon `403`. *(Garde `assertPrestationCouverte(..., 'MEDICAMENT')`.)*
- **RM-11-04** — **Délivrance** : seul un bon **`EN_ATTENTE`** peut passer `DELIVRE` ; toute autre origine → `409`. La délivrance fixe `delivreLe` (horodatage) et `delivrePar` (optionnel).
- **RM-11-05** — **Annulation** : un bon **`DELIVRE` ne peut être annulé** (`409`) ; un bon déjà `ANNULE` ne peut l'être de nouveau (`409`) ; le **motif est obligatoire** (`400` sinon). Seul un `EN_ATTENTE` est annulable.
- **RM-11-06** — **Cycle de vie** : `EN_ATTENTE` est l'état initial ; transitions terminales `→ DELIVRE` (irréversible) ou `→ ANNULE`. Aucune ré-ouverture d'un bon clôturé n'est prévue.
- **RM-11-07** — **Cloisonnement site (anti-IDOR)** : toute lecture/action résout le bon par `consultation.visite.siteId = siteId` de l'appelant ; un bon d'un autre site est **introuvable** (`404`), jamais exposé.
- **RM-11-08** — **Intégrité de création** : un bon doit comporter **≥ 1 ligne** et chaque ligne un **libellé** non vide (le `medicamentId` est facultatif côté backend ; l'interface impose en pratique le choix d'un médicament du référentiel). Les chaînes sont **trimées** ; champs vides → `null`.
- **RM-11-09** — **Distinction ordonnance / bon** (D-010) : le bon de pharmacie est **indépendant** de l'ordonnance ; sa restriction de catégorie **ne s'applique pas** à l'ordonnance (prescription libre).

---

## 7. Interfaces

Renvoi aux contrats de [[plan_modules]] §6.

- **Expose (C-4 — Émission de documents cliniques)** : `BonPharmacieService` (exporté par `BonPharmacieModule`) et l'API REST `/bons-pharmacie`. Consommé depuis la **décision de consultation** (`Consultation` → `BonPharmacie`).
- **Consomme — Référentiels (C-6)** : `MedicamentReference`, `CategoriePatient`/`DroitCategoriePatient` ([[MODULE_05_referentiels]]).
- **Consomme — données cliniques** : `Consultation` / `Visite` / `Patient` (collaboration **par la donnée**, pas par `imports` ; cf. [[plan_modules]] note C-2…C-6).
- **Consomme — délégation** : `DelegationPrescription` (D-011).
- **Dépend (imports NestJS)** : **`SecurityModule`** uniquement (gardes `JwtAuthGuard` + `PermissionsGuard`), cf. [[plan_modules]] §4 (contrat **C-9**). L'accès base passe par `PrismaService`.
- **Audit (C-11)** : mutations journalisées via `@Audit` + `AuditInterceptor` global (D-014).
- **Temps réel (C-8)** : invalidations live `LIVE_BONS_PHARMACIE` (intercepteur `LiveRefresh`).
- **Synchronisation (C-12)** : `BonPharmacie`/`LigneBonPharmacie` portent `updatedAt`/`deletedAt` → répliqués LWW vers les postes locaux (D-015/D-016, [[MODULE_16_synchronisation]]).
- **Frontend** : carte `BonPharmacieCard` (zone de droite de la consultation/dossier), hooks React Query (`useBonsPharmacie`, `useCreate/Delivrer/Annuler/DeleteBonPharmacie`), impression `BonPharmaciePrintModal`. Le picker de médicaments est alimenté par le référentiel (médicaments `ACTIF`).

---

## 8. Exigences non fonctionnelles spécifiques

- **Sécurité / confidentialité** : cloisonnement strict par site (RM-11-07) ; double garde métier (catégorie + prescription) appliquée **côté backend**, l'interface n'étant qu'un confort (l'action « Nouveau bon » masquée ne dispense jamais du contrôle serveur).
- **Offline-first** : les mutations sont **rejouables hors-ligne** (file IndexedDB côté web, backend local SQLite côté desktop) ; les gardes s'exécutent aussi sur le backend embarqué. Cf. [[MODULE_16_synchronisation]], D-001/D-020.
- **Traçabilité** : audit persistant de toutes les mutations (D-014) ; `delivrePar`, `delivreLe`, `motifAnnulation` conservés pour la piste.
- **Cohérence transactionnelle** : création (bon + lignes) et suppression (lignes + bon) exécutées en **transaction Prisma** unique.
- **Temps réel** : rafraîchissement automatique des listes via SSE (`LIVE_BONS_PHARMACIE`).
- **i18n** : interface bilingue FR/EN stricte (clés `bonPharmacie.*`, `apps/web/src/i18n/locales/modules/bonPharmacie.ts`).
- **Impression** : gabarit **A4 SARIS** unifié.

---

## 9. Risques et points ouverts

- **Rôles** (D-003) : le système compte **3 rôles d'habilitation** (`ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER`). « MEDECIN » est une profession mappée au rôle `MEDECIN_CHEF` ; les droits d'un médecin sont ceux de `MEDECIN_CHEF` (§2).
- **Soft-delete de `BonPharmacie`/`LigneBonPharmacie`** : `delete()` utilise `prisma.*.delete`/`deleteMany` ; ces entités étant sur l'allow-list soft-delete `PrismaService` (D-015), la suppression pose un tombstone `deletedAt` (soft-delete global), propagé par synchronisation.
- **Plafonds de prise en charge** : `DroitCategoriePatient.plafondConsultations`/`periode` **non appliqués** aux médicaments. À confirmer si un plafonnement (nombre de bons / période) est attendu par le recueil.
- **Contre-indications** : `ContreIndicationMedicament` **non vérifié** à l'émission. Risque clinique résiduel : aucune alerte d'interaction/contre-indication à la création du bon.
- **`delivrePar` libre** : champ **texte libre** (≤ 100 car.), non relié à un acteur (`PersonnelMedical`/`Utilisateur`). Traçabilité de l'agent dispensateur **faible**. À confirmer si une référence forte est souhaitée.
- **Quantité textuelle** : `quantite` est une **chaîne** (≤ 100 car.), non numérique — pas d'agrégation ni de contrôle de stock possible (cohérent avec le hors-périmètre stock, mais limite les statistiques de dispensation).
- **Migration tables dormantes** : alignement recueil (D-023) ; aucune table du module n'est dormante, mais la **re-baseline** générale des migrations reste à régulariser au déploiement.

---

*Sources de vérité : [[_SOURCE_systeme]], [[registre_decisions]] (D-009, D-010, D-011, D-014, D-015, D-016), [[glossaire]], [[plan_modules]], [[modele_donnees_global]], [[parametres_metier]]. Code : `apps/api/src/modules/bon-pharmacie/`, `apps/api/src/common/{prescription,droits-categorie}.ts`, `apps/web/src/modules/bon-pharmacie/`, `packages/types/src/permissions.ts`.*
