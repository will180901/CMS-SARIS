<!-- Fichier régénéré depuis Memoire_CMS_SARIS.docx le 28 août 2026. -->
<!-- Miroir exact du document Word. Ne pas modifier ici : le Word fait foi sur le texte. -->

# CONCLUSION GÉNÉRALE

> 0 figure(s) · 0 tableau(x) dans cette partie.

Notre travail est parti d'une question. Comment concevoir un système de gestion des consultations et des dossiers médicaux qui remplisse quatre conditions à la fois ? Tenir un seul dossier par patient sur les deux sites. Appliquer sans erreur les règles de prise en charge. Garder la trace de chaque acte. Et continuer de fonctionner quand le réseau tombe.

Cette question contient une contradiction. Relier deux sites suppose que l'information circule. Fonctionner sans réseau suppose qu'elle puisse ne pas circuler. C'est cette contradiction qui a guidé tout notre travail, et qui explique notre choix de 2TUP. Cette méthode traite le besoin métier et la contrainte technique dans deux branches séparées, qui ne se rejoignent qu'à la conception. Sans cette séparation, l'un des deux aurait été sacrifié à l'autre.

Nous avons produit une plateforme dont l'ampleur se mesure, plutôt qu'elle ne s'affirme. Les chiffres viennent d'un comptage direct dans le code : environ 93 500 lignes réparties sur 547 fichiers, 273 routes d'API, 88 entités de données reliées par 97 associations, 130 permissions réparties sur trois rôles, quinze écrans, 41 migrations de base de données, 52 entités synchronisées hors connexion, six documents imprimables et deux langues d'interface. Les vingt-trois besoins fonctionnels identifiés sont réalisés : vingt-deux pleinement, un partiellement. La problématique reçoit trois réponses.

La première porte sur l'unicité du dossier. Le dossier patient et tout le parcours de soin sont répliqués sur chaque poste. C'est une décision d'architecture assumée : un travailleur reçu à Moutela puis à Nkayi est retrouvé sur n'importe quel poste, sans doublon, y compris hors connexion.

La deuxième porte sur la règle d'éligibilité. Elle ne repose plus sur la mémoire des agents mais sur une table de la base, interrogée à chaque demande de bon. Elle est donc appliquée uniformément, tracée, et modifiable sans redéploiement. La troisième porte sur la continuité de service. Elle repose sur deux mécanismes distincts : une file de mutations rejouées côté web, et une base locale synchronisée par deltas côté poste autonome.

Nous avons mesuré la couverture du besoin, nous ne l'avons pas seulement affirmée. Nous avons confronté un à un les dix-huit besoins recueillis auprès des quatre acteurs à ce que le système réalise. Six sont couverts. Quatre le sont partiellement. Huit relèvent de domaines que le projet a explicitement écartés. Aucun n'est resté sans réponse à l'intérieur du périmètre retenu. Cette dernière valeur est la plus importante : elle établit que le projet n'a pas laissé de trou dans le domaine qu'il s'est donné.

Les apports de notre travail se situent à trois niveaux. Pour le Centre Médico-Sanitaire, le système supprime les ressaisies, consolide les historiques entre les deux sites, et applique uniformément une règle qui reposait auparavant sur la vigilance humaine. Pour notre formation, le projet a exigé de mettre en œuvre une chaîne d'ingénierie complète. La difficulté dominante n'a pas été algorithmique mais architecturale : faire coexister deux modes d'exécution d'un même code.

Pour le domaine enfin, plus modestement, ce travail documente une réponse argumentée à un problème récurrent dans la sous-région : concevoir pour un environnement où la connectivité n'est pas acquise. Nous énonçons ici nos limites, plutôt que de les laisser découvrir ailleurs. La validation est partielle. Cent trois cas de test ont été exécutés le 10 août 2026, et tous ont réussi. Mais quarante-trois cas n'ont pas pu l'être : ils exigent un serveur démarré et une base remplie.

Le cœur clinique n'est pas testé automatiquement. La règle d'éligibilité par catégorie est la plus importante du système, et aucun test ne la couvre. C'est la lacune la plus sérieuse. Le mode autonome n'a pas été éprouvé par une exécution complète sur machine cible, et la synchronisation n'a pas été validée entre deux postes réels. La signature de code n'est pas active. Cinq machines à états ne sont pas garanties par la base de données.

Trois besoins du périmètre ne sont enfin que partiellement satisfaits. C'est le cas des axes statistiques attendus par le Médecin Chef : quatre sur dix restent hors d'atteinte. Le volet contextuel reste lui aussi incomplet, faute d'avoir relevé l'infrastructure réseau et les chiffres d'activité du centre.

Une précision de statut s'impose enfin, et elle n'est pas de pure forme. Le système est déployé en ligne pour les besoins de la démonstration, et des incidents d'exploitation datés attestent de son fonctionnement réel. Mais aucun usage clinique par le personnel du centre n'est établi. Nous disons donc « conçu et développé », jamais « déployé et utilisé ».

Les perspectives se classent selon le rapport entre ce qu'elles apportent et ce qu'elles coûtent. La correction la plus rentable est réalisable avant la soutenance : ajouter les axes de direction et de catégorie socio-professionnelle aux statistiques. Ce sont quatre des dix axes attendus par le Médecin Chef, et les données existent déjà dans le registre des employés. Il s'agit d'ajouter des jointures, pas de modifier le modèle.

À court terme, il faudrait exécuter les cinq suites d'intégration restantes, valider le mode autonome sur machine cible, alléger le triage pour les consultations spécialisées, et relever l'infrastructure réseau du centre. Ce dernier point demanderait un entretien de vingt minutes. À moyen terme, il conviendrait d'étendre la couverture de test au cœur clinique, de mettre en place une intégration continue, d'activer la signature de code, et de migrer les cinq machines à états vers des types contraints par la base.

Trois besoins de priorité haute restent enfin hors du système, et chacun forme un projet en soi : le suivi des coûts d'évacuation, le tableau de bord de l'absentéisme, et la gestion pharmaceutique. Ce dernier mérite une attention particulière. C'est à la fois le besoin le plus criant du recueil et le plus éloigné du périmètre retenu.

Ce travail nous laisse un enseignement que nous n'attendions pas. Les difficultés sérieuses que nous avons rencontrées n'étaient pas des problèmes d'algorithme. C'étaient des écarts entre un système qui fonctionne en développement et un système qui tient en exploitation.

Nous en avons rencontré quatre : deux autorités d'authentification là où nous n'en voyions qu'une, un indicateur de disponibilité détourné de son usage par l'hébergeur, un catalogue de droits resté en retard sur le code, et un canal temps réel coupé par un intermédiaire réseau invisible. Aucune n'était prévisible depuis un schéma. Toutes se sont révélées à l'usage. Chacune a exigé de comprendre non pas notre code, mais l'environnement dans lequel il s'exécutait.

Nous en retenons deux choses. La conception ne s'arrête pas au diagramme. Et la solidité d'un système se juge à ce qu'il fait quand les conditions cessent d'être idéales. Nous en retenons aussi qu'une documentation n'a de valeur que si elle dit ce qui n'a pas été fait.
