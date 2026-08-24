<!-- Fichier régénéré depuis Memoire_CMS_SARIS.docx le 28 août 2026. -->
<!-- Miroir exact du document Word. Ne pas modifier ici : le Word fait foi sur le texte. -->

# CHAPITRE 2 — SITUATION INFORMATIQUE EXISTANTE

> 0 figure(s) · 6 tableau(x) dans cette partie.

Dans ce chapitre, nous décrivons l'état du système informatique du Service Médico-Social avant le projet, pour préparer la critique qui justifiera la solution retenue. Nous nous appuyons sur deux sources : le recueil de l'existant, qui documente les outils en usage au centre, et le rapport de stage, qui a permis d'inventorier l'organisation informatique, le parc matériel et les applications en production.

## 2.1 Organisation informatique

Le Service Informatique de SARIS-CONGO est rattaché à la Direction Administrative et Financière. Il assure la gestion de l'infrastructure, la maintenance, le support aux utilisateurs et le développement interne. Il s'inscrit dans une organisation de groupe qui dépasse le cadre de l'entreprise.

**Tableau 2.1 — La structure informatique à trois niveaux**

| Niveau | Entité | Rôle |
|---|---|---|
| Entreprise | Service Informatique de SARIS-CONGO | Infrastructure, maintenance, support, développement interne |
| Groupe | SOMINFOR, basée à Paris | Architecture, applications de gestion du groupe, cybersécurité |
| Groupe | AFRIK IT, membre de SOMINFOR | Interventions préventives et curatives sur le terrain |

Ce service compte sept personnes, réparties en deux sections. La section saisie enregistre les données administratives et opérationnelles : rapports de main-d'œuvre, données du parc, pointages, centralisation dans le progiciel de gestion. La section réseau et système administre les serveurs, gère l'infrastructure et assure la maintenance.

**Tableau 2.2 — Effectif du Service Informatique**

| Poste | Section | Nombre |
|---|---|---|
| Chef du Service Informatique | Direction | 1 |
| Technicien réseau et système | Réseau et système | 2 |
| Technicien de saisie | Saisie | 3 |
| Administrateur système détaché du groupe | Réseau et système | 1 |
| Total |  | 7 |

Un constat structurant se dégage de cette organisation. Le service informatique dépend de la Direction Administrative et Financière, tandis que le Service Médico-Social dépend de la Direction des Ressources Humaines. Ce sont deux directions distinctes. Cette séparation éclaire un fait relevé lors des entretiens. Aucun des quatre acteurs interrogés au centre médical n'adresse de besoin à un service informatique, et aucun problème constaté ne lui est attribué. Le fichier tableur de la pharmacie, qui perd ses données à chaque fermeture, est resté en usage pendant des années sans correctif.

Le centre disposait donc d'un service informatique compétent à l'échelle de l'entreprise, mais d'aucun appui dédié à ses besoins métier.

## 2.2 Infrastructure réseau

Le centre opère sur deux sites distants, Moutela et Nkayi, entre lesquels le personnel tourne selon un planning de permutation. Comme l'établit le chapitre 1, aucun système d'information ne reliait ces deux sites : chacun fonctionnait de façon autonome avec ses propres fichiers. Nous n'avons pas pu caractériser techniquement le réseau : ni la topologie, ni les équipements actifs, ni la liaison entre les sites, ni le taux d'indisponibilité. Les entretiens ont porté sur les processus métier plutôt que sur l'infrastructure.

Nous versons cependant au dossier une observation indirecte. L'architecture retenue pour le système est entièrement conçue pour fonctionner sans réseau : réplication complète des données sur chaque poste, serveur applicatif embarqué, résolution automatique des conflits. On ne consent pas le surcoût d'un tel dispositif pour un environnement où la connexion serait fiable. Cette observation établit qu'un problème de connectivité existait, sans en établir ni l'ampleur ni la fréquence.

## 2.3 Parc informatique matériel

Le parc recensé couvre l'ensemble des implantations de SARIS-CONGO, et non le seul centre médical. Pendant la période du stage, le site de Moutela faisait d'ailleurs l'objet de travaux d'extension de sa couverture réseau : le réseau existait, mais sa couverture n'était pas complète.

**Tableau 2.3 — Parc matériel informatique, par type**

| Type de matériel | Caractéristiques | Usage principal |
|---|---|---|
| Serveurs physiques | Windows Server, progiciel de gestion sur système IBM | Applications de gestion, base de données centrale |
| Postes de travail | Windows 10 et Windows 11 | Bureautique, saisie, applications métier |
| Commutateurs et routeurs | Équipements Cisco | Infrastructure réseau filaire |
| Points d'accès sans fil | Wi-Fi 5 et Wi-Fi 6 | Couverture des bureaux et du centre médical |
| Onduleurs | Modèles de marque et équivalents | Protection contre les coupures de courant |
| Imprimantes réseau | Laser monochrome et couleur | Documents administratifs et médicaux |

Trois observations conditionnent le déploiement du système. Les postes fonctionnent sous Windows 10 et 11. Le client de bureau est donc compatible avec le parc existant, sans renouvellement matériel. Une couverture sans fil existe, y compris au centre médical, ce qui rend l'usage sur tablette envisageable. Des onduleurs protègent enfin les postes. Cela compte pour un système reposant sur une base de données locale : une coupure brutale pendant une écriture peut corrompre un fichier.

Une réserve subsiste. Nous n'avons pas inventorié les quantités par type, leur répartition et leur état. Il faudra donc vérifier, avant tout déploiement, que les postes destinés au mode autonome disposent de l'espace disque et de la mémoire nécessaires.

## 2.4 Applications et logiciels en usage

SARIS-CONGO exploite un parc applicatif structuré, administré au niveau du groupe pour l'essentiel.

**Tableau 2.4 — Applications en production, par fonction d'entreprise**

| Application | Fonction couverte |
|---|---|
| Progiciel de gestion intégré sur système IBM | Gestion financière, comptabilité, paie, stocks |
| Messagerie du groupe | Communication interne |
| Protection des postes | Postes de travail et serveurs |
| Suite bureautique | Rédaction, tableaux de bord, rapports |
| Gestion du centre médical | Aucune application, support papier |

Le rapport de stage en tire une conclusion sans ambiguïté : la gestion du Centre Médico-Sanitaire ne dispose d'aucune application informatique dédiée. Le contraste est frappant. L'entreprise dispose d'un progiciel couvrant la finance, la comptabilité, la paie et les stocks, d'une messagerie de groupe, et d'une protection des postes administrée de façon centralisée. Le centre médical, lui, fonctionne au papier. Ce n'est pas un défaut de maturité informatique de l'entreprise. C'est un domaine resté hors du champ de l'informatisation, pour la raison organisationnelle exposée plus haut.

**Tableau 2.5 — Outils en usage au centre médical avant le projet**

| Fonction | Outil en usage | Détail |
|---|---|---|
| Suivi médical | Aucun logiciel | Carnet de santé papier, classeur, registre |
| Statistiques médicales | Tableur, local à chaque site | Comptages effectués a posteriori, à la main |
| Gestion de stock pharmaceutique | Fichier tableur « Mouvement de stock » | En usage depuis des années, codification par couleurs développée en pratique |
| Facturation pharmaceutique | Tableur, après abandon d'un logiciel dédié | Logiciel abandonné pour perte de données |
| Ressources humaines et service social | Papier et transmission verbale | Feuilles de repos, ordonnances, reçus, certificats |
| Gestion des accès | Aucune | Un poste, un fichier partagé, sans authentification |

Le cas du fichier « Mouvement de stock » mérite d'être détaillé, car il documente un défaut d'une gravité particulière. Le recueil en donne la description suivante : « le fichier Excel ne conserve pas les données d'une session à l'autre. Quand la pharmacienne ferme le fichier et le rouvre, les données de la session précédente peuvent disparaître. Un logiciel Excel de facturation avait également été mis en place mais a été abandonné pour la même raison. »

Il ne s'agit donc pas d'un outil imparfait, mais d'un outil qui ne remplit pas sa fonction première : un système de gestion de stock qui perd ses données est un système sans mémoire. Et la même cause a fait échouer une seconde tentative d'outillage. Non seulement les outils manquaient, mais ceux qui existaient avaient déjà échoué.

Une question technique reste par ailleurs ouverte. Le service des ressources humaines traite les dossiers en paie, ce qui suppose un système détenant le registre des employés et leurs matricules. Aucune interface avec le centre médical n'est cependant documentée. Notre système implémente en conséquence son propre registre. La question de son interopérabilité avec la paie — ou, à défaut, de la double saisie qui en résulte — devra être tranchée avant une mise en service réelle.

## 2.5 Gestion des données médicales

Quatre supports se partageaient la gestion de l'information médicale, avec des portées très différentes. Le carnet de santé individuel, transporté par le patient, assurait la circulation de l'information entre les étapes du parcours. Le classeur papier servait à retrouver un patient déjà connu. Le registre servait à enregistrer les passages. Et un fichier tableur produisait les comptages. Ces trois derniers supports étaient locaux à chaque site. L'information ne circulait donc pas dans un système : elle circulait physiquement. Le carnet passait de l'infirmière au médecin, revenait au triage, puis repartait avec le patient.

Trois conséquences en découlent. Entre les étapes d'une même visite, l'information se transmettait correctement, car le carnet la portait. Entre deux visites, elle dépendait entièrement de la conservation de ce carnet par le patient. Entre les deux sites enfin, elle ne circulait pas du tout : la consolidation était assurée à la main par le Médecin Chef, a posteriori, et jamais au moment du soin.

Les échanges entre le centre et le service des ressources humaines transitaient exclusivement par deux canaux. Le papier d'abord : feuilles de repos, ordonnances, reçus, certificats d'évacuation, bons de caisse. L'oral ensuite. Le recueil en tire une conclusion nette : « l'absence de format numérique structuré constitue un facteur de risque important : les informations verbales ne laissent aucune trace, et les documents papier sont exposés aux pertes, erreurs de saisie et difficultés d'archivage et de recherche ».

Il apporte une nuance essentielle sur la fiabilité. Celle-ci « repose essentiellement sur la confiance dans le personnel médical et sur les contrôles ponctuels réalisés. Elle n'est pas garantie par un système de validation numérique ou de traçabilité automatisée ». Autrement dit, la fiabilité constatée était le produit du sérieux des personnes, non d'un dispositif technique. Les procédures d'archivage et l'existence de sauvegardes n'ont pas été documentées.

## 2.6 Domaine du projet

Le domaine couvert par ce travail est le domaine médical du Service Médico-Social, et plus précisément le parcours de soin. Le recueil montre que ce service comprend trois domaines fonctionnels distincts, dont un seul entre dans le périmètre retenu.

**Tableau 2.6 — Les trois domaines fonctionnels du Service Médico-Social**

| Domaine | Porté par | Dans le périmètre |
|---|---|---|
| Soins : consultation, triage, décision, documents | Centre Médico-Sanitaire | Oui |
| Logistique pharmaceutique : stock, dispensation, facturation | Pharmacie du centre | Non |
| Administration du personnel : évacuations, remboursements, accidents | Section des Affaires Sociales | Non |

Cette délimitation est une décision de cadrage, que nous justifions au chapitre 3. Quant à l'existence d'un schéma directeur informatique couvrant le domaine médical, elle n'a pas pu être établie. Trois indices suggèrent qu'il n'en existait pas : l'absence de tout système d'information médical, l'échec non corrigé de deux outils tableur, et l'absence d'appui informatique dédié.

## 2.7 Premiers constats

Trois constats se dégagent de cet état des lieux. Le centre ne disposait d'aucun système d'information médical, alors que l'entreprise exploitait un parc applicatif structuré. Les deux seuls outils informatiques mis en place au centre avaient échoué pour la même raison : la perte des données d'une session à l'autre. Et les échanges avec le service administratif transitaient exclusivement par le papier et par l'oral, sans trace ni possibilité de suivi. La critique formelle et structurée de cet existant, dimension par dimension, est conduite au chapitre 5, conformément à la démarche 2TUP.

## Conclusion du chapitre

Le Service Médico-Social fonctionnait sans aucun système d'information médical. Le carnet de santé papier constituait le support de circulation, complété de registres et de fichiers tableur locaux à chaque site. Aucun lien informatique ne reliait Moutela et Nkayi. Les deux seuls outils informatiques en usage au centre avaient échoué pour la même raison : la perte des données d'une session à l'autre. Les flux avec le service administratif transitaient exclusivement par le papier et par l'oral, sans trace ni possibilité de suivi.

Dans le chapitre suivant, nous présentons le domaine d'étude : les acteurs, les catégories de patients, la règle de prise en charge qui en découle, et le périmètre retenu.
