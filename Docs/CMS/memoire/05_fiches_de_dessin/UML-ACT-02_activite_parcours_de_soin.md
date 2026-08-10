# UML-ACT-02 — Diagramme d'activité du parcours de soin

## Bloc 1 — Cartouche

```
Identifiant       : UML-ACT-02
Figure du mémoire : Figure 7.2 — Diagramme d'activité du parcours de soin
Chapitre / section: 7 — § 7.3
Type UML          : Diagramme d'activité avec couloirs
Sources de preuve : INV-07 §§ 3.1, 3.2, 4.1 à 4.6
Statut            : IMPLÉMENTÉ
Format conseillé  : A3 portrait, ou A4 portrait en réduisant les libellés
Densité           : 3 couloirs · 22 actions · 7 décisions · 1 fourche/jointure
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** L'enchaînement complet, de l'arrivée du patient jusqu'aux documents remis, avec **les points de décision et leurs conditions**. C'est la figure la plus utile du mémoire : elle se compare directement à la figure 5.1, qui représente le processus antérieur.

**Ce qu'elle ne montre pas.** Les échanges techniques. Elle décrit le processus **métier**.

## Bloc 3 — Éléments à dessiner

### Couloirs — trois colonnes verticales

| N° | Libellé exact du couloir | Position |
|---|---|---|
| P1 | `Infirmier` | gauche |
| P2 | `Soignant (Médecin Chef ou Infirmier)` | centre |
| P3 | `Système` | droite |

### Nœuds

| N° | Libellé exact | Forme | Couloir |
|---|---|---|---|
| N00 | *(sans libellé)* | **Cercle plein** — nœud initial | P1 |
| A01 | `Accueillir le patient` | Rectangle arrondi | P1 |
| A02 | `Rechercher le dossier` | Rectangle arrondi | P1 |
| D01 | `Dossier existant ?` | **Losange** | P1 |
| A03 | `Créer le dossier patient` | Rectangle arrondi | P1 |
| A04 | `Vérifier le matricule` | Rectangle arrondi | P1 |
| A05 | `Sélectionner le motif` | Rectangle arrondi | P1 |
| D02 | `Patient actif et aucune visite ouverte ?` | **Losange** | P3 |
| A06 | `Refuser l'ouverture` | Rectangle arrondi | P3 |
| A07 | `Créer la visite (EN_ATTENTE)` | Rectangle arrondi | P3 |
| A08 | `Relever les constantes vitales` | Rectangle arrondi | P1 |
| A09 | `Placer dans la file, par ordre d'arrivée` | Rectangle arrondi | P3 |
| A10 | `Prendre en charge la visite` | Rectangle arrondi | P2 |
| D03 | `Soignant libre et visite sans consultation ouverte ?` | **Losange** | P3 |
| A11 | `Refuser l'ouverture` | Rectangle arrondi | P3 |
| A12 | `Ouvrir la consultation (OUVERTE)` | Rectangle arrondi | P3 |
| A13 | `Saisir l'examen clinique` | Rectangle arrondi | P2 |
| A14 | `Poser le ou les diagnostics` | Rectangle arrondi | P2 |
| D04 | `Prescription nécessaire ?` | **Losange** | P2 |
| A15 | `Choisir le type d'ordonnance` | Rectangle arrondi | P2 |
| D05 | `Droit de prescrire ?` | **Losange** | P3 |
| A16 | `Refuser la prescription` | Rectangle arrondi | P3 |
| A17 | `Créer l'ordonnance (BROUILLON)` | Rectangle arrondi | P3 |
| A18 | `Ajouter les lignes` | Rectangle arrondi | P2 |
| A19 | `Valider l'ordonnance (VALIDEE)` | Rectangle arrondi | P2 |
| D06 | `Génération d'un bon demandée ?` | **Losange** | P2 |
| D07 | `Catégorie du patient éligible ?` | **Losange** | P3 |
| A20 | `Refuser le bon, motif explicite` | Rectangle arrondi | P3 |
| A21 | `Créer le bon (EN_ATTENTE)` | Rectangle arrondi | P3 |
| A22 | `Imprimer le document` | Rectangle arrondi | P2 |
| A23 | `Rédiger la conclusion` | Rectangle arrondi | P2 |
| D08 | `Décision médicale ?` | **Losange à 3 sorties** | P2 |
| A24 | `Créer l'évacuation (EN_COURS)` | Rectangle arrondi | P3 |
| A25 | `Ouvrir le suivi de traitement (EN_COURS)` | Rectangle arrondi | P3 |
| F01 | *(sans libellé)* | **Barre épaisse** — fourche | P3 |
| A26 | `Clôturer la consultation (CLOTUREE)` | Rectangle arrondi | P3 |
| A27 | `Clôturer la visite parente (CLOTUREE)` | Rectangle arrondi | P3 |
| J01 | *(sans libellé)* | **Barre épaisse** — jointure | P3 |
| A28 | `Émettre la notification` | Rectangle arrondi | P3 |
| N99 | *(sans libellé)* | **Cercle plein cerclé** — nœud final | P3 |

## Bloc 4 — Contenu des formes

Les libellés sont à écrire **exactement** comme indiqué. Les états entre parenthèses — `EN_ATTENTE`, `OUVERTE`, `VALIDEE`, `CLOTUREE` — sont les valeurs réelles stockées en base : ne pas les traduire ni les abréger.

Les losanges portent leur question **à l'intérieur**. Les conditions de sortie s'écrivent **sur les flèches**, entre crochets.

## Bloc 5 — Transitions à tracer

Toutes les transitions sont des **flèches pleines à tête ouverte**.

| N° | De | Vers | Garde à écrire |
|---:|---|---|---|
| T01 | N00 | A01 | — |
| T02 | A01 | A02 | — |
| T03 | A02 | D01 | — |
| T04 | D01 | A04 | `[oui]` |
| T05 | D01 | A03 | `[non]` |
| T06 | A03 | A04 | — |
| T07 | A04 | A05 | — |
| T08 | A05 | D02 | — |
| T09 | D02 | A06 | `[non]` |
| T10 | A06 | N99 | — |
| T11 | D02 | A07 | `[oui]` |
| T12 | A07 | A08 | — |
| T13 | A08 | A09 | — |
| T14 | A09 | A10 | — |
| T15 | A10 | D03 | — |
| T16 | D03 | A11 | `[non]` |
| T17 | A11 | A10 | *retour à la file* |
| T18 | D03 | A12 | `[oui]` |
| T19 | A12 | A13 | — |
| T20 | A13 | A14 | — |
| T21 | A14 | D04 | — |
| T22 | D04 | A23 | `[non]` |
| T23 | D04 | A15 | `[oui]` |
| T24 | A15 | D05 | — |
| T25 | D05 | A16 | `[non — infirmier sans délégation active]` |
| T26 | A16 | A23 | — |
| T27 | D05 | A17 | `[oui — médecin chef, ou infirmier délégué]` |
| T28 | A17 | A18 | — |
| T29 | A18 | A19 | — |
| T30 | A19 | D06 | — |
| T31 | D06 | A23 | `[non]` |
| T32 | D06 | D07 | `[oui]` |
| T33 | D07 | A20 | `[non — catégorie non couverte]` |
| T34 | A20 | A23 | — |
| T35 | D07 | A21 | `[oui — CDI ou ayant droit]` |
| T36 | A21 | A22 | — |
| T37 | A22 | A23 | — |
| T38 | A23 | D08 | — |
| T39 | D08 | A24 | `[évacuation]` |
| T40 | D08 | A25 | `[suivi de traitement]` |
| T41 | D08 | F01 | `[aucune décision — clôture simple]` |
| T42 | A24 | F01 | — |
| T43 | A25 | F01 | — |
| T44 | F01 | A26 | — |
| T45 | F01 | A27 | — |
| T46 | A26 | J01 | — |
| T47 | A27 | J01 | — |
| T48 | J01 | A28 | — |
| T49 | A28 | N99 | — |

**49 transitions.**

### Notes obligatoires

| Attachée à | Texte de la bulle |
|---|---|
| A09 | *« Ordre d'arrivée strict. Le système ne connaît aucune notion de priorité clinique. »* |
| D05 | *« Deux étages de contrôle : la permission ouvre la porte, la délégation autorise l'acte. »* |
| D07 | *« Matrice DroitCategoriePatient. Le contrôle porte sur le BON, jamais sur l'ordonnance. »* |
| D08 | *« Deux décisions seulement. La clôture simple se caractérise par l'absence de décision. »* |
| F01 / J01 | *« La clôture de la consultation entraîne obligatoirement celle de la visite. »* |

## Bloc 6 — Plan de placement

**Trois couloirs verticaux** de largeur égale, séparés par des traits pleins, avec le nom du couloir en haut.

Le flux descend **de haut en bas**, en traversant les couloirs selon l'acteur responsable de chaque action.

**Quatre blocs verticaux successifs :**

1. **Accueil et triage** *(quart supérieur)* — N00 à A09. Majoritairement dans le couloir Infirmier, avec deux incursions dans le couloir Système pour les contrôles.
2. **Consultation** *(deuxième quart)* — A10 à A14.
3. **Prescription** *(troisième quart, le plus dense)* — D04 à A22. Contient les deux décisions les plus importantes, D05 et D07.
4. **Clôture** *(quart inférieur)* — A23 à N99, avec la fourche et la jointure.

**Règles de tracé :**
- La fourche et la jointure sont des **barres horizontales épaisses**, occupant la largeur du couloir Système.
- Les trois branches sortant de D08 doivent être clairement séparées.
- Les branches de refus — A06, A11, A16, A20 — sont tracées **à droite**, distinctement, pour ne pas encombrer le flux nominal.
- Aucune flèche ne remonte, sauf T17 (retour à la file après refus de prise en charge).
- Les décisions D05 et D07 doivent être visuellement **mises en évidence** : ce sont les deux règles centrales.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Nœud initial | Cercle plein |
| Nœud final | Cercle plein cerclé |
| Action | Rectangle à coins arrondis |
| Décision / fusion | Losange |
| Fourche / jointure | Barre horizontale épaisse |
| Transition | Flèche pleine, tête ouverte |
| Garde | Entre crochets, sur la flèche |
| Couloir | Colonne verticale nommée en haut |

**Légende à reproduire :**

> **Figure 7.2 — Diagramme d'activité du parcours de soin**
> Les valeurs entre parenthèses sont les états réellement stockés en base. Les deux décisions grisées portent les règles métier centrales : droit de prescrire et éligibilité par catégorie de patient.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 3 couloirs sont présents et nommés
[ ] Les 40 nœuds du bloc 3 sont présents
[ ] Les 49 transitions du bloc 5 sont tracées
[ ] Chaque sortie de losange porte sa garde entre crochets
[ ] D08 possède bien TROIS sorties, dont « aucune décision »
[ ] La fourche et la jointure sont des barres épaisses, pas des losanges
[ ] A26 et A27 sont en PARALLÈLE entre la fourche et la jointure
[ ] Les 5 notes obligatoires sont présentes
[ ] Les états sont écrits en majuscules, non traduits
[ ] Les branches de refus sont visuellement séparées du flux nominal
[ ] Le mot « priorité » n'apparaît nulle part, sauf dans la note qui la nie
[ ] Un seul nœud final
```

## Vérification finale

| Point | Source |
|---|---|
| Contrôles à l'ouverture d'une visite | INV-07 § 3.1 |
| Une seule consultation ouverte par soignant et par visite | INV-07 § 3.2 |
| Deux étages du droit de prescrire | INV-07 § 5.2 |
| Contrôle d'éligibilité au moment du bon | INV-07 § 5.1 |
| Deux décisions médicales seulement | INV-07 § 3.3 |
| Couplage clôture consultation / visite | INV-07 § 3.2 |
