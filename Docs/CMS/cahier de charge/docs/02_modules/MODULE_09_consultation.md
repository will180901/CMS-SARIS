# Module 09 — Consultation & Certificats

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » du module **Consultation** (le système est développé et déployé). Faits issus de la lecture du code réel : `apps/api/src/modules/consultation/{consultation.controller.ts, consultation.service.ts, dto/consultation.dto.ts}`, du garde partagé `apps/api/src/common/prescription.ts`, et du frontend `apps/web/src/modules/consultation/`. Alignée sur le brief [[_SOURCE_systeme]], le [[glossaire]], le [[plan_modules]] et le [[registre_decisions]].
>
> Note d'identifiant : le code interne nomme ce module « Module 7 · Consultation & Actes Prescrits » (commentaires d'en-tête). Dans le cahier des charges, il porte le **numéro 09** (préfixes `EF-09`, `CU-09`, `RM-09`). Même objet, numérotation documentaire.

---

## 1. Mission et périmètre

### 1.1 Mission
Conduire l'**acte clinique** (la [[glossaire#Consultation|consultation]]) mené par un soignant pendant une [[glossaire#Visite|visite]], **piloté par la décision** ([[glossaire#Décision (de consultation)|décision de consultation]]), depuis l'ouverture jusqu'à la clôture guidée : examen clinique, type de consultation, diagnostics (pathologies), repos maladie, ordonnances (et lignes), et orientation vers les documents cliniques. Le module remplace le suivi « façon Jeannette » (Excel + papier) côté acte médical.

### 1.2 Périmètre couvert (vérifié dans le code)
- **Ouverture** d'une consultation à partir d'une visite `EN_COURS` ; clôture immédiate de la visite (`AVEC_CONSULTATION`) à l'ouverture (fin du triage).
- **Saisie de l'acte** : examen clinique (texte), conclusion (texte), **type de consultation** (référentiel), **repos maladie** (jours / inclusion du jour / date de reprise).
- **Diagnostics** : ajout/retrait de pathologies de référence, typées `PRINCIPAL`/`ASSOCIE` et qualifiées `CONFIRME`/`PROBABLE`/`SUSPECTE`.
- **Ordonnances** : création (brouillon), ajout/retrait de lignes (médicament + posologie + durée + voie + instructions), **contrôle des contre-indications et allergies**, validation, annulation, suppression de brouillon.
- **Clôture guidée par la décision** : `CLOTURE_SIMPLE`, `PRESCRIPTION`, `EXAMEN_COMPLEMENTAIRE`, `EVACUATION`, avec cohérence décision ↔ document produit.
- **Annulation** : remise de la visite en file d'attente (`EN_ATTENTE`).
- **Verrou souple** (« prise en charge ») empêchant deux soignants d'écraser le même acte.
- **Confidentialité** : activité scopée à l'initiateur (D-007), respect du verrou de confidentialité du dossier (D-006), cloisonnement par site des consultations.
- **Vue dossier** : agrégation des documents générés d'un patient (ordonnance, bon d'examen, bon de pharmacie, évacuation) pour l'onglet Documents.
- **Notification ciblée** au médecin assigné à l'ouverture (et notifications de clôture / validation d'ordonnance).
- **Documents imprimables A4 SARIS** : ordonnance, **certificat de repos** (frontend `OrdonnancePrintModal.tsx`, `CertificatReposPrintModal.tsx`).

### 1.3 Hors-périmètre explicite
- **Création du bon d'examen** et **du bon de pharmacie** : émis par leurs **modules dédiés** ([[plan_modules]] BonExamenModule / BonPharmacieModule), contrat C-4. La consultation **déclenche** la décision mais ne porte pas l'endpoint de création de ces bons.
- **Fiche d'évacuation** : portée par le module `sorties-critiques` (« Évacuations », D-023).
- **Saisie des constantes vitales** : relève du [[glossaire#Triage|triage]] (la consultation les lit en résumé, ne les saisit pas).
- **Suivi chronique, suivi grossesse, accident du travail** : modèles Prisma **dormants** mais **retirés du périmètre fonctionnel** (D-023). Le code de suppression les compte encore pour la garde « consultation sans document », sans les exposer.
- **Certificats hors repos maladie** : périmètre réduit au **repos maladie** (D-023) ; portée exacte des autres certificats **à confirmer** ([[glossaire#Certificat]]).
- **Restriction de prescription par catégorie patient** : l'**ordonnance n'est PAS restreinte** par catégorie (D-009/D-216 ordonnance libre) ; seuls les bons d'examen/pharmacie le sont (hors module).

---

## 2. Acteurs et rôles

Rôles du système (3, voir [[glossaire#Rôle]], D-003). « MEDECIN » n'est **pas** un rôle : c'est une **profession** du personnel médical mappée au rôle `MEDECIN_CHEF` (tout médecin reçoit ce rôle) :

| Rôle | Capacités dans le module (vérifiées via permissions et gardes) |
|------|----------------------------------------------------------------|
| **ADMIN_SYSTEME** | Supervision (`SUPERVISION_ROLES`) : voit **toutes** les consultations du site ; prescription **libre**. (Réserve D-004 : accès clinique complet temporaire.) L'en-tête du code note « ADMIN_SYSTEME pas de permission clinique » mais le garde `SUPERVISION_ROLES` l'inclut — **incohérence de commentaire** signalée, comportement effectif = supervision. |
| **MEDECIN_CHEF** | Supervision : voit toutes les consultations du site, peut prescrire **librement** (`assertPeutPrescrire`). Tout médecin (profession) reçoit ce rôle et prescrit donc librement. |
| **INFIRMIER** | Conduit ses consultations ; **prescrit uniquement** s'il dispose d'une [[glossaire#Permission|délégation de prescription]] active (D-011, garde `assertPeutPrescrire`). |

> Cloisonnement : un soignant non-supervision ne voit / n'ouvre **que** ses propres consultations (`findAll`/`findById` filtrent par `soignantId = personnelMedicalId`). La supervision = { ADMIN_SYSTEME, MEDECIN_CHEF } voit tout le site (D-007, [[glossaire#Supervision]]).

**Catégories de patient** : sans effet sur l'ordonnance (libre) ; pilotent les bons (hors module, D-009).

---

## 3. Exigences fonctionnelles (EF-09-xx)

| ID | Exigence (atomique, vérifiable) | Source code |
|----|----------------------------------|-------------|
| **EF-09-01** | Le système ouvre une consultation à partir d'une visite **`EN_COURS`** uniquement (sinon `409`). | `create()` |
| **EF-09-02** | À l'ouverture, le soignant est celui **assigné à la visite** (override `soignantId` possible) ; si aucun soignant assigné → erreur `400`. | `create()` |
| **EF-09-03** | Une visite ne peut avoir **qu'une seule consultation OUVERTE** (sinon `409` + `existingConsultationId`). | `create()` |
| **EF-09-04** | À l'ouverture, la **visite est clôturée** (`statut=CLOTUREE`, `typeCloture=AVEC_CONSULTATION`) — fin du triage. | `create()` (transaction) |
| **EF-09-05** | À l'ouverture, une **notification ciblée** est émise au compte du médecin assigné (repli diffusion site si pas de compte lié). | `create()` → `notif.emit` |
| **EF-09-06** | Le soignant peut saisir/modifier l'**examen clinique** (≤ 8000 caractères). | `updateExamen()`, DTO |
| **EF-09-07** | Le soignant peut saisir/modifier la **conclusion** (≤ 5000 caractères). | `updateConclusion()`, DTO |
| **EF-09-08** | Le soignant peut affecter/retirer un **type de consultation** (référentiel) ; un type inexistant → `404`. | `setType()` |
| **EF-09-09** | Le soignant peut renseigner le **repos maladie** : nombre de jours (0–365), inclusion du jour, date de reprise. | `setRepos()`, DTO |
| **EF-09-10** | Le soignant peut **ajouter un diagnostic** (pathologie active) typé `PRINCIPAL`/`ASSOCIE`, qualifié `CONFIRME`/`PROBABLE`/`SUSPECTE`. | `addDiagnostic()` |
| **EF-09-11** | Un **seul diagnostic PRINCIPAL** par consultation ; pas de **doublon** de pathologie (sinon `409`). | `addDiagnostic()` |
| **EF-09-12** | Le soignant peut **retirer un diagnostic**. | `removeDiagnostic()` |
| **EF-09-13** | Le soignant peut **créer une ordonnance** (statut initial `BROUILLON`) ; soumise au droit de prescription. | `createOrdonnance()` |
| **EF-09-14** | Le soignant peut **ajouter une ligne** d'ordonnance (médicament, posologie ≤ 500, durée ≤ 200, voie ≤ 100, instructions/justification optionnelles), uniquement sur une ordonnance `BROUILLON`. | `addLigneOrdonnance()`, DTO |
| **EF-09-15** | À l'ajout d'une ligne, le système **détecte les contre-indications et allergies** du patient et renvoie des **avertissements** classés `BLOCKING`/`WARNING`. | `checkContreIndications()` |
| **EF-09-16** | Un avertissement **BLOCKING** non confirmé (`acknowledgeWarnings`) **bloque** l'ajout (`409` + liste). | `addLigneOrdonnance()` |
| **EF-09-17** | Le soignant peut **retirer une ligne** d'ordonnance. | `removeLigneOrdonnance()` |
| **EF-09-18** | Le soignant peut **valider** une ordonnance (≥ 1 ligne requise, sinon `400`) → statut `VALIDEE` + notification. | `validerOrdonnance()` |
| **EF-09-19** | Le soignant peut **annuler** une ordonnance `VALIDEE`/`BROUILLON` (→ `ANNULEE`) ; déjà annulée → `409`. | `annulerOrdonnance()` |
| **EF-09-20** | Le soignant peut **supprimer** une ordonnance **`BROUILLON`** uniquement (une `VALIDEE` s'annule). | `deleteOrdonnance()` |
| **EF-09-21** | Le système **clôture** la consultation selon une **décision médicale** parmi `CLOTURE_SIMPLE`, `PRESCRIPTION`, `EXAMEN_COMPLEMENTAIRE`, `EVACUATION`. | `cloturer()`, DTO `DECISIONS_MEDICALES` |
| **EF-09-22** | Pré-requis de clôture : **≥ 1 diagnostic** et **un type de consultation** renseignés (sinon `400`). | `cloturer()` |
| **EF-09-23** | Cohérence décision ↔ document : `PRESCRIPTION` exige ≥ 1 ordonnance `VALIDEE` ; `EXAMEN_COMPLEMENTAIRE` ≥ 1 bon d'examen ; `EVACUATION` une fiche d'évacuation **non annulée** (sinon `400`). | `cloturer()` |
| **EF-09-24** | À la clôture, la **visite associée est clôturée** (atomique, `AVEC_CONSULTATION`) + notification de clôture. | `cloturer()` (transaction) |
| **EF-09-25** | L'**annulation** d'une consultation **remet la visite en file** (`EN_ATTENTE`, clôture triage effacée) et exige un **motif** (≤ 1000). | `annuler()`, DTO |
| **EF-09-26** | Une consultation peut être **supprimée définitivement** seulement si **ANNULÉE** et **sans aucun document**. | `delete()` |
| **EF-09-27** | Le système expose un **verrou souple** : un soignant « prend en charge » une consultation ; toute modification par un **autre** soignant est refusée (`409`, code `LOCKED_BY_OTHER`) tant qu'il n'a pas repris la main. | `prendreEnCharge()`, `assertEditable()` |
| **EF-09-28** | Toute modification est **refusée** sur une consultation en état terminal (`CLOTUREE`/`ANNULEE`, `409`). | `assertModifiable()` |
| **EF-09-29** | La **liste** des consultations est cloisonnée par **site** et, pour les non-supervision, **filtrée par soignant** ; filtrable par statut (`OUVERTE`/`CLOTUREE`/`ANNULEE`/`ACTIVES`/`TOUTES`) et par `patientId`. | `findAll()`, DTO |
| **EF-09-30** | Le **détail** d'une consultation n'est lisible que par son initiateur (hors supervision) ; un id deviné ne suffit pas (`404`). | `findById()` |
| **EF-09-31** | Le système **agrège les documents** d'un patient (ordonnance, bon d'examen, bon de pharmacie, évacuation) pour l'onglet Documents du dossier, **tous sites confondus** (site d'origine indiqué). | `findPatientDocuments()` |
| **EF-09-32** | Si le **dossier est verrouillé** (verrou de confidentialité) et l'appelant hors supervision, l'agrégat de documents renvoie une **liste vide**. | `findPatientDocuments()` |
| **EF-09-33** | Les documents **ordonnance** et **certificat de repos** sont **imprimables au format A4 SARIS**. | `OrdonnancePrintModal.tsx`, `CertificatReposPrintModal.tsx` |
| **EF-09-34** | Toute mutation du module est **journalisée à l'audit** (interceptor global) et **diffusée en temps réel** (LiveRefresh `LIVE_CONSULTATION`, site-scoped). | `@Audit`, `@LiveRefresh` (controller) |

---

## 4. Cas d'utilisation (CU-09-xx)

Format : acteur · déclencheur · nominal · erreurs · hors-ligne · critères « Étant donné / Quand / Alors ».

### CU-09-01 — Ouvrir une consultation
- **Acteur** : MEDECIN_CHEF / INFIRMIER / supervision · **Déclencheur** : prise en charge d'une visite triée.
- **Nominal** : sélection d'une visite `EN_COURS` → consultation créée (`OUVERTE`), visite clôturée (`AVEC_CONSULTATION`), notification ciblée au médecin assigné.
- **Erreurs** : visite non `EN_COURS` → `409` ; aucun soignant assigné → `400` ; consultation ouverte déjà existante → `409` (+ `existingConsultationId`).
- **Hors-ligne** : opérationnel sur le backend embarqué desktop ([[glossaire#Poste local]]) ; la notification et la propagation suivent la [[glossaire#Synchronisation|synchronisation]] (D-001).
- **Critères** : *Étant donné* une visite `EN_COURS` avec soignant ; *Quand* j'ouvre la consultation ; *Alors* elle est `OUVERTE`, la visite est `CLOTUREE/AVEC_CONSULTATION`, et le médecin assigné est notifié.

### CU-09-02 — Saisir l'acte clinique (examen, type, diagnostics, repos, conclusion)
- **Acteur** : soignant initiateur · **Déclencheur** : consultation ouverte.
- **Nominal** : saisie de l'examen, choix du type, ajout de diagnostic(s) PRINCIPAL/ASSOCIE, repos éventuel, conclusion.
- **Erreurs** : 2ᵉ diagnostic PRINCIPAL → `409` ; pathologie en doublon → `409` ; pathologie inactive → `409` ; consultation terminale → `409`.
- **Hors-ligne** : pleinement disponible (backend local).
- **Critères** : *Étant donné* une consultation `OUVERTE` que je détiens ; *Quand* j'ajoute un diagnostic PRINCIPAL confirmé ; *Alors* il est enregistré et un second PRINCIPAL est refusé.

### CU-09-03 — Prescrire (ordonnance + lignes avec contrôle d'interactions)
- **Acteur** : MEDECIN_CHEF/ADMIN (libre) ou INFIRMIER **délégué** · **Déclencheur** : décision de prescription.
- **Nominal** : création ordonnance `BROUILLON` → ajout de lignes (médicament/posologie/durée/voie) → contrôle contre-indications/allergies → validation (`VALIDEE`) → notification → impression A4.
- **Erreurs** : infirmier sans délégation active → `403` ([[glossaire#Permission|garde]] `assertPeutPrescrire`, D-011) ; contre-indication `BLOCKING` non confirmée → `409` (liste) ; validation sans ligne → `400` ; ligne sur ordonnance non `BROUILLON` → `409`.
- **Hors-ligne** : disponible ; la validation reste gardée par la délégation (lue en local).
- **Critères** : *Étant donné* un infirmier **sans** délégation active ; *Quand* il crée une ordonnance ; *Alors* l'API refuse (`403`). *Étant donné* une allergie sévère confirmée correspondant au médicament ; *Quand* j'ajoute la ligne sans confirmer ; *Alors* l'API renvoie `409` avec l'avertissement BLOCKING.

### CU-09-04 — Clôturer la consultation (clôture guidée par la décision)
- **Acteur** : soignant initiateur (perm `consultation.close`) · **Déclencheur** : fin de l'acte.
- **Nominal** : choix de la décision → vérification des pré-requis → consultation `CLOTUREE` + visite clôturée (atomique) + notification.
- **Erreurs** : aucun diagnostic → `400` ; type de consultation manquant → `400` ; décision `PRESCRIPTION` sans ordonnance validée → `400` ; `EXAMEN_COMPLEMENTAIRE` sans bon d'examen → `400` ; `EVACUATION` sans fiche active → `400`.
- **Hors-ligne** : disponible.
- **Critères** : *Étant donné* une décision `PRESCRIPTION` sans ordonnance validée ; *Quand* je clôture ; *Alors* l'API refuse (`400`) ; *Étant donné* tous les pré-requis remplis ; *Quand* je clôture ; *Alors* consultation et visite sont clôturées atomiquement.

### CU-09-05 — Annuler une consultation (remise en file)
- **Acteur** : soignant initiateur (perm `consultation.cancel`) · **Déclencheur** : décision d'annuler après envoi.
- **Nominal** : saisie d'un motif → consultation `ANNULEE` + visite **remise en file** `EN_ATTENTE`.
- **Erreurs** : motif vide → `400` ; consultation déjà terminale → `409`.
- **Hors-ligne** : disponible.
- **Critères** : *Étant donné* une consultation `OUVERTE` ; *Quand* je l'annule avec motif ; *Alors* la visite redevient `EN_ATTENTE` (le patient n'est jamais perdu).

### CU-09-06 — Verrou souple (prise en charge concurrente)
- **Acteur** : deux soignants · **Déclencheur** : édition simultanée.
- **Nominal** : le 1ᵉʳ « prend en charge » ; le 2ᵉ voit l'identité du détenteur et doit reprendre la main pour modifier.
- **Erreurs** : modification par un autre détenteur → `409` (`LOCKED_BY_OTHER`).
- **Hors-ligne** : verrou local au poste ; arbitrage final par [[glossaire#LWW|LWW]] à la synchro (D-016).
- **Critères** : *Étant donné* une consultation tenue par A ; *Quand* B tente de modifier ; *Alors* `409` avec le nom de A.

### CU-09-07 — Consulter les documents d'un patient (onglet Documents)
- **Acteur** : soignant / supervision · **Déclencheur** : ouverture du dossier patient.
- **Nominal** : agrégat trié par date des ordonnances, bons d'examen, bons de pharmacie et évacuations, **tous sites**, avec repère du site d'origine.
- **Erreurs / confidentialité** : dossier verrouillé + non-supervision → **liste vide** (D-006).
- **Hors-ligne** : disponible (dossier global répliqué, D-005).
- **Critères** : *Étant donné* un dossier verrouillé ; *Quand* un médecin hors supervision ouvre l'onglet Documents ; *Alors* aucun document n'est renvoyé.

---

## 5. Données du module

Renvoi au modèle global [[modele_donnees_global]] (à créer/compléter). Entités propres ou centrales au module (noms Prisma vérifiés dans le code) :

- **`Consultation`** : `statut` (`OUVERTE`/`CLOTUREE`/`ANNULEE`), `soignantId` (→ `PersonnelMedical`), `visiteId`, `typeConsultationId`, `examenClinique`, `conclusion`, `decisionMedicale`, `reposJours` / `reposInclutJour` / `dateReprise`, `pickedUpById` / `pickedUpAt` (verrou souple), `motifAnnulation`, `closedAt`.
- **`DiagnosticConsultation`** : `consultationId`, `pathologieId` (→ `PathologieReference`), `type` (`PRINCIPAL`/`ASSOCIE`), `certitude` (`CONFIRME`/`PROBABLE`/`SUSPECTE`).
- **`Ordonnance`** : `consultationId`, `prescripteurId` (→ `PersonnelMedical`), `statut` (`BROUILLON`/`VALIDEE`/`ANNULEE`), `delegationId` (→ `DelegationPrescription`, traçabilité D-011).
- **`LigneOrdonnance`** : `ordonnanceId`, `medicamentId` (→ `MedicamentReference`), `posologie`, `duree`, `voieAdmin`, `instructions`, `justification`.
- **Consommées (lecture)** : `Visite`, `Patient` (+ `Identite`, `allergies`, `alertesMedicales`, `categoriePatient`), `MotifConsultation`, `Constante`, `TypeConsultation`, `MedicamentReference` (+ `contreIndications`), `Utilisateur` (résolution prescripteur / détenteur), `Evacuation`, `BonExamen`, `BonPharmacie` (agrégat documents).
- **Référencées en suppression (dormantes, D-023)** : `SuiviChronique`, `ConsultationPrenatale`, `AccidentTravail` — comptées par `delete()` mais hors périmètre fonctionnel.

Tous les modèles portent les colonnes de synchro (`updatedAt`, `deletedAt` soft-delete, D-015) ; les `_count` filtrent les tombstones.

---

## 6. Règles métier (RM-09-xx)

| ID | Règle | Renvoi paramètre / décision |
|----|-------|------------------------------|
| **RM-09-01** | Une consultation ne s'ouvre que sur une visite `EN_COURS` ; une seule consultation `OUVERTE` par visite. | — |
| **RM-09-02** | L'ouverture clôture la visite (`AVEC_CONSULTATION`) ; l'annulation la rouvre (`EN_ATTENTE`). | D-023 (décisions finales) |
| **RM-09-03** | Clôture interdite sans **≥ 1 diagnostic** et **un type de consultation** (le type alimente les statistiques type × pathologie × catégorie). | [[parametres_metier]] (catégories, D-009) ; C-13 |
| **RM-09-04** | Cohérence décision ↔ document : `PRESCRIPTION` ⇒ ordonnance validée ; `EXAMEN_COMPLEMENTAIRE` ⇒ bon d'examen ; `EVACUATION` ⇒ fiche d'évacuation active. `CLOTURE_SIMPLE` n'exige aucun document. | C-4 |
| **RM-09-05** | **Droit de prescrire** : MEDECIN_CHEF/ADMIN_SYSTEME libres ; INFIRMIER seulement avec **délégation active** couvrant le jour. | D-011 ; [[glossaire#Permission]] |
| **RM-09-06** | L'**ordonnance n'est pas restreinte par catégorie patient** (≠ bons d'examen/pharmacie). | D-009, D-010 |
| **RM-09-07** | Une allergie **sévère confirmée** correspondant au médicament, ou une contre-indication **ABSOLUE/SEVERE** sur une alerte active = avertissement **BLOCKING** (ajout bloqué sans confirmation explicite). Rapprochement textuel avec garde-fou de longueur ≥ 4 caractères. | — |
| **RM-09-08** | Une seule pathologie **PRINCIPALE** ; pas de doublon de pathologie ; pathologie **active** requise. | — |
| **RM-09-09** | Ordonnance : ligne possible uniquement sur `BROUILLON` ; validation requiert ≥ 1 ligne ; suppression réservée au `BROUILLON` (la `VALIDEE` s'annule). | — |
| **RM-09-10** | Suppression définitive d'une consultation : **ANNULÉE** et **sans aucun document**. | — |
| **RM-09-11** | **Verrou souple** : un acte n'est modifiable que par le détenteur courant (`pickedUpById`) ; reprise explicite obligatoire ; arbitrage final LWW à la synchro. | D-016 |
| **RM-09-12** | **Confidentialité par initiateur** : hors supervision, lecture/édition limitées à ses propres consultations ; supervision = { ADMIN_SYSTEME, MEDECIN_CHEF }. | D-007 |
| **RM-09-13** | **Verrou de confidentialité du dossier** : documents masqués (liste vide) pour les non-supervision sur un dossier verrouillé. | D-006 |
| **RM-09-14** | **Cloisonnement par site** des consultations ; le **dossier patient et ses documents sont centralisés cross-site** (site d'origine indiqué). | D-005 |

> Aucune valeur chiffrée codée en dur n'est introduite par cette spec : les bornes de saisie (longueurs de texte, jours de repos 0–365) sont des **contraintes de DTO** (intégrité), non des paramètres métier configurables ; si un seuil devenait configurable, il rejoindrait [[parametres_metier]].

---

## 7. Interfaces (expose / consomme — contrats [[plan_modules]] C-x)

**Expose** (endpoints REST sous `/consultations`, gardes JWT + permissions) :
- Lecture : `GET /consultations` (`consultation.read`), `GET /consultations/:id`, `GET /consultations/patient/:patientId/documents`.
- Acte : `POST /consultations` (`consultation.create`), `PATCH :id/examen` (`consultation.examen`), `PATCH :id/conclusion` (`consultation.update`), `PATCH :id/type`, `PATCH :id/repos`, `POST :id/prise-en-charge`.
- Diagnostics : `POST :id/diagnostics` / `DELETE :id/diagnostics/:diagId` (`consultation.diagnose`).
- Cycle : `PATCH :id/cloturer` (`consultation.close`), `PATCH :id/annuler` (`consultation.cancel`), `DELETE :id` (`consultation.delete`).
- Ordonnances : `POST :id/ordonnances` & lignes (`ordonnance.create`), `PATCH …/valider` (`ordonnance.validate`), `PATCH …/annuler` (`ordonnance.cancel`), `DELETE …` (`ordonnance.create`).

**Consomme / collabore** (par la donnée, [[plan_modules]] §6) :
- **C-2** ← `Triage` : reprise d'une visite triée, transitions d'état de la `Visite`.
- **C-3** → `Patient` : actes, diagnostics, repos, ordonnances alimentent le dossier (timeline, alertes) ; agrégat documents.
- **C-4** → `BonExamen` / `BonPharmacie` / `SortiesCritiques` : la décision déclenche l'émission des documents (création hors module).
- **C-6** ← `Referentiels` : pathologies, médicaments (+ contre-indications), types de consultation.
- **C-8** → `Notification` : `NotificationModule` importé ; notifications ciblées (ouverture), de clôture et de validation d'ordonnance ; LiveRefresh `LIVE_CONSULTATION`.
- **C-9** ← `Security` : gardes JWT + permissions.
- **C-11** → `AuditInterceptor` : `@Audit('consultation','Consultation')` sur toutes les mutations.
- **C-12** ↔ `Sync` : modèles soft-delete/synchronisés (D-015/D-016).
- **C-13** → `Dashboard` : le **type de consultation** (obligatoire à la clôture) alimente les statistiques type × pathologie × catégorie.
- Garde transverse partagée : `assertPeutPrescrire` (`apps/api/src/common/prescription.ts`) — réutilisée par bons d'examen/pharmacie (D-011).

**Frontend** (écrans, `apps/web/src/modules/consultation/`) : `ConsultationPage`, `ConsultationDetail`, `ConsultationQueueCard`, `DiagnosticsCard`, `OrdonnanceCard` + `OrdonnancePrintModal`, `TypeConsultationSelect`, `CertificatCard` + `CertificatReposPrintModal`. Aperçu A4 intégré à la zone droite de consultation.

---

## 8. Exigences non fonctionnelles spécifiques

- **Atomicité** : ouverture, clôture et annulation modifient consultation **et** visite dans une **transaction** Prisma (cohérence d'état).
- **Concurrence** : verrou souple (`pickedUpById`) + arbitrage LWW (D-016) pour le multi-poste hors-ligne.
- **Offline-first** : toutes les opérations fonctionnent sur le backend embarqué desktop ([[glossaire#Poste local]]) ; propagation par synchronisation (D-001).
- **Confidentialité** : scope initiateur (D-007), verrou dossier (D-006), cloisonnement site, appliqués **aussi côté backend local**.
- **Traçabilité** : audit persistant de chaque mutation (D-014) ; `delegationId` tracé sur l'ordonnance d'un infirmier délégué.
- **Temps réel** : invalidations live SSE (`LIVE_CONSULTATION`, site-scoped) ; notifications cliniques.
- **Sécurité des prescriptions** : contrôle systématique des contre-indications/allergies avant ajout de ligne, avec confirmation explicite des alertes bloquantes.
- **i18n** : interface bilingue FR/EN ([[_SOURCE_systeme]]). **Documents A4** imprimables (ordonnance, certificat de repos).

---

## 9. Risques et points ouverts

- **R1 — Rôles** : le système compte **3 rôles d'habilitation** (`ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER`). « MEDECIN » est une **profession** mappée au rôle `MEDECIN_CHEF` : tout médecin prescrit donc librement via ce rôle (le garde `assertPeutPrescrire` accorde la prescription libre à `MEDECIN_CHEF`/`ADMIN_SYSTEME`). Cohérent avec D-003.
- **R2 — Commentaire trompeur** : l'en-tête du controller affirme « ADMIN_SYSTEME n'a PAS de permissions cliniques (gouvernance pure) », alors que `SUPERVISION_ROLES` l'inclut et que D-004 lui donne tout le catalogue (temporairement). **Incohérence documentaire dans le code** à corriger ; comportement effectif = supervision complète.
- **R3 — Modèles dormants** : `delete()` compte encore `SuiviChronique`, `ConsultationPrenatale`, `AccidentTravail` (hors périmètre D-023). À purger lors de la re-baseline des migrations / DROP des tables dormantes.
- **R4 — Périmètre des certificats** : seul le **repos maladie** est dans le périmètre ; la portée des autres certificats reste **« à confirmer »** ([[glossaire#Certificat]]).
- **R5 — Rapprochement textuel des contre-indications** : la détection allergie/contre-indication repose sur une comparaison de chaînes (garde-fou longueur ≥ 4) — risque résiduel de faux positifs/négatifs ; n'exonère pas le jugement clinique.
- **R6 — Fallback prescripteur** : si l'utilisateur n'est pas lié à un `PersonnelMedical`, le prescripteur retombe sur le soignant de la consultation — à surveiller pour la traçabilité exacte de l'auteur.
- **R7 — Verrou souple vs LWW** : le verrou est local au poste ; deux postes hors-ligne peuvent malgré tout produire un conflit résolu par LWW (D-016) — pas d'UI de résolution de conflit (réserve D-016).

---

> Sources : `apps/api/src/modules/consultation/consultation.controller.ts`, `consultation.service.ts`, `dto/consultation.dto.ts` ; `apps/api/src/common/prescription.ts` ; `apps/web/src/modules/consultation/`. Décisions : [[registre_decisions]] (D-005 à D-011, D-014 à D-016, D-023). Termes : [[glossaire]]. Paramètres : [[parametres_metier]]. Contrats : [[plan_modules]] (C-2, C-3, C-4, C-6, C-8, C-9, C-11, C-12, C-13).
