# Module 07 — Dossier Patient

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » : le module est développé et déployé. Les faits techniques renvoient au code réel sous `apps/api/src/modules/patient` (controller `patient.controller.ts`, service `patient.service.ts`, DTO `dto/`) et au frontend `apps/web/src/modules/patients` (`pages/DossierPage.tsx`, `api/patients.api.ts`). Tout terme est aligné sur le [[glossaire]] ; tout chiffre sur [[parametres_metier]] ; toute décision sur [[registre_decisions]] ; les dépendances sur [[plan_modules]] ; les entités sur [[modele_donnees_global]].

---

## 1. Mission et périmètre

### 1.1 Mission

Tenir le **dossier patient centralisé cross-site** (cf. [[glossaire#Dossier patient]], décision [[registre_decisions#D-005]]) : un dossier médico-administratif **unique par patient**, qui le suit sur **tous les sites** (Moutela, Nkayi). Le dossier porte l'identité civile, le **matricule** employeur, le contact d'urgence, les données d'emploi, le **mode de vie**, les allergies, antécédents et alertes médicales saisies, plus des **alertes cliniques calculées**, l'historique des **constantes vitales**, la **catégorie de patient** et son historique, les **rattachements** (ayant droit CDI, sous-traitant) et la **chronologie** des visites/consultations. Il peut être protégé par un **verrou de confidentialité** posé par le médecin-chef ([[registre_decisions#D-006]]).

### 1.2 Dans le périmètre

- Liste, recherche et **déduplication** (rapprochement de doublons, triage intelligent) des dossiers.
- Création d'un dossier avec **données administratives imposées selon la catégorie** (cf. [[registre_decisions#D-009]]) et reconnaissance/enregistrement du travailleur au **registre des employés SARIS** (`EmployeService`, cf. [[registre_decisions#D-022]], contrat [[plan_modules#C-7]]).
- Consultation du **dossier complet** (identité, contact urgence, données d'emploi, mode de vie, allergies, antécédents, alertes médicales, catégorie + historique, rattachements).
- Mise à jour de l'**identité** (civile + données professionnelles + contact urgence + matricule), du **mode de vie**, de la **photo** (encodée Base64, stockée en base).
- Gestion CRUD des **allergies**, **antécédents**, **alertes médicales** et des **rattachements** ayant droit CDI / sous-traitant (avec historisation).
- **Changement de catégorie** (historisé), changement de **statut** (ACTIF / ARCHIVE / DECEDE), **verrou** de confidentialité, **suppression définitive** (sous conditions).
- Lecture transverse : historique des **constantes vitales**, **alertes cliniques calculées** (3 règles), liste des **ayants droit** d'un travailleur CDI et leur activité récente, rapprochement par **matricule**.

### 1.3 Hors périmètre (explicite)

- **Triage / visites / file d'attente** : créés et gérés par le [[glossaire#Triage]] (module `triage`), pas par ce module. Le dossier ne fait que **lire** l'historique des visites et constantes. Contrat [[plan_modules#C-1]].
- **Consultation, décision, certificat, repos** : module `consultation` (les onglets « Consultations » / « Documents » du dossier sont alimentés en lecture). Contrat [[plan_modules#C-3]].
- **Bons d'examen / de pharmacie / évacuation** : modules dédiés ; la **garde de droits par catégorie** (`assertPrestationCouverte`) et le **droit de prescription** (`assertPeutPrescrire`) vivent dans ces modules, **pas** dans le dossier (cf. [[registre_decisions#D-009]], [[registre_decisions#D-010]], [[registre_decisions#D-011]]).
- **Registre des employés SARIS** : module `employe` (le dossier le **consomme** pour reconnaître/créer un travailleur). Contrat [[plan_modules#C-7]].
- **Fusion de dossiers** (`patient.merge`) : retirée du périmètre (cf. mémoire d'audit pré-déploiement) ; non implémentée comme endpoint dans ce module.
- **Suivis hors recueil** (suivi chronique, suivi grossesse, accident du travail) : modèles **dormants** (cf. [[registre_decisions#D-023]]) ; seules subsistent des **gardes de blocage de suppression** référençant `suiviGrossesse` et `preSaisieMedicale` (à régulariser au DROP).

---

## 2. Acteurs et rôles

Source : `packages/types/src/permissions.ts` (assignations de rôles) et `patient.controller.ts` (`@RequirePermissions`). Voir [[glossaire#Rôle]] et [[parametres_metier#PM-46]] (3 rôles). Le système compte **3 rôles d'habilitation** : `ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER`. « MEDECIN » n'est **pas** un rôle : c'est une **profession** du personnel médical (`TypePersonnel`) **mappée au rôle `MEDECIN_CHEF`** (seed : « un seul rôle médecin = Médecin Chef »).

| Acteur | Lecture dossier | Création / MAJ / sous-entités | Catégorie | Archiver | Verrou | Supprimer | Voir dossier verrouillé |
|--------|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **ADMIN_SYSTEME** (super-admin) | oui | oui | oui | oui | oui | oui | oui (supervision) |
| **MEDECIN_CHEF** (admin médical + supervision ; tout médecin reçoit ce rôle) | oui | oui | oui | oui | oui | non* | oui (supervision) |
| **INFIRMIER** (triage + consultation déléguée) | oui | oui | non | non | non | non | non |

\* Le catalogue (`MEDECIN_CHEF`) n'inclut **pas** `patient.delete` : seul `ADMIN_SYSTEME` (qui détient `[...ALL_PERMISSIONS]`) peut supprimer définitivement. À confirmer si voulu.

**Permissions du module** (`packages/types/src/permissions.ts`) :
`patient.read`, `patient.create`, `patient.update`, `patient.delete`, `patient.archive`, `patient.change_category`, `patient.lock`, `patient.rattachement.manage`. L'onglet « Alertes cliniques calculées » et les onglets cliniques du dossier exigent en plus `consultation.read`.

**Supervision** (= peut voir un dossier verrouillé) = { `ADMIN_SYSTEME`, `MEDECIN_CHEF` } (constante `SUPERVISION_ROLES`, `patient.controller.ts`). Cf. [[glossaire#Supervision]], [[registre_decisions#D-006]] et [[registre_decisions#D-007]].

> Note as-built : la fonction `isRestrictedDoctor()` (cloisonnement par médecin) existe mais retourne **toujours `false`** (la profession `MEDECIN` étant mappée au rôle `MEDECIN_CHEF`, aucun rôle médecin restreint distinct n'existe au modèle clinique). Le scope « ne voir que les patients que je suis » (`assertOwnPatient`) est donc **dormant** mais conservé dans la signature des services.

**Catégories de patient pertinentes** (pilotent les obligations administratives à la création, cf. [[glossaire#Catégorie de patient]], [[registre_decisions#D-009]]) : `ASSURE_CDI`, `ASSURE_CDD`, `AYANT_DROIT_CDI`, `SOUS_TRAITANT`, `RIVERAIN`.

---

## 3. Exigences fonctionnelles

> IDs **EF-07-xx**. Toute valeur chiffrée renvoie à [[parametres_metier]].

- **EF-07-01** — Le système liste les dossiers avec filtres `search` (n° patient, nom, prénom), `categorieId`, `siteId`, `statut`, triés par date de création décroissante (`findAll`). Requiert `patient.read`.
- **EF-07-02** — Le système rapproche les doublons potentiels à partir d'une identité saisie (`findSimilar`) : correspondance par nom+prénom proches (distance de Levenshtein ≤ 2), identité exacte, ou même date de naissance avec nom **ou** prénom identique ; **recherche sur tous les sites** (dossier unique cross-site) ; au plus 6 résultats. Requiert `patient.create` **et** `patient.read`.
- **EF-07-03** — Le système crée un dossier patient en générant un **numéro unique** par site (`PAT-MOU-#####` / `PAT-NKA-#####`, séquence basée sur le maximum existant, tombstones inclus). Requiert `patient.create`.
- **EF-07-04** — Le système **impose les données administratives selon la catégorie** (côté backend, pas seulement UI) : CDI/CDD → matricule + fonction + section de paie + service + département ; AYANT_DROIT_CDI → fonction + matricule du CDI rattaché + type de lien ; SOUS_TRAITANT → société sous-traitante **active** ; RIVERAIN → identité seule.
- **EF-07-05** — À la création d'un CDI/CDD, le système reconnaît ou enregistre le travailleur au **registre des employés SARIS** par matricule (`EmployeService.ensureByMatricule`) ; pour un ayant droit, il recherche le CDI rattaché et, s'il est inconnu, l'**enregistre à la volée** depuis l'identité fournie (`nouvelEmploye`).
- **EF-07-06** — Le **matricule** d'un patient CDI/CDD est **unique** : la création (et la mise à jour d'identité) refuse un matricule déjà attribué (conflit 409).
- **EF-07-07** — Le système émet une **notification temps réel** `PATIENT_CREE` (niveau INFO, portée site, permission requise `patient.read`) après création. Contrat [[plan_modules#C-8]].
- **EF-07-08** — Le système renvoie le **dossier complet** d'un patient (`findById`) : identité, contact urgence, données d'emploi, mode de vie, catégorie, site, allergies, antécédents, alertes médicales (toutes non-tombstones), historique de catégorie, rattachements AD/ST avec leurs historiques. Requiert `patient.read`.
- **EF-07-09** — Si le dossier est **verrouillé** et que l'appelant n'est pas supervision, le système renvoie le dossier **dépouillé** de son contenu clinique (allergies, antécédents, alertes médicales vidés ; mode de vie et données d'emploi nuls) en conservant l'identité et l'indicateur `verrouille`. Le vrai contenu ne quitte pas le serveur (cf. [[registre_decisions#D-006]]).
- **EF-07-10** — Le système met à jour l'**identité** : champs civils, date de naissance, matricule (unicité), données professionnelles (upsert `donneesEmploi`), contact d'urgence (upsert). Requiert `patient.update`.
- **EF-07-11** — Le système enregistre une **photo** de patient (image JPEG/PNG/WEBP/GIF ≤ 5 Mo) : recadrage carré 512 px, recompression JPEG q80, stockage en **Base64** dans `identite.photoUrl` (aucun fichier disque). Requiert `patient.update`.
- **EF-07-12** — Le système gère le **mode de vie** (upsert, 10 champs : tabac, alcool, drogues, activité physique, alimentation, sommeil, troubles du sommeil, sédentarité, port de charges, observations). Requiert `patient.update`.
- **EF-07-13** — Le système permet la création, modification et suppression des **allergies** (substance, gravité SEVERE/MODERE/FAIBLE, confirmée, statut ACTIVE/INACTIVE). Requiert `patient.update`.
- **EF-07-14** — Le système permet la création, modification et suppression des **antécédents** (type MEDICAL/CHIRURGICAL/FAMILIAL/GYNECO_OBSTETRICAL/AUTRE, description, statut ACTIF/RESOLU). Requiert `patient.update`.
- **EF-07-15** — Le système permet la création, modification et suppression des **alertes médicales** saisies (type ALLERGIE/PATHOLOGIE_CHRONIQUE/CONTRE_INDICATION/SURVEILLANCE/AUTRE, gravité CRITIQUE/IMPORTANT/INFO, statut) ; passer une alerte à INACTIVE renseigne `resolvedAt`. Requiert `patient.update`.
- **EF-07-16** — Le système calcule à la demande les **alertes cliniques** (non saisies) selon 3 règles : (1) allergie active ↔ médicament prescrit (rapprochement textuel sur ordonnance VALIDÉE), (2) constante critique sur la dernière mesure, (3) pathologie chronique diagnostiquée sans suivi chronique actif. Tri par gravité (CRITIQUE > ELEVE > MODERE). Requiert `consultation.read` (cf. RM-07-08 pour les seuils).
- **EF-07-17** — Le système renvoie l'**historique des constantes vitales** du patient (toutes visites, tous sites), du plus récent au plus ancien. Requiert `patient.read`.
- **EF-07-18** — Le système renvoie les **ayants droit** d'un travailleur CDI (rattachements actifs liés au patient CDI ou à son employé de registre) avec leur **activité médicale récente** (5 dernières visites + consultations). Requiert `patient.read`.
- **EF-07-19** — Le système permet un rapprochement par **matricule** (`by-matricule/:matricule`) renvoyant le patient correspondant (404 si aucun). Requiert `patient.read`.
- **EF-07-20** — Le système gère les **rattachements ayant droit CDI** (CRUD + historisation des événements CREATION/MODIFICATION/CLOTURE). Requiert `patient.rattachement.manage`.
- **EF-07-21** — Le système gère les **rattachements sous-traitant** (CRUD + historisation ; société doit être **active**). Requiert `patient.rattachement.manage`.
- **EF-07-22** — Le système permet le **changement de catégorie** avec **motif obligatoire**, historisé (`HistoriqueCategoriePatient` : ancienne/nouvelle catégorie, date d'effet, auteur). Requiert `patient.change_category`.
- **EF-07-23** — Le système permet le changement de **statut** du dossier parmi ACTIF, ARCHIVE, DECEDE. Requiert `patient.archive`.
- **EF-07-24** — Le système permet de **verrouiller / déverrouiller** un dossier avec un motif optionnel (≤ 300 caractères), en traçant l'auteur et la date de verrou. Requiert `patient.lock`.
- **EF-07-25** — Le système permet la **suppression définitive** d'un dossier **uniquement** s'il n'a **aucune visite** (historique clinique) et n'est référencé par aucun suivi de grossesse ni pré-saisie médicale ; sinon il refuse (409) et invite à archiver. La suppression purge en transaction les sous-entités administratives (rattachements + historiques, allergies, antécédents, alertes, historique catégorie, contact, identité). Requiert `patient.delete`.
- **EF-07-26** — Le frontend (`DossierPage`) présente le dossier en **9 onglets** : Identité, Alertes, Antécédents, Rattachements, Chronologie, Consultations, Constantes, Documents, Historique catégorie ; les onglets **Consultations** et **Documents** sont masqués sans `consultation.read`.
- **EF-07-27** — Le frontend affiche une **bannière d'alertes critiques** (allergies SEVERE actives + alertes médicales CRITIQUE actives) et une **bannière d'alertes cliniques calculées** (EF-07-16) en tête du dossier.
- **EF-07-28** — Pour un dossier verrouillé non accessible à l'utilisateur, le frontend force un **rideau bloquant** (`LockedDossier`) affichant le motif, sans contenu clinique.
- **EF-07-29** — Le frontend permet d'**imprimer une synthèse** du dossier (modale d'impression A4 SARIS, `DossierPrintModal`).

---

## 4. Cas d'utilisation

> IDs **CU-07-xx**. Critères « Étant donné / Quand / Alors ».

### CU-07-01 — Créer un dossier (avec déduplication)
- **Acteur** : INFIRMIER (accueil) ou MEDECIN_CHEF / ADMIN_SYSTEME.
- **Déclencheur** : enregistrement d'un nouveau patient au triage.
- **Scénario nominal** : l'acteur saisit nom/prénom/date de naissance → le système propose les doublons potentiels (EF-07-02) → en l'absence de doublon, l'acteur choisit la catégorie, renseigne les données imposées (EF-07-04), valide → le système enregistre/reconnaît le travailleur au registre (EF-07-05), génère le numéro (EF-07-03), crée le dossier et notifie (EF-07-07).
- **Scénarios d'erreur** : données obligatoires manquantes pour la catégorie → 400 ; matricule déjà attribué → 409 ; société sous-traitante introuvable/inactive → 400 ; catégorie invalide → 400 ; matricule CDI inconnu sans identité fournie pour un ayant droit → 400.
- **Hors-ligne** : pris en charge — le dossier (patient, identité, rattachements) est **global** et créé sur le backend local (SQLite), répliqué au central par synchronisation LWW ([[registre_decisions#D-005]], [[registre_decisions#D-016]]).
- **Critères** : *Étant donné* un patient absent du système, *Quand* l'acteur soumet une création CDI complète, *Alors* un dossier `PAT-…` unique est créé, le travailleur figure au registre et une notification `PATIENT_CREE` est émise.

### CU-07-02 — Consulter un dossier complet
- **Acteur** : tout rôle disposant de `patient.read`.
- **Déclencheur** : ouverture d'un dossier depuis la liste ou une notification.
- **Scénario nominal** : le système renvoie le dossier complet (EF-07-08) ; le frontend affiche sidebar, bannières d'alertes et onglets (EF-07-26/27).
- **Scénarios d'erreur** : patient introuvable → 404 ; dossier verrouillé et appelant non-supervision → dossier dépouillé + rideau bloquant (EF-07-09/28).
- **Hors-ligne** : pris en charge (dossier global présent sur le poste local) ; le **dépouillement du verrou s'applique aussi au backend local**.
- **Critères** : *Étant donné* un dossier verrouillé, *Quand* un infirmier l'ouvre, *Alors* il voit l'identité et la mention « Verrouillé » mais aucun contenu clinique.

### CU-07-03 — Verrouiller un dossier sensible
- **Acteur** : MEDECIN_CHEF (ou ADMIN_SYSTEME).
- **Déclencheur** : besoin de restreindre l'accès à un dossier.
- **Scénario nominal** : l'acteur ouvre le menu du dossier, choisit « Verrouiller », saisit un motif optionnel, confirme → le système enregistre `verrouille=true` + auteur + date + motif (EF-07-24). Les non-supervision voient désormais le dossier dépouillé.
- **Scénarios d'erreur** : patient introuvable → 404 ; appelant sans `patient.lock` → 403.
- **Hors-ligne** : pris en charge (mutation locale puis synchronisée).
- **Critères** : *Étant donné* un dossier déverrouillé, *Quand* le médecin-chef le verrouille, *Alors* un infirmier ne peut plus en voir le contenu clinique tant qu'il n'est pas déverrouillé.

### CU-07-04 — Changer la catégorie d'un patient
- **Acteur** : MEDECIN_CHEF / ADMIN_SYSTEME.
- **Déclencheur** : évolution du statut administratif (ex. CDD → CDI).
- **Scénario nominal** : l'acteur saisit la nouvelle catégorie + motif obligatoire, valide → le système historise et met à jour la catégorie en transaction (EF-07-22).
- **Scénarios d'erreur** : motif vide → 400 ; patient introuvable → 404 ; sans `patient.change_category` → 403.
- **Hors-ligne** : pris en charge — le dossier est **global** et présent sur le poste local ; le changement de catégorie (+ son historisation) est appliqué sur le backend local et mis en file (IndexedDB web / SQLite desktop) puis répliqué au central en LWW à la reconnexion ([[registre_decisions#D-005]], [[registre_decisions#D-016]]).
- **Critères** : *Étant donné* un patient SOUS_TRAITANT, *Quand* sa catégorie passe à ASSURE_CDI avec motif, *Alors* l'historique conserve l'ancienne et la nouvelle catégorie avec l'auteur.

### CU-07-05 — Gérer allergies / antécédents / alertes
- **Acteur** : soignant disposant de `patient.update`.
- **Déclencheur** : recueil d'information clinique.
- **Scénario nominal** : l'acteur ajoute/modifie/supprime une entrée → le système valide la sous-entité (RM-07-04) et la rattache au dossier ; une alerte mise à INACTIVE renseigne `resolvedAt`.
- **Scénarios d'erreur** : sous-entité introuvable pour ce patient → 404 ; valeurs hors énumération → 400.
- **Hors-ligne** : pris en charge — le dossier (et ses sous-entités allergies/antécédents/alertes) est **global** sur le poste local ; les ajouts/modifications/suppressions sont écrits sur le backend local et mis en file (IndexedDB web / SQLite desktop), rejoués au central en LWW à la reconnexion ([[registre_decisions#D-005]], [[registre_decisions#D-016]]).
- **Critères** : *Étant donné* un patient, *Quand* on ajoute une allergie SEVERE active, *Alors* elle apparaît en bannière critique et dans le compteur de la sidebar.

### CU-07-06 — Inscrire un ayant droit par matricule
- **Acteur** : INFIRMIER / MEDECIN_CHEF.
- **Déclencheur** : venue d'un membre de famille d'un CDI.
- **Scénario nominal** : l'acteur saisit le matricule du CDI → le système retrouve le travailleur au registre (sinon enregistrement à la volée) et crée le dossier ayant droit rattaché + l'historique de rattachement (EF-07-05/20).
- **Scénarios d'erreur** : matricule du CDI manquant / type de lien manquant → 400 ; CDI inconnu sans identité fournie → 400.
- **Hors-ligne** : pris en charge.
- **Critères** : *Étant donné* un CDI au registre, *Quand* on inscrit son enfant comme ayant droit, *Alors* l'enfant apparaît dans la liste des ayants droit du CDI (EF-07-18).

### CU-07-07 — Archiver puis supprimer un dossier
- **Acteur** : MEDECIN_CHEF (archivage) / ADMIN_SYSTEME (suppression).
- **Déclencheur** : dossier obsolète ou créé par erreur.
- **Scénario nominal (archivage)** : l'acteur passe le statut à ARCHIVE (EF-07-23). **Suppression** : si le dossier n'a **aucune** visite ni référence bloquante, l'acteur le supprime définitivement (EF-07-25).
- **Scénarios d'erreur** : dossier avec historique clinique (visites) → 409 « archivez-le plutôt » ; référence par suivi de grossesse / pré-saisie → 409 ; contrainte FK résiduelle (P2003/P2014) → 409.
- **Hors-ligne** : pris en charge — le dossier est **global** sur le poste local ; l'archivage (changement de statut) comme la suppression définitive sont appliqués sur le backend local et mis en file (IndexedDB web / SQLite desktop), répliqués au central en LWW à la reconnexion ; la suppression se matérialise par un soft-delete bi-cible (tombstone) propagé par synchronisation ([[registre_decisions#D-005]], [[registre_decisions#D-015]], [[registre_decisions#D-016]]).
- **Critères** : *Étant donné* un dossier ayant au moins une visite, *Quand* on tente de le supprimer, *Alors* le système refuse et propose l'archivage.

### CU-07-08 — Visualiser les alertes cliniques calculées
- **Acteur** : soignant disposant de `consultation.read`.
- **Déclencheur** : ouverture du dossier (bannière) ou onglet alertes.
- **Scénario nominal** : le système calcule les 3 règles (EF-07-16) sur l'historique complet (tous sites) et renvoie la liste triée par gravité.
- **Scénarios d'erreur** : dossier verrouillé non accessible → liste vide ; sans `consultation.read` → bannière non affichée.
- **Hors-ligne** : pris en charge — le calcul est servi par le backend local (desktop) ou le cache web sur les données **globales** présentes sur le poste (dossier, visites, constantes, ordonnances) ; opération de lecture/calcul sans mutation, aucune mise en file requise. Le dépouillement du verrou s'applique aussi en local ([[registre_decisions#D-005]], [[registre_decisions#D-006]]).
- **Critères** : *Étant donné* un patient allergique à une substance et une ordonnance VALIDÉE d'un médicament rapproché, *Quand* on ouvre son dossier, *Alors* une alerte CRITIQUE « Allergie vs médicament prescrit » apparaît.

---

## 5. Données du module

Voir [[modele_donnees_global]] pour le schéma complet. Entités **propres / centrales** au dossier patient (Prisma, `packages/db/prisma/schema.prisma`) :

- **`Patient`** — racine du dossier : `numeroPatient` (unique), `matricule` (unique, optionnel), `employeId` (lien registre), `siteCreationId` (site de création), `categoriePatientId`, `statut` (ACTIF/ARCHIVE/DECEDE), `verrouille` + `verrouilleParId` + `verrouilleLe` + `motifVerrou`, `createdBy`, soft-delete (`deletedAt`).
- **`IdentitePatient`** (1-1) — nom, prénom, date de naissance, sexe, téléphone, adresse, `photoUrl` (Base64).
- **`ContactUrgence`** (1-1) — nom, prénom, téléphone, lien.
- **`DonneesEmploi`** (1-1) — fonction, section de paie, service, département.
- **`ModeViePatient`** (1-1) — 10 champs de mode de vie (cf. EF-07-12).
- **`AllergiePatient`** (1-N), **`AntecedentPatient`** (1-N), **`AlerteMedicale`** (1-N) — sous-entités cliniques saisies.
- **`HistoriqueCategoriePatient`** (1-N) — traçabilité des changements de catégorie.
- **`RattachementAyantDroitCdi`** + **`HistoriqueRattachementAyantDroit`** ; **`RattachementSousTraitant`** + **`HistoriqueRattachementSousTraitant`** — rattachements administratifs et leur journal.

Entités **lues** par le module (appartenant à d'autres modules) : `CategoriePatient`, `Site`, `SocieteSousTraitante`, `EmployeSaris`, `Visite`, `Consultation`, `ConstanteVitale`, `LigneOrdonnance`/`Ordonnance`, `Medicament`, `DiagnosticConsultation`/`Pathologie`, `SuiviChronique`/`SuiviGrossesse`/`PreSaisieMedicale` (ces derniers **dormants**, utilisés seulement comme garde de suppression — cf. [[registre_decisions#D-023]]).

**Portée de synchronisation** : le patient, son dossier et son parcours sont **globaux** (présents sur chaque poste) — cf. [[registre_decisions#D-005]]. Soft-delete (tombstones) appliqué — cf. [[registre_decisions#D-015]].

---

## 6. Règles métier

> IDs **RM-07-xx**. Toute valeur chiffrée renvoie à [[parametres_metier]].

- **RM-07-01** — **Dossier unique cross-site** : la déduplication et la recherche d'inscription couvrent **tous les sites** ; un patient existant ailleurs n'est jamais recréé (cf. [[registre_decisions#D-005]]).
- **RM-07-02** — **Catégorie pilote les obligations administratives** : les champs imposés à la création dépendent de la catégorie (EF-07-04) et sont vérifiés **côté backend** (cf. [[registre_decisions#D-009]]).
- **RM-07-03** — **Unicité** : `numeroPatient` et `matricule` sont uniques ; le numéro est attribué par site sur la base du maximum existant (tombstones inclus), sans réutilisation après suppression.
- **RM-07-04** — **Appartenance des sous-entités** : toute opération sur une allergie/antécédent/alerte/rattachement vérifie qu'elle appartient bien au patient ciblé (sinon 404), empêchant les références croisées.
- **RM-07-05** — **Verrou de confidentialité** : un dossier `verrouille` n'expose son contenu clinique qu'à la **supervision** ({ ADMIN_SYSTEME, MEDECIN_CHEF }) ; pour les autres, le contenu est dépouillé côté serveur, y compris en mode **local hors-ligne** (cf. [[registre_decisions#D-006]], [[glossaire#Verrou de confidentialité]]).
- **RM-07-06** — **Suppression conditionnelle** : un dossier avec au moins une visite (historique clinique, vérifié sur le client brut incluant les tombstones) **ne peut être supprimé** ; il doit être **archivé**. Idem en cas de référence par un suivi de grossesse ou une pré-saisie médicale.
- **RM-07-07** — **Historisation** : tout changement de catégorie et tout événement de rattachement (CREATION/MODIFICATION/CLOTURE) est journalisé avec auteur et date.
- **RM-07-08** — **Seuils des alertes cliniques calculées** (`patient.service.ts`, EF-07-16 ; valeurs faisant foi en [[parametres_metier]]) : SpO₂ critique ([[parametres_metier#PM-54]]) ; température élevée puis critique ([[parametres_metier#PM-55]]) ; tension systolique élevée puis critique ([[parametres_metier#PM-56]]) ; fréquence cardiaque élevée haute/basse ([[parametres_metier#PM-57]]). La règle allergie↔médicament est un **rapprochement textuel** (ne remplace pas une base d'interactions).
- **RM-07-09** — **Photo** : image ≤ 5 Mo (JPEG/PNG/WEBP/GIF), normalisée 512×512 JPEG q80, stockée **en base** en Base64 (pas de fichier disque) pour rester transportable avec le dump.
- **RM-07-10** — **Filtrage des tombstones dans les relations imbriquées** : les sous-ressources soft-deletables sont explicitement filtrées (`deletedAt: null`) dans les `include` du dossier, car l'extension soft-delete ne filtre que le niveau racine.
- **RM-07-11** — **Scope par initiateur (dormant)** : la garde `assertOwnPatient` (médecin restreint à ses patients) existe mais est inactive (`isRestrictedDoctor` = false), la profession `MEDECIN` étant mappée au rôle `MEDECIN_CHEF` (pas de rôle médecin restreint distinct ; cf. [[registre_decisions#D-003]], [[registre_decisions#D-007]]).

---

## 7. Interfaces

### 7.1 Exposé (consommé par le frontend `apps/web/src/modules/patients`)

Endpoints REST sous `/patients` (`patient.controller.ts`), tous protégés par `JwtAuthGuard` + `PermissionsGuard`, mutations auditées (`@Audit('patient','Patient')`, contrat [[plan_modules#C-11]]) :
`GET /`, `POST /`, `GET /similar`, `GET /by-matricule/:matricule`, `GET /:id`, `GET /:id/ayants-droits`, `GET /:id/constantes`, `GET /:id/alertes-cliniques`, `PATCH /:id/identite`, `PATCH /:id/mode-vie`, `POST /:id/photo`, `PATCH /:id/categorie`, `PATCH /:id/statut`, `PATCH /:id/verrou`, CRUD `…/allergies`, `…/antecedents`, `…/alertes`, `…/rattachements-ad`, `…/rattachements-st`, `DELETE /:id`. Client : `patients.api.ts`.

### 7.2 Consommé (dépendances `imports` réelles — [[plan_modules]])

- **`EmployeModule`** → `EmployeService` : reconnaissance/enregistrement des travailleurs SARIS par matricule (contrat [[plan_modules#C-7]]).
- **`NotificationModule`** → `NotificationService` : émission `PATIENT_CREE` (contrat [[plan_modules#C-8]]).
- **`PrismaModule`** : accès base (incl. accesseur **`raw`** non filtré pour numérotation et contrôle de suppression).
- **`SecurityModule`** (global) : gardes JWT + permissions (contrat [[plan_modules#C-9]]).

### 7.3 Collaborations par la donnée (sans `imports` direct)

- **Triage** alimente `Visite`/`ConstanteVitale` lus par le dossier (contrat [[plan_modules#C-1]]).
- **Consultation** alimente la timeline, les diagnostics et ordonnances exploités par les alertes calculées et les onglets cliniques (contrat [[plan_modules#C-3]]).
- **Référentiels** fournit `CategoriePatient`, `SocieteSousTraitante` (contrat [[plan_modules#C-6]]).

---

## 8. Exigences non fonctionnelles spécifiques

- **Confidentialité** : verrou appliqué **côté serveur** (central et local) ; aucune donnée clinique masquée ne transite vers un appelant non autorisé (EF-07-09). Le frontend renforce par un **rideau bloquant** et le [[glossaire#Rideau de confidentialité]] sur les zones cliniques.
- **Offline-first** : dossier et parcours **globaux** sur chaque poste local, soft-delete bi-cible et synchronisation LWW ([[registre_decisions#D-005]], [[registre_decisions#D-015]], [[registre_decisions#D-016]]).
- **Intégrité** : transactions Prisma pour la création (patient + rattachements), le changement de catégorie et la suppression ; mapping des contraintes (P2002→409, P2003/P2014→409, P2025→404) via le filtre global.
- **Traçabilité** : toutes les mutations sont auditées (acteur, IP réelle, statut) — [[registre_decisions#D-014]].
- **Performance / volumétrie** : la déduplication borne le balayage à 1000 candidats et 6 résultats ; photos normalisées pour limiter le poids en base.
- **i18n & responsive** : `DossierPage` entièrement traduite (FR/EN), adaptée mobile (sidebar empilée). Cf. [[_SOURCE_systeme]].

---

## 9. Risques et points ouverts

- **Rôles** ([[registre_decisions#D-003]]) : le système compte **3 rôles d'habilitation** (`ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER`) ; « MEDECIN » est une profession mappée au rôle `MEDECIN_CHEF`, pas un rôle distinct.
- **Suppression réservée à ADMIN_SYSTEME** : `MEDECIN_CHEF` n'a pas `patient.delete` au catalogue — à confirmer si conforme à l'intention.
- **Scope par initiateur dormant** (`assertOwnPatient` jamais déclenché, RM-07-11) : code conservé mais inactif → dette à clarifier (réactiver ou retirer).
- **Modèles dormants en garde de suppression** : `suiviGrossesse` / `preSaisieMedicale` encore référencés alors que ces zones sont retirées du périmètre ([[registre_decisions#D-023]]) → nettoyer au **DROP** des tables dormantes.
- **Seuils des alertes cliniques** (RM-07-08) : ✅ externalisés en [[parametres_metier]] **PM-54→PM-57** (audit 2026-06-29). Restent codés dans `patient.service.ts` (le référentiel documente la valeur as-built) ; les rendre configurables au catalogue serait une évolution.
- **Rapprochement allergie↔médicament purement textuel** : risque de faux positifs/négatifs ; n'est pas une base d'interactions médicamenteuses (signalé dans le code).
- **Limite photo 5 Mo / stockage Base64 en base** : alourdit la base et les dumps de synchronisation si beaucoup de photos ; valeur non centralisée en [[parametres_metier]] (à confirmer).
- **Fusion de dossiers retirée** : aucune voie de réconciliation de doublons créés hors-ligne autre que l'archivage manuel — à surveiller.

---

*Sources de vérité : [[_SOURCE_systeme]], [[registre_decisions]], [[glossaire]], [[plan_modules]], [[parametres_metier]], [[modele_donnees_global]]. Faits techniques lus dans `apps/api/src/modules/patient/{patient.controller.ts,patient.service.ts,dto/*}`, `apps/web/src/modules/patients/{pages/DossierPage.tsx,api/patients.api.ts}`, `packages/types/src/permissions.ts`.*
