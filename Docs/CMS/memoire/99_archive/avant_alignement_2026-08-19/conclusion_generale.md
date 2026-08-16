---
chapitre: 99
titre: "Conclusion générale"
budget_pages: 3-4
statut: relu
sources: [INV-01 à INV-07]
blocages: [QO-10]
---

# CONCLUSION GÉNÉRALE

## 1. Rappel des objectifs et de la démarche

Ce travail est parti d'une question : comment concevoir un système d'information médical qui garantisse l'unicité du dossier patient entre deux sites distants, applique fiablement des règles de prise en charge différenciées, assure la traçabilité des actes — et continue de fonctionner lorsque le réseau s'interrompt.

Cette question contient une tension. Assurer la continuité entre deux sites suppose que l'information circule ; fonctionner hors connexion suppose qu'elle puisse ne pas circuler. C'est cette tension qui a orienté toute la démarche.

La méthode retenue, **2TUP**, a été choisie pour cette raison précise : elle traite séparément une branche fonctionnelle — le parcours de soin, les règles d'éligibilité, la délégation de prescription — et une branche technique — la persistance sur deux moteurs, la réconciliation des données, la protection des informations sensibles. Les deux branches n'ont convergé qu'à la conception. Sans cette séparation, l'un des deux volets aurait été sacrifié à l'autre.

La Partie I a situé le domaine. La Partie II a déroulé la démarche : méthode au chapitre 4, existant au chapitre 5, analyse au chapitre 6, conception au chapitre 7, réalisation au chapitre 8.

## 2. Résultats obtenus

### 2.1 Un système complet et mesurable

Le travail a produit une plateforme dont l'ampleur se mesure objectivement :

| Grandeur | Valeur |
|---|---|
| Lignes de code | ≈ 93 500, sur 547 fichiers |
| Routes de l'interface de programmation | 268, sur 26 contrôleurs et 17 modules |
| Entités de données | 88, reliées par 97 associations |
| Permissions | 128, réparties sur 3 rôles |
| Écrans | 15, plus 25 onglets |
| Migrations de base | 41 |
| Entités synchronisées hors connexion | 52 sur 88 |
| Documents imprimables | 6 |
| Langues | 2 |

Les **23 besoins fonctionnels** identifiés sont réalisés, dont 22 pleinement et un partiellement.

### 2.2 Trois réponses à la problématique

**L'unicité du dossier entre les deux sites** est obtenue par une décision d'architecture assumée : le dossier patient et l'ensemble du parcours de soin sont répliqués **intégralement sur chaque poste**, et non cloisonnés par site. Un travailleur reçu à Moutela puis à Nkayi est retrouvé sur n'importe quel poste, sans doublon, y compris hors connexion. La confidentialité est préservée par un verrou applicatif posé par le médecin chef, appliqué jusque dans le serveur embarqué du poste autonome.

**La fiabilité de la règle d'éligibilité** est obtenue en la sortant de la mémoire des agents pour la placer dans une table de la base, interrogée à chaque demande de bon. Elle devient ainsi appliquée uniformément, tracée, et modifiable sans redéploiement — ce qui correspond à sa nature de politique d'entreprise.

**La continuité de service** est obtenue par deux mécanismes distincts : une file de mutations rejouées côté web, et une base locale avec synchronisation par deltas côté poste autonome. Le premier réutilise intégralement les règles du serveur en rejouant de vraies requêtes ; le second permet à un poste de fonctionner comme un serveur à part entière.

### 2.3 Une couverture du besoin mesurée, non affirmée

Les dix-huit besoins recueillis auprès des quatre acteurs ont été confrontés un à un à ce que le système réalise.

| Verdict | Nombre | Part |
|---|---:|---:|
| Couverts | 6 | 33 % |
| Partiellement couverts | 4 | 22 % |
| **Hors du périmètre retenu, avec motif** | **8** | 44 % |
| **Non couverts dans le périmètre** | **0** | 0 % |

**Dans le périmètre retenu, aucun besoin n'est laissé sans réponse.** Les huit besoins écartés relèvent de deux métiers explicitement exclus — la logistique pharmaceutique et l'administration du personnel — et deux d'entre eux, le rythme de réapprovisionnement et la reprise des inventaires, ne relèvent même pas de l'informatique : le recueil le reconnaît lui-même.

### 2.4 Une documentation vérifiable

Le travail a produit une documentation dont chaque affirmation est rattachée à une preuve, au moyen de **huit inventaires** extraits automatiquement puis relus — sept du code, un du recueil.

Cette démarche a permis de corriger plusieurs écarts entre les documents du projet et sa réalité — notamment le nombre de permissions, le nombre de routes, et surtout le nombre de décisions médicales, ramené de quatre à deux.

Elle a aussi produit une validation inattendue : la documentation du système ayant été rédigée **à partir du code seul**, avant lecture du recueil, la concordance ultérieure des deux sources sur **sept points précis** — règle de prise en charge, délégation encadrée, évacuation réservée au médecin, limitation de l'infirmier au résumé en cours, neuf variables de mode de vie, neuf paramètres d'examen, anamnèse en quatre questions — atteste que le système est fidèle au terrain observé.

## 3. Apports du travail

**Pour le Centre Médico-Sanitaire.** Un système couvrant l'ensemble du parcours de soin, conçu pour ses contraintes propres — deux sites, connectivité variable, règles de prise en charge différenciées. Ce que le centre gagne n'est pas seulement un outil : c'est la suppression des ressaisies, la consolidation des historiques, et l'application uniforme d'une règle qui reposait auparavant sur la vigilance humaine.

**Pour la formation des auteurs.** Le projet a exigé la mise en œuvre complète d'une chaîne d'ingénierie : modélisation objet, architecture en couches, sécurité applicative, persistance sur deux moteurs, synchronisation distribuée, empaquetage et distribution d'un logiciel de bureau. La difficulté dominante n'a pas été algorithmique mais **architecturale** — faire coexister deux modes d'exécution d'un même code.

**Pour le domaine, plus modestement.** Le travail documente une réponse argumentée à un problème récurrent : concevoir pour un environnement où la connectivité n'est pas acquise. Les choix effectués — réplication complète plutôt que partielle, arbitrage par dernière écriture avec journalisation plutôt que verrouillage, rejeu de requêtes plutôt que duplication du moteur de règles — sont transposables. C'est leur **justification** qui constitue l'apport, plus que le code lui-même.

## 4. Limites

Elles sont énoncées ici plutôt que découvertes ailleurs.

**La validation est partielle.** Sur les 145 cas de test écrits, **102 ont été exécutés et vérifiés** le 10 août 2026 : 101 réussis, un échoué. Les 43 autres exigent une interface de programmation démarrée et une base chargée, indisponibles.

L'unique échec est instructif. Il ne révèle pas un défaut du code mais **une dérive du test lui-même** : le garde-fou qui vérifie l'alignement des plages physiologiques entre le client et le serveur était resté figé sur huit constantes vitales alors que le système en compte neuf. Client et serveur sont alignés ; c'est le contrôle qui avait cessé de tout contrôler.

Et il n'avait cessé de le faire que parce que **51 cas — soit 35 % — ne sont rattachés à aucune commande**. Ils ne s'exécutent que si on les invoque à la main. Personne ne les avait lancés depuis l'ajout de la neuvième constante. Ce que nous supposions être un risque théorique s'est révélé, à la première exécution, être un fait.

**Le cœur clinique n'est pas testé automatiquement.** Triage, consultation, prescription, bons, évacuation : aucun test dédié. La règle d'éligibilité par catégorie, la plus structurante du système, n'est couverte par aucun test. Aucune mesure de couverture n'existe.

**Le mode autonome n'est pas éprouvé.** Son pipeline de production est vérifié statiquement — chemins, fichiers et options cohérents de bout en bout — mais n'a pas été validé par une exécution complète sur machine cible. De même, la synchronisation n'a pas été éprouvée entre deux postes réels.

**La signature de code n'est pas active.** Elle est documentée comme indispensable pour un logiciel manipulant des données de santé, et sa configuration est préparée, mais elle n'est pas en place.

**Cinq machines à états ne sont pas garanties par la base.** Ordonnance, bon de pharmacie, bon d'examen, évacuation, suivi de traitement reposent sur de simples champs texte : une écriture directe en base pourrait y poser une valeur invalide.

**Trois besoins du périmètre ne sont que partiellement satisfaits.** Le Médecin Chef attend **dix axes** d'analyse des consultations ; le système en couvre six. Les quatre manquants exigent les notions de direction, de département et de catégorie socio-professionnelle, absentes du modèle de statistiques — alors même que ces données **existent déjà** dans le registre des employés. Le certificat de repos est produit mais **non transmis** au service administratif : le point de rupture papier subsiste. Enfin, le parcours allégé des consultations spécialisées n'est pas distingué.

**Le volet contextuel reste incomplet.** L'infrastructure réseau, l'inventaire du parc informatique et les chiffres d'activité du centre n'ont pas été relevés lors des entretiens. Environ sept pages en dépendent, ainsi qu'une figure. Les sections concernées sont explicitement marquées plutôt que comblées.

> ⛔ **Un point à confirmer avant soutenance (QO-10).** Aucune preuve n'a été trouvée d'un usage clinique effectif par le personnel du centre. L'environnement d'hébergement est actif et des incidents d'exploitation datés y sont documentés, ce qui atteste d'un système **en ligne** — non d'un système **en service**. Tant que ce point n'est pas établi, ce mémoire doit dire « conçu et développé », jamais « déployé et utilisé ». La distinction n'est pas rhétorique : elle change la nature du résultat.

## 5. Perspectives

Elles sont classées par rapport entre la valeur apportée et l'effort requis.

**Les deux corrections les plus rentables, réalisables avant la soutenance.**

*Ajouter les axes « direction » et « catégorie socio-professionnelle » aux statistiques.* Ce sont quatre des dix axes attendus par le Médecin Chef, tous de priorité haute. Les données **existent déjà** dans le registre des employés — champs fonction, service, département. Il s'agit d'ajouter des jointures et des axes d'agrégation, non de modifier le modèle. C'est la perspective au meilleur rapport valeur / effort du projet.

*Corriger puis rattacher les deux suites de test orphelines.* Une entrée à ajouter, un compteur à porter de huit à neuf, et deux lignes de configuration : **51 cas de test récupérés** et un garde-fou remis en fonction.

**À court terme.** Exécuter les cinq suites d'intégration restantes avec une base chargée. Valider le mode autonome par un build et un lancement effectifs. Alléger le triage pour les consultations spécialisées, conformément au processus réel. Relever l'infrastructure réseau du centre, ce qu'un entretien de vingt minutes suffirait à obtenir.

**À moyen terme.** Étendre la couverture de test au cœur clinique, en priorité à la règle de prise en charge. Valider la synchronisation entre deux postes réels. Mettre en place une intégration continue. Activer la signature de code. Migrer les cinq machines à états vers des types contraints par la base. Transmettre le certificat de repos au service administratif, pour supprimer le dernier point de rupture papier du périmètre.

**Les extensions de périmètre.** Trois besoins de priorité haute restent hors du système, et chacun constitue un projet en soi. Le **suivi des coûts d'évacuation** exigerait d'introduire des données financières. Le **tableau de bord de l'absentéisme** relève de la gestion du personnel. La **gestion pharmaceutique** — stock, péremption, reçus, facturation — est un métier distinct, dont le recueil montre qu'il souffre d'un outil qui ne conserve pas ses données. Ce dernier point mérite une attention particulière : c'est le besoin le plus criant du recueil, et le plus éloigné du périmètre retenu.

**À plus long terme.** Mesurer les performances et fixer des seuils, aucune exigence chiffrée n'existant aujourd'hui. Étendre le système à d'autres centres, ce que l'architecture permet sans refonte. Étudier l'interopérabilité avec le système de paie, pour supprimer la double tenue du registre des employés.

**Une perspective de méthode.** L'arbitrage par dernière écriture est simple et robuste, mais il ne fusionne pas : deux modifications concurrentes du même dossier ne se combinent pas, la plus récente l'emporte. Des approches de fusion par champ existent. Elles auraient un coût de complexité considérable pour un gain qui reste à démontrer sur ce cas d'usage, où les écritures concurrentes sur un même dossier sont rares. Le sujet mérite d'être posé, non tranché ici.

## 6. Mot de fin

Ce travail nous laisse un enseignement que nous n'attendions pas. Les difficultés sérieuses que nous avons rencontrées n'étaient pas des problèmes d'algorithme. C'étaient des écarts entre un système qui fonctionne en développement et un système qui tient en exploitation : deux autorités d'authentification là où nous n'en voyions qu'une, un indicateur de disponibilité détourné de son usage par l'hébergeur, un catalogue de droits en base resté en retard sur le code, un canal temps réel coupé par un intermédiaire réseau invisible.

Aucune de ces difficultés n'était prévisible depuis un schéma. Toutes se sont révélées à l'usage, et chacune a exigé de comprendre non pas notre code, mais l'environnement dans lequel il s'exécutait. Nous en retenons que la conception ne s'arrête pas au diagramme, et que la rigueur d'un système se juge à ce qu'il fait quand les conditions cessent d'être idéales.

Nous en retenons aussi qu'une documentation n'a de valeur que si elle dit ce qui n'a pas été fait. C'est pourquoi les limites énoncées plus haut y figurent avec la même précision que les résultats.
