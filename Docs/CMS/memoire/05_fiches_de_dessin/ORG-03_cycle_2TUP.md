# ORG-03 — Cycle de développement selon 2TUP

## Bloc 1 — Cartouche

```
Identifiant       : ORG-03
Figure du mémoire : Figure 4.1 — Cycle de développement selon 2TUP
Chapitre / section: 4 — § 4.2.2
Type              : Schéma méthodologique (non UML)
Sources de preuve : Littérature méthodologique — voir bibliographie
Statut            : figure théorique, à sourcer bibliographiquement
Format conseillé  : A4 paysage
Densité           : 9 blocs · 10 flèches
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** La forme en **Y** de 2TUP : deux branches montantes indépendantes, un point de convergence, un tronc descendant.

> ⚠️ **Attention à la source.** Ce schéma est issu de la littérature méthodologique, non d'une conception propre. La légende **doit** citer l'ouvrage de référence, avec sa page. Présenter un schéma théorique connu comme une création personnelle serait une faute. Voir la bibliographie du mémoire.

## Bloc 3 — Éléments à dessiner

**Branche gauche — fonctionnelle**, de bas en haut :

| N° | Libellé exact |
|---|---|
| G1 | `Capture des besoins fonctionnels` |
| G2 | `Analyse` |

**Branche droite — technique**, de bas en haut :

| N° | Libellé exact |
|---|---|
| D1 | `Capture des besoins techniques` |
| D2 | `Conception générique` |

**Point de convergence :**

| N° | Libellé exact |
|---|---|
| C1 | `Conception préliminaire` |

**Tronc descendant**, de haut en bas :

| N° | Libellé exact |
|---|---|
| T1 | `Conception détaillée` |
| T2 | `Codage et tests unitaires` |
| T3 | `Recette` |

**Deux entrées, tout en haut :**

| N° | Libellé exact | Côté |
|---|---|---|
| E1 | `Système existant` | au-dessus de G1, à gauche |
| E2 | `Contraintes techniques` | au-dessus de D1, à droite |

## Bloc 4 — Contenu des formes

Rectangles à coins droits, contenant leur libellé centré. Les deux entrées E1 et E2 sont des rectangles plus petits, ou des ellipses, pour les distinguer des étapes.

## Bloc 5 — Flèches à tracer

| N° | De | Vers | Sens |
|---:|---|---|---|
| A01 | `Système existant` | `Capture des besoins fonctionnels` | descendant |
| A02 | `Capture des besoins fonctionnels` | `Analyse` | descendant, le long de la branche gauche |
| A03 | `Contraintes techniques` | `Capture des besoins techniques` | descendant |
| A04 | `Capture des besoins techniques` | `Conception générique` | descendant, le long de la branche droite |
| A05 | `Analyse` | `Conception préliminaire` | **convergent, vers le centre** |
| A06 | `Conception générique` | `Conception préliminaire` | **convergent, vers le centre** |
| A07 | `Conception préliminaire` | `Conception détaillée` | descendant, tronc |
| A08 | `Conception détaillée` | `Codage et tests unitaires` | descendant, tronc |
| A09 | `Codage et tests unitaires` | `Recette` | descendant, tronc |

**Annotations de branche**, à écrire le long de chaque branche, en italique :

| Emplacement | Texte |
|---|---|
| Le long de la branche gauche | `Branche fonctionnelle — le métier, indépendamment de la technique` |
| Le long de la branche droite | `Branche technique — l'architecture, indépendamment des fonctions` |
| Le long du tronc | `Réalisation` |

## Bloc 6 — Plan de placement

**Forme en Y renversé**, occupant toute la hauteur de la planche.

- Les deux entrées E1 et E2 sont en haut, écartées d'environ 60 % de la largeur.
- Les deux branches descendent en **oblique convergente**, se rapprochant progressivement.
- `Conception préliminaire` est au **centre géométrique horizontal**, environ aux deux tiers de la hauteur.
- Le tronc descend **verticalement** jusqu'en bas de la planche.

**Règles de tracé :**
- La symétrie des deux branches doit être visible : c'est le message de la figure.
- Le point de convergence doit être visuellement marqué — encadré plus épais, ou fond légèrement teinté.
- Aucune flèche ne relie directement les deux branches entre elles avant la convergence : c'est précisément ce que 2TUP interdit.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Étape | Rectangle à coins droits |
| Entrée | Ellipse ou rectangle plus petit |
| Enchaînement | Flèche pleine, tête ouverte |
| Annotation de branche | Texte en italique, le long de la branche |

**Légende à reproduire — en complétant la référence :**

> **Figure 4.1 — Cycle de développement selon 2TUP**
> Les deux branches, fonctionnelle et technique, sont menées indépendamment et ne convergent qu'à la conception préliminaire.
> *Source : [ à compléter — auteur, ouvrage, édition, année, page ]*

⛔ **La référence doit être renseignée avant impression.** Une figure théorique sans source est une appropriation indue.

## Bloc 8 — Contrôles après dessin

```
[ ] Les 9 blocs et 2 entrées sont présents
[ ] La forme en Y est immédiatement reconnaissable
[ ] Les deux branches sont symétriques
[ ] AUCUNE flèche ne relie les deux branches avant la convergence
[ ] Le point de convergence est visuellement marqué
[ ] Les 3 annotations de branche sont présentes
[ ] La légende cite une source bibliographique complète
[ ] La source figure aussi dans la bibliographie du mémoire
```

## Vérification finale

| Point | À vérifier |
|---|---|
| Exactitude des libellés d'étape | Confronter à l'ouvrage de référence avant impression |
| Référence bibliographique complète | ⛔ à renseigner |
| Cohérence avec le texte du chapitre 4 | § 4.2 |
