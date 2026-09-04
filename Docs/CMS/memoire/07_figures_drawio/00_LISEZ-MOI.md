# Figures du mémoire — fichiers draw.io

> ## 📘 `FIG_00_TOUTES_LES_FIGURES.drawio` — **le seul fichier de figures**
>
> **Vingt-deux onglets**, un par figure, dans l'ordre du mémoire. C'est la source unique : les vingt fichiers individuels ont été supprimés le 4 septembre 2026 pour qu'il n'existe **aucune seconde source susceptible de diverger**.
>
> Les vingt figures dessinées y ont été reprises **à l'identique** — mêmes formes, mêmes liens, mêmes dimensions de page, vérifié onglet par onglet avant la suppression. Les deux derniers onglets, 8.1 et 8.2, portent le **contenu textuel** des figures qui ne se dessinent pas : ils servent à l'archive, pas à l'export.
>
> **Toute modification se fait dans ce fichier.** draw.io exporte la page affichée : l'export des images s'y fait onglet par onglet.


> **Ce dossier contient les figures elles-mêmes.** Les fiches qui décrivent ce que chaque figure doit montrer restent dans `05_fiches_de_dessin/`.

---

## 1. Ce qui est prêt

| Figure | Fichier | Canevas | Lisibilité |
|---|---|---|---|
| **1.1** Organigramme du Service Médico-Social | `FIG_1-1_organigramme.drawio` | 770 × 1170 | 8,5 pt |
| **4.1** Cycle de développement selon 2TUP | `FIG_4-1_cycle_2TUP.drawio` | 770 × 730 | 8,5 pt |
| **5.1** Activité — triage et recueil clinique | `FIG_5-1_activite_triage.drawio` | 770 × 1150 | 8,5 pt |
| **5.2** Activité — consultation, décision, clôture | `FIG_5-2_activite_consultation.drawio` | 770 × 1150 | 8,5 pt |
| **6.1** Diagramme de contexte statique | `FIG_6-1_contexte_statique.drawio` | 770 × 1120 | 8,5 pt |
| **6.2** Cas d'utilisation — Sécurité et habilitations | `FIG_6-2_uc_securite.drawio` | 770 × 740 | 8,5 pt |
| **6.3** Cas d'utilisation — Référentiels et acteurs médicaux | `FIG_6-3_uc_referentiels.drawio` | 770 × 850 | 8,5 pt |
| **6.4** Cas d'utilisation — Dossier patient | `FIG_6-4_uc_dossier_patient.drawio` | 770 × 895 | 8,5 pt |
| **6.5** Cas d'utilisation — Parcours de soin | `FIG_6-5_uc_parcours_de_soin.drawio` | 770 × 945 | 8,5 pt |
| **6.6** Cas d'utilisation — Fonctions transverses | `FIG_6-6_uc_fonctions_transverses.drawio` | 770 × 760 | 8,5 pt |
| **6.7** Séquence système — émettre un bon de pharmacie | `FIG_6-7_sequence_bon_pharmacie.drawio` | 770 × 1170 | 8,5 pt |
| **6.8** Séquence système — synchroniser un poste local | `FIG_6-8_sequence_synchronisation.drawio` | 770 × 1170 | 8,5 pt |
| **7.1** Classes — Sécurité et habilitations | `FIG_7-1_classes_securite.drawio` | 770 × 1120 | 8,5 pt |
| **7.2** Classes — Référentiels et acteurs médicaux | `FIG_7-2_classes_referentiels.drawio` | 770 × 1120 | 8,5 pt |
| **7.3** Classes — Dossier patient | `FIG_7-3_classes_dossier_patient.drawio` | 770 × 1150 | 8,5 pt |
| **7.4a** Classes — Parcours de soin : visite et consultation | `FIG_7-4a_classes_visite_consultation.drawio` | 770 × 1170 | 8,5 pt |
| **7.4b** Classes — Parcours de soin : prescription et bons | `FIG_7-4b_classes_prescription_bons.drawio` | 770 × 1170 | 8,5 pt |
| **7.5** Classes — diagramme du système | `FIG_7-5_classes_systeme.drawio` | 770 × 1170 | 8,8 pt |
| **7.6** Diagramme de composants | `FIG_7-6_composants.drawio` | 770 × 990 | **11,2 pt** |
| **7.7** Diagramme de déploiement | `FIG_7-7_deploiement.drawio` | 770 × 1160 | 8,6 pt |

**Les vingt-deux figures sont faites.** Les vingt figures dessinées sont dans ce dossier. Les deux figures textuelles — schéma relationnel 8.1 et modèle physique 8.2 — sont dans `07_figures_texte/`, prêtes à composer dans Word.

Restent les trois captures d'écran 8.3, 8.4 et 8.5, qui se prennent sur l'application.

Les trois captures d'écran — 8.3, 8.4, 8.5 — ne se dessinent pas : elles se prennent sur l'application.

Les trois captures d'écran — 8.3, 8.4, 8.5 — ne se dessinent pas : elles se prennent sur l'application.

---

## 2. La règle de lisibilité

Elle commande toute la production, et elle vient d'une mesure sur le document réel.

La place utile pour une image dans le mémoire est de **16,5 × 25,1 cm**, soit 468 × 711 points typographiques. Une figure y est réduite, et sa police avec elle :

> **police sur papier = 468 × police à l'écran ÷ largeur du canevas**

Le seuil de lisibilité à l'impression est de **8 points**. En dessous de 7, un jury ne lit rien.

> ⚠️ **La police 14 n'est pas une obligation, c'est un plancher.** La formule se lit dans les deux sens : à largeur de canevas constante, **augmenter la police à l'écran augmente la police sur papier dans la même proportion**. Une planche dont les libellés sont courts — composants, déploiement, packages — peut être écrite en 18 et passer de 8,5 à **11,2 pt sur le papier**. La seule contrainte est que le texte tienne encore dans les boîtes. Voir la décision **D-69**.

| Police à l'écran | Police sur papier (canevas 770) |
|---:|---:|
| 14 | 8,5 pt |
| 16 | 9,7 pt |
| **18** | **10,9 pt** |
| 20 | 12,2 pt |

D'où le gabarit imposé :

| Contrainte | Valeur |
|---|---|
| Largeur du canevas | **770 points au maximum** |
| Hauteur du canevas | **1 170 points au maximum** |
| Police | **14 au minimum** |
| Marge intérieure des formes | 6 points |
| Boîtes côte à côte | **jamais plus de trois** |

Résultat : **8,5 pt sur papier**, quelle que soit la figure.

> ⚠️ **Agrandir la police ne donne aucune place.** Quelle que soit la taille choisie, il tient toujours **106 caractères sur la largeur de la page**. La seule marge de manœuvre est verticale, et le nombre de boîtes par rangée.

---

## 3. `palettes/`

`PALETTE_v3.drawio` réunit **une forme de chaque famille** utilisée dans le mémoire, en six blocs : cas d'utilisation, classes, composants et déploiement, séquence, activité, et les formes hors UML — organigramme et table relationnelle.

Elle a servi à valider le vocabulaire graphique avant de produire quoi que ce soit. **À garder** : si une forme doit changer d'aspect, c'est là qu'on en décide, une fois pour toutes.

---

## 4. Comment exporter une figure pour Word

1. Ouvrir `FIG_00_TOUTES_LES_FIGURES.drawio` dans **draw.io Desktop** et choisir l'onglet de la figure.
2. Vérifier le contenu — c'est toi qui connais le système.
3. Ajuster si besoin : déplacer une forme, changer une couleur.
4. **Fichier → Exporter en tant que → PNG**, **échelle 3**, fond **non** transparent.
5. Coller le PNG dans Word, **au-dessus de sa légende**.

---

## 5. Deux règles de travail à ne pas oublier

**Ferme le fichier dans draw.io avant qu'une nouvelle version ne soit écrite.** Draw.io ne relit pas le disque : il réenregistre ce qu'il a en mémoire et écrase le fichier neuf. C'est arrivé deux fois.

**Chaque nouvelle version porte un nom neuf** tant qu'elle n'est pas validée. Une fois validée, elle prend le nom définitif.

---

## 6. Ce que je vérifie avant de livrer une figure

| Contrôle | Comment |
|---|---|
| XML valide, identifiants uniques | lecture du fichier |
| Aucun lien qui pointe dans le vide | comparaison source et destination à la liste des formes |
| Aucune forme hors page | comparaison aux dimensions du canevas |
| Aucun chevauchement entre formes | calcul des rectangles englobants |
| **Aucun trait ne traverse un encadré** | reconstitution du trajet de chaque lien, segment par segment |
| Écart minimal entre formes | mesure, cible : 20 points |
| **Police sur papier ≥ 8 pt** | calcul, refus en dessous |
| Conformité à la fiche de dessin | chaque élément et chaque lien confrontés au tableau de la fiche |
| **Aperçu visuel** | rendu de la figure en image, que je regarde avant de livrer |
| **Étendue réelle du dessin** | ce n'est pas la page déclarée qui compte, mais le rectangle qui englobe vraiment toutes les formes. C'est lui qui décide de la police sur papier |
| **Relecture du fichier après coup** | à la livraison, et **de nouveau chaque fois qu'une capture d'écran m'est envoyée** : le fichier a pu bouger entre-temps |

---

## 7. La règle de propreté du tracé

Le défaut le plus visible sur une figure n'est pas la taille : c'est **un trait qui passe au travers d'une boîte**. Le lecteur croit alors à un lien qui n'existe pas.

Trois règles en découlent, appliquées à toutes les figures :

1. **Une gouttière réservée.** Quand plusieurs traits partent d'une même boîte vers une colonne d'autres boîtes, ils descendent tous dans un couloir vertical vide, puis rejoignent chaque destinataire par un court trait horizontal. C'est le tracé « en peigne ».
2. **Rien dans la gouttière.** Aucune forme ne se pose dans ce couloir, ni à moins de 10 points de lui.
3. **Les commentaires sur le côté.** Encadrés d'attributions, notes et légendes se placent dans une colonne qui leur est propre, jamais entre un parent et ses enfants.

---

## 8. Deux règles propres aux diagrammes de cas d'utilisation

**Un point d'ancrage sur un ovale se calcule sur le contour, pas sur le rectangle.** draw.io exprime les ancrages en fraction du rectangle englobant. Sur une ellipse, la fraction (1 ; 0,67) tombe **à côté** de l'ovale, et la flèche s'arrête dans le vide. Le point du contour à l'angle θ vaut (0,5 + 0,5·cos θ ; 0,5 + 0,5·sin θ), et il faut ajouter `entryPerimeter=0` pour que draw.io respecte le point donné.

**L'héritage entre acteurs ne se trace que s'il est vrai.** Une généralisation `Administrateur ▷ Médecin Chef` affirme que l'administrateur fait *tout* ce que fait le médecin chef. Ce fait se vérifie cas par cas sur les tableaux 6.6 à 6.10 avant d'être dessiné. Le relevé est dans la décision **D-40** du registre : l'héritage complet vaut sur les figures 6.2, 6.4 et 6.6, il ne vaut pas sur la 6.3, et il se réduit à `Médecin Chef ▷ Infirmier` sur la 6.5.

Quand il est vrai, il vaut la peine : sur la figure 6.2 il fait passer la planche de **onze traits qui se croisent à six traits qui ne se croisent pas**.

**Un ovale ne réunit que des cas ayant exactement les mêmes acteurs.** Sinon la planche affirme un faux droit. Le relevé et les six scissions qu'il a imposées sont dans la décision **D-41**.

---

## 9. Le placement des acteurs, planche par planche

Trois dispositions, choisies selon le nombre de traits, jamais par goût.

| Situation | Disposition |
|---|---|
| Les ensembles de cas sont emboîtés | **Héritage** : acteurs empilés à gauche, le plus général en haut, deux ou trois traits par acteur |
| Pas d'héritage possible, trois acteurs | **Acteurs des deux côtés** : les soignants à gauche, l'Administrateur système à droite. Les traits de droite ne croisent jamais ceux de gauche |
| Un acteur système s'ajoute | Il se place **seul, du côté opposé** aux acteurs humains |

Les étiquettes des acteurs se posent **à côté de la silhouette, pas dessous** — `labelPosition=left` à gauche, `labelPosition=right` à droite. Sous la silhouette, elles occupent la colonne où passent les traits.

---

## 10. Le contrôle de conformité au mémoire

Chaque planche de cas d'utilisation est **relue par un programme** qui ne fait confiance à aucune intention. Il ouvre le `.drawio` livré, il ouvre le `Memoire_CMS_SARIS.docx`, et il confronte les deux.

Ce que le contrôle reconstruit à partir du fichier seul :

| Ce qu'il lit | Ce qu'il en fait |
|---|---|
| Les silhouettes d'acteur | la liste des acteurs présents |
| Les ellipses | la liste des ovales |
| Les traits acteur → ovale | les associations **directes** |
| Les flèches acteur → acteur | la chaîne d'héritage |
| Les flèches «extend» et «include» | la propagation des acteurs du cas de base |

Il applique ensuite les deux règles UML — *un acteur enfant fait tout ce que fait son parent* et *un cas qui étend ou qui est inclus reprend les acteurs du cas de base* — puis compare l'ensemble obtenu à la colonne « Acteurs » du tableau du Word, **ovale par ovale**.

Il refuse la planche si un cas du package manque, si un ovale n'a pas de correspondance déclarée, si un cas est couvert deux fois, ou si un regroupement réunit des acteurs différents.

**Un second contrôle porte sur les relations.** Il extrait du Word toutes les relations des tableaux 6.11 et 6.12 qui touchent le package, puis vérifie pour chaque flèche que le cas source appartient à l'ovale de départ, le cas cible à l'ovale d'arrivée, et que le couple existe bien au Word. Il signale toute relation traçable qui aurait été oubliée, et compte celles qui ont un bout hors du package — celles-là se mentionnent en note, elles ne se dessinent pas.

Pour que ce contrôle soit possible, **chaque flèche porte le couple de cas exact sur son étiquette** : `«extend» UC50→UC48`, jamais le seul stéréotype. C'est aussi ce qui lève l'ambiguïté pour le lecteur quand la flèche touche un ovale qui regroupe plusieurs cas.

**Un troisième contrôle lit le texte des figures.** Il vérifie que **chaque libellé porté par une figure se retrouve dans le Word**. Ce qui n'y est pas doit tomber dans l'une de trois catégories, et une seule : un nom de groupe déclaré en note, un nom d'action propre au diagramme, ou un repère de lecture — légende, marqueur, flèche de continuation. Tout le reste est un écart à instruire.

C'est ce contrôle qui a trouvé, le 30 août, que **« CMS SARIS » n'existait pas dans le mémoire** et qu'une figure portait encore un marqueur de travail non résolu. Le détail est aux décisions **D-43** et **D-44**.

**Toute planche livrée porte la mention `CONFORME AU WORD` obtenue par ces trois contrôles.**

### Ce que le contrôle ne peut pas vérifier

Il vérifie les acteurs et la couverture. Il **ne vérifie pas les libellés des regroupements**, qui sont composés et n'existent pas tels quels dans le mémoire.

D'où la règle qui gouverne les cinq planches : **on ne regroupe que si la planche ne tient pas autrement.**

| Figure | Cas | Représentation |
|---|---:|---|
| 6.2 | 16 | regroupée — seize ovales ne tiennent pas au gabarit |
| 6.3 | 8 | **un ovale par cas**, libellés exacts du tableau 6.7 |
| 6.4 | 9 | un ovale par cas, libellés exacts du tableau 6.8 |
| 6.5 | 20 | regroupée |
| 6.6 | 12 | regroupée |

Sur les planches regroupées, la note porte **la liste des cas couverts par chaque ovale**, pour que la correspondance avec le tableau reste vérifiable par le lecteur.

---

## 11. Le diagramme de séquence : ce qu'il a fallu adapter

**Les messages ne relient pas des formes.** Une flèche de séquence part d'une abscisse et arrive à une autre, à une ordonnée donnée. Elle se construit donc avec des `sourcePoint` et `targetPoint` fixes, sans `source` ni `target`. Conséquence : **le contrôle « aucun trait ne traverse un encadré » ne s'applique pas à ces flèches**, puisqu'il a besoin de deux formes pour reconstituer un trajet. C'est une limite connue et assumée, pas un oubli.

**Deux formes se superposent par nature**, et le contrôle de chevauchement a dû l'apprendre :

| Forme | Ce que le contrôle teste désormais |
|---|---|
| Ligne de vie | **sa tête seulement** — le reste n'est qu'un trait pointillé, que tout peut croiser |
| Cadre `alt` | **rien** — un cadre est fait pour englober des messages et des lignes de vie |

Vérification faite : cette adaptation ne masque aucun chevauchement sur les dix figures antérieures, toutes repassées au contrôle.

**Les gardes se placent à droite.** `[ catégorie couverte ]` et `[ catégorie non couverte ]` sont posées à droite de la ligne de vie du système, non au coin supérieur gauche du cadre comme le veut l'usage. Motif : au coin gauche, elles tomberaient sur les bandes d'activation, qui sont pleines, et le texte deviendrait illisible.

**Une étiquette d'arête ne revient pas à la ligne toute seule.** C'est le piège qui a fait déborder la première version de la figure 6.7 hors de la page : le message de refus, long de cent cinquante caractères, s'écrivait sur **une seule ligne** et sortait du canevas par la gauche.

La cause : dans draw.io, le texte porté par l'attribut `value` d'une arête s'affiche d'un seul tenant. Pour qu'il se replie, il faut en faire un **enfant `edgeLabel` doté d'une largeur explicite** dans sa géométrie, avec `whiteSpace=wrap`. Sans largeur, aucun repli.

Deux conséquences appliquées à toutes les figures :

1. Toute étiquette de plus de trente caractères est portée par un enfant à largeur imposée.
2. Ces étiquettes reçoivent un **fond blanc** — `labelBackgroundColor=#FFFFFF` — sinon elles s'écrivent par-dessus les bandes d'activation, qui sont pleines.

> ⚠️ **Et une leçon sur l'aperçu.** Mon rendu de contrôle repliait le texte alors que draw.io ne le fait pas : **il montrait une figure correcte là où le fichier était fautif.** C'est l'auteur qui a vu le débordement en ouvrant le fichier. Le rendu a été corrigé sur trois points — étiquettes à largeur imposée, étiquettes d'arête exclues de la boucle des formes, étiquette lue sur l'enfant et non sur l'arête. Un aperçu qui ment est pire qu'une absence d'aperçu.

---

## 12. La bande d'activation : ce que j'avais faux

**Une bande d'activation n'est pas la durée du diagramme. C'est une période d'exécution.** Elle commence quand l'objet reçoit un message et s'arrête quand il rend la main.

La première version de la figure 6.7 portait **une seule bande courant du haut en bas** sur chaque ligne de vie, et **aucune bande imbriquée** pour les six auto-appels. C'est une faute de langage : elle affirmait que le système reste en exécution pendant toute la scène, y compris quand il attend une action du soignant.

Le vocabulaire juste était déjà dans `palettes/PALETTE_v3.drawio`, bloc 4, validé avant toute production :

| Élément | Valeur de la palette |
|---|---|
| Remplissage de la bande | **blanc**, pas de teinte |
| Largeur | **10 points** |
| Auto-appel | une **bande imbriquée**, décalée de **10 points vers la droite**, de la durée du seul auto-appel |
| Parent | la bande est **enfant de la ligne de vie**, en coordonnées relatives |

**La règle de travail qui en découle.** Avant de produire la première figure d'une famille nouvelle — séquence, classes, composants, déploiement — **relire le bloc correspondant de la palette et confronter la figure produite à ses valeurs**. La palette a été validée pour ça ; ne pas la rouvrir revient à l'avoir faite pour rien.

---

## 13. Ce que la comparaison avec le mémoire de référence a apporté

Deux emprunts, une différence assumée.

**Le cadre d'interaction.** Un diagramme de séquence UML 2 se pose dans un **cadre `sd`** portant le nom de l'interaction — `sd Émettre un bon de pharmacie`. Nos planches n'en avaient pas. C'est ce cadre qui donne au lecteur, d'un coup d'œil, le périmètre de la scène.

**La couleur porte la structure.** Le fragment `alt` est tracé en **rouge**, ses gardes aussi. Les messages et les lignes de vie restent bleus. Le lecteur distingue alors immédiatement *ce qui se passe* de *ce qui conditionne*. Les bandes d'activation reçoivent le fond teinté du thème, pour qu'on voie qui travaille sans avoir à suivre un filet.

**Ce qu'on ne reprend pas : la troisième ligne de vie.** Le mémoire de référence fait dialoguer l'acteur, le système **et la base de données**. Nos figures 6.7 et 6.8 sont des **diagrammes de séquence *système***, ce que la légende annonce et ce que la fiche impose : le système y est une **boîte noire**, et ses composants internes — dont la base — n'ont pas à y figurer. Ajouter une ligne de vie « BD » contredirait le texte du mémoire. La vue interne existe, mais elle est ailleurs : c'est le diagramme de composants, figure 7.6.

---

## 14. L'auto-appel : un crochet, pas une boîte

C'est le détail qui trahissait nos planches face à celles du mémoire de référence.

**Ce que je faisais** : la flèche d'auto-appel partait de la bande d'activation, faisait un grand rectangle de 36 points de haut, et revenait sur une bande imbriquée posée **à côté** de la bande porteuse. Les deux formes se refermaient l'une sur l'autre : le lecteur voyait **une boîte**, pas un appel à soi-même.

**Ce que fait la référence, et ce qu'on fait maintenant** :

| | |
|---|---|
| Le crochet | **court** — 14 points de haut, 52 de large. Il part de la bande, sort à droite, redescend, et **retombe sur la ligne de vie** avec sa pointe |
| La bande imbriquée | commence **là où la flèche retombe**, et se poursuit **en dessous** pendant toute l'exécution appelée |
| Son décalage | **+5 points**, pour qu'elle **chevauche** la bande porteuse et se lise comme une exécution emboîtée — pas comme une seconde ligne de vie |
| L'étiquette | à droite du crochet, sur fond blanc |

Le contrôle de chevauchement a été précisé en conséquence : **une bande d'activation est faite pour se poser sur une ligne de vie et s'imbriquer sur une autre bande.** Elle est donc exclue du test. Vérification faite : aucune régression sur les onze figures antérieures.

---

## 15. Un nom d'opération sans espace ne peut pas se replier

`résoudreConflitPourChaqueEnregistrement()` fait 41 caractères **sans un seul espace**. Aucun moteur de rendu ne peut le couper : il sort du cadre, quelle que soit la largeur imposée à l'étiquette.

Trois noms de la figure 6.8 dépassaient ainsi. Ils ont été raccourcis en gardant leur sens :

| Avant | Après |
|---|---|
| `résoudreConflitPourChaqueEnregistrement()` | `résoudreConflit(par enregistrement)` |
| `appliquerLeGagnantParDernièreÉcriture()` | `appliquerLeGagnant(dernière écriture)` |
| `mettreÀJourLeCurseurDeSynchronisation()` | `mettreÀJourLeCurseur()` |

Deux d'entre eux gagnent un **espace à l'intérieur des parenthèses**, ce qui rend le repli possible sans rien perdre.

**Un contrôle automatique s'ajoute** : pour chaque étiquette, la largeur de son **mot le plus long** est mesurée et comparée à la largeur imposée. Un seul mot trop large fait refuser la planche.

---

## 16. Les diagrammes de classes

**Vocabulaire relevé sur la palette, bloc 2.** Classe en `swimlane` à disposition empilée, bandeau de titre de **30 points**, une ligne d'attribut par **26 points**, fond blanc pour les compartiments. Chaque ligne d'attribut porte `portConstraint=eastwest`, ce qui permet d'y accrocher une association si besoin.

| Élément | Écriture |
|---|---|
| Identifiant | **souligné** — `<u>id</u> : String` |
| Attribut | `nom : Type`, contrainte entre accolades — `code : String {unique}` |
| Multiplicité d'un attribut | entre crochets — `blocageJusquA : DateTime [0..1]` |
| Clé étrangère | **jamais écrite comme attribut** — elle est portée par l'association |
| Classe d'un autre package | rectangle **à bord pointillé**, **nom seul**, sans attributs |

**Deux règles de contenu, tirées de la fiche.** Une association qui sort du package se trace vers une classe en pointillés — cela montre la frontière sans dupliquer l'information. Et les **multiplicités des liens traversants** ne sont portées que par la planche globale 7.5, jamais par les planches de package.

**Un contrôle s'ajoute** : la largeur de chaque ligne d'attribut est mesurée contre celle de son compartiment. Le style `overflow=hidden` de la palette **coupe** un texte trop long sans prévenir — une planche livrée ainsi perdrait des caractères en silence.

---

## 17. Comparaison avec les mémoires de référence : trois écarts, trois corrections

Les diagrammes de classes des mémoires de référence ont fait apparaître trois manques sur notre première version de la 7.1. Tous les trois sont corrigés, et chacun est **adossé à une source du dossier**, jamais copié.

| Manque | Correction | D'où elle vient |
|---|---|---|
| Nos classes n'avaient que **deux compartiments** | **trois compartiments**, le troisième étant celui des opérations | la fiche `UML-CLS-01` l'écrit trois fois : *« rectangle à trois compartiments : nom, attributs, opérations »* |
| Les associations ne portaient **que les multiplicités** | **le nom du rôle et la multiplicité à chaque extrémité** | le bloc 5 de la fiche donne les deux rôles de chacune des 38 associations |
| Les attributs n'avaient **pas de marqueur de visibilité** | un **tiret** devant chaque attribut privé | la palette l'écrit ainsi : `- telephone : string` |

### Ce que nous ne reprenons pas : les opérations

Les deux mémoires de référence remplissent le troisième compartiment — `ajouter_domaine()`, `modifier()`, `supprimer()`, `créer()`, `lire()`. **Le nôtre reste vide, et c'est un choix, pas un oubli.**

Le motif est celui de la décision **D-02** : *le code fait foi*. Les vingt-neuf classes retenues viennent des modèles de données du dépôt, qui **ne déclarent aucune méthode**. Y inscrire des opérations reviendrait à affirmer que le code contient ce qu'il ne contient pas — exactement ce qu'un jury peut vérifier en trente secondes.

Le compartiment est donc **présent et vide**, ce qui est la notation UML correcte pour un modèle de données, et la **note de chaque planche le dit en toutes lettres**. Un compartiment vide qui s'explique est défendable ; un compartiment rempli d'opérations inventées ne l'est pas.

**Correction du 30 août — deux manquements à la fiche sur la première planche de classes.**

La fiche `UML-CLS-01` le dit quatre fois : *« Chaque classe est un rectangle à **trois compartiments** : nom, attributs, opérations — le compartiment des opérations reste **vide**, le modèle est un modèle de données. »* Ma première version n'en portait que **deux**. Le troisième, avec son filet séparateur, est rétabli.

La fiche donne aussi, au bloc 5, le **nom de rôle de chaque extrémité d'association** — `roles`, `utilisateur`, `permissions`, `role`. Je n'avais porté que les multiplicités. Chaque extrémité porte désormais son rôle **et** sa multiplicité, comme dans les mémoires de référence.

> **Sur les opérations.** Les mémoires de référence remplissent le troisième compartiment de méthodes — `ajouter_X()`, `modifier_X()`, `supprimer_X()`. Nous ne le faisons pas, et c'est un choix documenté, pas un oubli : nos vingt-neuf classes sont des **entités de données**, sans méthode propre. Le compartiment vide est la façon UML de le dire, et la note de chaque planche l'énonce.
