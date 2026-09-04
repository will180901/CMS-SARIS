<!-- Fichier régénéré depuis Memoire_CMS_SARIS.docx le 28 août 2026. -->
<!-- Miroir exact du document Word. Ne pas modifier ici : le Word fait foi sur le texte. -->

# CHAPITRE 3 — DOMAINE D'ÉTUDE : LE SYSTÈME D'INFORMATION MÉDICAL

> 0 figure(s) · 7 tableau(x) dans cette partie.

Un système d'information médical n'est pas un logiciel de gestion auquel on aurait ajouté des champs cliniques. Trois traits le distinguent. La donnée y est sensible par nature : sa divulgation cause un préjudice direct à une personne. La continuité y prime sur la disponibilité. Un système de soin indisponible fait perdre l'historique d'un patient au moment précis où l'on en a besoin. La traçabilité y est enfin une obligation, non un confort. Qui a prescrit, qui a délivré, qui a consulté : ces questions doivent trouver réponse après coup.

Dans ce chapitre, nous posons d'abord le contexte et la problématique. Nous décrivons ensuite le domaine d'étude sous ces trois angles, puis nous énonçons le périmètre retenu.

## 3.1 Contexte du projet

Le Centre Médico-Sanitaire de SARIS-CONGO assure les soins de premier recours sur deux sites distants, Moutela et Nkayi. Il prend en charge neuf catégories de personnes, du travailleur permanent au riverain, selon des règles de prise en charge différentes. Le personnel médical n'est affecté à aucun site en propre : il tourne entre les deux selon un planning de permutation.

Avant ce projet, tout reposait sur le papier et le tableur. Le carnet de santé du patient portait l'information d'une étape à l'autre. Chaque site tenait ses propres registres, et le Médecin Chef consolidait les deux à la main. Aucun lien informatique ne reliait Moutela et Nkayi. C'est dans ce contexte que nous avons conçu le système décrit par ce mémoire.

## 3.2 Problématique

Ce contexte pose une question centrale. Comment concevoir et réaliser un système de gestion des consultations et des dossiers médicaux qui remplisse quatre conditions à la fois ? Tenir un seul dossier par patient sur les deux sites. Appliquer sans erreur les règles de prise en charge par catégorie. Garder la trace de chaque acte. Et continuer de fonctionner sans connexion réseau.

Cette question contient une contradiction, et c'est elle qui fait la difficulté du travail. Relier deux sites suppose que l'information circule. Fonctionner sans réseau suppose qu'elle puisse ne pas circuler. Un système qui privilégie la première exigence s'arrête dès que la connexion tombe. Un système qui privilégie la seconde laisse les deux sites diverger. Tout ce mémoire est la réponse à cette tension.

## 3.3 Les acteurs du suivi médical

Le système reconnaît trois acteurs, dont les périmètres de responsabilité et de visibilité diffèrent nettement.

**Tableau 3.1 — Les acteurs du système et leur périmètre**

| Acteur | Périmètre de responsabilité | Portée de visibilité |
|---|---|---|
| Médecin Chef | Référence clinique du centre : prescrit librement, décide des évacuations, accorde les délégations, gouverne les référentiels et le personnel | Toute l'activité clinique |
| Infirmier | Accueil, triage, constantes vitales, consultation. Prescrit uniquement sous délégation | Ses propres consultations seulement |
| Administrateur système | Gouvernance de la plateforme : comptes, rôles, paramètres, supervision | Totale |

Deux principes d'organisation se lisent dans cette structure. Le premier est le cloisonnement par initiateur. Un infirmier ne voit que l'activité qu'il a lui-même conduite. En consultant l'historique d'un patient, il n'accède qu'à la visite en cours. Seul le groupe de supervision dispose d'une vue complète.

Le second est la délégation de prescription. L'infirmier possède les droits techniques de prescrire, mais l'acte n'est autorisé que si une délégation active existe, accordée par le médecin chef et couvrant la date du jour. La délégation utilisée est enregistrée sur l'ordonnance : la responsabilité reste donc imputable après coup.

Cette organisation traduit une hiérarchie médicale réelle : l'infirmier traite des cas simples sous la responsabilité du médecin, sans que cette responsabilité se dilue. Un autre fait éclaire toute notre conception. Comme le personnel tourne entre les deux sites, un même soignant peut recevoir à Nkayi un patient examiné la semaine précédente à Moutela, sans disposer du dossier. Le déficit d'information ne pénalisait pas seulement le patient : il pénalisait le soignant, privé de ce qu'il avait lui-même constaté.

Deux caractéristiques des utilisateurs comptent enfin pour la conception. Le poste d'accueil est celui qui subit le plus de coupures, et c'est aussi celui que tient l'agent dont l'aisance avec l'informatique est la plus variable. Le fonctionnement hors connexion doit donc garantir en priorité l'enregistrement des arrivées. Et l'interface doit parler le langage du métier plutôt que celui du système.

## 3.4 Le fonctionnement sur deux sites

Cette configuration pose trois problèmes. Le problème de l'identité d'abord. Un même travailleur peut être vu sur les deux sites. Sans dossier unique, il existe deux fois, avec deux historiques partiels. Le problème de la synchronisation ensuite. Toute donnée saisie sur un site doit devenir visible sur l'autre, sans ressaisie et sans divergence. Le problème de la connectivité enfin. Faute de liaison fiable et permanente entre les sites, un système exigeant une connexion continue serait inutilisable.

La réponse que nous avons retenue constitue une décision d'architecture forte. Le dossier patient et l'ensemble du parcours de soin sont en portée globale : chaque poste détient la totalité des dossiers des deux sites.

**Tableau 3.2 — Portée des données selon leur nature**

| Donnée | Portée | Motif |
|---|---|---|
| Dossier patient et parcours de soin | Globale | Continuité entre les sites, y compris hors connexion, sans doublon |
| Référentiels partagés | Globale | Un motif, une pathologie, un médicament ont le même sens partout |
| Comptes et habilitations | Globale | Un agent qui tourne doit pouvoir se connecter hors ligne sur n'importe quel poste |
| Personnel médical | Globale | Permet de désigner le soignant d'un acte réalisé sur l'autre site |
| Messagerie | Globale | Une conversation peut réunir des agents des deux sites |
| Planning et présences | Par site | Données strictement opérationnelles, propres à chaque site |

Cette généralisation soulève une objection. Si chaque poste détient tous les dossiers, la confidentialité n'est-elle pas compromise ? La réponse tient en deux mécanismes. Le verrou de dossier permet au médecin chef de restreindre l'accès à un dossier sensible. Ce verrou est appliqué par l'interface de programmation applicative (API), y compris par le serveur embarqué du poste autonome. Le cloisonnement par initiateur établit ensuite que détenir la donnée n'est pas y avoir accès : les droits s'appliquent à la lecture.

Nous avons tranché en faveur de la disponibilité de l'information de soin, contre la restriction de sa diffusion, avec des garde-fous applicatifs. Dans un contexte où l'indisponibilité d'un antécédent peut avoir des conséquences cliniques, cet arbitrage se défend — à condition d'être énoncé.

## 3.5 Catégories de patients et règles de prise en charge

C'est la règle métier centrale du système. Elle explique la majorité des contrôles, conditionne plusieurs cas d'utilisation, et constitue la principale différence entre ce système et un dossier médical générique. Le système distingue cinq catégories de personnes, dont les droits diffèrent.

**Tableau 3.3 — Les cinq catégories de patients reconnues par le système**

| Catégorie | Qui | Identification |
|---|---|---|
| Assuré CDI | Travailleur en contrat à durée indéterminée | Matricule |
| Ayant droit CDI | Membre de la famille rattaché à un assuré CDI | Matricule du CDI et type de lien |
| Assuré CDD | Travailleur en contrat à durée déterminée | Matricule |
| Sous-traitant | Travailleur d'une société sous-traitante | Rattachement à la société |
| Riverain | Personne du voisinage, sans lien contractuel | Aucune |

Les prestations se répartissent en quatre types, et toutes ne sont pas ouvertes à toutes les catégories.

**Tableau 3.4 — Prestations ouvertes selon la catégorie de patient**

| Prestation | Assuré CDI | Ayant droit CDI | Assuré CDD | Sous-traitant | Riverain |
|---|---|---|---|---|---|
| Consultation | Oui | Oui | Oui | Oui | Oui |
| Premiers soins | Oui | Oui | Oui | Oui | Oui |
| Bon de pharmacie | Oui | Oui | Non | Non | Non |
| Bon d'examen | Oui | Oui | Non | Non | Non |

Ce tableau se lit avec précision, car un contresens est facile. Personne n'est refusé aux soins : toute personne qui se présente est reçue, examinée et soignée. Ce qui varie, c'est la prise en charge financière des médicaments et des examens. Elle est réservée au personnel en contrat à durée indéterminée et à ses ayants droit. Pour les autres statuts, les soins sont assurés puis refacturés à la société employeuse ou à l'assurance.

Une distinction s'impose alors entre deux documents que l'on confond aisément. L'ordonnance n'est restreinte par aucune catégorie. C'est un acte médical : le soignant prescrit ce que l'état du patient exige. Le bon de pharmacie l'est. C'est un acte administratif, par lequel l'employeur prend en charge, ou non.

Autrement dit, un riverain reçoit une ordonnance s'il en a besoin, mais il l'honorera à ses frais, faute de bon. Cette règle n'est pas écrite en dur dans le code : une table de la base croise les catégories et les prestations. Elle reste donc modifiable sans redéploiement, ce qui correspond à sa nature de politique d'entreprise. En cas de refus, le message nomme la catégorie et rappelle la règle appliquée.

## 3.6 Intérêts du sujet

Le sujet présente un intérêt pratique pour le Centre Médico-Sanitaire. Notre système répond à quatre besoins précis : disposer d'un dossier patient unique et consolidé entre les deux sites, supprimer les ressaisies, automatiser une règle d'éligibilité qui reposait sur la mémoire des agents, et continuer de fonctionner lorsque le réseau tombe. Ce dernier point n'est pas un raffinement technique, c'est une condition d'usage.

Il présente ensuite un intérêt académique pour nous. Le projet a exigé une démarche d'ingénierie complète : modélisation objet, architecture en couches, sécurité applicative, persistance sur deux moteurs de base de données, synchronisation distribuée avec résolution de conflit, empaquetage et distribution d'un logiciel de bureau. La difficulté principale n'a pas été algorithmique mais architecturale : faire coexister deux modes d'exécution du même code.

Il présente enfin un intérêt méthodologique, plus modeste. Le travail documente une réponse concrète à un problème récurrent dans la sous-région : concevoir un système de santé pour un environnement où la connectivité n'est pas acquise. Trois de nos choix sont transposables : la réplication complète plutôt que partielle, la résolution par dernière écriture avec journalisation plutôt que le verrouillage, et le rejeu de requêtes plutôt que la duplication du moteur de règles. C'est leur argumentation qui constitue l'apport, plus que le code.

## 3.7 Situation du travail dans la littérature

Quatre références encadrent ce travail. L'Organisation mondiale de la santé a publié en 2025 une stratégie d'optimisation des systèmes d'information sanitaire de routine, destinée à renforcer ces systèmes pour soutenir les soins de santé primaires. Cette référence situe le travail dans un cadre reconnu. Un centre médico-sanitaire d'entreprise produit précisément des données de routine — consultations, pathologies, prescriptions — dont l'agrégation alimente les décisions de santé.

Traore et alii ont publié en 2024, dans le Pan African Medical Journal, une analyse de la gestion des données du système d'information sanitaire de routine dans le district sanitaire de Tombouctou, au Mali, en contexte de ressources contraintes. C'est la référence la plus proche de ce sujet : francophone, à comité de lecture, et portant sur un environnement comparable à celui du Centre Médico-Sanitaire de SARIS-CONGO.

Sur le plan technique, deux références comptent. Les travaux de Shapiro, Preguiça, Baquero et Zawirski sur les types de données répliqués sans conflit, publiés en 2011, constituent la référence fondatrice de la cohérence entre répliques qui ne peuvent pas se coordonner en permanence. Ils éclairent le choix de résolution par dernière écriture exposé au chapitre 7. La thèse de Roy Thomas Fielding, soutenue en 2000, introduit REST, le style architectural sur lequel repose l'API du système et ses 273 points d'accès.

Ces références convergent vers la question que nous traitons. En quoi le contexte d'un centre de santé d'entreprise, en milieu à connectivité intermittente et réparti sur deux sites, diffère-t-il de celui pour lequel les systèmes hospitaliers courants sont conçus ?

## 3.8 Périmètre retenu et solution proposée

Le recueil de l'existant a produit dix-huit besoins, répartis sur trois métiers : le soin, l'administration du personnel et la logistique pharmaceutique. Ces domaines n'ont en commun ni les règles, ni les objets, ni les acteurs. Le premier manipule des actes de soin, le deuxième des dossiers administratifs et des montants, le troisième des références de produits et des mouvements de stock. Les traiter ensemble aurait produit un système partout superficiel.

Nous avons donc sélectionné un périmètre : le parcours de soin, de l'accueil du patient à la remise de ses documents.

**Tableau 3.5 — Contenu du parcours de soin retenu**

| Étape | Contenu |
|---|---|
| Triage et accueil | Identification, statut, mode de vie, antécédents, constantes vitales, file d'attente |
| Consultation | Anamnèse, examen clinique, diagnostics, conclusion |
| Décision finale | Clôture guidée par la décision médicale |
| Génération des documents | Ordonnance, bon de pharmacie, bon d'examen, certificat de repos, fiche d'évacuation |

Notre choix n'est pas arbitraire. Il correspond exactement au processus formalisé par le Médecin Chef, décrit au chapitre 5. C'est le processus central du centre, celui que tous les autres alimentent ou prolongent : la pharmacie exécute une ordonnance, le laboratoire exécute un bon d'examen, le service administratif traite un certificat de repos.

S'y ajoutent dix fonctions transverses : le dossier patient centralisé, les référentiels, la gestion du personnel et des délégations, la sécurité et les habilitations, le journal d'audit, la synchronisation hors connexion, la messagerie interne chiffrée, les notifications, les tableaux de bord et rapports, et les paramètres système. Ces fonctions ne sont pas des ajouts d'agrément. Le dossier centralisé et la synchronisation répondent aux deux besoins prioritaires du Médecin Chef. Les habilitations traduisent la règle de confidentialité du centre. Et la messagerie répond au constat que l'information circule verbalement, sans trace.

**Tableau 3.6 — Domaines écartés du périmètre et motifs**

| Écarté | Motif |
|---|---|
| Gestion de stock pharmaceutique | Métier distinct : prix fournisseur, coffrets génériques, seuils de réapprovisionnement, péremption. Le système émet un bon de retrait, le stock reste hors système |
| Facturation et refacturation | Le système modélise des droits d'accès aux prestations, non des droits financiers. Aucun modèle de données ne porte de montant |
| Processus administratifs du personnel | Relèvent de la Section des Affaires Sociales et de la Direction des Ressources Humaines |
| Volet financier des évacuations | Le système gère la décision médicale et le suivi clinique, le bon de caisse relève des affaires sociales |
| Consultations spécialisées | Pôle distinct, avec un parcours de triage allégé |
| Radiologie, laboratoire, maternité, kinésithérapie | Quatre pôles distincts du centre |

Trois besoins de priorité haute restent donc sans réponse : le suivi des coûts d'évacuation, le tableau de bord de l'absentéisme et le logiciel de gestion pharmaceutique. Ils appartiennent tous à des domaines écartés. Nous l'énonçons franchement, car cela se défend : un besoin hors périmètre relève d'une décision de cadrage argumentée, alors qu'un besoin non réalisé à l'intérieur du périmètre serait un échec. Ces trois besoins figurent en perspectives de la conclusion.

Notre solution est donc une plateforme interne de gestion médico-sanitaire couvrant ce périmètre. Elle est accessible depuis les deux sites, en connexion comme hors connexion, et se décline en trois canaux appuyés sur un socle de code commun : une application web pour les postes connectés, tablettes et téléphones ; un client de bureau connecté pour les postes fixes ; et un client de bureau autonome, avec base locale et resynchronisation.

## 3.9 Concepts liés au sujet

Les termes suivants sont employés dans un sens précis tout au long du mémoire.

**Tableau 3.7 — Concepts mobilisés dans ce mémoire**

| Concept | Définition retenue |
|---|---|
| Dossier patient | Ensemble consolidé des informations concernant une personne : identité, antécédents, allergies, alertes et historique de ses passages |
| Visite | Passage d'un patient au centre. Unité de travail créée à l'accueil, close par une consultation |
| Triage | Étape d'accueil et d'enregistrement, ici par ordre d'arrivée, sans notion de priorité clinique |
| Consultation | Acte clinique conduit pendant une visite, aboutissant à une conclusion et, éventuellement, à une décision |
| Ordonnance | Document de prescription. Non restreint par catégorie de patient |
| Bon de prise en charge | Document ouvrant droit au retrait de médicaments ou à un examen. Restreint par catégorie |
| Évacuation | Orientation d'un patient vers une structure de soins supérieure |
| Catégorie de patient | Classement administratif déterminant les prestations prises en charge |
| Délégation de prescription | Autorisation temporaire, accordée par le médecin chef à un infirmier, de prescrire dans un cadre défini |
| Fonctionnement hors connexion | Approche où le fonctionnement sans réseau constitue le cas nominal, la connexion étant un enrichissement |
| Synchronisation | Rapprochement des données d'un poste local et du serveur central, par échange des seules modifications |
| Résolution de conflit | Arbitrage entre deux modifications concurrentes du même enregistrement |
| Suppression logique | Marquage d'un enregistrement comme supprimé sans effacement, afin que la suppression puisse se propager |
| Traçabilité | Capacité à établir après coup qui a fait quoi, quand et depuis où |
| Habilitation | Ensemble des droits d'un agent, résultant de son rôle et de ses dérogations individuelles |
| Verrou de dossier | Restriction d'accès posée par le médecin chef sur un dossier sensible, appliquée y compris hors connexion |

## Conclusion du chapitre

Dans ce chapitre, nous avons établi les caractéristiques du domaine. Le suivi médical repose sur une hiérarchie où l'infirmier agit sous délégation du médecin chef, avec une visibilité cloisonnée. Cette organisation existait déjà, informelle et non tracée : notre système l'encadre. Le fonctionnement sur deux sites impose une réplication complète des dossiers, et nous avons arbitré en faveur de la disponibilité de l'information de soin, avec un verrou applicatif pour garde-fou.

Une règle d'éligibilité distingue enfin le soin, ouvert à tous, de la prise en charge financière, réservée à certains. Nous avons énoncé et justifié notre périmètre — le parcours de soin et ses fonctions transverses — ainsi que ce qui en a été écarté. La Partie II développe la démarche technique.
