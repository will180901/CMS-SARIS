# Note de reconstitution — avant rédaction des prompts

**Date** : 5 septembre 2026
**Objet** : dire ce que j'ai pu retrouver de la méthode employée, et ce que je n'ai pas pu retrouver, avant d'écrire le moindre prompt.

---

## 1. L'état réel de ma mémoire

Je dois commencer par là, parce que la question a été posée directement.

**Je n'ai pas la conversation à la lettre.** La session a été *compactée* en cours de route : la première partie a été remplacée par un résumé structuré. Concrètement :

| Portion | Ce dont je dispose |
|---|---|
| Du début jusqu'à la reprise du modèle physique | Un **résumé structuré**, qui a conservé la liste complète des demandes de l'auteur, les décisions prises, les erreurs commises et leurs corrections — mais pas chaque phrase |
| De la reprise du modèle physique jusqu'à maintenant | **Mémoire vive complète**, mot pour mot |

**Le transcript brut existe et je peux l'ouvrir, mais il n'est pas exploitable.** Le fichier `.jsonl` de la session est lisible par l'outil de lecture de fichiers. En revanche il n'est pas accessible au shell, donc impossible à filtrer par programme. Et chaque ligne y pèse environ deux mille jetons, parce que les résultats d'outils y sont intégrés : **douze lignes coûtent vingt-cinq mille jetons**. Le lire en entier est hors de portée, et le parcourir au hasard reviendrait à dépenser ma mémoire de travail sans garantie de tomber sur ce qui compte.

**Et surtout : cette conversation n'est pas tout le projet.** Les fichiers du dossier remontent au 16 août. Le registre compte **84 décisions** couvrant tout le travail. Cette discussion en est la dernière ligne droite. Même une mémoire parfaite de nos échanges ne suffirait pas.

---

## 2. Ce sur quoi je m'appuie réellement

Par ordre de fiabilité décroissante.

| Source | Volume | Ce qu'elle apporte | Fiabilité |
|---|---|---|---|
| **Registre des décisions** | 84 décisions, 990 lignes | Chaque choix avec son motif et sa conséquence, écrit au moment où il a été fait | **Maximale** — c'est un journal, pas un souvenir |
| **LISEZ-MOI des figures** | 364 lignes, 17 sections | Toute la technique du dessin : formule de lisibilité, contrôles, pièges de draw.io, notation UML | **Maximale** |
| **Méthode de production** | 117 lignes | Vocabulaire graphique forme par forme, ordre de production, les deux règles de fond | **Maximale** |
| **Sources et statut des preuves** | 117 lignes | La hiérarchie de preuve, les huit inventaires, ce qui reste indisponible | **Maximale** |
| **Registre des questions ouvertes** | 164 lignes | Ce qui bloque, qui peut répondre, ce que ça coûte | **Maximale** |
| **Résumé de compactage** | — | La **liste complète des demandes de l'auteur** sur la première moitié, plusieurs citées mot pour mot | Bonne — c'est un résumé, pas un verbatim |
| **Ma mémoire vive** | Seconde moitié | Verbatim | Maximale sur cette portion |

**Conclusion honnête** : je dispose de la totalité de la *méthode* et de la totalité des *décisions*. Ce dont je ne dispose pas, c'est du mot à mot de la première moitié des échanges. Or ce qui fait la valeur d'un prompt, ce sont les règles et les raisons — et elles sont toutes écrites.

---

## 3. Ce que j'ai retrouvé, et qui ira dans les prompts

### 3.1 Les règles de fond — celles qui ne se négocient pas

Elles se sont construites en quatre temps, et chacune est née d'un incident réel :

1. **Le code fait foi** (D-02). Quand un document du projet et le code divergent, le mémoire décrit le code. Motif : un jury peut ouvrir le code.
2. **Le document Word fait foi sur le texte, les inventaires font foi sur les chiffres** (D-17). Deux sources qui se prétendent maîtresses divergent toujours.
3. **Le code fait foi sur la structure** (D-78). Trois fiches de dessin se sont révélées fausses ; elles disent désormais *ce que la figure doit démontrer*, jamais *ce qu'elle doit contenir*.
4. **Rien ne s'invente.** Un chiffre, un verbe, une cardinalité qui n'a pas de source ne s'écrit pas. Si l'information manque, la figure porte une zone vide et on le dit.

### 3.2 La règle de méthode — une chose à la fois

Une étape, une validation, on avance. L'auteur ne connaît ni la rédaction de mémoire ni Word : le rôle tenu est celui d'un **directeur de mémoire**, pas d'un exécutant. Cela implique de dire ce qu'on va faire avant de le faire, de mesurer avant d'affirmer, et de rendre compte des erreurs sans les habiller.

### 3.3 Les règles de lisibilité des figures — la partie la plus technique

- La formule : **police sur papier = 468 × police écran ÷ largeur du canevas**, et son pendant en hauteur, **711 × police ÷ hauteur**. La vraie valeur est **le plus petit des deux**.
- Le seuil est **8 points**. En dessous, un jury ne lit rien.
- **La police 14 est un plancher, pas une règle** (D-69). La formule se lit dans les deux sens : sur une planche à libellés courts, monter à 18 fait passer le papier de 8,5 à 10,9 pt.
- **Le placement décide de la lisibilité, pas le routage** (D-68). Router proprement des formes mal placées ne donne qu'un labyrinthe bien tracé.
- **Une gouttière se dimensionne au nombre d'étiquettes qu'elle porte**, jamais par symétrie (D-75). Et **l'espacement des boîtes commande l'écartement des étiquettes**, puisque le milieu d'un lien est à mi-chemin entre sa source et sa cible.
- **Deux cadres qui échangent des liens s'alignent à la même hauteur** (D-73), et leur contenu s'ordonne pour que les liens soient courts.
- **Aucun trait ne traverse un encadré** (D-38). Gouttière verticale vide, puis court trait horizontal.

### 3.4 Les contrôles automatiques — et pourquoi chacun existe

Aucun n'a été inventé : chacun est né d'un défaut qui était passé.

| Contrôle | L'incident qui l'a fait naître |
|---|---|
| Trajet de chaque lien segment par segment | Six traits traversaient un encadré sur la figure 1.1 |
| Étendue réelle du dessin, pas la page déclarée | La figure 7.2 avait bougé sur le disque : 1 365 points au lieu de 750, soit 4,8 pt sur papier |
| Relecture du fichier à la livraison **et à chaque capture reçue** | Même incident : les contrôles ne valaient que pour l'instant où on les passait |
| Balises doublement échappées | Le générateur écrivait `<b>` en toutes lettres au lieu du gras |
| Largeur mesurée ligne par ligne, sur le texte et non sur la boîte | Trois étiquettes de la figure 4.1 débordaient de la page, invisibles à l'aperçu |
| Mot le plus long mesuré séparément | `résoudreConflitPourChaqueEnregistrement()` ne peut se replier : 41 caractères sans espace |
| Conteneurs exclus du test de traversée | Un cadre de séquence, une frontière, un couloir sont faits pour être traversés |
| Ovale testé sur son contour, ligne de vie sur son trait central | Le contrôle criait au loup sur la figure 6.3 |
| Toutes les formes testées, pas seulement celles de premier niveau | Les ovales sont enfants de la frontière : ils n'étaient **jamais** testés |
| Position réelle des étiquettes de lien | Ajouté le 5 septembre : les cardinalités du premier MCD étaient posées sur les entités, et rien ne le signalait |
| Largeur des textes mesurée dans la police de draw.io | Ajouté le 5 septembre : mesurer en DejaVu donnait trois fausses alertes et un vrai débordement manqué |

### 3.5 Les pièges de l'outil, appris à la dure

- **Draw.io écrase le fichier neuf** en réenregistrant sa copie en mémoire. C'est arrivé deux fois. Fermer le fichier avant toute réécriture.
- **Draw.io ne conserve pas toujours les points de passage.** D'où la préférence pour des dispositions où les liens sont des segments droits.
- **Une étiquette d'arête ne se replie pas toute seule** : il faut un enfant `edgeLabel` à largeur explicite.
- **`overflow=hidden` coupe un texte trop long sans prévenir.**
- **Un nom de classe en italique signifie « classe abstraite »** en UML. L'employer pour marquer autre chose est une faute de notation.
- **Un ancrage sur une ellipse se calcule sur le contour**, pas sur le rectangle englobant.
- **Un aperçu qui replie le texte alors que l'outil ne le fait pas montre une figure correcte là où le fichier est fautif.** Un aperçu qui ment est pire qu'une absence d'aperçu.

### 3.6 Les leçons de méthode, qui valent au-delà des figures

- **Quand l'auteur pose deux fois la même question devant une planche, ce n'est pas la note qu'il faut compléter : c'est la planche qui doit répondre** (D-83).
- **Une planche doit répondre elle-même aux questions qu'elle soulève**, sinon le lecteur conclut à un oubli — et il a raison (D-74).
- **Un document intermédiaire périmé est plus dangereux qu'un document absent** : il fait autorité par sa seule présence, et l'on n'y regarde pas la date.
- **Les limites s'énoncent, elles ne se dissimulent pas** (D-14). Un mémoire sans défaut est suspect ; un mémoire qui identifie ses propres limites démontre une maîtrise supérieure.
- **Combler un trou par du plausible est exactement ce qu'un jury détecte** (D-10). Un squelette honnête est défendable ; une invention ne l'est pas.

### 3.7 La cause commune des cinq erreurs trouvées à l'audit

Elle mérite d'être écrite, parce qu'elle est la leçon la plus utile de tout le projet.

**Trois des cinq erreurs — les migrations, les entités synchronisées, le volume de code — ont exactement la même origine : des chiffres mesurés le 10 août 2026 et jamais remesurés.** Ils figuraient dans les inventaires, ils ont été recopiés de bonne foi, et le code a bougé sous eux.

La règle qui en découle, et qui n'existait pas : **un chiffre a une date de péremption**. Tout chiffre extrait du code doit porter la date de sa mesure, et être remesuré avant remise. Un inventaire n'est pas une source permanente : c'est une photographie.

---

## 4. Ce que je n'ai pas pu retrouver

Je l'écris pour que la limite soit connue avant que vous jugiez les prompts.

1. **Le mot à mot de la première moitié de la conversation.** J'ai la liste de vos demandes et les décisions qui en sont sorties, pas vos phrases exactes. Si l'une d'elles portait une nuance qui n'a pas été consignée, elle est perdue.
2. **Mes propres raisonnements intermédiaires** sur cette première moitié — les pistes essayées puis abandonnées, quand elles n'ont pas donné lieu à une décision écrite.
3. **Les conversations antérieures au 31 août.** Le projet a commencé mi-août. Ce qui s'y est décidé n'est connu que par le registre — ce qui est déjà beaucoup, mais ce n'est pas la conversation.
4. **Le contenu des outils que j'ai construits.** Les scripts de production et de contrôle ont été supprimés du dossier sur votre décision (D-81), et l'environnement temporaire a été réinitialisé au moins sept fois. Je peux **décrire** chaque contrôle et sa raison d'être — c'est ce qu'il y a de plus important — mais pas restituer le code, et vous ne le voulez pas dans les fichiers.

---

## 5. Ce que je propose d'écrire ensuite

**Deux prompts, un à la fois, avec votre validation entre les deux.**

### Prompt 1 — Produire un mémoire de fin de cycle de A à Z

Il portera : la posture de directeur de mémoire, la méthode pas à pas, la hiérarchie de preuve et les quatre règles de fond, l'organisation du dossier de travail, les registres à tenir, l'ordre de production, les contraintes de forme, les boucles de vérification, la règle de péremption des chiffres, et les pièges dans lesquels je suis tombé.

### Prompt 2 — Produire les diagrammes d'un mémoire

Il portera : la formule de lisibilité dans ses deux sens, le gabarit et ses plafonds, les règles de placement, les onze contrôles et l'incident qui a fait naître chacun, la notation UML et MERISE, les pièges de draw.io, le fichier unique à onglets, et la procédure d'export et de collage dans Word.

**Sans une ligne de code**, conformément à votre règle. Les contrôles y seront décrits par ce qu'ils vérifient et par ce qu'ils ont attrapé, pas par leur implémentation.

---

*Cette note est un état des lieux, pas un livrable du mémoire. Elle ne modifie aucun document de soutenance.*
