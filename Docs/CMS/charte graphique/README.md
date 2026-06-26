# Charte graphique — CMS SARIS Congo

Ce dossier contient la **charte graphique** du projet CMS SARIS, c'est-à-dire la
spécification visuelle de référence du *design system* de l'application. Elle
décrit, module par module, l'ensemble des décisions de conception : palette de
couleurs et jetons (*tokens*), typographie, espacements, effets de surface,
composants, navigation, présentation des données, retours utilisateur,
animations, iconographie, états et accessibilité, ainsi que les règles absolues à
respecter.

Chaque page est un **document HTML interactif et autonome** : il suffit de
l'ouvrir dans un navigateur (double-clic sur le fichier ou glisser-déposer dans
une fenêtre du navigateur) pour visualiser les couleurs, les composants et les
démonstrations en situation réelle, en mode clair comme en mode sombre. Aucun
serveur n'est nécessaire.

## Sommaire des fichiers

| Fichier | Sujet couvert |
| --- | --- |
| [`CG-01_Couleurs_et_Tokens.html`](CG-01_Couleurs_et_Tokens.html) | **Couleurs & Tokens** — palette de marque extraite du logo SARIS Congo, spectres complets des accents (Bleu ardoise primaire, Or Congo secondaire), échelle de gris froids bleutés, couleurs sémantiques (succès, erreur, avertissement, info), jetons contextuels (variables CSS prêtes à l'emploi) et règles d'usage par contexte. |
| [`CG-02_Typographie.html`](CG-02_Typographie.html) | **Typographie** — police Inter, échelle typographique à 11 niveaux, graisses et interlignages, hiérarchie par couleur, démonstrations de hiérarchie visuelle, combinaisons typographiques par contexte d'usage et règles absolues. |
| [`CG-03_Espacements_et_Grilles.html`](CG-03_Espacements_et_Grilles.html) | **Espacements & Grilles** — échelle d'espacement sur unité de base 4 px, jetons CSS d'espacement, zones de layout de l'écran, grille de contenu à 12 colonnes et gouttières, densité/padding des composants et arrondis (*border-radius* discrets). |
| [`CG-04_Effets_de_Surface.html`](CG-04_Effets_de_Surface.html) | **Effets de surface** — texture de grain (SVG noise), glassmorphisme (surfaces translucides), système d'ombres et d'élévation (axe Z), usage restreint des dégradés (réservés aux graphiques en courbes) et interdictions. |
| [`CG-05_Composants_Fondamentaux.html`](CG-05_Composants_Fondamentaux.html) | **Composants fondamentaux** — boutons (variants, tailles, états, icône seule), formulaires (champs, zones de texte, contrôles de sélection), badges et tags, avatars, séparateurs et tooltips, avec leurs obligations et interdictions. |
| [`CG-06_Navigation_et_Structure.html`](CG-06_Navigation_et_Structure.html) | **Navigation & structure** — sidebar et topbar (scène applicative complète), fil d'Ariane, onglets, pagination, menus contextuels et *dropdowns*, avec les jetons de position et les règles associées. |
| [`CG-07_Donnees_et_Contenu.html`](CG-07_Donnees_et_Contenu.html) | **Données & contenu** — tableaux de données, cartes (KPI, contenu, patient), listes groupées, accordéons et les 5 types de graphiques exclusifs au CMS SARIS Congo. |
| [`CG-08_Feedback_et_Communication.html`](CG-08_Feedback_et_Communication.html) | **Feedback & communication** — toasts (notifications éphémères), modales (panneaux de focus), drawers (panneaux latéraux), alertes inline, skeletons (placeholders de chargement) et spinners (indicateurs d'activité). |
| [`CG-09_Animations_et_Transitions.html`](CG-09_Animations_et_Transitions.html) | **Animations & transitions** — courbes d'accélération, paliers de durée, micro-interactions, transitions de composants, règles absolues d'animation et tableau de référence complet. |
| [`CG-10_Iconographie_et_Assets.html`](CG-10_Iconographie_et_Assets.html) | **Iconographie & assets** — système de tailles d'icônes, catalogue par domaine, couleurs autorisées, icônes en contexte, variantes officielles du logo SARIS Congo et interdictions absolues. |
| [`CG-11_Etats_et_Accessibilite.html`](CG-11_Etats_et_Accessibilite.html) | **États & accessibilité** — états des composants, focus clavier (navigation sans souris), contraste et lisibilité (WCAG 2.1 AA), ARIA et sémantique HTML, états vides et messages d'erreur, avec obligations et interdictions. |
| [`CG-12_Recapitulatif_et_Regles.html`](CG-12_Recapitulatif_et_Regles.html) | **Récapitulatif & règles absolues** — index des 12 modules, jetons et échelle typographique de référence rapide, les 36 règles absolues par module et le tableau de bord visuel de la charte (v1.0). |

## Lien avec le code

Ces principes ne restent pas théoriques : ils sont **implémentés dans
l'application** via le design system SARIS. Les composants réutilisables se
trouvent sous
`CMS/APP/CMS-SARIS/apps/web/src/components/saris/` (boutons, cartes, champs,
tableaux de données, avatars, graphiques, etc.), et les jetons visuels (couleurs,
espacements, arrondis) sont appliqués à travers des **variables CSS**
(`var(--couleur-accent)`, `var(--fond-surface)`, `var(--texte-primaire)`,
`var(--radius-md)`…) référencées dans toute l'interface.

La charte graphique fait donc office de **source de vérité visuelle** : toute
évolution de l'interface doit s'y conformer, et toute modification durable de
l'identité visuelle devrait être répercutée à la fois dans ces fichiers et dans
le code du design system.
