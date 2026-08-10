---
chapitre: 2
titre: "Situation informatique existante"
budget_pages: 6-8
statut: partiel
sources: [INV-08, recueil de l'existant]
figures: [ORG-02]
blocages: [QO-03]
---

# CHAPITRE 2 — SITUATION INFORMATIQUE EXISTANTE

## Introduction du chapitre

Ce chapitre décrit l'état du système informatique du Service Médico-Social **avant** le projet. Il prépare la critique qui justifiera la solution retenue et permet de mesurer le point de départ.

Il s'appuie sur le **recueil de l'existant**, source primaire issue de quatre entretiens. Ce recueil documente précisément les **outils en usage** et les **flux d'information** ; il ne comporte en revanche ni inventaire du parc matériel ni description de la topologie réseau. Les sections correspondantes restent en attente (**QO-03**).

---

## 2.1 Organisation informatique

### 2.1.1 Une structure à trois niveaux

Le **Service Informatique** de SARIS Congo est rattaché à la **Direction Administrative et Financière**. Il assure la gestion quotidienne de l'infrastructure, la maintenance des équipements, le support aux utilisateurs et le développement applicatif interne.

Il s'inscrit dans une structure de groupe :

| Niveau | Entité | Rôle |
|---|---|---|
| **Entreprise** | Service Informatique SARIS Congo | Infrastructure, maintenance, support, développement interne |
| **Groupe** | SOMINFOR — Société d'Organisation Méthode et Informatique, basée à Paris | Architecture, développement des applications de gestion du groupe, cybersécurité |
| **Groupe** | AFRIK IT, membre de SOMINFOR | Informaticiens africains assurant les interventions préventives et curatives sur le terrain |

### 2.1.2 Personnel informatique par métier

**Tableau 2.A — Effectif du Service Informatique**

| Poste | Section | Nombre |
|---|---|---:|
| Chef du Service Informatique | Direction | 1 |
| Technicien réseau et système | Réseau et système | 2 |
| Technicien de saisie | Saisie | 3 |
| Administrateur système, appui du groupe | Réseau et système | 1 *(détaché)* |
| **Total** | | **7** |

Le service est organisé en **deux sections**. La **section saisie** recueille et enregistre les données administratives et opérationnelles : rapports de main-d'œuvre, données du parc matériel, pointages du personnel, centralisation dans le progiciel de gestion. La **section réseau et système** administre les serveurs et systèmes d'exploitation, gère l'infrastructure réseau — câblage, équipements actifs, sécurité — et assure la maintenance.

### 2.1.3 Un constat structurant

Le service informatique dépend de la **Direction Administrative et Financière**, tandis que le Service Médico-Social dépend de la **Direction des Ressources Humaines**. Ce sont **deux directions distinctes**.

Cette séparation organisationnelle éclaire un fait relevé dans les entretiens : aucun des quatre acteurs interrogés au centre médical n'adresse de besoin à un service informatique, et aucun des problèmes constatés ne lui est attribué. Le fichier tableur de la pharmacie, qui perd ses données à chaque fermeture, est resté en usage **pendant des années** sans qu'un correctif soit apporté.

Le centre disposait donc, à l'échelle de l'entreprise, d'un service informatique compétent — mais **pas d'un appui dédié à ses propres besoins métier**.

---

## 2.2 Infrastructure réseau

⛔ **PARTIELLEMENT EN ATTENTE — QO-03**

> **Figure 2.1 — Schéma de l'infrastructure réseau** — ne peut pas être tracée en l'état.

**Ce qui est établi par le recueil :**

Le centre opère **deux sites géographiquement distincts**, Moutela et Nkayi. Le personnel médical **tourne entre les deux** selon un planning de permutation.

Et le recueil énonce la situation informatique en une phrase sans ambiguïté :

> *« Aucun système d'information centralisé n'existe actuellement entre les deux sites. Chaque site fonctionne de façon autonome avec ses propres fichiers et ses propres données. »*

**Ce qui reste à documenter** : topologie par site, équipements actifs, couverture sans fil, existence et caractéristiques d'une liaison entre les deux sites, fournisseur et débit d'accès à Internet, **taux d'indisponibilité constaté**, alimentation électrique.

> **Une preuve indirecte forte, mais qui ne suffit pas.** L'architecture réalisée est **entièrement conçue** pour fonctionner sans réseau : réplication complète sur chaque poste, serveur embarqué, résolution de conflit. On ne construit pas un tel dispositif pour un environnement où la connexion serait fiable.
>
> Cette preuve établit qu'un problème de connectivité existait. Elle n'établit **ni son ampleur ni sa fréquence**. C'est ce chiffre manquant — le taux d'indisponibilité réel — qui donnerait au chapitre 7 sa justification factuelle.

---

## 2.3 Parc informatique matériel

Le parc couvre l'ensemble des sites de l'entreprise : Moutéla, Nkayi, Brazzaville et Pointe-Noire.

**Tableau 2.1 — Parc matériel informatique de SARIS Congo, par type**

| Type de matériel | Caractéristiques | Usage principal |
|---|---|---|
| **Serveurs physiques** | Windows Server, progiciel de gestion sur système IBM | Applications de gestion, base de données centrale |
| **Postes de travail** | **Windows 10 et Windows 11** | Bureautique, saisie, applications métier |
| **Commutateurs et routeurs** | Équipements Cisco | Infrastructure réseau filaire |
| **Points d'accès sans fil** | Wi-Fi 5 et Wi-Fi 6 | Couverture des bureaux et du centre médical |
| **Onduleurs** | Modèles de marque et équivalents | Protection contre les coupures de courant |
| **Imprimantes réseau** | Laser monochrome et couleur | Documents administratifs et médicaux |

### 2.3.1 Ce que ce parc autorise

Trois observations conditionnent directement le déploiement du système.

**Les postes fonctionnent sous Windows 10 et 11.** Le client de bureau, conçu pour Windows, est donc compatible avec le parc existant. Aucun renouvellement matériel n'est requis pour l'installer.

**Une couverture sans fil existe, y compris au centre médical.** Le rapport de stage mentionne explicitement la configuration de points d'accès dans les bureaux et au centre. L'usage sur tablette est donc envisageable.

**Des onduleurs protègent les postes.** C'est une donnée importante pour un système à base de données locale : une coupure brutale pendant une écriture peut corrompre un fichier de base. La présence d'onduleurs réduit ce risque.

### 2.3.2 Une infrastructure en cours d'extension

Le rapport de stage documente, pendant la période du stage, une **extension de la couverture réseau sur le site de Moutéla** : élaboration de devis pour prises, câbles et goulottes ; déploiement de nouvelles prises réseau ; configuration de points d'accès sans fil ; câblage structuré associé.

Le réseau existait donc, mais **sa couverture n'était pas complète** et faisait l'objet de travaux au moment de l'étude.

⛔ **Reste à documenter — QO-03** : les **quantités** par type de matériel, leur répartition par site, leur âge et leur état.

> **Point de vigilance pour le déploiement.** Le mode autonome installe une base de données locale sur chaque poste. Il faudra vérifier que les postes disposent de l'espace disque et de la mémoire nécessaires — vérification impossible sans un inventaire quantifié.

---

## 2.4 Applications et logiciels en usage

### 2.4.1 Les applications de l'entreprise

**Tableau 2.B — Applications en production, par fonction d'entreprise**

| Application | Éditeur et type | Fonction couverte |
|---|---|---|
| Progiciel de gestion intégré sur système IBM | IBM | Gestion financière, comptabilité, **paie**, stocks |
| Messagerie du groupe | Éditeur tiers, déployée par le groupe | Communication interne |
| Protection des postes | Éditeur de sécurité | Postes de travail et serveurs |
| Suite bureautique | Microsoft | Rédaction, tableaux de bord, rapports |
| **Gestion du centre médical** | **aucune — support papier** | **Consultations et dossiers médicaux** |

Le rapport de stage tire de ce tableau une conclusion sans ambiguïté :

> *« On observe que la gestion du Centre Médico-Sanitaire ne dispose d'aucune application informatique dédiée. »*

Ce n'est pas une déduction : c'est un constat d'inventaire, établi par la personne qui a recensé le parc applicatif de l'entreprise.

### 2.4.2 Les outils en usage au centre médical

| Fonction | Outil en usage avant le projet | Détail |
|---|---|---|
| **Suivi médical** | **Aucun logiciel** | Carnet de santé individuel papier, classeur papier, registre papier |
| **Statistiques médicales** | Fichier tableur, local à chaque site | Comptages effectués a posteriori, à la main |
| **Gestion de stock pharmaceutique** | **Fichier tableur « Mouvement de stock »** | Utilisé « depuis de nombreuses années ». Système de codification par couleurs développé en pratique |
| **Facturation pharmaceutique** | Tableur, puis abandon d'un logiciel dédié | Un logiciel de facturation avait été mis en place, **abandonné pour perte de données** |
| **Gestion RH et service social** | **Papier et transmission verbale** | Feuilles de repos, ordonnances, reçus, certificats d'évacuation, bons de caisse |
| **Gestion des accès** | **Aucune** | Un poste, un fichier partagé, sans authentification |

> **Le contraste est le point à retenir de ce chapitre.** L'entreprise dispose d'un progiciel de gestion intégré couvrant la finance, la comptabilité, la paie et les stocks, d'une messagerie de groupe et d'une protection des postes administrée de façon centralisée. **Le centre médical, lui, fonctionne au papier.**
>
> Ce n'est pas un défaut de maturité informatique de l'entreprise : c'est un **domaine resté hors du champ** de l'informatisation, pour une raison organisationnelle — le service informatique relève de la direction financière, le centre médical de la direction des ressources humaines.

### 2.4.1 Le cas du fichier « Mouvement de stock » — un outil qui ne conserve rien

Le recueil documente un défaut d'une gravité particulière :

> *« Le fichier Excel ne conserve pas les données d'une session à l'autre. Quand la pharmacienne ferme le fichier et le rouvre, les données de la session précédente peuvent disparaître. Il est donc impossible de consulter le travail réalisé la veille ou d'avoir un historique fiable sur plusieurs semaines ou mois. Un logiciel Excel de facturation avait également été mis en place mais a été abandonné pour la même raison. »*

**Il ne s'agit pas d'un outil imparfait mais d'un outil qui ne remplit pas sa fonction première.** Un système de gestion de stock qui perd ses données est un système sans mémoire. Et la même cause a fait échouer une seconde tentative d'outillage.

Ce constat est le plus révélateur du recueil sur l'état de l'informatique du centre : non seulement les outils manquaient, mais ceux qui existaient **avaient déjà échoué**.

### 2.4.2 Question restant ouverte sur le registre des employés

Existe-t-il un système de gestion des ressources humaines détenant le registre des employés et leurs matricules ? Le recueil décrit un service RH qui traite les dossiers **en paie**, ce qui suppose un système de paie. Mais aucune interface avec le centre médical n'est mentionnée : les échanges se font par papier et par oral.

Le système réalisé implémente son propre registre des employés. La question de l'interopérabilité — ou de la double saisie — se pose donc. **À confirmer** — QO-03.

---

## 2.5 Gestion actuelle des données médicales

Cette section est **entièrement documentée** par le recueil.

### 2.5.1 Les supports et leur portée

| Support | Rôle | Portée |
|---|---|---|
| **Carnet de santé individuel, papier** | Support de circulation entre les étapes du parcours | **Transporté par le patient** |
| Classeur papier | Recherche d'un patient déjà connu | **Local au site** |
| Registre papier | Enregistrement des passages | **Local au site** |
| Fichier tableur | Comptages et statistiques | **Local au site**, a posteriori |

### 2.5.2 Le circuit de l'information

L'information ne circulait pas dans un système : elle circulait **physiquement**. Le carnet passait de l'infirmière au médecin, puis revenait au triage, puis repartait avec le patient.

Trois conséquences directes :

**Entre les étapes d'une même visite**, l'information se transmettait — le carnet la portait.

**Entre deux visites**, elle dépendait de la conservation du carnet par le patient.

**Entre les deux sites**, elle ne circulait **pas**. Chaque site n'avait que son propre classeur et son propre tableur. La consolidation était assurée **manuellement par le Médecin Chef**, uniquement pour produire ses rapports à la Direction Générale — donc a posteriori, et jamais au moment du soin.

### 2.5.3 Les flux vers le service administratif

Le recueil est précis sur ce point : les informations entre le centre et le service RH circulent **exclusivement** sous deux formats.

| Format | Contenu |
|---|---|
| **Papier** | Feuilles de repos, ordonnances, reçus, certificats d'évacuation, bons de caisse |
| **Verbal** | Transmissions orales lors d'échanges directs |

Et la conclusion qu'en tire le recueil :

> *« L'absence de format numérique structuré constitue un facteur de risque important : les informations verbales ne laissent aucune trace, et les documents papier sont exposés aux pertes, erreurs de saisie et difficultés d'archivage et de recherche. »*

### 2.5.4 Fiabilité des données

Le recueil note que les données transmises sont **jugées fiables** par le service RH, avec un mécanisme de vérification en cas de doute : une enquête sociale est diligentée. Un historique existe et reste accessible, mais **sa consultation est manuelle**.

Il ajoute une nuance essentielle :

> *« La fiabilité déclarée des données repose essentiellement sur la confiance dans le personnel médical et sur les contrôles ponctuels réalisés. Elle n'est pas garantie par un système de validation numérique ou de traçabilité automatisée. »*

### 2.5.5 Archivage et sauvegarde

⛔ **EN ATTENTE — QO-03.** Les procédures d'archivage des documents papier, les durées de conservation et l'existence de sauvegardes des fichiers tableur ne sont pas documentées par le recueil.

Le constat sur la perte de données du fichier de stock laisse penser qu'aucune politique de sauvegarde n'était en place, au moins pour cet outil.

---

## 2.6 Domaine du projet et état du schéma directeur

**Le domaine couvert** par le projet est le **domaine médical** du système d'information du Service Médico-Social — plus précisément le parcours de soin.

Le recueil montre que ce Service comprend trois domaines fonctionnels distincts :

| Domaine | Porté par | Dans le périmètre du projet ? |
|---|---|---|
| **Soins** — consultation, triage, décision, documents | Centre Médico-Sanitaire | ✅ **oui** |
| Logistique pharmaceutique — stock, dispensation, facturation | Pharmacie du centre | ❌ non |
| Administration du personnel — évacuations, remboursements, accidents, congés | Section des Affaires Sociales | ❌ non |

Cette délimitation est une **décision de cadrage documentée**, justifiée au chapitre 3 § 3.5 et détaillée dans le document de périmètre du dossier.

**Sur le schéma directeur informatique** : ⛔ son existence n'est pas documentée — QO-03. L'absence de tout système d'information médical, l'échec non corrigé de deux outils tableur, et l'absence apparente de service informatique dédié suggèrent qu'il n'en existait pas. **À confirmer.**

---

## 2.7 Analyse critique de l'existant

### 2.7.1 Dimension informationnelle

| Problème constaté | Impact |
|---|---|
| **Aucun dossier patient unique** | Un patient vu sur l'autre site n'est pas retrouvé |
| **Aucune consolidation automatique entre les sites** | Consolidation manuelle par le Médecin Chef, a posteriori |
| **Le fichier de gestion de stock ne conserve pas ses données** | Aucun historique ; deux tentatives d'outillage abandonnées pour ce motif |
| Aucune autorité sur les matricules | Reconnaissance déclarative et visuelle |

### 2.7.2 Dimension organisationnelle

| Problème constaté | Impact |
|---|---|
| **Production manuelle de toutes les statistiques** | Dix axes d'analyse attendus, tous produits à la main ; fréquence et rapidité limitées |
| **Surcharge administrative du Médecin Chef** | Principal point de tension déclaré |
| Facturation pharmaceutique manuelle | **Tâche la plus chronophage** du poste de pharmacienne |
| Traitement manuel des remboursements | Chronophage, source de retards, aucun reporting |
| Droits de prise en charge vérifiés de mémoire | Risque d'inégalité de traitement |

### 2.7.3 Dimension technique

| Problème constaté | Impact |
|---|---|
| Aucun système entre les deux sites | Autonomie complète de chaque site |
| **Flux papier et verbal exclusivement** | Perte de documents, aucune trace des échanges oraux, ressaisie obligatoire |
| Ruptures de stock récurrentes | Pharmacie régulièrement vide entre deux livraisons trimestrielles |

### 2.7.4 Dimension sécuritaire

| Problème constaté | Impact |
|---|---|
| **Aucun contrôle d'accès** | Toute personne ayant accès au poste a accès à tout |
| **Aucune traçabilité** des actes, accès et décisions | Aucune preuve d'autorisation des prescriptions déléguées |
| Règle de confidentialité définie mais **non garantie techniquement** | Repose entièrement sur la discipline des personnes |

### 2.7.5 Le constat d'ensemble

Il faut rendre justice au dispositif avant de le critiquer : **il fonctionnait, et il était même méthodique**. Le processus de consultation était formalisé en quatre étapes standardisées. La règle de confidentialité était définie, différenciée par acteur. La délégation de prescription était encadrée par des règles écrites. Les rapports étaient produits à trois fréquences.

Ce qui manquait n'était donc **pas la méthode, mais l'outil pour l'appliquer** — et surtout, pour en conserver la trace.

Un carnet perdu, et l'historique disparaissait. Un patient changeant de site, et il redevenait inconnu. Une prescription contestée, et rien ne permettait d'établir qui l'avait autorisée. Un fichier de stock refermé, et le travail de la journée s'effaçait.

C'est ce **déficit de mémoire** — informationnelle, organisationnelle et probatoire — que le projet vise à combler, sur le périmètre qu'il a retenu.

> ⛔ **Ce qui manque à cette critique.** Elle est **qualitative**. Le recueil documente les problèmes sans les chiffrer : ni le nombre de dossiers dupliqués, ni les heures de dépouillement mensuel, ni la fréquence des ruptures. Ces mesures n'ont pas été relevées lors des entretiens.

---

## Conclusion du chapitre

Le Service Médico-Social fonctionnait, avant le projet, **sans aucun système d'information médical**. Le carnet de santé papier constituait le support de circulation, complété de registres et de fichiers tableur **locaux à chaque site**. Aucun lien informatique ne reliait Moutela et Nkayi, et la consolidation était assurée manuellement par le Médecin Chef.

Les deux seuls outils informatiques en usage — un fichier de gestion de stock et un logiciel de facturation — avaient **échoué pour la même raison** : la perte des données d'une session à l'autre.

Les flux entre le centre et le service administratif transitaient exclusivement par le papier et l'oral, sans trace ni possibilité de reporting.

Le chapitre suivant présente le domaine d'étude : les acteurs du suivi médical, le fonctionnement sur deux sites, les statuts de patients dont découle la règle de prise en charge, et le périmètre retenu pour ce travail.

---

## Récapitulatif de l'état

| Section | État | Question ouverte |
|---|---|---|
| 2.1 Organisation informatique | ⚠️ absence probable établie indirectement | QO-03 |
| 2.2 Infrastructure réseau | ⚠️ situation établie, topologie manquante | QO-03 |
| 2.3 Parc matériel | ⚠️ parc bureautique attesté, inventaire manquant | QO-03 |
| 2.4 Applications | ✅ **débloquée** | QO-03 pour les autres fonctions |
| 2.5 Gestion des données médicales | ✅ **débloquée** | QO-03 pour l'archivage |
| 2.6 Domaine du projet | ✅ **débloquée** | QO-03 pour le schéma directeur |
| 2.7 Critique de l'existant | ✅ **débloquée** — qualitative | QO-01 pour les mesures |
| Figure 2.1, Tableau 2.1 | ⛔ bloqués | QO-03 |
