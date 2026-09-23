# Plan validé — réorganisation du mémoire

> Validé par Will le 21 septembre 2026, d'après les recommandations du directeur de mémoire
> et les critiques formulées en séance de travail.
> **Ce plan est la feuille de route. On le suit section par section, avec validation à chaque étape.**

---

## Le principe directeur

Le mémoire doit raconter **une seule chaîne de raisonnement**, où chaque partie prépare la suivante :

> ce qui existe → ce qui ne va pas → ce qu'on propose → ce qu'on conçoit → ce qu'on réalise

Deux conséquences :

- **Plus aucune répétition.** Le chapitre 2 actuel et le chapitre 5 actuel décrivent le même existant à vingt pages d'écart. Ils fusionnent.
- **La démarche 2TUP doit se voir dans le sommaire lui-même**, pas seulement dans le chapitre qui la décrit.

---

## Le plan

**Pages liminaires** — inchangées : Dédicace, Remerciements, Résumé, Abstract, Sommaire,
Liste des figures, Liste des tableaux, Liste des abréviations et sigles.

**INTRODUCTION GÉNÉRALE**

### PREMIÈRE PARTIE — CADRE CONTEXTUEL ET DOMAINE D'ÉTUDE

**CHAPITRE 1 — PRÉSENTATION DE LA STRUCTURE D'ACCUEIL**

1. SARIS-CONGO et son implantation
2. Le Service Médico-Social et ses missions
3. La population couverte
4. Organisation structurelle du service
5. Des fonctions réelles aux usages du système
6. Ressources et chiffres caractéristiques

**CHAPITRE 2 — DOMAINE D'ÉTUDE : LE SYSTÈME D'INFORMATION MÉDICAL**
*(l'actuel chapitre 3, inchangé dans son contenu)*

1. Contexte du projet
2. Problématique
3. Les acteurs du suivi médical
4. Le fonctionnement sur deux sites
5. Catégories de patients et règles de prise en charge
6. Intérêt du sujet
7. Situation du travail dans la littérature
8. Périmètre retenu et solution proposée
9. Concepts liés au sujet

### DEUXIÈME PARTIE — ANALYSE, CONCEPTION ET RÉALISATION SELON 2TUP COUPLÉ À UML

**CHAPITRE 3 — DÉMARCHE MÉTHODOLOGIQUE : 2TUP COUPLÉ À UML**

1. Le Processus Unifié
2. 2TUP, un processus en Y
3. UML, le langage de modélisation retenu
4. Justification du choix de 2TUP couplé à UML
5. Déroulement de la démarche dans ce mémoire — **section nouvelle**

#### BRANCHE FONCTIONNELLE — DU MÉTIER AUX CAS D'UTILISATION

**CHAPITRE 4 — ÉTUDE DE L'EXISTANT**
*(fusion de l'actuel chapitre 2 et de l'actuel chapitre 5)*

1. Démarche du recueil et sources mobilisées
2. Les processus métier soumis à l'étude
3. Le processus de consultation avant le projet
4. L'organisation informatique et le personnel qui la porte
5. L'infrastructure réseau et le parc matériel
6. Les applications et outils en usage
7. La gestion des données médicales
8. Les dix-huit besoins recueillis
9. Forces et faiblesses de la situation actuelle
10. Propositions de solutions et solution retenue
11. Nouvelles orientations pour le futur système

**CHAPITRE 5 — ANALYSE ET SPÉCIFICATION DES BESOINS**

1. Des processus métier aux besoins
   - Méthode : un processus, ses besoins fonctionnels, ses besoins non fonctionnels
   - Les besoins fonctionnels, processus par processus
   - Les besoins non fonctionnels
   - Confrontation des besoins exprimés au périmètre retenu
2. Des besoins aux cas d'utilisation
   - Les acteurs du système
   - Diagramme de contexte statique
   - Frontière du système
   - Les cas d'utilisation métier, issus des besoins fonctionnels
   - Les cas d'utilisation techniques, issus des besoins non fonctionnels
   - Classification par package
   - Relations entre cas d'utilisation
3. Spécification détaillée des cas d'utilisation prioritaires
   - Critères de priorité
   - UC43 — Émettre un bon de pharmacie
   - UC48 — Clôturer une consultation avec décision
4. Diagrammes de séquence système

#### BRANCHE TECHNIQUE — DES CONTRAINTES À L'ARCHITECTURE

**CHAPITRE 6 — ARCHITECTURE TECHNIQUE DU SYSTÈME**

1. Les contraintes techniques à satisfaire
2. L'architecture applicative et ses trois canaux
3. L'architecture de sécurité
4. Le moteur de synchronisation

#### CONVERGENCE DES DEUX BRANCHES — CONCEPTION ET RÉALISATION

**CHAPITRE 7 — CONCEPTION DÉTAILLÉE ET IMPLÉMENTATION**

1. Le modèle de classes
2. Composants, déploiement et interfaces
3. Environnement de développement et de déploiement
4. Modélisation et implémentation de la base de données
5. Les fonctionnalités développées
6. Tests et validation
7. Mise en production
8. Difficultés rencontrées et solutions apportées

**CONCLUSION GÉNÉRALE** · **BIBLIOGRAPHIE** · **WEBOGRAPHIE** · **TABLE DES MATIÈRES**

---

## Les écarts assumés par rapport au plan remis par le directeur

| Écart | Raison |
|---|---|
| Les processus (4.2-4.3) passent **avant** l'informatique (4.4-4.7) | C'est la logique qu'il a énoncée de vive voix. Son plan écrit reprenait l'ordre des sections existantes, ce qui semble être une fusion mécanique plutôt qu'un choix. **À lui confirmer, non bloquant.** |
| « Critique formelle » et « Premiers constats » **fusionnés** en 4.9 | C'étaient deux bilans successifs — la répétition même qu'on cherche à supprimer |
| Ajout de **4.11 Nouvelles orientations** | Demandé à l'oral, absent de son plan écrit. C'est le pont vers la conception |
| Ajout de **3.5 Déroulement de la démarche** | Réponse directe à « savoir comment 2TUP a été déroulé dans le document » |
| « Phases » remplacé par **« Branches »** | Dans 2TUP les deux branches sont parallèles — c'est le Y. « Phase » suggère une séquence. **Validé par Will.** |
| Le modèle de classes quitte la branche technique pour la convergence | Les classes naissent des cas d'utilisation, donc du fonctionnel |
| 1.5 « rôles du système » → « usages du système » | Le code ne connaît que trois rôles ; le tableau en décrivait quatre |

---

## Règles de rédaction à respecter, sans exception

- Chaque chapitre commence en haut d'une nouvelle page
- Chaque figure occupe une page entière, seule
- La page de garde ne se modifie jamais
- Aucune donnée patient réelle sur les captures d'écran
- Le code fait foi sur ce qui est livré ; les inventaires font foi sur les chiffres
- Rien ne s'invente : un chiffre sans source ne s'écrit pas
- Écrire **2TUP couplé à UML**, jamais « 2TUP / UML »
- Pas de code dans le mémoire

## Objectif de style

Phrases simples, efficaces, explicites. Le vocabulaire technique reste, mais seulement là où il
est nécessaire. On retire les répétitions, les détails qui n'apportent rien au projet ni à la
soutenance. **On ne coupe pas pour gagner des pages** : le plafond est à 150 pages et le
document en compte 112. On coupe ce qui n'apporte rien.

---

## Méthode de travail convenue

1. Claude annonce ce qu'il va modifier, texte avant et après
2. Will valide
3. Claude modifie directement dans le fichier Word
4. Will vérifie et valide
5. On passe à la section suivante

Les surlignements rouges — qui marquent les modifications déjà faites — sont retirés au fur et
à mesure, section par section.

Les pages de figures ne sont pas touchées.

Une fois tout le contenu repris, Will met à jour le sommaire, la table des matières et la
numérotation lui-même dans Word : Ctrl+A, puis F9.

---

## Ordre de traitement retenu

1. **Chapitre 1** — le tableau 1.4 et ses marquages rouges
2. **Chapitre 2 actuel** — les tableaux d'état, le bilan, les nouvelles orientations
3. **Déplacement des chapitres** et renumérotation des renvois
4. **Chapitres suivants**, dans l'ordre du nouveau plan
5. **Introduction générale en dernier** — elle annonce le plan, elle ne peut être écrite
   qu'une fois le plan réellement en place dans le document

## Ce qui reste en attente

- **Les données d'infrastructure réseau** : les colonnes « État » ont été ajoutées aux tableaux
  du parc matériel et des applications, mais elles sont vides. Il faut obtenir ces informations
  auprès de Verdi ou du Service Informatique de SARIS-CONGO — sans quoi ces colonnes devront
  être retirées plutôt que laissées vides.
- **Confirmation du directeur** sur l'ordre processus / informatique du chapitre 4.
