<!-- Fichier régénéré depuis Memoire_CMS_SARIS.docx le 28 août 2026. -->
<!-- Miroir exact du document Word. Ne pas modifier ici : le Word fait foi sur le texte. -->

# CHAPITRE 7 — CONCEPTION

> 7 figure(s) · 9 tableau(x) dans cette partie.

La conception est le point où les deux branches de 2TUP se rejoignent. Le chapitre précédent a établi le modèle du métier : trois acteurs, soixante-cinq cas d'utilisation, deux règles centrales. Nous devons maintenant projeter ce modèle sur une architecture technique capable de le porter. Et de le porter dans les conditions les plus contraignantes : sans connexion, sur deux sites, avec des données de santé à protéger.

## 7.1 Architecture technique

La contrainte dominante n'est pas fonctionnelle, elle est contextuelle : la connectivité des sites est variable. Un système qui cesse de fonctionner quand le réseau tombe est inutilisable dans un centre de santé. On ne suspend pas une consultation en attendant le retour du réseau. Trois architectures étaient envisageables.

**Tableau 7.1 — Les trois architectures envisagées**

| Option | Principe | Décision |
|---|---|---|
| Client-serveur classique | Tout passe par un serveur central | Écartée : une coupure réseau arrêterait le centre |
| Postes autonomes non reliés | Chaque poste dispose de sa base, sans synchronisation | Écartée : elle reproduirait le problème constaté, dossiers dupliqués et aucune continuité |
| Fonctionnement hors connexion avec réconciliation | Chaque poste travaille localement puis se resynchronise | Retenue : seule option satisfaisant la continuité de service et la cohérence entre les sites |

Notre choix commande tout le reste. Il impose la duplication du schéma de données, la suppression logique généralisée, la stratégie de résolution de conflit, et jusqu'à une authentification qui fonctionne en mode autonome.

Notre système suit une architecture en couches. La couche de présentation porte les interfaces, la navigation et l'état local : elle est bâtie avec React et compilée par Vite. La couche métier porte les contrôleurs, les gardes, les services, les règles et la validation : elle repose sur NestJS. La couche d'accès aux données assure la correspondance objet-relationnel (ORM) et les migrations, au moyen de Prisma. La persistance repose enfin sur deux moteurs SQL : PostgreSQL pour le serveur central, SQLite pour la base locale du poste autonome. L'ensemble est écrit en TypeScript, du serveur à l'interface.

Le point remarquable est que la couche métier est bi-cible. Le même code NestJS s'exécute sur le serveur central au-dessus de PostgreSQL, et à l'intérieur du client de bureau au-dessus de SQLite. Cela évite d'écrire deux fois les règles, et donc de les faire diverger.

Cette bi-cible a toutefois un coût, visible dans le code. Certaines options de requête existent dans un moteur et sont refusées par l'autre : la recherche insensible à la casse en est l'exemple type, Prisma ne l'acceptant que sur PostgreSQL. Le système n'injecte donc l'option que sur le moteur qui l'exige. Sans cette précaution, toute recherche ferait échouer le poste autonome. Le code est réuni dans un dépôt unique, organisé en six paquets et orchestré par pnpm et Turborepo.

**Tableau 7.2 — Les six paquets du dépôt**

| Paquet | Contenu |
|---|---|
| Serveur applicatif | 17 modules métier, 26 contrôleurs, 268 routes |
| Interface web | 15 modules, 15 écrans |
| Client de bureau | Deux modes de fonctionnement, installateur |
| Paquet de données | Schéma, 41 migrations, jeu de données de démonstration |
| Paquet de types | Types partagés, catalogue des permissions, logique de résolution de conflit |
| Paquet d'interface | Système de composants visuels |

Le paquet de types est le pivot de la maintenabilité. Le catalogue des 128 permissions y est déclaré une seule fois. La logique de résolution de conflit y est écrite sous forme de fonctions sans effet de bord : elles sont donc testables, et réutilisables des deux côtés de la synchronisation.

Une limite doit cependant être signalée, et le code la documente lui-même. Le serveur ne peut pas importer de valeur depuis ce paquet partagé. La règle de cohérence des permissions existe donc en deux copies, qui doivent rester identiques. C'est une dette technique reconnue, non un oubli.

## 7.2 Architecture de sécurité

Nous avons organisé la sécurité en couches successives, chacune traitant une menace distincte. Un accès non autorisé doit franchir neuf niveaux avant d'atteindre une donnée.

**Tableau 7.3 — Les neuf niveaux de l'architecture de sécurité**

| Niveau | Mécanisme | Menace couverte |
|---|---|---|
| 1 | En-têtes de protection du navigateur | Attaques par le navigateur |
| 2 | Politique d'origine croisée restrictive | Appels depuis un site tiers |
| 3 | Limitation à 100 requêtes par minute, clée sur l'utilisateur | Force brute et déni de service |
| 4 | Vérification du jeton signé | Accès non authentifié |
| 5 | Garde de permission | Accès non autorisé |
| 6 | Règle métier appliquée dans le service | Acte non autorisé malgré la permission |
| 7 | Validation stricte des entrées | Injection de données |
| 8 | Journal d'audit alimenté par un intercepteur unique | Absence d'imputabilité |
| 9 | Chiffrement au repos | Lecture directe de la base de données |

Nous devons souligner trois points. La limitation de débit est calée sur l'utilisateur et non sur l'adresse réseau. Derrière un routeur, plusieurs agents partagent la même adresse : un plafond par adresse les pénaliserait mutuellement. Les niveaux 5 et 6 sont ensuite distincts, et cette distinction est essentielle. La permission ouvre la porte, la règle métier autorise l'acte. Un infirmier possède la permission de créer une ordonnance, mais le service refuse tant qu'aucune délégation active ne le couvre.

Certaines permissions sont enfin protégées contre leur propre retrait. Dix permissions de gouvernance ne peuvent être retirées ni par un administrateur à lui-même, ni au dernier administrateur actif. Sans cette protection, une fausse manœuvre rendrait la plateforme inadministrable. Notre audit repose sur un intercepteur global. Il journalise chaque modification effectuée sur un contrôleur annoté, en capturant l'auteur, l'action, le module, l'entité, l'adresse réseau réelle et le statut de l'opération. Cent cinquante et une routes sur deux cent soixante-huit sont ainsi couvertes.

Deux propriétés en font une preuve exploitable. L'intercepteur n'interrompt jamais la requête métier : un échec d'écriture du journal ne fait donc pas échouer l'acte de soin. Et seul cet intercepteur écrit dans le journal, aucune route n'y donnant accès : on ne peut donc pas falsifier l'audit depuis l'interface.

## 7.3 Modèle de classes

Le modèle complet comporte 88 entités reliées par 97 associations. Une planche représentant l'ensemble serait illisible imprimée au format A4. Nous retenons donc 29 classes au diagramme. Deux critères ont guidé cette sélection : un degré de connexion supérieur ou égal à deux dans les domaines clinique, acteurs et référentiels, plus deux exceptions justifiées par leur poids métier, les constantes vitales et la matrice des droits par catégorie. Nous devons énoncer ce critère, sans quoi la sélection paraîtrait arbitraire.

Les 59 entités écartées se répartissent ainsi : 13 pour la sécurité et l'audit, 11 autour du dossier patient, 8 pour la synchronisation, 7 pour la messagerie, 7 pour le personnel, 7 pour les suivis de soin et 6 référentiels secondaires. La plupart sont des fonctions techniques ou transverses. Les autres ajoutent du détail à une entité déjà présente sur la planche, sans en changer la structure. Elles ne disparaissent pas du mémoire pour autant : le tableau 8.2, au chapitre suivant, donne la répartition complète des 88 tables par domaine fonctionnel, avec le nombre de champs de chacun.

Les 29 classes retenues se répartissent selon les mêmes packages que les cas d'utilisation. Cette correspondance n'est pas décorative : elle permet de vérifier qu'à chaque groupe de fonctions correspond bien un groupe de données.

**Tableau 7.4 — Répartition des 29 classes retenues par package**

| Package | Classes retenues | Nombre |
|---|---|---|
| Sécurité et habilitations | Utilisateur, UtilisateurRole, Role, RolePermission, Permission | 5 |
| Référentiels et acteurs médicaux | Site, CategoriePatient, DroitCategoriePatient, PathologieReference, MedicamentReference, TypeExamen, PersonnelMedical, DelegationPrescription | 8 |
| Dossier patient | Patient, IdentitePatient, EmployeSaris, RattachementAyantDroitCdi, RattachementSousTraitant | 5 |
| Parcours de soin | Visite, ConstanteVitale, Consultation, DiagnosticConsultation, Ordonnance, LigneOrdonnance, BonExamen, LigneExamen, BonPharmacie, LigneBonPharmacie, Evacuation | 11 |
| Fonctions transverses | aucune classe retenue | 0 |

Le package Fonctions transverses ne retient aucune classe, et ce fait mérite d'être expliqué plutôt que constaté. La messagerie, les notifications, le pilotage et la synchronisation reposent sur des entités bien réelles — elles font partie des 59 écartées — mais aucune ne participe au modèle du domaine médical. Les faire figurer aurait chargé la planche sans rien apprendre sur le métier du centre.

Les quatre diagrammes suivants représentent chaque package, et le cinquième réunit l'ensemble. Nous allons du détail vers la vue générale. Cette progression du détail vers la vue générale permet de lire le modèle par domaine avant de le lire en entier.

> 🖼️ **Figure 7.1 — Diagramme de classes du package Sécurité et habilitations**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 7.2 — Diagramme de classes du package Référentiels et acteurs médicaux**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 7.3 — Diagramme de classes du package Dossier patient**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 7.4 — Diagramme de classes du package Parcours de soin**
> *Emplacement d'image réservé dans le document.*

> 🖼️ **Figure 7.5 — Diagramme de classes du système**
> *Emplacement d'image réservé dans le document.*

**Tableau 7.5 — Les six entités les plus connectées du modèle**

| Rang | Entité | Degré | Lecture |
|---|---|---|---|
| 1 | Patient | 18 | Pivot du modèle : identité, contacts, allergies, antécédents, alertes, rattachements, visites, suivis |
| 2 | Consultation | 13 | Pivot du parcours de soin : diagnostics, ordonnances, bons, certificats, évacuation, suivi |
| 3 | Utilisateur | 11 | Pivot de la sécurité : rôles, dérogations, sessions, second facteur, préférences, journaux |
| 4 | Personnel médical | 8 | Lien entre le compte applicatif et la personne soignante |
| 5 | Visite | 6 | Unité de travail du triage |
| 6 | Ordonnance | 6 | Charnière entre la prescription et les bons de prise en charge |

Cette hiérarchie se mesure au nombre d'associations. Le modèle s'organise autour de trois pivots : la personne soignée, l'acte de soin, et l'agent qui le réalise. Trois choix de modélisation méritent d'être explicités. Le dossier patient est éclaté en entités satellites — identité, contacts d'urgence, données d'emploi, mode de vie — plutôt que réuni dans une table unique. Cela permet d'appliquer des droits différents à la partie administrative et à la partie médicale.

Les documents cliniques sont rattachés à la consultation, et non au patient. Aucun document ne peut donc exister sans acte de soin qui le justifie. Les rattachements sont enfin historisés. Un lien qui change ne s'écrase pas : il se termine, et un nouveau commence. C'est indispensable pour justifier a posteriori qu'un bon avait bien été émis à une date où le patient y avait droit.

Neuf entités possèdent un cycle de vie contraint. Les recenser est indispensable, car ce sont ces contraintes qui empêchent le système d'entrer dans un état incohérent.

**Tableau 7.6 — Les neuf machines à états du système**

| Entité | États | Transition notable |
|---|---|---|
| Visite | En attente, en cours, clôturée, annulée | La clôture est posée par la consultation, jamais depuis le triage |
| Consultation | Ouverte, clôturée, annulée | Une seule consultation ouverte par soignant et par visite |
| Ordonnance | Brouillon, validée, annulée | Modifiable uniquement à l'état brouillon |
| Bon de pharmacie | En attente, délivré, annulé | Un bon délivré ne peut plus être annulé |
| Bon d'examen | En attente, validé, reçu, annulé | La saisie du résultat exige un bon validé |
| Évacuation | En cours, en transport, admis, clôturé, annulé | L'annulation exige l'état en cours |
| Suivi de traitement | En cours, clôturé, annulé | Les fiches datées bouclent sur l'état en cours |
| Dossier patient | Actif, archivé, décédé, fusionné | Une visite exige un dossier actif |
| Compte utilisateur | Actif, désactivé, bloqué | Le blocage est posé automatiquement après échecs répétés |

Trois observations en découlent. Les états terminaux sont irréversibles. Une consultation clôturée, un bon délivré, une évacuation close ne reviennent jamais en arrière. Un acte clinique enregistré ne se défait pas : il s'annule avec un motif. Le motif d'annulation est d'ailleurs systématiquement obligatoire. Une annulation sans justification constitue une perte d'information.

Quatre machines sur neuf seulement sont enfin garanties par la base de données. Les cinq autres reposent sur de simples champs texte, contraints par le code applicatif : une écriture directe en base pourrait y poser une valeur invalide. C'est une faiblesse réelle, née d'un compromis de portabilité entre les deux moteurs. Elle est sans conséquence tant que toutes les écritures passent par l'application, mais elle est signalée ici plutôt que passée sous silence. Quarante-sept entités sur 88 portent enfin une marque de suppression. Une suppression n'efface jamais : elle horodate.

Ce choix découle directement du fonctionnement hors connexion. Si un dossier supprimé disparaissait de la base centrale, les postes hors ligne qui le détiennent encore n'auraient aucun moyen d'apprendre sa disparition. Ils le réintroduiraient à la synchronisation suivante. La marque de suppression est précisément la donnée qui permet de propager un effacement.

Le processus central du système reste le parcours de soin, décrit au chapitre 5 dans sa version antérieure au projet. Le système le reprend à l'identique, aux contrôles automatiques près. Ces contrôles sont au nombre de trois : vérifier que le patient est actif et qu'aucune visite n'est déjà ouverte, contrôler le droit de prescrire avant toute ordonnance, et contrôler l'éligibilité de la catégorie au moment d'émettre un bon.

Deux cas illustrent particulièrement cette chaîne. L'émission d'un bon de pharmacie fait apparaître les deux étages de contrôle. La garde de permission valide que l'agent a le droit d'émettre un bon. Puis le service interroge la matrice des droits pour déterminer si ce patient précis y ouvre droit. La synchronisation d'un poste local est le seul cas dont l'acteur est un système, et le seul à comporter une résolution de conflit.

## 7.4 Le moteur de synchronisation

Le système comporte deux mécanismes hors connexion de conception différente. Les confondre serait une erreur d'analyse.

**Tableau 7.7 — Comparaison des deux mécanismes hors connexion**

| Critère | Application web | Poste autonome |
|---|---|---|
| Stockage local | Base du navigateur | Base locale, atteinte via le serveur embarqué |
| Lectures hors connexion | Cache local, réseau interrogé en premier | Véritables requêtes sur la base locale |
| Écritures hors connexion | File de mutations mises en attente | Écriture directe en base |
| Réconciliation | Rejeu des requêtes dans l'ordre | Échange de deltas et dernière écriture gagnante |
| Autonomie | Partielle, dépendante du cache | Complète, le poste étant lui-même un serveur |

Le rejeu de requêtes mérite d'être expliqué, car son élégance tient à ce qu'il évite. Hors connexion, chaque écriture est enregistrée telle quelle : méthode, chemin, contenu. Au retour du réseau, ces requêtes sont rejouées vers les routes réelles. La conséquence est décisive. Toute la validation, toutes les permissions et toute la logique métier du serveur sont réutilisées. Il n'existe aucun moteur d'application parallèle côté client, donc aucun risque de voir les règles diverger entre le mode connecté et le mode hors connexion.

Nous avons retenu la stratégie de la dernière écriture gagnante. Les versions sont comparées sur l'horodatage de modification, et la concurrence est détectée grâce à la version de départ connue du client.

**Tableau 7.8 — Règles de résolution des conflits d'écriture**

| Situation | Décision |
|---|---|
| Aucun enregistrement existant | Appliquer, il s'agit d'une création |
| Entrant plus récent, serveur inchangé depuis la version de départ | Appliquer |
| Entrant plus récent, serveur modifié depuis | Conflit : l'entrant l'emporte, l'incident est journalisé |
| Entrant plus ancien, serveur inchangé | Ignorer |
| Entrant plus ancien, serveur modifié depuis | Conflit : l'existant l'emporte, l'incident est journalisé |
| Horodatages égaux | Ignorer, la réponse est renvoyée sans effet |

Trois propriétés en découlent. Aucun blocage n'est possible. Il n'existe pas de verrou distribué entre des machines dont certaines sont hors ligne. Un conflit est donc tranché puis journalisé pour revue, jamais mis en attente. Une suppression est une modification comme une autre : sa marque porte son propre horodatage. L'horodatage d'origine est enfin restauré après application. Sans cela, le mécanisme automatique de datation invaliderait tout le raisonnement de comparaison. Cinquante-deux entités sur 88 sont synchronisées : quarante-deux en portée globale, trois par site et sept par chemin de relation.

Le point décisif est que le dossier patient et tout le parcours de soin sont en portée globale. Chaque poste détient donc la totalité des dossiers des deux sites. C'est ce qui rend possible la continuité entre Moutela et Nkayi, même hors connexion. Les 36 entités non synchronisées sont locales à leur instance : journaux, notifications, sessions, préférences, paramètres, et tables de la synchronisation elle-même.

Le serveur central expose enfin un flux d'événements serveur (SSE) qui ne transporte aucune donnée. Il signale seulement qu'il y a du neuf, et l'identité de celui qui l'a produit. Les postes abonnés déclenchent alors une synchronisation, qui repasse par les contrôles d'accès habituels. Un canal muet ne peut rien divulguer. Et le poste à l'origine d'une écriture n'est pas réveillé pour son propre travail.

Un battement régulier maintient le canal ouvert, car les équipements réseau intermédiaires coupent les connexions silencieuses au bout d'une minute environ. Ce battement porte un type différent de celui de la notification. Sans cela, les postes se synchroniseraient à chaque battement.

## 7.5 Composants, déploiement et interfaces

L'architecture en composants distingue sept blocs. Le serveur applicatif NestJS expose les 268 routes HTTP et le flux SSE. Il requiert l'accès aux données et le service de géolocalisation. L'interface web React ne fournit rien : elle consomme l'interface distante. Le client de bureau Electron fournit la fenêtre applicative, le coffre de secrets et la mise à jour. Ses deux processus communiquent par un canal IPC restreint. C'est la seule voie ouverte entre l'interface et le poste. Il consomme soit l'interface distante, soit son serveur embarqué. Ce dernier fournit une interface locale restreinte à la boucle locale, et consomme la base SQLite.

Les trois paquets partagés fournissent enfin le schéma Prisma et les migrations, les types TypeScript et le catalogue des permissions, et les composants visuels.

> 🖼️ **Figure 7.6 — Diagramme de composants**
> *Emplacement d'image réservé dans le document.*

Le déploiement distingue quatre nœuds : un serveur d'application exposé en HTTPS, un serveur PostgreSQL hébergé séparément avec liaison chiffrée, des postes clients en mode connecté, et des postes clients en mode autonome embarquant serveur et base SQLite locale. Trois points de sécurité conditionnent ce déploiement. Le serveur embarqué du poste autonome n'écoute que sur la boucle locale. Aucune autre machine du réseau ne peut donc l'interroger. L'adresse du serveur doit être chiffrée en production. Sans cela, jetons d'authentification et données patient transiteraient en clair.

L'origine du client de bureau Electron est enfin un schéma applicatif privilégié, déclaré autorisé côté serveur. C'est indispensable au fonctionnement du flux SSE.

> 🖼️ **Figure 7.7 — Diagramme de déploiement**
> *Emplacement d'image réservé dans le document.*

Les principes d'interface sont formalisés dans une charte graphique et appliqués par un système de composants partagé entre les canaux.

**Tableau 7.9 — Principes d'interface et leur application**

| Principe | Application |
|---|---|
| Adaptation au rôle | Le menu est filtré par permission, item par item. Un groupe dont tous les items sont refusés disparaît au lieu d'afficher des entrées mortes |
| Confidentialité par défaut | Les zones cliniques sensibles sont floutées en permanence et révélées au survol, dispositif neutralisé sur écran tactile |
| Bilinguisme | Français et anglais, bascule en direct, préférence mémorisée par compte |
| Adaptation à l'écran | Menu en tiroir sur mobile, panneaux empilés, tableaux défilants |
| Point de départ adapté au métier | L'infirmier arrive sur la file d'attente, les autres rôles sur le tableau de bord |
| Impression normalisée | Six documents au format A4 partagent deux gabarits communs |

Nous devons signaler une faiblesse sur ce volet. Les permissions qui gouvernent l'affichage du menu et celles qui gardent les routes du serveur sont déclarées à deux endroits distincts. Une divergence produit donc une entrée de menu visible qui mène à un refus. Le code documente lui-même un incident de ce type, corrigé depuis. Mais la double déclaration demeure, et constitue une dette technique.

## Conclusion du chapitre

Notre conception a fait converger les deux branches de 2TUP. Du côté fonctionnel, le modèle du domaine s'organise autour de trois pivots — le patient, la consultation, l'agent — et de 29 classes que nous avons retenues sur 88 selon un critère explicite. Du côté technique, l'architecture répond à la contrainte dominante par une couche métier bi-cible, et par deux mécanismes hors connexion adaptés chacun à son contexte.

Trois décisions structurent l'ensemble. La portée globale du dossier patient rend possible la continuité entre les deux sites. La suppression logique généralisée permet à un effacement de se propager jusqu'aux postes hors ligne. Et le contrôle à deux étages distingue le droit d'agir de l'autorisation d'agir. Le chapitre suivant rend compte de la construction effective de cette conception.
