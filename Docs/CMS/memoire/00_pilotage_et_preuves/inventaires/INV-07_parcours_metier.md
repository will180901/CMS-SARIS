# INV-07 — Inventaire des parcours métier et des machines à états

> **Statut** : extrait · **Date d'extraction** : 2026-08-10
> **Sources** : services et DTO de `apps/api/src/modules/`, `apps/api/src/common/` (règles transverses), `packages/db/prisma/schema.prisma` (énumérations)
> **Nature de la preuve** : `IMPLÉMENTÉ`, sauf mentions explicites.

**Raison d'être de cet inventaire.** INV-01 à INV-06 décrivent des *choses* : routes, tables, écrans, droits, tests. Celui-ci décrit des *enchaînements*. Sans lui, aucun diagramme d'activité, de séquence ou de communication n'est traçable — il faudrait deviner l'ordre des étapes, les gardes et les cas d'erreur. Il alimente **7 des 18 figures** du mémoire.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Parcours métier reconstitués | **9** |
| Machines à états documentées | **9** |
| États garantis par la base (énumérations PostgreSQL) | **4** machines |
| États gouvernés par le code seul (champs `String`) | **5** machines |
| Règles métier transverses | **5** |
| Écarts entre une documentation antérieure et le code | **3**, dont un majeur (§ 6) |

---

## 2. Conventions de lecture

| Notation | Sens |
|---|---|
| `ÉTAT` | Valeur exacte stockée en base — à reprendre telle quelle sur les diagrammes |
| `— événement [garde] →` | Transition : ce qui la déclenche, et la condition qui doit être vraie |
| **terminal** | État sans transition sortante |
| ⛔ | Transition explicitement refusée par le code, avec message d'erreur |

Sur un diagramme d'états ou d'activité, la **garde s'écrit en toutes lettres entre crochets** sur la flèche. Ne jamais la sous-entendre : c'est elle qui porte la règle métier.

---

## 3. Les 9 machines à états

### 3.1 Visite — `StatutVisite` ✅ énumération PostgreSQL

| État de départ | Événement | Garde | État d'arrivée |
|---|---|---|---|
| _(néant)_ | Enregistrement au triage | Patient `ACTIF` · motif `ACTIF` · aucune visite déjà ouverte pour ce patient | `EN_ATTENTE` |
| `EN_ATTENTE` | Prise en charge | — | `EN_COURS` |
| `EN_ATTENTE` | Annulation | Motif d'annulation obligatoire | `ANNULEE` |
| `EN_COURS` | Annulation | Motif d'annulation obligatoire | `ANNULEE` |
| `EN_COURS` | Clôture de la consultation | **Posée par le service Consultation, jamais depuis le triage** | `CLOTUREE` |
| `CLOTUREE` | — | — | **terminal** |
| `ANNULEE` | — | — | **terminal** |

⛔ Depuis le triage, `CLOTUREE` **n'est pas une cible atteignable**. Une visite se clôture uniquement par la consultation.
⛔ Toute modification d'une visite `CLOTUREE` ou `ANNULEE` est refusée : *« Cette visite est clôturée et ne peut plus être modifiée »*.

**Règles associées** :

- La file d'attente est ordonnée **par ordre d'arrivée**. La notion de priorité a été retirée de tout le système — ne jamais la faire réapparaître sur un diagramme.
- La file active ne montre que les visites `EN_ATTENTE` ou `EN_COURS` **sans consultation non annulée**.
- Un patient ne peut avoir qu'**une seule visite ouverte** à la fois.

### 3.2 Consultation — `StatutConsultation` ✅ énumération PostgreSQL

| État de départ | Événement | Garde | État d'arrivée |
|---|---|---|---|
| _(néant)_ | Ouverture depuis une visite | Soignant actif · **aucune consultation déjà `OUVERTE` pour ce soignant** · aucune consultation déjà `OUVERTE` pour cette visite | `OUVERTE` |
| `OUVERTE` | Clôture | Décision médicale facultative (§ 3.3) | `CLOTUREE` |
| `OUVERTE` | Annulation | Motif obligatoire | `ANNULEE` |
| `CLOTUREE` · `ANNULEE` | — | — | **terminal** |

⛔ *« Ce soignant a déjà une consultation ouverte (patient N) — clôturez-la avant d'en ouvrir une nouvelle. »* C'est le miroir exact de la règle « une seule visite en cours » côté triage.
⛔ Suppression refusée tant que la consultation est `OUVERTE` : il faut d'abord clôturer ou annuler.

La clôture d'une consultation pose `CLOTUREE` sur la **visite** parente : les deux machines sont couplées, et le diagramme d'activité doit le montrer.

### 3.3 Décision médicale — ⚠️ **2 valeurs seulement**

| Valeur | Effet |
|---|---|
| `EVACUATION` | Crée une évacuation rattachée à la consultation |
| `SUIVI_TRAITEMENT` | Ouvre un épisode de suivi de traitement |
| _(absente)_ | **Clôture simple** — c'est l'absence de décision qui la caractérise |

> ⛔ **Écart majeur avec une documentation antérieure du projet.** Celle-ci annonçait quatre décisions : `CLOTURE_SIMPLE`, `PRESCRIPTION`, `EXAMEN_COMPLEMENTAIRE`, `EVACUATION`. Le code n'en connaît que **deux** : `EVACUATION` et `SUIVI_TRAITEMENT`.
>
> Le modèle a évolué en cours de réalisation : la prescription et l'examen complémentaire ne sont plus des *décisions*, ils sont **matérialisés par des documents** — ordonnance de type `PHARMACEUTIQUE` ou `PRESCRIPTION_EXAMEN`. Et `SUIVI_TRAITEMENT` est apparu.
>
> **C'est le code qui fait foi.** Le mémoire décrit les deux valeurs réelles ; l'écart est consigné dans `matrice_alignement.md`, jamais effacé. C'est un exemple typique de la raison pour laquelle une documentation produite avant la réalisation a été écartée.

### 3.4 Ordonnance — champ `String`

| État de départ | Événement | Garde | État d'arrivée |
|---|---|---|---|
| _(néant)_ | Création depuis une consultation | Droit de prescription vérifié (§ 5.2) | `BROUILLON` |
| `BROUILLON` | Validation | — | `VALIDEE` |
| `BROUILLON` | Suppression | — | _(supprimée)_ |
| `VALIDEE` | Annulation | — | `ANNULEE` |

⛔ Modification, ajout de ligne et suppression **uniquement** en `BROUILLON`.
⛔ Un bon ne peut être généré que depuis une ordonnance **`VALIDEE`**.

**Deux types d'ordonnance** : `PHARMACEUTIQUE` (médicaments) et `PRESCRIPTION_EXAMEN` (examens). Le type détermine quel bon peut en être généré.

### 3.5 Bon de pharmacie — champ `String`

| État de départ | Événement | Garde | État d'arrivée |
|---|---|---|---|
| _(néant)_ | Génération depuis une ordonnance `PHARMACEUTIQUE` validée | **Catégorie du patient éligible** (§ 5.1) | `EN_ATTENTE` |
| `EN_ATTENTE` | Délivrance en pharmacie | — | `DELIVRE` |
| `EN_ATTENTE` | Annulation | Motif obligatoire | `ANNULE` |
| `DELIVRE` · `ANNULE` | — | — | **terminal** |

⛔ Un bon `DELIVRE` **ne peut plus être annulé** — les médicaments sont sortis.
⛔ Un bon déjà `ANNULE` ne peut pas l'être deux fois.

### 3.6 Bon d'examen — champ `String`

| État de départ | Événement | Garde | État d'arrivée |
|---|---|---|---|
| _(néant)_ | Génération depuis une ordonnance `PRESCRIPTION_EXAMEN` validée | **Catégorie du patient éligible** (§ 5.1) | `EN_ATTENTE` |
| `EN_ATTENTE` | Validation | — | `VALIDE` |
| `EN_ATTENTE` · `VALIDE` | Annulation | Motif obligatoire | `ANNULE` |
| `VALIDE` | Saisie du résultat | Bon obligatoirement `VALIDE` | `RECU` |
| `ANNULE` · `RECU` | — | — | **terminal** |

> ⚠️ L'en-tête du fichier source annonce un état `CONSULTÉ` après `RECU`. **Cet état n'existe nulle part dans le code.** Commentaire obsolète : ne pas le représenter. Écart à consigner.

### 3.7 Évacuation — champ `String`

| État de départ | Événement | Garde | État d'arrivée |
|---|---|---|---|
| _(néant)_ | Décision `EVACUATION` en consultation | Aucune évacuation non annulée déjà rattachée | `EN_COURS` |
| `EN_COURS` | Étape de suivi | — | `EN_TRANSPORT` |
| `EN_TRANSPORT` | Étape de suivi | — | `ADMIS` |
| `EN_COURS` · `EN_TRANSPORT` · `ADMIS` | Clôture | — | `CLOTURE` |
| `EN_COURS` | Annulation | Motif obligatoire · statut strictement `EN_COURS` | `ANNULE` |
| `CLOTURE` · `ANNULE` | — | — | **terminal** |

⛔ *« Évacuation déjà clôturée / annulée »* pour toute action sur un état terminal.
⛔ L'annulation exige `EN_COURS` : une évacuation déjà partie ne s'annule pas.

L'évacuation est **réservée au médecin chef**. Chaque étape est historisée dans `SuiviEvacuation`.

### 3.8 Suivi de traitement — champ `String`

| État de départ | Événement | Garde | État d'arrivée |
|---|---|---|---|
| _(néant)_ | Décision `SUIVI_TRAITEMENT` en consultation | Aucun suivi non annulé déjà rattaché | `EN_COURS` |
| `EN_COURS` | Ajout d'une fiche datée | — | `EN_COURS` _(boucle)_ |
| `EN_COURS` | Clôture | — | `CLOTURE` |
| `EN_COURS` | Annulation | Motif obligatoire | `ANNULE` |
| `CLOTURE` · `ANNULE` | — | — | **terminal** |

Ouvrable par le **médecin chef comme par l'infirmier** : c'est un contrôle de suivi partagé.

### 3.9 Dossier patient et compte utilisateur ✅ énumérations PostgreSQL

| Machine | États | Note |
|---|---|---|
| `StatutPatient` | `ACTIF` · `ARCHIVE` · `DECEDE` · `FUSIONNE` | Une visite ne peut être ouverte que si le patient est `ACTIF` |
| `StatutCompte` | `ACTIF` · `DESACTIVE` · `BLOQUE` | `BLOQUE` est posé automatiquement après échecs répétés (§ 4.8) |

---

## 4. Les 9 parcours de bout en bout

### 4.1 Triage d'une visite

**Acteur** : Infirmier (ou Médecin Chef) · **Permission** : `visite.create`

| # | Étape | Route | Contrôle |
|---:|---|---|---|
| 1 | Rechercher ou créer le dossier du patient | `GET /patients` · `POST /patients` | `patient.read` / `patient.create` |
| 2 | Vérifier le matricule (contrôle visuel, déclaratif) | — | Règle métier, pas technique |
| 3 | Ouvrir la visite | `POST /triage/visites` | Patient `ACTIF` · motif `ACTIF` · pas de visite déjà ouverte |
| 4 | Saisir les constantes vitales | `POST /triage/visites/:id/constantes` | Plages physiologiques validées par le DTO |
| 5 | La visite entre dans la file, **par ordre d'arrivée** | `GET /triage/visites` | — |
| 6 | Affecter un soignant | `PATCH /triage/visites/:id/soignant` | `visite.assign_soignant` |

**Alternatives** : A1 — patient inconnu → création du dossier au préalable. A2 — patient déjà en visite → refus, la visite existante est proposée.
**Exceptions** : E1 — patient non `ACTIF` → refus. E2 — motif inactif → refus.
**Résultat** : visite `EN_ATTENTE`, constantes enregistrées, alertes cliniques éventuellement levées.

### 4.2 Consultation et décision

**Acteur** : Médecin Chef ou Infirmier · **Permission** : `consultation.create`

| # | Étape | Route | Contrôle |
|---:|---|---|---|
| 1 | Ouvrir la consultation depuis une visite | `POST /consultations` | Une seule consultation `OUVERTE` par soignant **et** par visite |
| 2 | Saisir l'examen clinique | `PATCH /consultations/:id/examen` | `consultation.examen` |
| 3 | Poser un ou plusieurs diagnostics | `POST /consultations/:id/diagnostics` | `consultation.diagnose` · type `PRINCIPAL`/`ASSOCIE` · certitude `CONFIRME`/`PROBABLE`/`SUSPECTE` |
| 4 | Prescrire, si nécessaire | `POST /consultations/:id/ordonnances` | § 4.3 |
| 5 | Rédiger la conclusion | `PATCH /consultations/:id/conclusion` | `consultation.update` |
| 6 | Clôturer avec ou sans décision | `PATCH /consultations/:id/cloturer` | § 3.3 |

**Branches à la clôture** :

- décision absente → **clôture simple** ;
- `EVACUATION` → création d'une évacuation (§ 4.6) ;
- `SUIVI_TRAITEMENT` → ouverture d'un épisode de suivi.

**Effet de bord obligatoire** : la visite parente passe à `CLOTUREE`. Notification `CONSULTATION_CLOTUREE` émise, portant la décision.
**Alternatives** : A1 — annulation avec motif. A2 — certificat de repos délivré.
**Exceptions** : E1 — soignant déjà occupé → refus explicite avec le numéro du patient concerné. E2 — visite déjà en consultation → refus, l'identifiant de la consultation existante est renvoyé.

### 4.3 Prescription — ordonnance

**Acteur** : Médecin Chef (libre) ou Infirmier (**sous délégation active**)

| # | Étape | Contrôle |
|---:|---|---|
| 1 | Choisir le type : `PHARMACEUTIQUE` ou `PRESCRIPTION_EXAMEN` | — |
| 2 | **Vérification du droit de prescrire** | § 5.2 — deux étages de contrôle |
| 3 | Créer l'ordonnance | statut `BROUILLON`, `delegationId` tracé si délégué |
| 4 | Ajouter les lignes | uniquement en `BROUILLON` |
| 5 | Valider | `BROUILLON` → `VALIDEE` |
| 6 | Imprimer (A4) | côté client |

**Exceptions** : E1 — infirmier sans délégation active → *« Vous devez disposer d'une délégation de prescription active (accordée par le médecin chef) pour prescrire. »* E2 — modification d'une ordonnance validée → refus.

### 4.4 Émission d'un bon de pharmacie

| # | Étape | Contrôle |
|---:|---|---|
| 1 | Ordonnance `PHARMACEUTIQUE` **validée** | Prérequis strict |
| 2 | **Vérification de l'éligibilité de la catégorie** | § 5.1 — `MEDICAMENT` |
| 3 | Génération du bon en un clic | statut `EN_ATTENTE` |
| 4 | Impression A4 | — |
| 5 | Délivrance en pharmacie | `EN_ATTENTE` → `DELIVRE` |

**Exception E1** : catégorie non couverte → *« La catégorie « … » n'ouvre pas droit à la prise en charge des médicaments (bon de pharmacie) — réservé au personnel CDI et à leurs ayants droit. »*
**Exception E2** : tentative d'annulation d'un bon `DELIVRE` → refus.

> **Distinction à ne jamais confondre dans le mémoire** : l'**ordonnance** n'est pas restreinte par catégorie ; le **bon de pharmacie** l'est. Tout patient peut recevoir une ordonnance ; seuls les CDI et leurs ayants droit obtiennent la prise en charge.

### 4.5 Émission d'un bon d'examen et saisie du résultat

| # | Étape | Contrôle |
|---:|---|---|
| 1 | Ordonnance `PRESCRIPTION_EXAMEN` **validée** | Prérequis strict |
| 2 | **Vérification de l'éligibilité de la catégorie** | § 5.1 — `EXAMEN` |
| 3 | Génération du bon | statut `EN_ATTENTE` |
| 4 | Validation | `EN_ATTENTE` → `VALIDE` |
| 5 | Réalisation de l'examen (hors système) | — |
| 6 | Saisie du résultat | `VALIDE` → `RECU` · permission `bon_examen.result` |

**Exception E1** : saisie de résultat sur un bon non `VALIDE` → refus.
**Note** : l'infirmier possède `bon_examen.result` — il saisit les résultats sans avoir besoin d'une délégation, car ce n'est **pas** un acte de prescription.

### 4.6 Évacuation

**Acteur** : Médecin Chef exclusivement

| # | Étape | État |
|---:|---|---|
| 1 | Décision `EVACUATION` à la clôture de consultation | `EN_COURS` |
| 2 | Établissement de destination renseigné | — |
| 3 | Suivi : départ | `EN_TRANSPORT` |
| 4 | Suivi : arrivée | `ADMIS` |
| 5 | Clôture | `CLOTURE` |

Chaque étape est historisée (`SuiviEvacuation`). Fiche imprimable A4.
**Alternative A1** : annulation, uniquement depuis `EN_COURS`, motif obligatoire.

### 4.7 Suivi de traitement

Ouvert par décision `SUIVI_TRAITEMENT`, statut `EN_COURS`. Des **fiches datées** sont ensuite ajoutées depuis le dossier patient (boucle). Clôture ou annulation avec motif. Accessible au médecin chef **et** à l'infirmier.

### 4.8 Authentification avec double facteur

| # | Étape | Route | Contrôle |
|---:|---|---|---|
| 1 | Saisie identifiant et mot de passe | `POST /auth/login` | — |
| 2 | Contrôle du blocage en cours | — | Si `blocageJusquA` est dans le futur → refus avec durée restante |
| 3 | Vérification du mot de passe (bcrypt) | — | — |
| 4a | **Échec** → incrément des tentatives | — | Au seuil : blocage, durée **× 4 à chaque récidive** |
| 4b | **Succès** → remise à zéro des compteurs | — | — |
| 5 | Étape intermédiaire éventuelle | — | `step: 'totp'` ou `step: 'session'` |
| 6 | Double facteur | `POST /auth/totp/verify` | Secret déchiffré depuis le stockage chiffré |
| 7 | Session concurrente à trancher | `POST /auth/session/confirmer` | Règle de session unique |
| 8 | Émission des jetons | — | Accès + rafraîchissement |
| 9 | Acceptation des CGU | `POST /me/cgu/accepter` | Bloquant tant que non acceptée |
| 10 | Redirection vers la page d'accueil du rôle | — | Infirmier → triage ; autres → tableau de bord |

**Escalade du blocage** : premier blocage = valeur du paramètre `auth.duree_blocage_minutes`, puis multiplication par 4 à chaque récidive. Formule inscrite dans le code — donnée précieuse pour le chapitre 7 (sécurité).
**Alternatives** : A1 — mot de passe temporaire → changement obligatoire. A2 — double facteur non activé → étape 6 sautée. A3 — codes de secours utilisables à la place du code temporaire.

### 4.9 Synchronisation d'un poste local

**Acteur** : Poste local (acteur **secondaire**, système externe)

| # | Étape | Route | Détail |
|---:|---|---|---|
| 1 | Enregistrement du poste | `POST /sync/poste` | Identité du poste |
| 2 | Abonnement à la « sonnette » | flux SSE | Canal muet : *« il y a du neuf »*, sans donnée |
| 3 | Signe de vie | `POST /sync/heartbeat` | — |
| 4 | **Pull** des deltas | `GET /sync/pull` | Depuis le dernier horodatage, tombstones inclus, paginé |
| 5 | Application locale | — | Résolution de conflit LWW |
| 6 | **Push** des modifications locales | `POST /sync/push` | Réponse : `applied` / `skipped` / `conflicts` |
| 7 | Journalisation des conflits | — | Pour revue en supervision |
| 8 | Purge planifiée des tombstones | tâche cron | — |

**Branches de la résolution de conflit** (§ 5.4 de INV-05) : `apply`, `skip`, `conflict` avec gagnant `incoming` ou `existing`.
**Point à représenter absolument** : le battement du canal SSE porte un **type différent** de la sonnerie, sinon le poste synchroniserait à chaque battement.

### 4.10 Messagerie interne

| # | Étape | Contrôle |
|---:|---|---|
| 1 | Ouvrir une conversation | La conversation **n'apparaît chez personne** tant qu'aucun message n'est envoyé |
| 2 | Saisir un message — indicateur « en train d'écrire » | Événement de saisie diffusé |
| 3 | Envoyer, avec pièces jointes éventuelles | Chiffrement **AES-256-GCM au repos** |
| 4 | La conversation apparaît **des deux côtés** | Déclenché par le premier message |
| 5 | Réception : compteur de non-lus, notification temps réel | — |
| 6 | Lecture : déchiffrement, accusé de lecture | — |
| 7 | Réactions, réponses, masquage individuel | Le masquage est « supprimé pour moi » |

**Règle structurante** : *c'est le premier message qui crée la conversation*. Verrouillée par un test de non-régression (INV-06 § 4.3).

---

## 5. Règles métier transverses

### 5.1 Droits par catégorie de patient — **la règle centrale**

C'est la règle la plus structurante du système, issue directement du recueil de l'existant.

| Prestation | Catégories couvertes |
|---|---|
| `CONSULTATION` | **Toutes** |
| `PREMIERS_SOINS` | **Toutes** |
| `MEDICAMENT` (bon de pharmacie) | **CDI et ayants droit uniquement** |
| `EXAMEN` (bon d'examen) | **CDI et ayants droit uniquement** |

Portée par la table `DroitCategoriePatient` — une matrice **en base**, pas une condition en dur : elle est donc modifiable sans redéploiement. Convention : autorisé s'il existe une ligne (catégorie, prestation) avec `couvert = true`.

Les cinq catégories : `ASSURE_CDI` · `AYANT_DROIT_CDI` · `ASSURE_CDD` · `SOUS_TRAITANT` · `RIVERAIN`.

> Un `ASSURE_CDD` cotise mais **n'ouvre pas droit** aux bons. C'est contre-intuitif : à vérifier auprès du terrain avant soutenance, le jury posera la question. `À CONFIRMER`.

### 5.2 Droit de prescrire — contrôle à deux étages

| Étage | Mécanisme | Effet |
|---|---|---|
| 1 | Garde de permission (`ordonnance.create`) | L'infirmier **la possède** |
| 2 | Règle métier dans le service | Exige une **délégation active** couvrant la date du jour |

| Rôle | Prescription |
|---|---|
| `MEDECIN_CHEF`, `ADMIN_SYSTEME` | Libre |
| `INFIRMIER` | **Seulement** avec une délégation `ACTIVE`, non supprimée, dont la période couvre aujourd'hui |
| Autres | Refus |

L'identifiant de la délégation utilisée est **tracé sur l'ordonnance** (`delegationId`) : la responsabilité est traçable après coup.

> C'est le point le plus subtil du système. Un diagramme qui montrerait seulement la garde de permission serait **faux**. La séquence objets de la prescription doit faire apparaître les deux étages.

### 5.3 Cloisonnement par initiateur et supervision

| Groupe | Portée de lecture |
|---|---|
| `ADMIN_SYSTEME`, `MEDECIN_CHEF` | Toute l'activité clinique du site |
| `INFIRMIER` | **Uniquement ses propres** consultations |

Restriction supplémentaire : l'infirmier consultant l'historique d'un patient n'accède qu'à la **visite en cours**, pas aux visites passées.

### 5.4 Verrou de confidentialité

Un médecin chef peut **verrouiller un dossier** (`patient.lock`). Le verrou est appliqué côté API, **y compris par le backend local** du poste autonome — c'est ce qui permet de synchroniser tous les dossiers sur tous les postes sans perdre la confidentialité.

À ne jamais confondre avec le **rideau** de confidentialité (effet visuel de floutage, INV-04 § 5.2).

### 5.5 Suppression logique et cascade

Toute suppression est **logique** (`deletedAt`) sur 47 modèles, afin que la synchronisation propage l'effacement par tombstone.

La suppression d'une consultation déclenche une **cascade explicite**, dans l'ordre des dépendances : lignes d'ordonnance → ordonnances → lignes d'examen → résultats → bons d'examen → lignes de bon de pharmacie → bons de pharmacie → suivis d'évacuation → évacuations → fiches de suivi.

> Aucune de ces relations ne porte `onDelete: Cascade` en base : la cascade est faite **explicitement, dans la même transaction**. La logique est partagée entre la suppression d'une consultation et celle d'une visite, pour ne jamais diverger.

---

## 6. Écarts et points de vigilance

| # | Constat | Gravité | Conséquence documentaire |
|---|---|---|---|
| E-01 | **Les décisions médicales sont 2, pas 4.** Le cahier annonce `CLOTURE_SIMPLE`, `PRESCRIPTION`, `EXAMEN_COMPLEMENTAIRE`, `EVACUATION` ; le code n'a que `EVACUATION` et `SUIVI_TRAITEMENT`. | **majeure** | Décrire les 2 valeurs réelles. Consigner l'écart dans `matrice_alignement.md`. Expliquer l'évolution : prescription et examen sont devenus des **documents**, pas des décisions. |
| E-02 | L'état `CONSULTÉ` du bon d'examen figure dans un commentaire mais **n'existe pas** dans le code. | moyenne | Ne pas le représenter. Commentaire obsolète à signaler. |
| E-03 | **5 machines à états sur 9** reposent sur des champs `String`, non sur des énumérations de base : ordonnance, bon de pharmacie, bon d'examen, évacuation, suivi de traitement. | moyenne | Les états ne sont **pas garantis par la base** : une écriture directe pourrait poser une valeur invalide. À énoncer honnêtement au chapitre 7 et en limite de conclusion. |
| E-04 | `ASSURE_CDD` n'ouvre pas droit aux bons. | à vérifier | `À CONFIRMER` auprès du terrain. Question probable du jury. |
| E-05 | La règle « une seule consultation ouverte par soignant » est vérifiée **par requête préalable**, non par une contrainte d'unicité en base. | faible | Techniquement sujet à concurrence. À mentionner si le jury interroge sur la robustesse. |

---

## 7. Alimente

| Destination | Figure | Contenu apporté |
|---|---|---|
| Fiche UML-ACT-01 → Figure 5.1 | Activité du processus **actuel** | ⛔ **Ne peut pas être alimentée par cet inventaire** — décrit le fonctionnement Excel + papier d'avant, qui dépend du recueil de terrain absent |
| ~~Fiche UML-ACT-02~~ | **Figure abandonnée le 18 août 2026** — l'activité du nouveau système ne figure plus dans le mémoire | § 4.1 et § 4.2 : triage → file → consultation → décision → documents |
| Fiches UML-SEQS-01 à 03 → Figures 6.4 à 6.6 | Séquences système | § 4.1 (triage), § 4.3 + 4.4 (prescription et bon), § 4.8 (authentification) |
| Fiches UML-SEQO-01/02 → Figures 7.3 et 7.4 | Séquences objets | § 5.2 (deux étages de contrôle) et § 4.9 (synchronisation avec conflit) |
| ~~Fiche UML-COM-01~~ | Communication | **Figure abandonnée le 18 août 2026** — le diagramme de communication ne figure plus dans le mémoire |
| Chapitre 6 § 6.6 | Fiches de spécification des UC | Préconditions, scénario nominal, alternatives, exceptions — déjà structurés ici |
| Chapitre 6 § 6.6bis | Descriptions textuelles (2 max) | Candidats : § 4.2 (consultation et décision) et § 4.4 (bon de pharmacie, qui porte la règle centrale) |
| Chapitre 3 § 3.1.3 | Catégories de patients et règles | § 5.1 en entier |
| Chapitre 7 | Conception | § 5.2 à § 5.5 |
| Matrice de traçabilité | — | Colonne « règle métier » |
