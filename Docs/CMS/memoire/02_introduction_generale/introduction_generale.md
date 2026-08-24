<!-- Fichier régénéré depuis Memoire_CMS_SARIS.docx le 28 août 2026. -->
<!-- Miroir exact du document Word. Ne pas modifier ici : le Word fait foi sur le texte. -->

# INTRODUCTION GÉNÉRALE

> 0 figure(s) · 0 tableau(x) dans cette partie.

Dans un centre de santé, l'information circule aussi vite que le soin. Un antécédent oublié. Une allergie non consignée. Un dossier non retrouvé. Chacune de ces ruptures a un coût. Et ce coût ne se mesure pas en heures perdues, mais en risque pour le patient. A cela s’ajoute une contrainte propre à notre contexte national : la valeur d’un outil informatique réside également dans sa capacité à rester fonctionnel en cas d’interruption de la connexion internet.

SARIS-CONGO est une entreprise sucrière implantée dans le département de la Bouenza. Son Centre Médico-Sanitaire assure les soins de premier recours sur deux sites distants, Moutela et Nkayi. Il prend en charge plusieurs agents, leurs ayants droit et les habitants du voisinage. Neuf statuts de patients y sont reconnus, chacun ouvrant des droits différents. Tous bénéficient de l’accès à la consultation. En revanche, seuls les employés en contrat à durée indéterminée et leurs ayants droit bénéficient d’une prise en charge des médicaments et des examens.

Avant ce projet, la gestion reposait entièrement sur le papier et le tableur. Les entretiens de terrain ont établi trois constats. D'abord, aucun système ne reliait les deux sites. La consolidation était faite à la main par le Médecin Chef. Ensuite, la règle de prise en charge reposait sur un contrôle visuel du badge, donc sur la seule vigilance de l'agent. Enfin, les deux outils informatiques en usage avaient échoué : ils perdaient leurs données à chaque fermeture.

Le centre disposait pourtant d'un processus formalisé en quatre étapes. Ce qui manquait n'était donc pas la méthode, mais l'outil pour l'appliquer et en garder trace. Ces constats conduisent à la question centrale de ce travail. Comment concevoir et réaliser un système de gestion des consultations et des dossiers médicaux qui remplisse quatre conditions à la fois ? Tenir un seul dossier par patient sur les deux sites. Appliquer sans erreur les règles de prise en charge par catégorie. Garder la trace de chaque acte. Et continuer de fonctionner sans connexion réseau.

Notre objectif général est de concevoir et de réaliser ce système. Il doit couvrir tout le parcours de soin, de l'accueil du patient à la production de ses documents. Cinq objectifs spécifiques en découlent : analyser les processus métier du centre ; formaliser les besoins fonctionnels et non fonctionnels ; concevoir l'architecture selon la méthode 2TUP et le langage UML ; implémenter le système sur ses trois canaux de diffusion ; garantir la sécurité et la traçabilité des données de santé.

Nous avons retenu le Processus Unifié, dans sa déclinaison 2TUP, outillée par UML. Le volet métier s'appuie sur quatre entretiens semi-directifs. Ils ont été conduits lors du stage effectué à la SARIS par Nzila Oscarvie Verdi, du 15 janvier au 14 avril 2026. Ces entretiens ont recensé dix-huit besoins, couvrant trois métiers distincts : le soin, la logistique pharmaceutique et l'administration du personnel. Nous ne retenons que le parcours de soin, augmenté des fonctions transverses nécessaires à son exploitation. Nous avons organisé ce mémoire en deux parties.

La Partie I, « Cadre contextuel et domaine d'étude », comprend trois chapitres : la structure d'accueil, sa situation informatique, puis le domaine d'étude et le périmètre retenu. La Partie II, « Analyse, conception et implémentation selon 2TUP/UML », en comprend cinq : la méthodologie, l'étude de l'existant, l'analyse des besoins, la conception et l'implémentation.
