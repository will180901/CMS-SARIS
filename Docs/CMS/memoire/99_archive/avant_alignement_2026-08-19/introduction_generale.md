---
chapitre: 0
titre: "Introduction générale"
budget_pages: 4-5
statut: relu
sources: [INV-01 à INV-08, recueil de l'existant, code]
blocages: []
---

# INTRODUCTION GÉNÉRALE

## 1. Accroche

Dans un centre de santé, l'information circule aussi vite que le soin. Un antécédent oublié, une allergie non consignée, un dossier resté sur l'autre site : chacune de ces ruptures a un coût qui ne se mesure pas en heures perdues mais en risque clinique. Or, dans une grande partie de l'Afrique centrale, la question ne se pose pas seulement en termes d'outil, mais de **conditions d'usage** — un système informatique n'y vaut que s'il continue de fonctionner quand la connexion s'interrompt.

## 2. Contexte général

La transformation numérique des organisations congolaises progresse, portée par la disponibilité croissante des équipements et par une génération de professionnels formés à l'informatique. Le secteur de la santé y occupe une place particulière : il manipule les données les plus sensibles qui soient, exige une traçabilité stricte, et supporte mal l'indisponibilité.

Cette exigence se heurte à une réalité d'infrastructure. Les réseaux ne sont pas partout fiables, l'alimentation électrique connaît des interruptions, et les sites d'une même organisation ne sont pas toujours reliés. Concevoir pour ce contexte n'est pas concevoir un système ordinaire auquel on ajouterait des précautions : c'est **inverser l'hypothèse de départ** et considérer que le fonctionnement sans réseau est le cas normal.

C'est dans ce cadre que s'inscrit la formation en Génie Logiciel Applicatif du CFI-CIRAS, dont ce mémoire constitue le travail de fin de cycle.

## 3. Contexte particulier

SARIS-CONGO est une entreprise sucrière implantée au Congo-Brazzaville. Son **Service Médico-Social**, rattaché à la Direction des Ressources Humaines, se compose de deux entités : la Section des Affaires Sociales et le **Centre Médico-Sanitaire**. Ce dernier assure les soins de premier recours pour les travailleurs de la société, pour les personnes qui leur sont rattachées, et jusqu'aux habitants de son voisinage — sur **deux sites distants : Moutela et Nkayi**.

La population soignée n'est pas homogène : **neuf statuts** y sont reconnus, du personnel permanent aux visiteurs. Et **ces statuts n'ouvrent pas les mêmes droits**. Tous donnent accès à la consultation et aux premiers soins, mais seuls les employés en contrat à durée indéterminée et leurs ayants droit bénéficient de la prise en charge des médicaments et des examens ; pour les autres, les soins sont assurés puis refacturés à leur société ou à leur assurance.

Avant ce projet, la gestion reposait sur le papier et le tableur. Un **carnet de santé individuel**, transporté par le patient, constituait le seul support de circulation de l'information ; classeurs, registres et fichiers tableur, tous **locaux à chaque site**, complétaient le dispositif.

Trois constats issus des entretiens de terrain résument la situation. **Aucun système d'information ne reliait les deux sites** — la consolidation était assurée manuellement par le Médecin Chef. **La règle de prise en charge reposait sur un contrôle visuel** du badge, donc sur la vigilance de l'agent. Et **les deux outils informatiques en usage avaient échoué** : le fichier de gestion de stock, comme le logiciel de facturation qui l'avait suivi, perdaient leurs données à chaque fermeture.

Le paradoxe mérite d'être relevé : le centre disposait d'un **processus formalisé** — quatre étapes standardisées, une règle de confidentialité différenciée, une délégation de prescription encadrée. Ce qui manquait n'était pas la méthode, mais l'outil pour l'appliquer et en garder trace.

## 4. Justification du travail

Quatre raisons rendent ce travail nécessaire.

**La continuité du dossier patient.** Un même travailleur peut être reçu sur les deux sites. Sans dossier unique, il existe deux fois, avec deux historiques partiels, et aucun soignant ne dispose de l'information complète au moment où il en a besoin.

**La fiabilité de la règle d'éligibilité.** Déterminer qui ouvre droit à un bon de pharmacie ou d'examen relevait de la mémoire des agents. Une règle appliquée de mémoire est une règle appliquée inégalement.

**La traçabilité.** Dans un système manipulant des données de santé, savoir après coup qui a prescrit, qui a délivré et qui a consulté n'est pas un confort : c'est une obligation.

**La continuité de service.** Un outil qui s'arrête quand le réseau tombe n'est pas utilisable dans un centre de santé. On ne suspend pas une consultation en attendant le retour de la connexion.

## 5. Problématique

Ces constats conduisent à la question centrale de ce travail :

> **Comment concevoir et réaliser un système d'information médical adapté aux spécificités organisationnelles et techniques du Centre Médico-Sanitaire de SARIS-CONGO, garantissant l'unicité et la continuité du dossier patient entre deux sites distants, l'application fiable des règles de prise en charge par catégorie, et la traçabilité des actes — tout en restant pleinement opérationnel en l'absence de connexion réseau ?**

Cette formulation appelle deux remarques. D'une part, elle porte simultanément sur une exigence **métier** — unicité du dossier, fiabilité des règles, traçabilité — et sur une contrainte **technique** — le fonctionnement hors connexion. C'est précisément cette double nature qui a commandé le choix méthodologique exposé au chapitre 4. D'autre part, elle contient une tension : garantir la continuité du dossier entre deux sites suppose que l'information circule, alors que le fonctionnement hors connexion suppose qu'elle puisse ne pas circuler. La résolution de cette tension constitue le cœur technique du travail.

## 6. Objectifs

### Objectif général

**Concevoir et réaliser un système d'information médical pour le Centre Médico-Sanitaire de SARIS-CONGO**, couvrant le parcours de soin de l'accueil du patient à la production des documents cliniques, utilisable sur les sites de Moutela et Nkayi, en connexion comme hors connexion.

### Objectifs spécifiques

| Id | Objectif |
|---|---|
| **OS1** | Analyser et modéliser les processus métier du centre, notamment les règles de prise en charge par catégorie de patient et la délégation de prescription |
| **OS2** | Formaliser les besoins fonctionnels et non fonctionnels, avec leurs identifiants et leurs critères d'acceptation |
| **OS3** | Concevoir l'architecture du système selon la méthode 2TUP et le langage UML, en traitant séparément la branche fonctionnelle et la branche technique |
| **OS4** | Implémenter le système sur trois canaux — application web, client de bureau connecté, client de bureau autonome — à partir d'un socle de code commun |
| **OS5** | Concevoir et mettre en œuvre le mécanisme de synchronisation permettant la continuité entre les deux sites, y compris après une période hors connexion |
| **OS6** | Garantir la sécurité et la traçabilité : authentification forte, habilitations granulaires, chiffrement des données sensibles, journal d'audit |
| **OS7** | Documenter le système de manière vérifiable, en distinguant explicitement ce qui est livré, ce qui est partiel et ce qui reste à confirmer |

## 7. Démarche méthodologique

La démarche repose sur le **Processus Unifié**, dans sa déclinaison **2TUP**, outillée par **UML**.

Le choix de 2TUP tient à une caractéristique du projet : il subit deux familles de contraintes de nature différente. D'un côté les contraintes fonctionnelles — parcours de soin, règles d'éligibilité, documents à produire. De l'autre les contraintes techniques — fonctionnement hors connexion, cohérence entre deux sites, protection de données de santé. 2TUP traite ces deux familles dans **deux branches parallèles** qui ne convergent qu'à la conception, ce qui évite que les considérations techniques ne contaminent la compréhension du métier, et réciproquement.

Neuf types de diagrammes UML ont été retenus, chacun répondant à une question identifiée : contexte statique, cas d'utilisation, séquence système, activité, classes, séquence objets, communication, composants et déploiement.

**Techniques de recueil.** Le volet métier repose sur **quatre entretiens semi-directifs** conduits lors du stage effectué à la SARIS par **Nzila Verdi Oscarvie**, auprès du gestionnaire des ressources humaines et du service social, de la pharmacienne, du médecin chef et de l'infirmière. Ils ont produit un recueil de l'existant recensant **dix-huit besoins**. L'analyse de ces éléments, la sélection du périmètre, la conception et la réalisation relèvent du **travail commun des deux auteurs**.

**Une sélection de périmètre, exposée dès l'abord.** Les dix-huit besoins recueillis couvrent **trois métiers distincts** : le soin, la logistique pharmaceutique et l'administration du personnel. Aucun projet de fin de cycle ne pouvait les traiter ensemble sans devenir partout superficiel. Le travail retient donc le **parcours de soin** — triage, consultation, décision, documents — augmenté des fonctions transverses nécessaires à son exploitation. La gestion pharmaceutique et les processus administratifs sont explicitement écartés, chacun avec son motif. Ce cadrage est justifié au chapitre 3 § 3.5, et la confrontation besoin par besoin figure en conclusion.

**Une précision de chronologie, indispensable.** Le stage à la SARIS s'est déroulé **du 15 janvier au 14 avril 2026**. Le système a poursuivi son évolution après cette période : les chiffres présentés dans ce mémoire — 268 points d'accès, 88 entités, 128 permissions — décrivent son état au **10 août 2026**. Un lecteur qui rapprocherait ce mémoire du rapport de stage de Verdi, qui décrit l'état d'avril, y trouverait des valeurs différentes : c'est l'effet de quatre mois de développement, non une contradiction.

**Une précision de méthode, énoncée par honnêteté.** Les exigences de ce mémoire proviennent de **deux voies complémentaires**. Les besoins exprimés viennent du recueil ; ils disent ce que le centre demandait. Les exigences reconstituées viennent de l'analyse exhaustive du système — routes, entités, permissions, écrans, règles inventoriés puis remontés jusqu'à l'exigence qu'ils servent ; elles disent ce que le système réalise. Les deux ensembles ne se recouvrent pas exactement, et cet écart est documenté plutôt que gommé. Chaque affirmation porte son statut : observé, implémenté, partiellement implémenté, hors périmètre, non implémenté, ou à confirmer.

## 8. Structure du document

Ce mémoire est organisé en deux parties.

La **Partie I — Cadre contextuel et domaine d'étude** situe le travail. Le chapitre 1 présente le Centre Médico-Sanitaire en tant qu'organisation. Le chapitre 2 décrit sa situation informatique avant le projet. Le chapitre 3 expose le domaine d'étude : acteurs, fonctionnement sur deux sites, et surtout les catégories de patients dont découle la règle métier centrale du système.

La **Partie II — Analyse, conception et implémentation selon 2TUP/UML** développe la démarche technique. Le chapitre 4 présente et justifie la méthode. Le chapitre 5 formalise l'étude de l'existant. Le chapitre 6 établit les besoins, les acteurs et les cas d'utilisation. Le chapitre 7 opère la convergence des deux branches : architecture, modèle de classes, composants, déploiement. Le chapitre 8 rend compte de la réalisation, des tests et des difficultés rencontrées.

La conclusion générale rappelle la démarche, présente les résultats, identifie les apports, énonce les limites et propose des perspectives. Les annexes regroupent le guide d'entretien, le registre des besoins, les spécifications complètes des cas d'utilisation, le dictionnaire de données et les extraits de code commentés.
