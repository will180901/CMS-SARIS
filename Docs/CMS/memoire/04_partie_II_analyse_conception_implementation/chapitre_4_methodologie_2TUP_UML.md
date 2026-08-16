<!-- Fichier aligné sur Memoire_CMS_SARIS.docx le 19 août 2026. -->
<!-- Le document Word fait foi. Toute divergence est une erreur de ce fichier. -->

# CHAPITRE 4 — MÉTHODOLOGIE : 2TUP ET UML

> 1 figure(s) · 3 tableau(x) dans ce chapitre.

Concevoir un système d'information médical ne se résume pas à écrire du code. Entre le besoin exprimé par une infirmière à l'accueil et la ligne qui enregistre une visite en base, il existe une distance que seule une méthode rigoureuse permet de franchir sans perte. Cette distance est d'autant plus grande ici que le projet devait satisfaire deux exigences de nature différente : traduire fidèlement des pratiques de terrain, et tenir des contraintes techniques sévères. Ce chapitre présente la démarche retenue, le Processus Unifié dans sa déclinaison 2TUP, outillée par le langage UML, puis justifie ce choix.


## 4.1 Le Processus Unifié

Le Processus Unifié est un cadre de développement logiciel formalisé à la fin des années 1990 par Ivar Jacobson, Grady Booch et James Rumbaugh, les auteurs mêmes d'UML. Il ne s'agit pas d'une méthode figée mais d'un canevas que chaque équipe adapte à son contexte. Sa définition tient en quatre caractéristiques.

Il est d'abord piloté par les cas d'utilisation. Le besoin n'est pas décrit comme une liste de fonctions, mais comme un ensemble d'interactions entre des acteurs et le système, ce qui garde le développement tourné vers l'usage réel. Il est ensuite centré sur l'architecture : celle-ci n'est pas une conséquence du développement mais son ossature, définie tôt et validée par des versions exécutables. Il est itératif et incrémental, procédant par cycles courts qui traversent chacun toutes les activités plutôt que de les enchaîner une seule fois. Il est enfin conduit par les risques, les points les plus incertains étant traités en premier, quand les mauvaises surprises coûtent encore peu.

**Tableau 4.1 — Les quatre phases du Processus Unifié**

| Phase | Objet | Critère de sortie |
|---|---|---|
| Inception | Cerner le périmètre, identifier les acteurs et les cas d'utilisation principaux, évaluer la faisabilité | Accord sur le périmètre et les risques majeurs |
| Élaboration | Stabiliser l'architecture, détailler les cas d'utilisation critiques, lever les risques techniques | Architecture exécutable validée |
| Construction | Réaliser l'essentiel des fonctionnalités, par itérations | Système complet et testé |
| Transition | Déployer, former, corriger | Système utilisé par ses destinataires |

La répartition de l'effort est déséquilibrée à dessein : l'inception et l'élaboration mobilisent peu de développement mais lèvent la majorité des incertitudes, tandis que la construction concentre le volume de production.


## 4.2 2TUP — Two-Track Unified Process

2TUP est une déclinaison pratique du Processus Unifié, popularisée en France par Pascal Roques et Franck Vallée. Son apport tient dans une observation simple : un système subit deux sortes de contraintes, qui n'évoluent pas au même rythme et ne se traitent pas de la même façon. D'un côté les contraintes fonctionnelles, c'est-à-dire ce que les utilisateurs attendent et les règles du métier ; de l'autre les contraintes techniques, c'est-à-dire les plateformes disponibles, les modes de déploiement et les impératifs de sécurité.

Mêler ces deux natures de contraintes dès le départ produit un défaut connu : la conception fonctionnelle se laisse contaminer par des considérations techniques, et les choix techniques se figent avant que le métier ait été compris. 2TUP les sépare donc en deux branches parallèles, qui ne se rejoignent qu'à la conception préliminaire. D'où sa représentation caractéristique en Y : deux branches montantes, un point de convergence, un tronc descendant.

> 🖼️ **Figure 4.1 — Cycle de développement selon 2TUP**  
> *Emplacement d'image réservé dans le document.*

La branche fonctionnelle part du métier et l'épure de toute considération technique. Elle produit un modèle du métier indépendant de toute technologie, qui resterait valable si l'on changeait de langage ou de base de données. Dans ce projet, elle a produit l'identification de trois acteurs, la description du parcours de soin, et surtout la formalisation de la règle qui gouverne tout le système : toutes les catégories de patients ont droit à la consultation et aux premiers soins, mais seuls les employés en contrat à durée indéterminée et leurs ayants droit ouvrent droit aux bons de pharmacie et d'examen. Cette règle est de nature purement métier, et aucune considération technique n'intervient dans sa formulation.

La branche technique part au contraire des contraintes d'exploitation et construit l'architecture qui les satisfait, indépendamment des fonctions à rendre. Dans ce projet, elle a dû répondre à des contraintes que le métier ne dictait pas : fonctionner sans connexion, partager les données entre deux sites sans double saisie, protéger des données de santé au repos comme en transit, s'installer sur des postes Windows sans droits d'administrateur, et rester maintenable par une équipe de deux personnes. C'est de cette branche que proviennent les décisions structurantes du système : une base de données centrale doublée d'une réplique locale sur chaque poste, une résolution de conflit fondée sur la dernière écriture, une suppression logique généralisée pour propager les effacements, et un chiffrement authentifié pour la messagerie.

La branche technique contraint la branche fonctionnelle, mais tardivement et de façon maîtrisée. Le choix de la résolution par dernière écriture, par exemple, a une conséquence fonctionnelle directe : deux agents modifiant simultanément le même dossier depuis deux postes hors ligne ne verront pas leurs modifications fusionnées, la plus récente l'emportant. Cette conséquence devait être connue et acceptée par le métier avant d'être figée.

Les deux branches se rejoignent à la conception préliminaire : le modèle du métier est projeté sur l'architecture technique. Les entités du domaine deviennent des modèles de données, les cas d'utilisation deviennent des routes et des écrans, les règles métier deviennent des contrôles et des services. La construction réalise ensuite l'intégration par itérations. Dans ce projet, chaque itération a livré un module fonctionnel complet, de la base de données à l'écran, plutôt qu'une couche technique horizontale.


## 4.3 UML — Unified Modeling Language

UML est un langage de modélisation graphique normalisé par l'Object Management Group. Ce n'est ni une méthode ni un processus, mais un vocabulaire visuel permettant de décrire un système sous plusieurs angles, avec une sémantique partagée. Sa valeur tient à trois propriétés : il est normalisé, donc lisible par tout informaticien formé ; il est multi-vues, aucun diagramme ne prétendant décrire le système entier ; et il est indépendant du langage de programmation, ce qui permet de raisonner sur la structure avant de raisonner sur le code. Sa limite est qu'un diagramme UML ne prouve rien : il communique une intention, et la conformité entre le modèle et le code n'est garantie que par une vérification explicite.

UML définit une quinzaine de types de diagrammes. En retenir la totalité serait un exercice scolaire sans valeur. Ceux qui suivent ont été retenus parce que chacun répond à une question précise que le projet posait.

**Tableau 4.2 — Les sept diagrammes UML retenus**

| Diagramme | Question à laquelle il répond | Chapitre |
|---|---|---|
| Contexte statique | Où s'arrête le système, et avec qui échange-t-il ? | 6 |
| Cas d'utilisation | Qui fait quoi avec le système ? | 6 |
| Séquence système | Dans quel ordre l'acteur et le système échangent-ils, vu de l'extérieur ? | 6 |
| Activité | Comment s'enchaînaient les étapes du processus antérieur, avec ses décisions ? | 5 |
| Classes | Quelles sont les entités du domaine et comment se relient-elles ? | 7 |
| Composants | De quels blocs déployables le système est-il fait ? | 7 |
| Déploiement | Sur quelles machines ces blocs s'exécutent-ils ? | 7 |

Quatre diagrammes fréquents ont été écartés, et il faut dire pourquoi. Le diagramme d'états-transitions n'a pas été produit sous forme graphique : les machines à états du système sont décrites sous forme de tables de transitions, plus denses et plus vérifiables. Le diagramme de paquetages n'apporterait rien de plus que le diagramme de composants, l'organisation du code étant déjà lisible dans ce dernier. Le diagramme de séquence objets et le diagramme de communication ont été écartés pour la même raison. Ils montrent les mêmes objets et les mêmes échanges que les diagrammes de séquence système du chapitre 6. Seule la forme change. Les produire aurait ajouté des planches sans ajouter d'information.

<!-- Corrigé le 24 août 2026 : le tableau annonçait neuf diagrammes alors que le mémoire n'en livre que sept. Les lignes « Séquence objets » et « Communication » ont été retirées, et la ligne « Activité » ramenée au seul chapitre 5. Le paragraphe suivant justifie désormais les quatre exclusions. -->



## 4.4 Justification du choix de 2TUP

Trois caractéristiques du projet ont commandé ce choix. La première est la double nature des contraintes : le besoin métier — accueillir, trier, consulter, prescrire, orienter — est classique pour un centre de santé, alors que la contrainte technique — fonctionner sans connexion, sur deux sites, avec réconciliation automatique — l'est beaucoup moins. C'est exactement la configuration pour laquelle la séparation en deux branches a été conçue. La deuxième est la taille du projet et de l'équipe : deux étudiants, quelques dizaines de milliers de lignes. Le Processus Unifié complet aurait produit plus de documentation que de logiciel, tandis que 2TUP reste praticable à cette échelle. La troisième est le besoin de traçabilité : un système manipulant des données de santé doit pouvoir justifier chacune de ses règles, et l'orientation par les cas d'utilisation fournit le fil qui relie un besoin observé à une règle métier, puis à un écran, une route, une entité et un test.

**Tableau 4.3 — Comparaison de 2TUP avec Merise et Scrum**

| Critère | Merise | Scrum | 2TUP |
|---|---|---|---|
| Nature | Méthode d'analyse et de conception, orientée données | Cadre de gestion de projet agile | Processus de développement orienté objet |
| Approche dominante | Données puis traitements | Livraison incrémentale pilotée par la valeur | Cas d'utilisation et architecture |
| Modélisation objet | Non, modèle entité-association | Non prescrite | Oui, native, via UML |
| Traite l'architecture technique | Peu | Non prescrite | Oui, branche dédiée |
| Adapté à une équipe de deux | Oui | Difficilement, les rituels supposent une équipe | Oui |
| Documentation soutenable | Oui | Non par nature | Oui |
| Adéquation au projet | Moyenne | Faible | Forte |

Merise reste solide pour concevoir une base de données, et son modèle conceptuel a inspiré la démarche de modélisation des données de ce projet. Mais elle est structurellement orientée données et traitements, non objet, alors que l'application repose sur une modélisation objet de bout en bout : elle aurait obligé à traduire deux fois. Scrum, de son côté, est un cadre de gestion et non une méthode de conception : il organise le travail sans rien dire de la façon de modéliser, et il aurait fallu lui adjoindre UML de toute façon. Ses rituels supposent en outre une équipe de plusieurs personnes et un commanditaire disponible ; à deux étudiants, ils deviennent une formalité vide. Son caractère itératif a en revanche été retenu, le développement ayant bien procédé par incréments fonctionnels.

2TUP offre donc le meilleur compromis : la rigueur de modélisation du Processus Unifié, la séparation des préoccupations adaptée à un projet à forte contrainte technique, et une charge documentaire soutenable pour une équipe de deux.

Une limite doit cependant être notée. 2TUP structure la conception, il ne remplace pas l'accès au terrain : le volet fonctionnel de ce travail est resté dépendant de la disponibilité du recueil de l'existant et des entretiens conduits pendant le stage. Aucune méthode ne compense une source manquante ; elle rend simplement visible ce qui manque. De même, le caractère itératif du Processus Unifié suppose des retours d'utilisateurs entre les itérations, retours qui ont été limités faute d'accès continu au personnel du centre. Les itérations ont donc été guidées davantage par l'analyse que par l'usage observé.


## Conclusion du chapitre

Ce chapitre a posé le cadre méthodologique du travail. Le Processus Unifié fournit les principes : pilotage par les cas d'utilisation, centrage sur l'architecture, itération, gestion des risques. 2TUP en donne une déclinaison praticable, dont l'apport propre est la séparation d'une branche fonctionnelle et d'une branche technique qui ne convergent qu'à la conception. UML fournit le vocabulaire visuel, dont neuf types de diagrammes ont été retenus. Ce cadre gouverne l'ensemble de la Partie II.
