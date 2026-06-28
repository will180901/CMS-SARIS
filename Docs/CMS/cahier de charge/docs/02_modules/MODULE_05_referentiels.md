# Module 05 — Référentiels

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » du module **Référentiels** (le système est développé et déployé). Elle documente ce qui EXISTE dans le code. Sources lues : `apps/api/src/modules/referentiels/{referentiels.controller.ts, referentiels.service.ts, dto/*}`, `apps/api/src/common/droits-categorie.ts`, `packages/db/prisma/schema.prisma`, `packages/types/src/permissions.ts`, `packages/db/prisma/seed.ts`, et le frontend `apps/web/src/modules/referentiels/`. Alignée sur [[_SOURCE_systeme]], [[glossaire]], [[plan_modules]], [[modele_donnees_global]], [[parametres_metier]], [[registre_decisions]].

---

## 1. Mission et périmètre

### 1.1 Mission
Le module Référentiels **gère les données de référence métier partagées** qui alimentent l'ensemble des parcours cliniques : sites, catégories de patients (et la matrice de **droits par catégorie** qui pilote l'accès aux bons), motifs de consultation, pathologies, médicaments, types d'examen et types de consultation. Il offre, par entité, une gestion **CRUD** (créer / modifier / activer-désactiver / supprimer) avec contrôle d'accès **granulaire par service**. Référentiel `Referentiels` selon [[plan_modules]] (contrat **C-6**).

### 1.2 Entités effectivement gérées par le contrôleur
Le contrôleur `ReferentielsController` (`referentiels.controller.ts`) expose la gestion de **sept entités** :
1. **Sites** (`Site`)
2. **Motifs de consultation** (`MotifConsultation`)
3. **Pathologies** (`PathologieReference`)
4. **Médicaments** (`MedicamentReference`)
5. **Catégories de patients** (`CategoriePatient`)
6. **Types d'examen** (`TypeExamen`)
7. **Types de consultation** (`TypeConsultation`)

### 1.3 Le cœur métier : droits par catégorie
La **matrice des droits par catégorie** (`DroitCategoriePatient`) est la **règle centrale du recueil** (décision [[registre_decisions]] D-009) : la catégorie de patient **pilote les droits aux prestations**. Elle est documentée ici car elle est conceptuellement portée par le référentiel **catégorie patient**, mais — honnêteté as-built — elle **n'est PAS exposée par le contrôleur Référentiels** : elle est **peuplée par le seed** (`packages/db/prisma/seed.ts`) et **lue par un garde partagé** `assertPrestationCouverte` (`apps/api/src/common/droits-categorie.ts`) appliqué dans les modules `bon-examen` et `bon-pharmacie`. Voir §6 (RM-05-07) et §7 (C-6).

### 1.4 Hors-périmètre (explicite)
- **Sociétés sous-traitantes** (`SocieteSousTraitante`) et **registre employé SARIS** (`EmployeSaris`) : portés par d'autres modules backend (`personnel` pour les sous-traitants, `employe` pour le registre, cf. [[plan_modules]] et D-022). Ils apparaissent comme **onglets** dans l'écran Référentiels du frontend (regroupement d'IHM), mais ne relèvent PAS de ce contrôleur. Documentés dans leurs modules respectifs.
- **Types de certificat** (`TypeCertificat`) : le modèle existe en base et la mémoire projet évoque deux onglets « Types consultation / certificat » ajoutés ; **le contrôleur Référentiels actuel n'expose PAS d'endpoints `types-certificat`** (vérifié dans `referentiels.controller.ts`). Le périmètre certificat est par ailleurs **restreint** par l'alignement au recueil (D-023, certificat réduit au « Repos maladie »). Statut : **à confirmer** (gestion par seed uniquement à ce jour).
- **Édition de la matrice `DroitCategoriePatient`** depuis l'IHM : non exposée (peuplée par seed). Aucun écran d'administration de la matrice.
- **`EtablissementReference`** (établissements d'évacuation) : modèle présent, **non géré** par ce contrôleur.
- **Notion de priorité** : retirée de tout le système (D-008) — ne s'applique pas ici.

---

## 2. Acteurs et rôles

Les rôles sont définis dans [[glossaire]] (terme « Rôle ») et [[registre_decisions]] D-003/D-004. Le contrôle d'accès s'appuie sur les permissions `referentiel.*` (`packages/types/src/permissions.ts`).

| Acteur | Lecture (`referentiel.read`) | Écriture (create/update/delete granulaires) |
|--------|------------------------------|---------------------------------------------|
| **ADMIN_SYSTEME** | Oui | Oui — possède **tout** le catalogue, dont les 21 permissions `referentiel.*` (D-004) |
| **MEDECIN_CHEF** | Oui (`referentiel.read`) | Oui — dispose du bloc complet `referentiel.*` d'écriture (vérifié `permissions.ts`, lignes 360-367) |
| **MEDECIN** | Selon attribution | Selon attribution (rôle non présent au catalogue de droits — cf. D-003, « à confirmer ») |
| **INFIRMIER** | Oui (`referentiel.read`) | **Limité** : `referentiel.motif.create` uniquement (vérifié `permissions.ts`, ligne 402) ; pas d'autre écriture référentiel |

**Catégories de patient** (pertinentes pour le cœur métier, [[glossaire]]) : **ASSURE_CDI**, **AYANT_DROIT_CDI**, **ASSURE_CDD**, **SOUS_TRAITANT**, **RIVERAIN**. Elles ne sont pas des « acteurs » mais sont l'objet du référentiel `CategoriePatient` et pilotent les droits (D-009).

---

## 3. Exigences fonctionnelles

Identifiants **EF-05-xx**. Toutes vérifiées dans `referentiels.controller.ts` / `referentiels.service.ts`.

| ID | Exigence |
|----|----------|
| **EF-05-01** | Le système expose, en lecture, la liste de chaque entité de référentiel (`GET /referentiels/{sites,motifs,pathologies,medicaments,categories-patient,types-examen,types-consultation}`), sous la permission unique `referentiel.read`. |
| **EF-05-02** | La liste accepte deux filtres optionnels : `search` (texte) et `statut` (un parmi `ACTIF`/`INACTIF`/`ACTIVE`/`INACTIVE`), via `ListQueryDto`. |
| **EF-05-03** | La recherche `search` est **insensible à la casse** (helper `CI`) et porte sur les champs métier de chaque entité (ex. site : libellé/code/localisation ; médicament : nom générique/commercial/famille thérapeutique ; type d'examen : libellé/code/domaine). |
| **EF-05-04** | Les listes sont triées de façon stable : par `libelle` croissant (par défaut), par `nomGenerique` (médicaments), par `domaine` puis `libelle` (types d'examen). |
| **EF-05-05** | Le système permet de **créer** une entrée pour chaque entité (`POST /referentiels/<type>`, code HTTP 201), sous une permission **granulaire** `referentiel.<service>.create`. |
| **EF-05-06** | Le système permet de **modifier les champs métier** d'une entrée (`PATCH /referentiels/<type>/:id`), sous `referentiel.<service>.update`. Le champ `statut` est **exclu** des DTO de modification. |
| **EF-05-07** | Le système permet d'**activer/désactiver** une entrée (`PATCH /referentiels/<type>/:id/statut`), sous `referentiel.<service>.delete`, via `ToggleStatutReferentielDto`. |
| **EF-05-08** | Le système permet la **suppression définitive** d'une entrée (`DELETE /referentiels/<type>/:id`), sous `referentiel.<service>.delete`. |
| **EF-05-09** | Le système expose une lecture unitaire pour le site uniquement (`GET /referentiels/sites/:id`). Les autres entités n'ont pas d'endpoint `GET /:id` (lecture via la liste). |
| **EF-05-10** | Pour chaque entité à `code` unique (site, motif, pathologie, catégorie, type d'examen, type de consultation), la création **refuse un code déjà utilisé** (409). Le médicament n'a pas de code (pas d'unicité de code). |
| **EF-05-11** | La création d'une pathologie accepte un indicateur `chronique` (booléen, défaut `false`), avec une coercition stricte « true »/« false » (rejet 400 de toute autre valeur). |
| **EF-05-12** | La création d'un type d'examen impose un `domaine` parmi `BIOLOGIE`, `IMAGERIE`, `SPECIALISE` (rejet 400 sinon). |
| **EF-05-13** | Toutes les mutations du module sont **journalisées** (audit) et déclenchent un **rafraîchissement temps réel** des listes (voir §7). |
| **EF-05-14** | La granularité des permissions garantit qu'un acteur peut recevoir un droit d'écriture sur une entité (ex. créer des motifs) **sans** obtenir les droits sur les autres entités (ex. sites). |
| **EF-05-15** | Les permissions d'écriture séparent **modifier** (`.update`) et **désactiver/supprimer** (`.delete`) : un acteur n'ayant que `.update` ne peut pas changer le `statut`. |

---

## 4. Cas d'utilisation

Identifiants **CU-05-xx**. Critères « Étant donné / Quand / Alors ».

### CU-05-01 — Créer un motif de consultation
- **Acteur** : ADMIN_SYSTEME, MEDECIN_CHEF, ou INFIRMIER (seul acte d'écriture référentiel ouvert à l'infirmier).
- **Déclencheur** : besoin d'un nouveau motif dans la liste de triage/consultation.
- **Scénario nominal** : l'acteur ouvre l'onglet Motifs, saisit code + libellé, valide → entrée créée (201) et liste rafraîchie en direct.
- **Scénarios d'erreur** : code déjà utilisé → 409 ; champ manquant/trop long → 400 ; permission absente → 403.
- **Hors-ligne** : possible sur poste local (backend embarqué) ; la création est répliquée au central à la synchronisation (D-001/D-016).
- **Critères** : *Étant donné* un code de motif inédit, *Quand* l'acteur crée le motif, *Alors* le motif apparaît actif dans la liste et est utilisable au triage.

### CU-05-02 — Désactiver une entrée référencée (au lieu de la supprimer)
- **Acteur** : porteur de `referentiel.<service>.delete`.
- **Déclencheur** : une entrée ne doit plus être proposée mais est déjà utilisée par des données existantes.
- **Scénario nominal** : l'acteur bascule le statut sur INACTIF/INACTIVE (`PATCH …/statut`) → l'entrée reste en base, masquée des sélecteurs filtrant sur le statut actif.
- **Scénario d'erreur** : statut non reconnu → 400.
- **Hors-ligne** : oui (mutation locale + sync).
- **Critères** : *Étant donné* une entrée référencée, *Quand* l'acteur la désactive, *Alors* son statut devient inactif et l'historique des données qui la référencent reste intègre.

### CU-05-03 — Supprimer définitivement une entrée non référencée
- **Acteur** : porteur de `referentiel.<service>.delete`.
- **Déclencheur** : entrée erronée jamais utilisée.
- **Scénario nominal** : `DELETE …/:id` → suppression effective (`{ id, deleted: true }`).
- **Scénario d'erreur** : entrée **référencée** par des données existantes → **409** avec message invitant à la désactiver (contraintes Prisma `P2003`/`P2014` interceptées) ; entrée introuvable → 404.
- **Hors-ligne** : oui (soft-delete bi-cible, propagation par tombstone — D-015).
- **Critères** : *Étant donné* une entrée non référencée, *Quand* l'acteur la supprime, *Alors* elle disparaît ; *et si* elle est référencée, *Alors* la suppression est refusée (409) et l'entrée est conservée.

### CU-05-04 — Modifier les champs métier sans toucher au statut
- **Acteur** : porteur de `referentiel.<service>.update` (sans `.delete`).
- **Déclencheur** : correction d'un libellé/code.
- **Scénario nominal** : `PATCH …/:id` avec les champs métier → mise à jour ; le `statut` envoyé dans le corps est **ignoré** (champ absent du DTO).
- **Scénario d'erreur** : entrée introuvable → 404 ; valeur invalide → 400.
- **Critères** : *Étant donné* un acteur n'ayant que `.update`, *Quand* il tente d'inclure un changement de statut, *Alors* le statut reste inchangé (séparation des droits respectée).

### CU-05-05 — Réutiliser un code « ressuscité » après suppression logique
- **Acteur** : porteur de `referentiel.<service>.create`.
- **Déclencheur** : recréer une entrée dont le code avait été soft-supprimé.
- **Scénario nominal** : à la création, le service consulte le client **brut** (`prisma.raw`) ; si une entrée portant ce code existe mais est en tombstone (`deletedAt` non nul), elle est **réactivée** (mise à jour, `deletedAt: null`) plutôt que dupliquée ; si elle est active, → 409. (Applicable aux entités à code unique : site, motif, pathologie, catégorie, type d'examen, type de consultation.)
- **Critères** : *Étant donné* un code en tombstone, *Quand* l'acteur recrée ce code, *Alors* l'entrée existante est ressuscitée sans violer l'unicité.

### CU-05-06 — Consulter les référentiels pour alimenter un parcours clinique
- **Acteur** : tout acteur disposant de `referentiel.read` (consommé par triage/consultation/bons).
- **Déclencheur** : sélection d'un motif, d'une pathologie, d'un médicament, d'un type d'examen/consultation, d'une catégorie ou d'un site dans un formulaire clinique.
- **Scénario nominal** : `GET …` filtré sur le statut actif → liste fournie aux sélecteurs.
- **Hors-ligne** : oui (référentiels répliqués sur le poste local).
- **Critères** : *Étant donné* des référentiels actifs, *Quand* un soignant ouvre un formulaire, *Alors* les listes déroulantes sont peuplées par les entrées actives.

### CU-05-07 — Le droit de catégorie conditionne l'émission d'un bon (cœur métier)
- **Acteur** : prescripteur (consommateur du référentiel, via `bon-examen`/`bon-pharmacie`).
- **Déclencheur** : tentative d'émettre un bon d'examen (`EXAMEN`) ou de pharmacie (`MEDICAMENT`).
- **Scénario nominal** : le garde `assertPrestationCouverte` lit `DroitCategoriePatient` ; si une ligne `(catégorie, prestation, couvert=true)` existe → autorisé.
- **Scénario d'erreur** : catégorie non couverte (ex. SOUS_TRAITANT, RIVERAIN pour MEDICAMENT/EXAMEN) → **403** avec message explicite (« réservé au personnel CDI et à leurs ayants droit »).
- **Hors-ligne** : oui (matrice présente sur le poste local).
- **Critères** : *Étant donné* un patient de catégorie non couverte, *Quand* on émet un bon d'examen ou de pharmacie, *Alors* l'opération est refusée (403) ; *et* CONSULTATION/PREMIERS_SOINS restent autorisés pour toutes les catégories.

---

## 5. Données du module

Voir [[modele_donnees_global]] pour les schémas complets. Modèles Prisma propres au module (schéma PostgreSQL, `packages/db/prisma/schema.prisma`) :

| Modèle | Champs structurants | Statut (énum effectif) | Soft-delete |
|--------|---------------------|------------------------|-------------|
| `Site` | `code` (unique), `libelle`, `localisation?` | `ACTIF`/`INACTIF` (défaut ACTIF) | oui (`deletedAt`) |
| `CategoriePatient` | `code` (unique), `libelle`, relation `droits` | `ACTIVE`/`INACTIVE` (défaut ACTIVE) | oui |
| `DroitCategoriePatient` | `categorieId`, `typePrestation`, `couvert`, `plafondConsultations?`, `periode?` | — | non (pas de `deletedAt`) |
| `MotifConsultation` | `code` (unique), `libelle` | `ACTIF`/`INACTIF` | oui |
| `TypeConsultation` | `code` (unique), `libelle` | `ACTIF`/`INACTIF` | oui |
| `PathologieReference` | `code` (unique), `libelle`, `chronique` | `ACTIVE`/`INACTIVE` | oui |
| `MedicamentReference` | `nomGenerique`, `nomCommercial?`, `familleThera?` (pas de `code`) | `ACTIF`/`INACTIF` | oui |
| `TypeExamen` | `code` (unique), `libelle`, `domaine` (BIOLOGIE/IMAGERIE/SPECIALISE) | `ACTIF`/`INACTIF` | oui |

**Note d'incohérence as-built** : deux conventions de statut coexistent — `ACTIF/INACTIF` (site, motif, type consultation, médicament, type examen) et `ACTIVE/INACTIVE` (pathologie, catégorie). Le service normalise via `toEnumActifInactif` / `toEnumActiveInactive`, et le filtre de liste et le DTO de toggle acceptent les **quatre** valeurs.

**Entités présentes en base mais hors gestion de ce contrôleur** (cf. §1.4) : `TypeCertificat`, `EtablissementReference`, `SocieteSousTraitante`, `ContreIndicationMedicament`.

Tous les modèles gérés portent `updatedAt` indexé (support synchronisation LWW, D-016) et `deletedAt` (soft-delete bi-cible, D-015), sauf `DroitCategoriePatient` (pas de `deletedAt`).

---

## 6. Règles métier

Identifiants **RM-05-xx**. Les valeurs chiffrées renvoient à [[parametres_metier]].

| ID | Règle |
|----|-------|
| **RM-05-01** | **Lecture mutualisée, écriture granulaire** : la lecture de tous les référentiels passe par la seule permission `referentiel.read` ; chaque action d'écriture exige une permission `referentiel.<service>.<action>` propre à l'entité. |
| **RM-05-02** | **Séparation update/delete** : modifier les champs métier (`.update`) et changer le statut/supprimer (`.delete`) sont des droits distincts ; le `statut` est exclu des DTO de modification pour empêcher un contournement. |
| **RM-05-03** | **Unicité du code** : pour les entités à `code`, un code actif déjà existant interdit la création (409). |
| **RM-05-04** | **Résurrection au lieu de duplication** : si le code existe en tombstone, la création réactive l'entrée (consultation via le client brut `prisma.raw`) au lieu d'en créer une seconde. |
| **RM-05-05** | **Suppression protégée** : la suppression définitive d'une entrée référencée par des données existantes est refusée (409) ; l'opérateur doit la **désactiver**. |
| **RM-05-06** | **Domaine d'examen contraint** : un type d'examen appartient à `BIOLOGIE`, `IMAGERIE` ou `SPECIALISE`. |
| **RM-05-07** | **Catégorie = pilote des droits (cœur recueil, D-009)** : la matrice `DroitCategoriePatient` autorise CONSULTATION et PREMIERS_SOINS pour **toutes** les catégories, mais MEDICAMENT (bon de pharmacie) et EXAMEN (bon d'examen) **uniquement** pour `ASSURE_CDI` et `AYANT_DROIT_CDI` ; refus 403 sinon (`assertPrestationCouverte`). L'ordonnance n'est PAS restreinte (D-009). |
| **RM-05-08** | **Source de la matrice** : `DroitCategoriePatient` est **peuplée par le seed** (catégorie « complète » CDI/ayant droit → MEDICAMENT/EXAMEN couverts) et lue par les modules consommateurs ; elle n'est pas éditable par l'IHM Référentiels. |
| **RM-05-09** | **Indicateur chronique** : une pathologie peut être marquée `chronique` ; coercition stricte (rejet de toute valeur autre que booléen / « true » / « false »). |
| **RM-05-10** | **Toute mutation est auditée et diffusée en temps réel** (§7). |

> Aucune valeur chiffrée propre n'est codée en dur dans ce module ; les catégories de référence (5 catégories du recueil) relèvent de [[parametres_metier]] (PM catégories patient, D-009).

---

## 7. Interfaces (expose / consomme)

Contrats selon [[plan_modules]].

### 7.1 Ce que le module **expose**
- **API REST** `/referentiels/*` (CRUD des 7 entités), protégée par `JwtAuthGuard` + `PermissionsGuard` (contrat **C-9**, [[plan_modules]]).
- **Données de référence** consommées par les modules cliniques `patient`, `triage`, `consultation`, `bon-examen`, `bon-pharmacie` (contrat **C-6**) : catégories, motifs, pathologies, médicaments, types d'examen, types de consultation, sites.
- **Matrice de droits** `DroitCategoriePatient` lue par `bon-examen` et `bon-pharmacie` via le garde commun `assertPrestationCouverte` (`apps/api/src/common/droits-categorie.ts`) — extension fonctionnelle de C-6 (cœur D-009/D-010).

### 7.2 Ce que le module **consomme**
- **Sécurité** : gardes JWT + permissions exportées par `SecurityModule` (`ReferentielsModule` importe `SecurityModule`, cf. [[plan_modules]] §4) — contrat **C-9**.
- **Persistance** : `PrismaService` (client filtré + accesseur brut `raw` pour la résurrection des tombstones).
- **Audit** : décorateur `@Audit('referentiel', 'Référentiel')` → `AuditInterceptor` global (contrat **C-11**, D-014).
- **Temps réel** : décorateur `@LiveRefresh('LIVE_REFERENTIELS')` → invalidation live des listes via SSE (contrat **C-8**).
- **Synchronisation** : les modèles du module (sauf `DroitCategoriePatient`) sont marqués pour la synchro offline-first (contrat **C-12**, D-015/D-016).

### 7.3 IHM (frontend)
Écran `ReferentielsPage` (`apps/web/src/modules/referentiels/pages/ReferentielsPage.tsx`) : page à onglets. **Sept onglets** correspondent à ce module (Sites, Motifs, Pathologies, Médicaments, Catégories, Examens, Types consultation). **Deux onglets supplémentaires** (Sous-traitants, Registre employé) sont affichés dans le même écran mais relèvent d'autres modules (permissions `sous_traitant.*` et `employe.*`) — regroupement d'IHM, hors périmètre backend de ce module (§1.4).

---

## 8. Exigences non fonctionnelles spécifiques

- **Disponibilité hors-ligne** : les référentiels sont répliqués sur chaque poste local et restent consultables/modifiables hors-ligne ; réconciliation LWW à la reconnexion ([[parametres_metier]] section 5, D-001/D-016).
- **Cohérence de suppression** : soft-delete bi-cible + garde anti-suppression d'entrée référencée (409) pour préserver l'intégrité référentielle malgré l'absence de cascade FK en base (D-015).
- **Sécurité d'accès** : principe de moindre privilège via 21 permissions granulaires `referentiel.*` ; séparation stricte update/delete (RM-05-02).
- **Traçabilité** : toute mutation auditée (acteur, IP réelle, statut) — D-014.
- **Réactivité IHM** : compteurs et listes rafraîchis en temps réel (SSE) après mutation ; recherche insensible à la casse.
- **i18n** : libellés d'écran bilingues FR/EN (react-i18next), conformément à [[_SOURCE_systeme]].

---

## 9. Risques et points ouverts

- **Double convention de statut** (`ACTIF/INACTIF` vs `ACTIVE/INACTIVE`) : source potentielle d'erreurs ; atténuée par normalisation au service mais à harmoniser à terme.
- **Types de certificat non exposés** par le contrôleur (gestion par seed) alors que des onglets « certificat » ont pu être évoqués en mémoire projet : **à confirmer** / aligner avec le périmètre certificat restreint (D-023).
- **Matrice `DroitCategoriePatient` non éditable par l'IHM** : toute évolution des droits par catégorie passe par le seed/code ; pas d'écran d'administration. Risque opérationnel si SARIS souhaite ajuster les droits en exploitation.
- **`DroitCategoriePatient` sans `deletedAt`** : non aligné sur la convention soft-delete des autres modèles ; comportement en synchronisation à vérifier (présent dans `sync-models.ts`, **à confirmer** pour la propagation des suppressions).
- **Catégories seedées au-delà des 5 du recueil** (8 valeurs conservées pour compat, retrait jugé destructif — D-009) : écart documenté à régulariser au déploiement.
- **Confusion de périmètre IHM/backend** : l'écran Référentiels agrège sous-traitants et registre employé d'autres modules ; tout lecteur du cahier des charges doit se référer à [[plan_modules]] pour le découpage backend réel.
- **Lecture unitaire incomplète** : seul `Site` dispose d'un `GET /:id` ; les autres entités s'éditent à partir de la liste (limitation mineure assumée).
