# Recensement des fonctionnalités de l'application

> **Date du relevé** : 31 août 2026
> **Source** : lecture directe du dépôt `CMS/APP/CMS-SARIS` — API, application web, client de bureau, schéma de données, catalogue de permissions.
> **Méthode** : extraction automatique puis relecture. Chaque chiffre de ce document a été recompté sur le code, aucun n'est repris d'un inventaire.
> **Objet** : établir ce que l'application fait réellement, et le confronter au mémoire.

---

## 1. Ce qu'il faut retenir en une page

L'application est structurée en **18 modules fonctionnels**, portés par **26 contrôleurs** côté serveur et **15 modules** côté interface. Elle expose **273 points d'entrée**, s'appuie sur **88 entités** de données, **130 permissions** et **41 migrations**.

**Le mémoire annonce 268 routes et 128 permissions.** L'écart n'est pas une erreur du mémoire : les inventaires ont été extraits le **10 août 2026**, et **cinq points d'entrée ont été ajoutés depuis**. Aucun n'a disparu. Le relevé est donc cohérent, mais il a trois semaines de retard.

**Trois de ces cinq fonctionnalités ne correspondent à aucun des soixante-cinq cas d'utilisation du mémoire.** C'est le seul vrai problème de ce recensement, et il est traité au § 4.

| Indicateur | Mémoire (10 août) | Code (31 août) | Écart |
|---|---:|---:|---:|
| Points d'entrée de l'API | 268 | **273** | **+5** |
| Contrôleurs | 26 | 26 | — |
| Modules fonctionnels | 18 | 18 | — |
| Entités de données | 88 | 88 | — |
| Migrations de base | 41 | 41 | — |
| Permissions au catalogue | 128 | **130** | **+2** |
| Cas d'utilisation décrits | 65 | — | **3 fonctions sans cas** |
| Écrans atteignables | 15 | 15 | — |
| Modales d'impression | 6 | **7** | **+1** |

---

## 2. Le recensement, module par module

### Partie I — Sécurité et habilitations

#### M01 · Accès personnel et authentification — 21 fonctions

L'ouverture de session se fait en quatre étapes possibles, toutes implémentées : identifiant et mot de passe, second facteur temporaire, résolution d'une session déjà ouverte ailleurs, et **confirmation du site de travail**. Le rafraîchissement du jeton, le changement de mot de passe et la fermeture de session complètent l'accès.

L'utilisateur gère ensuite lui-même son espace : ses préférences d'affichage, sa photo de profil, l'annuaire du centre, l'acceptation des conditions d'utilisation, la liste de ses sessions actives avec révocation individuelle ou globale, et l'activation, la vérification puis la désactivation de son second facteur.

> **Aucune de ces fonctions n'exige de permission** : elles portent sur le compte de la personne connectée. C'est la seule zone du système dans ce cas, et le mémoire le signale déjà.

#### M02 à M04 · Comptes, rôles, permissions, audit, paramètres, sauvegardes — 33 fonctions

**Comptes utilisateurs (14)** — créer, lire, modifier, supprimer un compte ; attribuer ses rôles ; changer son statut ; réinitialiser son mot de passe ; réinitialiser son second facteur ; régénérer ses codes de secours ; révoquer toutes ses sessions ; lire et fixer ses dérogations de permission, individuellement ou par lot.

**Rôles et permissions (7)** — le catalogue complet des permissions, la liste des rôles, le détail d'un rôle, la liste de ses porteurs, puis la création, la modification et la suppression d'un rôle.

**Journal d'audit (3)** — consultation des actions métier, consultation des événements d'authentification, et **purge du journal**.

**Paramètres système (3)** — lecture de l'ensemble, modification d'un paramètre, remise d'un paramètre à sa valeur d'usine.

**Sauvegardes et maintenance (6)** — état du dispositif, liste des sauvegardes, déclenchement d'une sauvegarde manuelle, restauration d'une sauvegarde, suppression d'une sauvegarde, et rechiffrement de la messagerie.

### Partie II — Référentiels et acteurs

#### M05 · Référentiels — 37 fonctions

**Sept référentiels**, chacun avec le même jeu de cinq à six fonctions — consulter, créer, modifier, activer ou désactiver, supprimer :

| Référentiel | Fonctions |
|---|---:|
| Sites | 6 |
| Motifs de consultation | 5 |
| Pathologies | 5 |
| Médicaments | 5 |
| Catégories de patient | 6 *(dont la lecture de la matrice des droits)* |
| Types d'examen | 5 |
| Types de consultation | 5 |

La **matrice des droits par catégorie** est lue par une fonction dédiée : c'est elle qui porte la règle d'éligibilité, la plus structurante du système.

#### M06 · Personnel, délégations, sous-traitants, employés — 25 fonctions

**Fiches de personnel (7)** — liste, liste restreinte aux soignants, détail, création, modification, changement de statut, suppression.

**Délégations de prescription (7)** — **ses propres délégations actives** (seule fonction du module sans permission, puisqu'elle ne renvoie que ce qui concerne le demandeur), la liste générale, le détail, l'octroi, la modification, la révocation, la suppression.

**Sociétés sous-traitantes (6)** et **registre des employés SARIS (5)**, dont la **recherche d'un employé par son matricule**, qui sert au rattachement d'un ayant droit.

### Partie III — Dossier patient

#### M07 · Dossier patient — 30 fonctions

**Identification et création (5)** — liste filtrée, création, **rapprochement de doublons** avant création, recherche par matricule employeur, ouverture du dossier.

**Contenu médical (12)** — allergies, antécédents et alertes médicales, chacun avec création, modification et suppression ; mode de vie ; suivi chronique avec création et modification.

**Consultation du dossier (4)** — ayants droit du travailleur, historique des constantes vitales, alertes cliniques, suivi.

**Gestion administrative (9)** — mise à jour de l'identité, photo du patient et son retrait, changement de catégorie, changement de statut (archivage), **verrouillage et déverrouillage du dossier**, modification et suppression d'un rattachement d'ayant droit, suppression du dossier.

> Le **verrou de dossier** et la **restriction d'historique pour l'infirmier** sont implémentés dans le contrôleur lui-même, pas seulement dans les permissions. C'est la traduction technique de la règle de confidentialité du recueil.

### Partie IV — Parcours de soin

#### M08 · Accueil et triage — 9 fonctions

Ouvrir une visite, consulter la file, retrouver les visites d'un patient, ouvrir une visite précise, **relever les constantes vitales**, affecter un soignant, annoter, changer le statut (prise en charge, clôture, annulation), supprimer.

#### M09 · Consultation — 22 fonctions

**Acte de soin (13)** — ouvrir, lister, ouvrir le détail, consulter les documents d'un patient, saisir l'examen clinique, rédiger la conclusion, fixer le type de consultation, **délivrer un repos**, poser et retirer un diagnostic, prendre en charge, clôturer, annuler, supprimer.

**Ordonnances (9)** — créer, ajouter une ligne, modifier, retirer une ligne, valider, annuler, supprimer, et **générer le bon** de pharmacie ou d'examen correspondant.

> La génération du bon est la seule fonction du système à exiger **deux permissions distinctes** de création — bon d'examen **et** bon de pharmacie. C'est le point où la règle d'éligibilité par catégorie est appliquée.

#### M10 · Bon d'examen — 7 fonctions

Liste, détail, modification, validation, annulation, suppression, et **saisie du résultat** — cette dernière exigeant un bon préalablement validé.

#### M11 · Bon de pharmacie — 5 fonctions

Liste, détail, **délivrance**, annulation, suppression. Un bon délivré ne peut plus être annulé.

#### M12 · Évacuations — 8 fonctions

Liste, détail, initiation, modification, **ajout d'une étape de suivi**, annulation, clôture, suppression.

#### M12b · Suivi de traitement — 8 fonctions

Liste, détail, ouverture d'un épisode, **ajout d'une fiche datée**, modification d'une fiche, clôture, annulation, suppression.

### Partie V — Fonctions transverses

#### M13 · Messagerie interne — 29 fonctions

C'est le module le plus fourni du système, et de loin le plus riche par rapport à ce que le mémoire en dit.

**Conversations (13)** — contacts, liste des conversations, compteur de non-lus, ouverture d'une conversation, **création d'un groupe**, quitter un groupe, informations du groupe, ajout et retrait de participants, **nomination d'un administrateur de groupe**, modification du groupe, photo du groupe et son retrait, mise en sourdine, indicateur de saisie en cours.

**Messages (16)** — lecture, envoi, **pièces jointes**, détail d'un message, réactions et détail des réactions, épinglage et liste des épinglés, **transfert**, modification, suppression, masquage individuel, masquage par lot, suppression par lot.

> L'interface ajoute par-dessus : **enregistrement de messages vocaux**, lecteur de médias, sélecteur d'émojis, aperçu des pièces jointes.

#### M14 · Notifications — 9 fonctions

Liste, compteur de non-lus, marquage lu, marquage global, **diffusion d'une annonce**, écartement individuel, par lot et global, suppression.

#### M15 · Tableaux de bord — 9 fonctions

Vue d'ensemble, motifs du jour, urgences, tendance, affluence, **tableau de bord de l'administrateur système**, statistiques, **croisement d'axes**, évolution annuelle.

#### M15b · Rapports — 4 fonctions

Liste, **génération d'un rapport**, consultation d'un rapport, **suppression d'un rapport**.

#### M16 · Synchronisation — 14 fonctions

**Échange de données (3)** — récupération des changements, envoi des changements locaux, battement de cœur.

**Gestion du poste (2)** — enregistrement d'un poste local, lecture de sa configuration.

**Supervision du parc (5)** — vue générale, activité, détail d'un poste, renommage, masquage.

**Déclenchement (4)** — état, exécution, exécution immédiate, indicateur de disponibilité. Ces deux dernières sont **sans permission** : elles servent l'amorçage du poste avant toute session.

---

## 3. Ce que porte l'interface, au-delà de l'API

| Élément | Nombre |
|---|---:|
| Écrans atteignables | 15 |
| Modules fonctionnels front | 15 |
| Onglets et sous-onglets | 25, sur 4 pages composites |
| **Modales d'impression A4** | **7** — dossier, ordonnance, certificat de repos, bon de pharmacie, bon d'examen, évacuation, **rapport** |
| Gabarits d'impression partagés | 2 — pièce médicale et liste |
| Magasins d'état | 12 |
| Langues | 2, français et anglais |

Le **client de bureau** ajoute deux modes de fonctionnement — client léger et poste autonome hors connexion — avec base locale, synchronisation par écarts, propagation des suppressions par pierres tombales, et installateur sans droits administrateur.

---

## 4. Les cinq écarts, et ce qu'il faut en faire

Cinq points d'entrée existent dans le code et ne figurent pas dans les inventaires du 10 août. **Aucune fonction inventoriée n'a disparu** : le système n'a fait que croître.

| # | Fonction | Module | Cas d'utilisation correspondant |
|---|---|---|---|
| 1 | **Générer un rapport** | M15b Rapports | **UC61 — Exporter un rapport** ✔ |
| 2 | **Confirmer son site à la connexion** | M01 Sécurité | **aucun** ✘ |
| 3 | **Purger le journal d'audit** | M03 Audit | **aucun** ✘ — UC14 ne couvre que la consultation |
| 4 | **Supprimer un rapport** | M15b Rapports | **aucun** ✘ |
| 5 | État détaillé du service | — technique | sans objet, hors périmètre fonctionnel |

Les deux permissions nouvelles — purge du journal et suppression d'un rapport — correspondent exactement aux points 3 et 4.

### Le premier cas est le plus important

**Générer un rapport** est la fonction que le cas UC61 décrit. Le mémoire l'annonce donc correctement ; c'est **l'inventaire des routes qui l'a manquée**, et par conséquent le module Rapports y apparaît avec 2 fonctions au lieu de 4. Le mémoire dit par ailleurs que le rapport est « exporté » — la fonction existe bel et bien.

### Les trois autres sont des fonctions sans cas d'utilisation

Elles sont réelles, elles sont dans le code, elles sont accessibles depuis l'interface — la confirmation de site a même son propre écran — et **aucune n'est décrite dans le mémoire**. Un jury qui ouvrirait l'application les trouverait.

Trois façons de traiter cela, à arbitrer :

| | Ce qu'on fait | Ce que ça coûte |
|---|---|---|
| **A** | Ajouter trois cas d'utilisation — le total passe de 65 à 68 | Il faut reprendre les tableaux 6.5 à 6.10, la répartition par module, les cinq planches de cas d'utilisation déjà dessinées, et la matrice de traçabilité. **Travail lourd, figures à refaire.** |
| **B** | Rattacher les trois fonctions à des cas existants, en élargissant leur libellé | UC14 deviendrait « Consulter et purger le journal d'audit », UC60 ou UC61 absorberait la suppression, et la confirmation de site rejoindrait UC01. **Trois libellés à changer, aucune figure à refaire.** |
| **C** | Ne rien changer et l'assumer | Le mémoire décrit un périmètre arrêté au 10 août. Il faudrait alors le **dire explicitement** dans le texte, sinon l'écart passe pour un oubli. |

### Et les chiffres du chapitre 8

Le mémoire écrit : « environ 93 500 lignes réparties sur 547 fichiers, avec **268 routes**, 88 entités, **128 permissions** et 41 migrations ». Deux de ces cinq chiffres ne sont plus exacts. **Les trois autres le sont toujours** — les 88 entités et les 41 migrations ont été recomptées et vérifiées ce jour.

---

## 5. Ce que ce recensement confirme

Il faut le dire aussi, parce que c'est le résultat principal : **les inventaires du dossier sont fidèles**. Sur 268 routes recensées, 268 existent toujours et sont exactement là où l'inventaire les situe. Les 88 entités, les 41 migrations, les 15 écrans, les 26 contrôleurs, les 18 modules : tout se vérifie.

L'écart tient entièrement à trois semaines de développement postérieures à l'extraction. Ce n'est pas un défaut de méthode, c'est une date qui a vieilli.
