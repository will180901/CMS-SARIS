---
chapitre: 4
titre: "Méthodologie : 2TUP et UML"
budget_pages: 8-10
statut: relu
sources: [modele_memoire, plan_ecole, bibliographie]
figures: [ORG-03]
blocages: []
---

# CHAPITRE 4 — MÉTHODOLOGIE : 2TUP ET UML

## Introduction du chapitre

Concevoir un système d'information médical ne se résume pas à écrire du code. Entre le besoin exprimé par une infirmière à l'accueil et la ligne qui enregistre une visite en base, il existe une distance que seule une méthode rigoureuse permet de franchir sans perte. Cette distance est d'autant plus grande ici que le projet devait satisfaire deux exigences de nature différente : traduire fidèlement des pratiques de terrain, et tenir des contraintes techniques sévères — fonctionner sans connexion, sur deux sites, avec des données médicales à protéger.

Ce chapitre présente la démarche retenue : le **Processus Unifié** dans sa déclinaison **2TUP**, outillée par le langage de modélisation **UML**. Il expose d'abord les fondements du processus unifié, puis le principe des deux branches de 2TUP, ensuite les diagrammes UML effectivement mobilisés, et enfin la justification de ce choix pour CMS SARIS, comparé à deux alternatives sérieuses.

---

## 4.1 Le Processus Unifié (UP)

### 4.1.1 Origine et définition

Le Processus Unifié est un cadre de développement logiciel formalisé à la fin des années 1990 par Ivar Jacobson, Grady Booch et James Rumbaugh, les auteurs mêmes d'UML. Il ne s'agit pas d'une méthode figée mais d'un **canevas de processus** : un ensemble de principes et d'activités qu'une équipe adapte à son contexte.

Sa définition tient en quatre caractéristiques, généralement énoncées ensemble :

**Il est piloté par les cas d'utilisation.** Le besoin n'est pas décrit comme une liste de fonctions, mais comme un ensemble d'interactions entre des acteurs et le système. Un cas d'utilisation raconte ce qu'un acteur veut obtenir, pas ce que le logiciel doit faire techniquement. Cette orientation garde le développement tourné vers l'usage réel.

**Il est centré sur l'architecture.** L'architecture n'est pas une conséquence du développement mais son ossature, définie tôt et validée par des versions exécutables. Elle sert de référence commune à toute l'équipe.

**Il est itératif et incrémental.** Le développement procède par cycles courts, chacun produisant une version enrichie du système. Chaque itération traverse toutes les activités — analyse, conception, réalisation, test — plutôt que de les enchaîner une seule fois.

**Il est conduit par les risques.** Les points les plus incertains sont traités en premier, pour que les mauvaises surprises surviennent tôt, quand elles coûtent encore peu.

### 4.1.2 Le cycle de vie en quatre phases

Le Processus Unifié organise le projet en quatre phases successives, chacune pouvant contenir plusieurs itérations.

| Phase | Objet | Critère de sortie |
|---|---|---|
| **Inception** | Cerner le périmètre, identifier les acteurs et les cas d'utilisation principaux, évaluer la faisabilité | Accord sur le périmètre et les risques majeurs |
| **Élaboration** | Stabiliser l'architecture, détailler les cas d'utilisation critiques, lever les risques techniques | Architecture exécutable validée |
| **Construction** | Réaliser l'essentiel des fonctionnalités, par itérations | Système complet, testé |
| **Transition** | Déployer, former, corriger | Système utilisé par ses destinataires |

La répartition de l'effort est déséquilibrée à dessein : l'inception et l'élaboration mobilisent peu de développement mais lèvent la majorité des incertitudes ; la construction concentre le volume de production.

---

## 4.2 2TUP — Two-Track Unified Process

### 4.2.1 Principes

2TUP est une déclinaison pratique du Processus Unifié, popularisée en France par Pascal Roques et Franck Vallée. Son apport tient dans une observation simple : **un système subit deux sortes de contraintes, qui n'évoluent pas au même rythme et ne se traitent pas de la même façon**.

D'un côté les contraintes **fonctionnelles** : ce que les utilisateurs attendent, les règles du métier, les documents à produire. De l'autre les contraintes **techniques** : les plateformes disponibles, les performances exigées, les modes de déploiement, les impératifs de sécurité.

Mêler ces deux natures de contraintes dès le départ produit un défaut connu : la conception fonctionnelle se laisse contaminer par des considérations techniques, et les choix techniques se figent avant d'avoir compris le métier. 2TUP les sépare volontairement en **deux branches parallèles**, qui ne se rejoignent qu'à la conception préliminaire.

D'où sa représentation caractéristique en **Y** : deux branches montantes, un point de convergence, un tronc descendant.

> **Figure 4.1 — Cycle de développement selon 2TUP** *(fiche `ORG-03`)*

### 4.2.2 La branche fonctionnelle — branche gauche

Elle part du métier et l'épure de toute considération technique.

| Étape | Production |
|---|---|
| Capture des besoins fonctionnels | Cahier des exigences, acteurs identifiés |
| Analyse | Cas d'utilisation, scénarios, règles métier, modèle du domaine |
| Structuration | Classification des cas d'utilisation, priorités |

Le produit de cette branche est un **modèle du métier indépendant de toute technologie**. Il resterait valable si l'on changeait de langage, de base de données ou de plateforme.

Dans CMS SARIS, cette branche a produit l'identification de trois acteurs, la description du parcours de soin — accueil, triage, file d'attente, consultation, décision, documents — et surtout la formalisation de la règle qui gouverne tout le système : **toutes les catégories de patients ont droit à la consultation et aux premiers soins, mais seuls les employés en contrat à durée indéterminée et leurs ayants droit ouvrent droit aux bons de pharmacie et d'examen**. Cette règle est de nature purement métier ; aucune considération technique n'intervient dans sa formulation.

### 4.2.3 La branche technique — branche droite

Elle part des contraintes d'exploitation et construit l'architecture qui les satisfait, indépendamment des fonctions à rendre.

| Étape | Production |
|---|---|
| Capture des besoins techniques | Exigences non fonctionnelles |
| Conception générique | Architecture de référence, choix des technologies |
| Prototypage | Validation des choix par le code |

Dans CMS SARIS, cette branche a dû répondre à des contraintes que le métier ne dictait pas mais que le contexte imposait :

- **fonctionner sans connexion** — la connectivité des sites est variable ;
- **partager les données entre deux sites** sans imposer une saisie double ;
- **protéger des données de santé** au repos comme en transit ;
- **s'installer sur des postes Windows** sans droits d'administrateur ;
- **rester maintenable par une équipe de deux personnes**.

C'est de cette branche que proviennent les décisions structurantes : une base PostgreSQL centrale doublée d'une réplique SQLite locale, une résolution de conflit fondée sur la dernière écriture, une suppression logique généralisée pour propager les effacements, un chiffrement symétrique authentifié pour la messagerie, et un monorepo permettant de partager les types entre le serveur et les clients.

**La branche technique contraint la branche fonctionnelle**, mais tardivement et de façon maîtrisée. Le choix de la résolution par dernière écriture, par exemple, a une conséquence fonctionnelle directe : deux agents modifiant simultanément le même dossier depuis deux postes hors ligne ne verront pas leurs modifications fusionnées, la plus récente l'emportera. Cette conséquence devait être connue et acceptée par le métier avant d'être figée.

### 4.2.4 Convergence et construction

Les deux branches se rejoignent à la **conception préliminaire** : le modèle du métier est projeté sur l'architecture technique. Les entités du domaine deviennent des modèles de données, les cas d'utilisation deviennent des routes et des écrans, les règles métier deviennent des gardes et des services.

La **construction** réalise ensuite l'intégration par itérations. Dans CMS SARIS, chaque itération a livré un module fonctionnel complet — de la base de données à l'écran — plutôt qu'une couche technique horizontale. C'est ce qui explique l'organisation du code, où l'on retrouve le même découpage par domaine métier dans l'API et dans le frontend.

---

## 4.3 UML — Unified Modeling Language

### 4.3.1 Présentation

UML est un langage de modélisation graphique normalisé par l'Object Management Group. Ce n'est ni une méthode ni un processus : c'est un **vocabulaire visuel** permettant de décrire un système sous plusieurs angles, avec une sémantique partagée.

Sa valeur tient à trois propriétés. Il est **normalisé**, donc lisible par tout informaticien formé. Il est **multi-vues** : aucun diagramme ne prétend décrire le système entier, chacun en éclaire une facette. Il est **indépendant du langage de programmation**, ce qui permet de raisonner sur la structure avant de raisonner sur le code.

Sa limite doit être énoncée avec la même clarté : un diagramme UML ne prouve rien. Il communique une intention. La conformité entre le modèle et le code réalisé n'est garantie que par une vérification explicite — c'est précisément ce qu'assure, dans ce travail, la matrice de traçabilité présentée au chapitre 6.

### 4.3.2 Les diagrammes retenus

UML définit une quinzaine de types de diagrammes. En retenir la totalité serait un exercice scolaire sans valeur. Ceux qui suivent ont été retenus parce que chacun répond à une question précise que le projet posait.

| Diagramme | Question à laquelle il répond | Étape 2TUP | Chapitre |
|---|---|---|---|
| **Contexte statique** | Où s'arrête le système, et avec qui échange-t-il ? | Capture fonctionnelle | 6 |
| **Cas d'utilisation** | Qui fait quoi avec le système ? | Capture fonctionnelle | 6 |
| **Séquence système** | Dans quel ordre l'acteur et le système échangent-ils, vu de l'extérieur ? | Analyse | 6 |
| **Activité** | Comment s'enchaînent les étapes d'un processus, avec ses décisions ? | Analyse | 5 et 7 |
| **Classes** | Quelles sont les entités du domaine et comment se relient-elles ? | Conception | 7 |
| **Séquence objets** | Comment les composants internes collaborent-ils pour rendre le service ? | Conception | 7 |
| **Communication** | Quels liens structurels existent entre ces composants ? | Conception | 7 |
| **Composants** | De quels blocs déployables le système est-il fait ? | Conception | 7 |
| **Déploiement** | Sur quelles machines ces blocs s'exécutent-ils ? | Conception | 7 |

Deux diagrammes UML fréquents ont été **écartés**, et il vaut mieux le dire que le taire. Le **diagramme d'états-transitions** n'a pas été produit sous forme graphique : les neuf machines à états du système sont décrites sous forme de tables de transitions, plus denses et plus vérifiables sur ce projet. Le **diagramme de paquetages** n'apporterait rien de plus que le diagramme de composants, l'organisation du monorepo étant déjà lisible dans ce dernier.

---

## 4.4 Justification du choix de 2TUP pour CMS SARIS

### 4.4.1 Pourquoi une méthode, et pourquoi celle-là

Trois caractéristiques du projet ont commandé ce choix.

**La double nature des contraintes.** Le besoin métier — accueillir, trier, consulter, prescrire, orienter — est classique pour un centre de santé. La contrainte technique — fonctionner sans connexion, sur deux sites, avec réconciliation automatique — l'est beaucoup moins. C'est exactement la configuration pour laquelle la séparation en deux branches a été conçue. Traitées ensemble, ces deux familles de contraintes auraient produit soit une application métier correcte incapable de fonctionner hors ligne, soit une prouesse technique éloignée des pratiques réelles.

**La taille du projet et de l'équipe.** Deux étudiants, un projet de quelques dizaines de milliers de lignes. Le Processus Unifié complet, avec ses rôles nombreux et ses artefacts abondants, aurait produit plus de documentation que de logiciel. 2TUP, plus léger, reste praticable à cette échelle.

**Le besoin de traçabilité.** Un système manipulant des données de santé doit pouvoir justifier chacune de ses règles. L'orientation par les cas d'utilisation, propre au Processus Unifié, fournit naturellement le fil qui relie un besoin observé à une règle métier, puis à un écran, une route, une entité et un test.

### 4.4.2 Comparaison avec deux alternatives

| Critère | **Merise** | **Scrum** | **2TUP** |
|---|---|---|---|
| Nature | Méthode d'analyse et de conception, orientée données | Cadre de gestion de projet agile | Processus de développement orienté objet |
| Approche dominante | Données puis traitements | Livraison incrémentale pilotée par la valeur | Cas d'utilisation et architecture |
| Modélisation objet | Non — modèle entité-association | Non prescrite | Oui, native, via UML |
| Traite l'architecture technique | Peu | Non prescrite | **Oui, branche dédiée** |
| Adapté à une équipe de 2 | Oui | Difficilement — les rituels supposent une équipe | Oui |
| Produit une documentation soutenable | Oui | Non par nature | Oui |
| Adéquation au projet | Moyenne | Faible | **Forte** |

**Merise** reste solide pour concevoir une base de données, et son modèle conceptuel a inspiré la démarche de modélisation des données de ce projet. Mais elle est structurellement orientée données et traitements, non objet. Or l'application repose sur une modélisation objet de bout en bout — entités, services, composants — et sur un langage typé partagé entre serveur et clients. Merise aurait obligé à traduire deux fois.

**Scrum** est un cadre de gestion, non une méthode de conception : il organise le travail, il ne dit rien de la façon de modéliser. Il aurait fallu lui adjoindre UML de toute façon. Surtout, ses rituels — mêlée quotidienne, revue de sprint, rétrospective, rôles distincts de propriétaire de produit et de facilitateur — supposent une équipe de plusieurs personnes et un commanditaire disponible. À deux étudiants, ils deviennent une formalité vide. Le caractère itératif de Scrum, en revanche, a été retenu : le développement de CMS SARIS a bien procédé par incréments fonctionnels, chacun livrant un module complet.

**2TUP** offre le meilleur compromis : la rigueur de modélisation du Processus Unifié, la séparation des préoccupations adaptée à un projet à forte contrainte technique, et une charge documentaire soutenable.

### 4.4.3 Ce que la méthode n'a pas résolu

L'honnêteté impose de le noter : 2TUP structure la conception, il ne remplace pas l'accès au terrain. Le volet fonctionnel de ce travail est resté dépendant de la disponibilité du recueil de l'existant et des entretiens conduits pendant le stage. Aucune méthode ne compense une source manquante — elle rend simplement visible ce qui manque, ce qui est déjà beaucoup.

De même, le caractère itératif du Processus Unifié suppose des retours d'utilisateurs entre itérations. Ces retours ont été limités, l'équipe n'ayant pas eu d'accès continu au personnel du centre. Les itérations ont donc été guidées davantage par l'analyse que par l'usage observé, ce qui constitue une limite de la démarche telle qu'elle a pu être appliquée.

---

## Conclusion du chapitre

Ce chapitre a posé le cadre méthodologique du travail. Le Processus Unifié fournit les principes — pilotage par les cas d'utilisation, centrage sur l'architecture, itération, gestion des risques. 2TUP en donne une déclinaison praticable, dont l'apport propre est la séparation d'une branche fonctionnelle et d'une branche technique qui ne convergent qu'à la conception. UML fournit le vocabulaire visuel, dont neuf types de diagrammes ont été retenus, chacun répondant à une question identifiée.

Ce cadre gouverne l'ensemble de la partie II. Le chapitre 5 applique la phase d'étude de l'existant. Le chapitre 6 déroule la branche fonctionnelle : besoins, acteurs, cas d'utilisation, scénarios. Le chapitre 7 opère la convergence : architecture, modèle de classes, composants, déploiement. Le chapitre 8 rend compte de la construction et de sa validation.
