---
chapitre: 7
titre: "Conception"
budget_pages: 10-12
statut: relu
sources: [INV-01, INV-02, INV-04, INV-05, INV-07]
figures: [UML-CLS-01, UML-ACT-02, UML-SEQO-01, UML-SEQO-02, UML-COM-01, UML-CMP-01, UML-DEP-01, IHM-01..05]
blocages: []
---

# CHAPITRE 7 — CONCEPTION

## Introduction du chapitre

La conception est le point où les deux branches de 2TUP se rejoignent. Le modèle du métier établi au chapitre précédent — trois acteurs, soixante-cinq cas d'utilisation, deux règles centrales — doit maintenant être projeté sur une architecture technique capable de le porter, y compris dans les conditions les plus contraignantes : sans connexion, sur deux sites, avec des données de santé à protéger.

Ce chapitre présente d'abord l'architecture technique retenue et sa justification, puis le modèle de classes du domaine, le déroulement du processus principal, la réalisation interne des cas d'utilisation prioritaires, l'organisation en composants, le déploiement physique, et enfin les principes d'interface.

---

## 7.1 Architecture technique

### 7.1.1 Le choix structurant : offline-first

La contrainte dominante n'est pas fonctionnelle mais contextuelle : **la connectivité des sites est variable**. Un système qui cesse de fonctionner quand le réseau tombe est inutilisable dans un centre de santé — on ne suspend pas une consultation en attendant le retour d'Internet.

Trois architectures étaient envisageables.

| Option | Principe | Pourquoi écartée ou retenue |
|---|---|---|
| Client-serveur classique | Tout passe par un serveur central | **Écartée** : une coupure réseau arrête le centre |
| Postes autonomes non reliés | Chaque poste a sa base, aucune synchronisation | **Écartée** : reproduit exactement le problème constaté — dossiers dupliqués, aucune continuité entre sites |
| **Offline-first avec réconciliation** | Chaque poste travaille localement puis se resynchronise | **Retenue** : seule option satisfaisant simultanément la continuité de service et la cohérence entre sites |

Ce choix commande tout le reste : la duplication du schéma de données, la suppression logique généralisée, la stratégie de résolution de conflit, et jusqu'à la nécessité d'une double authentification en mode autonome.

### 7.1.2 Architecture en couches

Le système suit une architecture en trois couches, elle-même déclinée en deux implantations physiques.

| Couche | Rôle | Technologie |
|---|---|---|
| **Présentation** | Interfaces, navigation, état local, contrôle d'affichage | React 19, Vite 7 · client de bureau Electron |
| **Logique métier** | Contrôleurs, gardes, services, règles, validation | NestJS 11 |
| **Accès aux données** | Correspondance objet-relationnel, migrations, extension de suppression logique | Prisma 6 |
| **Persistance** | Stockage | PostgreSQL 16 (central) · SQLite (poste autonome) |

Le point remarquable est que **la couche métier est bi-cible** : le même code NestJS s'exécute sur le serveur central au-dessus de PostgreSQL, et à l'intérieur du client de bureau au-dessus de SQLite. Cela évite d'écrire deux fois les règles — et donc de les faire diverger.

Cette bi-cible a un coût, visible dans le code : certaines options de requête existent en PostgreSQL et sont refusées par SQLite. La recherche insensible à la casse en est l'exemple type ; le système n'injecte l'option correspondante que hors SQLite, ce dernier appliquant déjà ce comportement par défaut. Sans cette précaution, toute recherche ferait échouer le poste autonome.

### 7.1.3 Organisation en monorepo

Le code est réuni dans un dépôt unique organisé en six paquets, gérés par un gestionnaire de paquets à espaces de travail et un orchestrateur de tâches.

| Paquet | Contenu | Justification |
|---|---|---|
| `apps/api` | Serveur NestJS — 17 modules métier, 26 contrôleurs, 268 routes | — |
| `apps/web` | Interface React — 15 modules, 15 écrans | — |
| `apps/desktop` | Client Electron — 2 modes, installateur | — |
| `packages/db` | Schéma Prisma, 41 migrations, jeu de données de démonstration | Schéma unique pour les deux cibles |
| `packages/types` | Types partagés, **catalogue des permissions**, **logique de résolution de conflit** | Le serveur et les clients partagent la même définition des droits |
| `packages/ui` | Système de composants d'interface | Cohérence visuelle |

Le paquet de types est le pivot de la maintenabilité : le catalogue des 128 permissions y est déclaré une seule fois, et la logique de résolution de conflit y est écrite sous forme de fonctions pures, sans entrée-sortie, ce qui la rend testable et réutilisable des deux côtés de la synchronisation.

> **Une limite assumée, documentée par le code lui-même.** Le serveur ne peut pas importer de *valeur* depuis ce paquet partagé. La règle de cohérence des permissions existe donc en **deux copies** — celle du paquet et celle du serveur — qui doivent rester identiques. Toute divergence produirait une incohérence de droits invisible. C'est une dette technique reconnue, non un oubli.

### 7.1.4 Architecture de sécurité

La sécurité est organisée en couches successives, chacune traitant une menace distincte.

| Niveau | Mécanisme | Menace couverte |
|---|---|---|
| 1 | En-têtes HTTP protégés | Attaques par le navigateur |
| 2 | Politique d'origine croisée restrictive | Appels depuis un site tiers |
| 3 | Limitation de débit : 100 requêtes par minute, **clé sur l'utilisateur et non sur l'adresse IP** | Force brute, déni de service |
| 4 | Vérification du jeton signé | Accès non authentifié |
| 5 | Garde de permission | Accès non autorisé |
| 6 | **Règle métier dans le service** | Acte non autorisé malgré la permission |
| 7 | Validation stricte des entrées, avec rejet des champs inconnus | Injection de données |
| 8 | Journal d'audit alimenté par un intercepteur unique | Absence d'imputabilité |
| 9 | Chiffrement au repos | Lecture de la base |

Trois points méritent d'être soulignés.

**La limitation de débit est clée sur l'utilisateur.** Derrière un proxy ou une traduction d'adresses, plusieurs agents partagent la même adresse IP : un plafond par IP les pénaliserait mutuellement. Le système clé donc sur l'identifiant du compte, avec repli sur l'adresse pour les requêtes non authentifiées.

**Les niveaux 5 et 6 sont distincts, et cette distinction est essentielle.** La permission ouvre la porte ; la règle métier autorise l'acte. Un infirmier possède la permission de créer une ordonnance, mais le service refuse tant qu'aucune délégation active ne le couvre. Un diagramme qui ne montrerait que la garde de permission décrirait un système plus permissif qu'il ne l'est.

**Certaines permissions sont protégées contre leur propre retrait.** Dix permissions de gouvernance — lecture et gestion des rôles, des comptes, des attributions — ne peuvent être retirées ni par un administrateur à lui-même, ni au dernier administrateur actif. Sans cette protection, une fausse manœuvre rendrait la plateforme inadministrable, la seule issue étant une intervention directe en base.

### 7.1.5 Le journal d'audit

L'audit repose sur un intercepteur global qui journalise chaque mutation effectuée sur un contrôleur annoté, en capturant l'auteur, l'action, le module, l'entité, l'adresse IP réelle et le statut de l'opération. **151 routes sur 268** sont ainsi couvertes.

Deux propriétés en font une preuve exploitable. D'abord, l'intercepteur est **best-effort** : un échec d'écriture du journal n'altère jamais la requête métier. Ensuite, et surtout, **seul cet intercepteur écrit dans le journal** — aucune route d'écriture n'y donne accès. C'est ce qui garantit qu'on ne peut pas falsifier l'audit par l'interface.

L'adresse IP journalisée est enrichie à la lecture d'une ville et de coordonnées, obtenues d'un service externe avec **repli hors ligne** sur une base embarquée. Aucune colonne supplémentaire n'a été ajoutée : la localisation est dérivée, jamais stockée.

---

## 7.2 Modèle de classes

### 7.2.1 Une sélection nécessaire, et son critère

Le modèle complet comporte **88 entités reliées par 97 associations**. Une planche représentant l'ensemble serait illisible imprimée au format A4.

Le diagramme de classes retient donc **27 classes**, sélectionnées selon deux critères énoncés :

1. un **degré de connexion supérieur ou égal à deux** dans les domaines clinique, acteurs et référentiels — le degré étant le nombre d'associations portées par l'entité ;
2. **deux exceptions justifiées par leur poids métier** : les constantes vitales, donnée centrale du triage, et la matrice des droits par catégorie, qui porte la règle d'éligibilité.

Les 61 entités écartées ne disparaissent pas : elles figurent intégralement au dictionnaire de données en annexe D.

> **Figure 7.1 — Diagramme de classes du système** *(fiche `UML-CLS-01`)*

### 7.2.2 Les entités les plus connectées

| Rang | Entité | Degré | Lecture |
|---:|---|---:|---|
| 1 | `Patient` | 18 | Pivot du modèle : identité, contacts, allergies, antécédents, alertes, mode de vie, rattachements, visites, suivis |
| 2 | `Consultation` | 13 | Pivot du parcours de soin : diagnostics, ordonnances, bons, certificats, évacuation, suivi |
| 3 | `Utilisateur` | 11 | Pivot de la sécurité : rôles, dérogations, sessions, second facteur, préférences, journaux, messages |
| 4 | `PersonnelMedical` | 8 | Lien entre le compte applicatif et la personne soignante |
| 5 | `Visite` | 6 | Unité de travail du triage |
| 6 | `Ordonnance` | 6 | Charnière entre la prescription et les bons |

Cette hiérarchie n'est pas une impression : elle se lit dans le nombre d'associations. Elle confirme que le modèle est organisé autour de trois pivots — la personne soignée, l'acte de soin, et l'agent qui le réalise.

### 7.2.3 Trois choix de modélisation

**Le dossier patient est éclaté en entités satellites.** L'identité, les contacts d'urgence, les données d'emploi, le mode de vie sont des entités distinctes reliées au patient plutôt que des colonnes d'une table unique. Ce choix permet de faire évoluer chaque volet indépendamment, et surtout d'appliquer des droits différents : la partie administrative du dossier relève d'une permission distincte de la partie médicale.

**Les documents cliniques sont rattachés à la consultation, pas au patient.** Une ordonnance, un bon, un certificat existent *dans* un acte de soin. Cela garantit qu'aucun document ne peut exister sans consultation qui le justifie, et rend traçable le contexte de chaque prescription.

**Les rattachements sont historisés.** Le lien entre un ayant droit et l'employé dont il dépend, ou entre un patient et sa société sous-traitante, possède sa propre entité d'historique. Un rattachement qui change ne s'écrase pas : il se termine et un nouveau commence. C'est indispensable pour justifier a posteriori qu'un bon avait bien été émis à une date où le patient y avait droit.

### 7.2.4 Les machines à états

Neuf entités du modèle possèdent un **cycle de vie contraint**. Les recenser explicitement est indispensable : ce sont ces contraintes qui empêchent le système d'entrer dans un état incohérent.

| Entité | États | Transitions notables |
|---|---|---|
| **Visite** | en attente → en cours → clôturée · annulée | La clôture est posée **par la consultation**, jamais depuis le triage |
| **Consultation** | ouverte → clôturée · annulée | Une seule ouverte par soignant **et** par visite |
| **Ordonnance** | brouillon → validée → annulée | Modifiable et supprimable **uniquement** au brouillon |
| **Bon de pharmacie** | en attente → délivré · annulé | Un bon délivré **ne peut plus être annulé** |
| **Bon d'examen** | en attente → validé → reçu · annulé | Le résultat exige un bon validé |
| **Évacuation** | en cours → en transport → admis → clôturé · annulé | L'annulation exige l'état « en cours » |
| **Suivi de traitement** | en cours → clôturé · annulé | Les fiches datées bouclent sur « en cours » |
| **Dossier patient** | actif · archivé · décédé · fusionné | Une visite exige un dossier actif |
| **Compte utilisateur** | actif · désactivé · bloqué | Le blocage est posé automatiquement après échecs répétés |

Trois observations méritent d'être portées au mémoire.

**Les états terminaux sont irréversibles.** Une consultation clôturée, un bon délivré, une évacuation close ne reviennent jamais en arrière. C'est une exigence de traçabilité : un acte clinique enregistré ne se défait pas, il s'annule avec un motif — et l'annulation est elle-même un état terminal.

**Le motif d'annulation est systématiquement obligatoire.** Sur les visites, consultations, ordonnances, bons, évacuations et suivis, aucune annulation n'est possible sans motif. Une annulation sans justification serait une perte d'information.

**Quatre machines sur neuf seulement sont garanties par la base.** Les cycles de la visite, de la consultation, du dossier patient et du compte reposent sur des types énumérés, que le moteur refuse de violer. Les cinq autres — ordonnance, bons, évacuation, suivi — reposent sur de simples champs texte contraints par le code applicatif. Une écriture directe en base pourrait y poser une valeur invalide.

> C'est une **faiblesse réelle**, née d'un compromis de portabilité entre les deux moteurs de base de données. Elle est sans conséquence tant que toutes les écritures passent par l'application, ce qui est le cas aujourd'hui. Elle est signalée ici plutôt que passée sous silence, et figure parmi les perspectives d'amélioration.

### 7.2.5 Suppression logique

**47 entités sur 88** portent une marque de suppression. Une suppression n'efface jamais : elle horodate.

Ce choix découle directement de l'offline-first. Si un dossier supprimé disparaissait de la base centrale, les postes hors ligne qui le détiennent encore n'auraient aucun moyen d'apprendre sa disparition — ils le réintroduiraient à la synchronisation suivante. La marque de suppression est **la donnée qui permet de propager un effacement**.

L'extension appliquée à la couche d'accès aux données transforme automatiquement les suppressions en mises à jour et filtre les enregistrements marqués. Le code en documente lui-même les **limites** : certaines opérations — création avec écrasement, compteurs relationnels, inclusions imbriquées — voient encore les enregistrements marqués, et une sélection qui omet la colonne de suppression défait le filtrage. Ces cas sont traités explicitement dans les services concernés, et l'un d'eux — la recréation d'un enregistrement portant une clé déjà utilisée par un enregistrement supprimé — fait l'objet d'un test de non-régression.

---

## 7.3 Diagramme d'activité du processus principal

Le processus central du système est le **parcours de soin**, de l'accueil du patient à la production des documents.

> **Figure 7.2 — Diagramme d'activité du parcours de soin** *(fiche `UML-ACT-02`)*

Le déroulement se lit en quatre temps.

**Accueil et triage.** L'agent recherche ou crée le dossier, vérifie le matricule, sélectionne le motif. Le système contrôle que le patient est actif, que le motif est actif, et qu'aucune visite n'est déjà ouverte pour cette personne. La visite est créée, les constantes vitales relevées, et elle entre dans la file **par ordre d'arrivée** — le système ne connaît aucune notion de priorité.

**Consultation.** Un soignant prend en charge la visite. Deux contrôles s'appliquent : il ne peut avoir qu'une consultation ouverte à la fois, et une visite ne peut porter qu'une consultation ouverte. Il saisit l'examen clinique, pose un ou plusieurs diagnostics, rédige sa conclusion.

**Prescription, le cas échéant.** Deux branches distinctes : une ordonnance pharmaceutique, ou une prescription d'examen. Dans les deux cas, le droit de prescrire est vérifié avant toute création. Une fois validée, l'ordonnance peut engendrer un bon — et c'est à ce moment, et seulement à ce moment, que l'éligibilité de la catégorie du patient est contrôlée.

**Clôture.** Le soignant clôture avec ou sans décision. La clôture entraîne obligatoirement celle de la visite parente. Selon la décision, une évacuation ou un suivi de traitement est ouvert.

> **Une évolution à signaler.** Une documentation antérieure du projet annonçait **quatre** décisions médicales. Le système n'en implémente que **deux** — évacuation et suivi de traitement — la clôture simple étant caractérisée par l'absence de décision. La raison est claire à la lecture du code : la prescription et l'examen complémentaire ne sont plus des *décisions* mais des **documents**, matérialisés par une ordonnance dont le type détermine le bon qui peut en être généré. Cet écart est consigné à la matrice d'alignement.

---

## 7.4 Réalisation des cas d'utilisation

La réalisation concrétise un cas d'utilisation vu de l'extérieur en une collaboration entre objets internes. Le système suit une chaîne constante, sur les 268 routes :

**Contrôleur → Garde d'authentification → Garde de permission → Service → Règle métier → Couche d'accès aux données → Base**

Les responsabilités sont strictement réparties : le contrôleur ne contient aucune logique métier, il valide et délègue ; le service porte les règles ; les gardes portent la sécurité ; les utilitaires transverses portent les règles partagées.

### 7.4.1 Séquence objets — Émettre un bon de pharmacie

> **Figure 7.3 — Diagramme de séquence objets : émission d'un bon de pharmacie** *(fiche `UML-SEQO-01`)*

Ce cas a été retenu parce qu'il fait apparaître **les deux étages de contrôle** que ni le diagramme de cas d'utilisation ni la séquence système ne peuvent montrer. La garde de permission valide que l'agent a le droit d'émettre un bon ; puis le service interroge la matrice des droits par catégorie pour déterminer si *ce patient précis* y ouvre droit. Un agent parfaitement autorisé se voit refuser l'acte si le patient n'est pas couvert — et le message d'erreur nomme explicitement la catégorie concernée.

### 7.4.2 Séquence objets — Synchroniser un poste local

> **Figure 7.4 — Diagramme de séquence objets : cycle de synchronisation avec conflit** *(fiche `UML-SEQO-02`)*

Ce cas a été retenu parce qu'il est le seul dont l'acteur est un système, et le seul à comporter une résolution de conflit. Il fait apparaître le canal de notification, le service de synchronisation, la fonction pure de résolution et le service de supervision qui journalise.

> **Figure 7.5 — Diagramme de communication du parcours de soin** *(fiche `UML-COM-01`)*

---

## 7.5 Le moteur de synchronisation

### 7.5.1 Deux mécanismes, pas un

Le système comporte **deux mécanismes hors-ligne de conception différente**. Les confondre serait une erreur d'analyse.

| | **Web** | **Poste autonome** |
|---|---|---|
| Stockage local | Base du navigateur | SQLite, via le serveur embarqué |
| Lectures hors ligne | Cache du service worker, réseau d'abord | Vraies requêtes sur la base locale |
| Écritures hors ligne | **File de mutations rejouées** | Écriture directe en base |
| Réconciliation | Rejeu des requêtes dans l'ordre | **Deltas et résolution par dernière écriture** |
| Autonomie | Partielle, dépend du cache | Complète : le poste est un serveur |

**Le rejeu de requêtes** mérite d'être expliqué, car son élégance tient à ce qu'il évite. Hors connexion, chaque écriture est enregistrée telle quelle — méthode, chemin, corps. Au retour du réseau, ces requêtes sont rejouées vers les routes réelles. Conséquence : **toute la validation, toutes les permissions et toute la logique métier du serveur sont réutilisées**. Il n'existe aucun moteur d'application parallèle côté client, donc aucun risque de voir les règles diverger entre le mode connecté et le mode hors ligne. Trois garanties l'accompagnent : aucune perte, l'ordre respecté, et l'idempotence assurée par un identifiant unique par mutation.

### 7.5.2 La résolution de conflit

La stratégie retenue est la **dernière écriture gagnante**, comparée sur l'horodatage de modification, avec détection de la concurrence par la version de départ connue du client.

| Situation | Décision |
|---|---|
| Aucun enregistrement existant | Appliquer — création |
| Entrant plus récent, serveur inchangé depuis la version de départ | Appliquer |
| Entrant plus récent, serveur **modifié** depuis | **Conflit** — l'entrant l'emporte, l'incident est journalisé |
| Entrant plus ancien, serveur inchangé | Ignorer |
| Entrant plus ancien, serveur **modifié** depuis | **Conflit** — l'existant l'emporte, l'incident est journalisé |
| Horodatages égaux | Ignorer — renvoi idempotent |

Trois propriétés en découlent, toutes revendiquées dans le code.

**Aucun blocage.** Il n'existe pas de verrou distribué entre des machines dont certaines sont hors ligne — ce serait techniquement impossible et fonctionnellement inacceptable. Un conflit est donc **tranché puis journalisé pour revue**, jamais mis en attente.

**Une suppression est une modification comme une autre.** La marque de suppression porte son propre horodatage et entre dans le même arbitrage.

**L'horodatage source est restauré.** L'application d'une modification entrante procède par écriture puis restauration explicite de l'horodatage d'origine — sans quoi le mécanisme automatique de datation ré-horodaterait l'enregistrement et invaliderait tout le raisonnement.

**Les marques de suppression ne s'accumulent pas indéfiniment.** Une tâche planifiée les purge une fois qu'elles ont été propagées à tous les postes connus ; une seconde tâche purge les notifications anciennes. Sans ces purges, la base croîtrait sans limite avec des enregistrements qui n'ont plus d'utilité que transitoire.

### 7.5.3 Portée des données synchronisées

**52 entités sur 88** sont synchronisées. Leur portée relève d'une décision d'architecture majeure.

| Portée | Entités | Décision |
|---|---:|---|
| **Globale** | 42 | Chaque poste détient l'ensemble |
| Par site | 3 | Planning, présences, conversations |
| Par chemin de relation | 7 | Portée dérivée d'une entité parente |

Le point décisif est que **le dossier patient et tout le parcours de soin sont en portée globale**. Chaque poste détient la totalité des dossiers, des deux sites. Le motif est explicite dans le code : c'est ce qui rend possible la continuité entre Moutela et Nkayi **même hors connexion**. Un travailleur muté est retrouvé sur n'importe quel poste, sans doublon.

La confidentialité n'est pas sacrifiée pour autant : elle est assurée par le **verrou de dossier** posé par le médecin chef, appliqué par l'API — y compris par le serveur embarqué du poste autonome.

Les 36 entités non synchronisées sont locales à leur instance : journaux d'audit et d'authentification, notifications, sessions, second facteur, préférences, paramètres, sauvegardes, et les tables de la synchronisation elle-même.

### 7.5.4 Le canal de notification

Le serveur central expose un flux d'événements qui **ne transporte aucune donnée** : uniquement l'information qu'il y a du neuf, et l'identité de celui qui l'a produit. Les postes abonnés déclenchent alors une synchronisation, qui repasse par les contrôles d'accès habituels.

Le raisonnement inscrit dans le code est complet : un canal muet ne peut pas fuiter ; le poste à l'origine d'une écriture n'est pas réveillé pour son propre travail ; un battement régulier maintient le canal ouvert, car les intermédiaires réseau coupent les connexions silencieuses au bout d'une minute environ, ce qui provoquerait sur un parc de deux cents postes un flot permanent de reconnexions pour zéro information ; et ce battement porte un **type différent** de la notification, faute de quoi les postes synchroniseraient à chaque battement, réinventant l'interrogation périodique qu'on cherchait précisément à supprimer.

---

## 7.6 Architecture en composants

> **Figure 7.6 — Diagramme de composants** *(fiche `UML-CMP-01`)*

| Composant | Interface fournie | Interfaces requises |
|---|---|---|
| Serveur API | 268 routes REST, flux d'événements | Accès aux données, service de géolocalisation |
| Interface web | — | API REST, flux d'événements |
| Client de bureau | Fenêtre applicative, coffre de secrets, mise à jour | API distante **ou** serveur embarqué |
| Serveur embarqué | API locale, restreinte à la boucle locale | Base SQLite |
| Paquet de données | Schéma, migrations, client d'accès | Base de données |
| Paquet de types | Types, catalogue des permissions, résolution de conflit | — |
| Paquet d'interface | Composants visuels | — |

---

## 7.7 Déploiement

> **Figure 7.7 — Diagramme de déploiement** *(fiche `UML-DEP-01`)*

| Nœud | Contenu | Réseau |
|---|---|---|
| Serveur d'application | Serveur API, exposé en HTTPS | Internet |
| Serveur de base de données | PostgreSQL 16, hébergé séparément | Liaison chiffrée |
| Poste client, mode connecté | Client de bureau ou navigateur | Internet |
| **Poste client, mode autonome** | Client de bureau + serveur embarqué + base SQLite | **Boucle locale uniquement**, synchronisation par Internet quand disponible |

Deux points de sécurité conditionnent ce déploiement.

Le serveur embarqué du poste autonome n'écoute **que sur la boucle locale**. Il n'est jamais exposé au réseau du poste, ce qui interdit qu'un autre machine du même réseau l'interroge.

L'URL du serveur **doit être en HTTPS en production**. Le code l'exige explicitement : une URL non chiffrée ferait transiter jetons d'authentification et données patient en clair, interception triviale sur un réseau partagé.

L'origine du client de bureau est un **schéma applicatif privilégié** plutôt qu'une adresse locale. Cette origine stable est déclarée autorisée côté serveur, ce qui est indispensable au fonctionnement du flux d'événements — soumis à la politique d'origine croisée.

---

## 7.8 Conception des interfaces

Les principes d'interface sont formalisés dans une charte graphique en douze fiches, appliquée par un système de composants partagé.

| Principe | Application |
|---|---|
| **Adaptation au rôle** | Le menu est filtré par permission, item par item. Un groupe dont tous les items sont refusés **disparaît** au lieu d'afficher des entrées mortes |
| **Confidentialité par défaut** | Les zones cliniques sensibles sont floutées en permanence et révélées au survol. Actif par défaut, neutralisé sur écran tactile |
| **Bilinguisme** | Français et anglais, bascule en direct, préférence mémorisée par compte |
| **Adaptation à l'écran** | Menu en tiroir sur mobile, panneaux empilés, tableaux défilants |
| **Point de départ adapté au métier** | L'infirmier arrive sur la file d'attente ; les autres rôles sur le tableau de bord |
| **Impression normalisée** | Six documents A4 partagent deux gabarits communs |

> **Figures 7.8 à 7.12 — Maquettes des interfaces principales** *(fiches `IHM-01` à `IHM-05`)* : écran de connexion, tableau de bord, file de triage, dossier patient, consultation.

**Une faiblesse à signaler.** Les permissions gouvernant l'affichage du menu et celles gardant les routes sont déclarées à **deux endroits distincts**. Une divergence produit une entrée visible menant à un refus. Le code documente lui-même un incident de ce type : l'entrée « Rapports » exigeait une permission de consultation quand le serveur en exigeait une autre, produisant une erreur après clic. Le cas a été corrigé, mais la double déclaration demeure.

---

## Conclusion du chapitre

La conception a fait converger les deux branches de 2TUP. Du côté fonctionnel, le modèle du domaine s'organise autour de trois pivots — le patient, la consultation, l'agent — et de 27 classes retenues sur 88, selon un critère explicite. Du côté technique, l'architecture répond à la contrainte dominante par une couche métier **bi-cible**, exécutable indifféremment au-dessus de PostgreSQL ou de SQLite, et par deux mécanismes hors-ligne adaptés chacun à son contexte.

Trois décisions structurent l'ensemble et méritent d'être retenues. La **portée globale du dossier patient** rend possible la continuité entre les deux sites, y compris hors connexion, la confidentialité étant préservée par un verrou applicatif. La **suppression logique généralisée** est ce qui permet à un effacement de se propager. Le **contrôle à deux étages** distingue le droit d'agir de l'autorisation d'agir, et matérialise dans le code la règle de délégation observée sur le terrain.

Le chapitre suivant rend compte de la construction effective de cette conception, et de ce qui a été — ou n'a pas été — validé.
