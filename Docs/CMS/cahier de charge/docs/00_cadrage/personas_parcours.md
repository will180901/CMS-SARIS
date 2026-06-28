# Personas & parcours — CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Historique** : v1.0 création

> Document de cadrage « as-built » : il décrit les utilisateurs réels de **CMS SARIS** et leurs
> parcours **actuels** (Excel / papier, « façon Jeannette ») comparés aux parcours **cibles**
> outillés par le système tel qu'il est développé et déployé. Source de vérité : le brief
> système canonique. Voir aussi [[glossaire]], [[plan_modules]],
> [[parametres_metier]], [[modele_donnees_global]].

---

## 1. Contexte d'usage

CMS SARIS est le système de gestion clinique médico-sociale du **Centre Médico-Social de
SARIS-CONGO** (sucrerie, Congo-Brazzaville). Il sert les **travailleurs** (et leurs **ayants
droit**, ainsi que riverains et sous-traitants) sur **deux sites** : **Moutela** et **Nkayi**.
Il remplace un suivi sur tableur Excel et registres papier.

L'architecture est **offline-first multi-poste** : chaque poste de travail peut être une
**application desktop (Windows)** embarquant son propre backend et sa base locale, fonctionnant
**hors-ligne** et se **synchronisant** avec un **serveur central cloud** dès que la connexion
revient. Un **site web public** (PWA) donne également un accès direct au central. Cette
contrainte de **connectivité variable** structure tous les parcours décrits ci-dessous.

Le système est organisé autour de **4 rôles** (voir [[MODULE_02_acces_habilitations]] et la fiche
projet « réduction à 4 rôles ») : `ADMIN_SYSTEME`, `MEDECIN_CHEF`, `MEDECIN`, `INFIRMIER`.
Le **patient** et l'**ayant droit** ne sont pas des utilisateurs du logiciel : ce sont les
**sujets** des dossiers ; ils sont décrits ici comme personas pour éclairer les besoins.

---

## 2. Personas — utilisateurs du système

### 2.1 Persona P-01 — Médecin-chef (« Dr Moukanda »)

- **Rôle système** : `MEDECIN_CHEF` (administrateur médical + supervision).
- **Mission** : consultations complètes (diagnostic, prescription, examens, évacuation),
  **supervision** de toute l'activité clinique de son site, gestion des référentiels, du
  personnel soignant et des sociétés sous-traitantes, **verrouillage** d'un dossier sensible.
- **Littératie numérique** : moyenne à bonne ; à l'aise avec un logiciel métier mais pas
  développeur. Attend une interface en clair (pas de codes techniques).
- **Équipement** : poste fixe au cabinet (application desktop Windows) ; consulte parfois depuis
  un portable via le site web.
- **Connectivité** : majoritairement connecté au central, mais doit pouvoir travailler en cas
  de coupure réseau (mode local du desktop).
- **Besoins clés** :
  - Voir l'ensemble des consultations et dossiers de son site (rôle de supervision).
  - Prescrire librement (ordonnance, bon de pharmacie, bon d'examen) et décider d'une
    **évacuation**.
  - Imprimer des documents A4 conformes (ordonnance, bon de pharmacie, bon d'examen,
    évacuation).
  - Protéger un dossier confidentiel via le **verrou** (`patient.lock`).
  - Suivre l'activité (tableau de bord, statistiques par type × pathologie × catégorie).

### 2.2 Persona P-02 — Médecin (« Dr Ndinga »)

- **Rôle système** : `MEDECIN`.
- **Mission** : assurer **ses** consultations cliniques.
- **Littératie numérique** : moyenne.
- **Équipement** : poste fixe (desktop) ou web.
- **Connectivité** : variable selon le site ; bénéficie du mode hors-ligne.
- **Besoins clés** :
  - Reprendre un patient depuis la file de triage, mener la consultation, décider de la suite
    (clôture simple, prescription, examen complémentaire, évacuation).
  - Voir **ses propres** consultations (activité scopée à l'initiateur ; il n'a pas la
    supervision de tout le site).
  - Émettre et imprimer les documents cliniques.

### 2.3 Persona P-03 — Infirmier (« Batchi »)

- **Rôle système** : `INFIRMIER`.
- **Mission** : **accueil et triage** (enregistrement / recherche du patient, mesure des
  **constantes vitales**, mise en file par ordre d'arrivée), conduite de consultations simples,
  prescription **uniquement si une délégation est active**.
- **Littératie numérique** : variable ; certains agents peu habitués à l'informatique → besoin
  d'une interface très lisible, sans jargon, avec saisie guidée.
- **Équipement** : poste d'accueil partagé (desktop) ; usage mobile occasionnel (drawer sidebar
  responsive).
- **Connectivité** : c'est souvent le poste le plus exposé aux coupures → le mode **offline**
  doit garantir l'enregistrement des arrivées sans interruption.
- **Besoins clés** :
  - Trouver rapidement un patient existant (dossier centralisé cross-site) ou en créer un, avec
    un **formulaire piloté par la catégorie** (CDI → matricule ; ayant droit → matricule du CDI
    rattaché ; sous-traitant → société ; riverain → identité seule).
  - Saisir les constantes et mode de vie, lancer la visite.
  - Mener une consultation simple ; prescrire **si** une délégation de prescription le couvre,
    sinon être bloqué proprement (message clair).

### 2.4 Persona P-04 — Administrateur système (« Admin »)

- **Rôle système** : `ADMIN_SYSTEME` (super-administrateur ; catalogue complet de permissions).
- **Mission** : gouvernance technique et fonctionnelle — **utilisateurs, rôles, permissions**,
  récupération de compte, sessions, paramètres système, supervision de la **synchronisation**
  (postes, file terrain, sauvegardes de configuration, volumétrie), **annonces** (dont annonces
  de mise à jour desktop), audit.
- **Littératie numérique** : élevée.
- **Équipement** : poste d'administration ; accès web et desktop.
- **Connectivité** : généralement connecté au central (rôle de pilotage du hub de synchro).
- **Besoins clés** :
  - Créer / désactiver des comptes et leur affecter un rôle (la création de compte clinique crée
    aussi la fiche de personnel soignant correspondante).
  - Réinitialiser un accès, gérer les sessions (session unique par utilisateur) et le 2FA (TOTP).
  - Diffuser des **annonces** et des **liens de mise à jour** de l'application desktop.
  - Surveiller la synchronisation multi-poste, lancer / restaurer des sauvegardes de
    configuration, consulter le **journal d'audit**.

---

## 3. Personas — sujets (non-utilisateurs)

### 3.1 Persona P-05 — Travailleur / patient (« Le travailleur CDI »)

- **Statut** : **sujet** d'un dossier, pas utilisateur du logiciel.
- **Catégorie** (référentiel `CategoriePatient`) : `ASSURE_CDI` le plus souvent ; les autres
  catégories couvrent CDD, ayants droit, sous-traitants et riverains (voir 3.3).
- **Caractéristiques** : identifié par son **matricule** (CDI/CDD) ; son dossier est
  **centralisé cross-site** (le suivi le suit s'il change de site).
- **Besoins (du point de vue du soin)** : être pris en charge rapidement à l'arrivée, bénéficier
  de la prise en charge des **médicaments (bon de pharmacie)** et des **examens** réservée à sa
  catégorie, disposer d'un dossier unique et continu.

### 3.2 Persona P-06 — Ayant droit (« L'enfant / le conjoint d'un CDI »)

- **Statut** : **sujet** d'un dossier, rattaché à un travailleur CDI.
- **Catégorie** : `AYANT_DROIT_CDI`.
- **Caractéristiques** : enregistré via le **matricule du CDI** auquel il est rattaché (lien de
  parenté), avec son propre dossier distinct ; bénéficie de la **même couverture** que le CDI
  (médicaments + examens).
- **Besoins (du point de vue du soin)** : être reconnu et rattaché sans ressaisie, et que son
  activité médicale soit traçable et reliée au travailleur de référence.

### 3.3 Catégories et droits aux bons (rappel de la règle centrale)

Tirée du recueil de l'existant et implémentée via `DroitCategoriePatient` (voir
[[parametres_metier]]) :

| Catégorie | Consultation & premiers soins | Bon de pharmacie (médicaments) | Bon d'examen |
|---|:---:|:---:|:---:|
| `ASSURE_CDI` | Oui | Oui | Oui |
| `AYANT_DROIT_CDI` | Oui | Oui | Oui |
| `ASSURE_CDD` | Oui | Non | Non |
| `SOUS_TRAITANT` | Oui | Non | Non |
| `RIVERAIN` | Oui | Non | Non |

> Règle **RM-CAT-01** (voir [[parametres_metier]]) : la **consultation et les premiers soins** sont
> ouverts à **toutes** les catégories ; le **bon de pharmacie** et le **bon d'examen** sont
> réservés à **`ASSURE_CDI` + `AYANT_DROIT_CDI`**. Les autres catégories s'arrêtent au registre.

---

## 4. Parcours clés — actuel (Excel / papier) vs cible (CMS SARIS)

### 4.1 Flux F-01 — Arrivée d'un patient → triage → consultation → documents

#### Parcours ACTUEL (« façon Jeannette »)

1. À l'accueil, l'infirmier recherche le patient dans un **classeur papier** ou un **fichier
   Excel** local au site ; un patient déjà vu sur l'autre site n'est pas retrouvé (pas de
   centralisation).
2. Les **constantes** sont notées sur une fiche papier ; l'ordre de passage est géré « de tête »
   ou sur un cahier.
3. Le médecin consulte, écrit le **diagnostic** et l'**ordonnance** à la main ; les bons
   d'examen et la délivrance de médicaments dépendent d'une **vérification visuelle** de la
   catégorie (badge / carnet).
4. Les documents sont rédigés à la main ; le comptage d'activité se fait **a posteriori** dans
   un classeur Excel.
5. Aucune trace consolidée multi-site ; risque de doublons, de perte de fiches, d'erreurs sur
   les droits aux bons.

#### Parcours CIBLE (CMS SARIS)

1. **Triage** : l'infirmier recherche le patient dans le **dossier centralisé cross-site** ;
   s'il est nouveau, le **formulaire piloté par la catégorie** capte les informations requises
   (matricule CDI/CDD reconnu via le **registre employé** ; matricule du CDI pour un ayant
   droit ; société pour un sous-traitant ; identité seule pour un riverain). Les **constantes
   vitales** et le **mode de vie** sont saisis ; la visite entre dans la **file par ordre
   d'arrivée** (pas de priorité).
2. **Consultation** : un médecin (ou un infirmier délégué) reprend la visite ; la consultation
   est **pilotée par la décision** (clôture simple, prescription, examen complémentaire,
   évacuation). À l'envoi, la visite est **clôturée** et une **notification ciblée** est émise.
3. **Documents** : ordonnance, **bon de pharmacie**, bon d'examen, certificat / repos et
   évacuation sont générés au **gabarit A4 SARIS** et imprimables. Les **bons de pharmacie et
   d'examen ne sont proposés que pour les catégories couvertes** (CDI + ayants droit) ; pour les
   autres, l'action est masquée / refusée avec un message clair (règle **RM-CAT-01**).
4. **Hors-ligne** : tout le parcours fonctionne sur le poste desktop sans réseau ; les données
   sont **synchronisées** avec le central à la reconnexion (réconciliation LWW).
5. **Pilotage** : le tableau de bord et les statistiques (type × pathologie × catégorie,
   exports CSV/PDF) remplacent le comptage manuel Excel.

##### Cas d'usage CU-F01-01 — Enregistrer et orienter un patient à l'arrivée

- **Étant donné** un infirmier authentifié sur le poste d'accueil (en ligne ou hors-ligne)
- **Quand** il recherche un patient absent puis l'enregistre via le formulaire de sa catégorie
  et saisit ses constantes
- **Alors** une visite est créée dans la file par ordre d'arrivée, le dossier est disponible
  cross-site, et la donnée se synchronise au central dès le retour de la connexion.

##### Cas d'usage CU-F01-02 — Refuser un bon non couvert

- **Étant donné** une consultation pour un patient `RIVERAIN`
- **Quand** le soignant tente d'émettre un bon de pharmacie ou un bon d'examen
- **Alors** l'action est indisponible (bouton masqué) et toute tentative est rejetée avec le
  message de couverture (conforme à **RM-CAT-01**).

### 4.2 Flux F-02 — Prescription par un infirmier (délégation)

#### Parcours ACTUEL

La prescription par un infirmier repose sur une **délégation verbale / écrite** du médecin,
sans contrôle systématique ni traçabilité fiable.

#### Parcours CIBLE

L'infirmier ne peut prescrire (ordonnance, bon de pharmacie, bon d'examen) que si une
**délégation de prescription est active** (période valide le concernant). Sinon l'action est
bloquée côté serveur avec un message explicite. La délégation est gérée dans l'écran
**Accès & habilitations** et tracée.

##### Cas d'usage CU-F02-01 — Prescription déléguée

- **Étant donné** un infirmier sans délégation active
- **Quand** il tente d'émettre une ordonnance
- **Alors** la demande est refusée (interdiction) ; **Étant donné** une délégation active le
  couvrant, **Alors** la prescription est acceptée et tracée.

### 4.3 Flux F-03 — Gestion des accès

#### Parcours ACTUEL

Pas de gestion d'accès formalisée : un poste / un fichier Excel partagé, sans authentification
forte, sans rôles, sans journal.

#### Parcours CIBLE

L'**administrateur système** gère les comptes, rôles et **permissions (110)** depuis l'écran
**Accès & habilitations** : création d'un compte (qui crée aussi la fiche de personnel soignant
pour un rôle clinique), affectation d'un rôle, **session unique** par utilisateur avec
révocation immédiate, **2FA TOTP** chiffré, récupération de compte, et **journal d'audit**
persistant sur les mutations. Le **médecin-chef** dispose en plus du **verrou de
confidentialité** par dossier.

##### Cas d'usage CU-F03-01 — Créer un accès soignant

- **Étant donné** un administrateur système authentifié
- **Quand** il crée un compte avec un rôle clinique et l'identité du soignant
- **Alors** le compte est créé, la fiche de personnel soignant associée est générée, et le
  soignant apparaît dans les sélecteurs de soignant ; toute la mutation est journalisée
  (audit).

##### Cas d'usage CU-F03-02 — Verrouiller un dossier sensible

- **Étant donné** un médecin-chef et un dossier patient sensible
- **Quand** il pose le verrou de confidentialité sur ce dossier
- **Alors** le contenu clinique est masqué / dépouillé pour les utilisateurs hors supervision
  (`{ADMIN_SYSTEME, MEDECIN_CHEF}`).

---

## 5. Synthèse des contraintes transverses

- **Connectivité variable** : tout poste critique (accueil, consultation) doit rester
  opérationnel **hors-ligne** et se **synchroniser** ensuite — exigence structurante pour tous
  les personas P-01 à P-04.
- **Littératie hétérogène** : interfaces en **clair** (codes techniques retirés des vues
  cliniques), saisie **guidée par la catégorie**, **bilingue FR/EN**, **responsive** mobile.
- **Confidentialité** : dossier centralisé mais activité **scopée à l'initiateur**, **verrou**
  médecin-chef, rideau de confidentialité (flou) sur les zones cliniques.
- **Traçabilité** : journal d'audit, IP réelle + géolocalisation, acceptation des conditions
  d'utilisation (CGU).

> Les chiffres (rôles, catégories, permissions, tables) sont définis une seule fois dans
> [[glossaire]] / [[plan_modules]] et référencés ici. En cas de divergence, le code
> et le brief système canonique font foi.
