# UML-UC-02 — Relations entre cas d'utilisation

## Bloc 1 — Cartouche

```
Identifiant       : UML-UC-02
Figure du mémoire : Figure 6.3 — Relations entre cas d'utilisation
Chapitre / section: 6 — § 6.4
Type UML          : Diagramme de cas d'utilisation (vue des relations)
Sources de preuve : INV-07 (enchaînements) · INV-01 (appels de gardes)
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 paysage
Densité           : 16 cas · 7 inclusions · 7 extensions · 1 généralisation
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Que certains cas en appellent d'autres **obligatoirement** (inclusion) et que d'autres ne se déclenchent que **sous condition** (extension). C'est la figure qui rend visibles les deux gardes centrales du système : le droit de prescrire et l'éligibilité par catégorie.

**Ce qu'elle ne montre pas.** Les acteurs. Cette figure se concentre sur les relations entre cas ; les acteurs figurent sur `UML-UC-01`.

## Bloc 3 — Éléments à dessiner

**Cas d'utilisation métier** — ovales à trait plein :

| N° | Libellé exact |
|---|---|
| U01 | `Se connecter` |
| U02 | `Valider le second facteur` |
| U03 | `Résoudre une connexion concurrente` |
| U04 | `Changer son mot de passe` |
| U05 | `Accepter les conditions d'utilisation` |
| U06 | `Rechercher un patient` |
| U07 | `Ouvrir une visite` |
| U08 | `Consulter la file d'attente` |
| U09 | `Ouvrir une consultation` |
| U10 | `Créer et valider une ordonnance` |
| U11 | `Émettre un bon de pharmacie` |
| U12 | `Émettre un bon d'examen` |
| U13 | `Clôturer une consultation` |
| U14 | `Clôturer la visite parente` |
| U15 | `Initier une évacuation` |
| U16 | `Ouvrir un suivi de traitement` |

**Cas techniques** — ovales à **trait pointillé**, pour les distinguer visuellement des cas métier :

| N° | Libellé exact |
|---|---|
| T01 | `Vérifier le droit de prescrire` |
| T02 | `Vérifier l'éligibilité de la catégorie` |

**Généralisation** — trois ovales :

| N° | Libellé exact |
|---|---|
| G01 | `Gérer un référentiel` *(cas général)* |
| G02 | `Gérer les sites` *(exemple de spécialisation)* |
| G03 | `Gérer les médicaments` *(exemple de spécialisation)* |

## Bloc 4 — Contenu des formes

Chaque ovale contient son libellé seul. Les cas techniques T01 et T02 sont en trait pointillé : ce ne sont pas des services rendus à un acteur, mais des contrôles internes systématiques. Cette distinction est une convention propre à cette figure, à signaler en légende.

## Bloc 5 — Relations à tracer

### Inclusions — trait **pointillé**, tête de flèche **ouverte**, stéréotype `«include»`

Sens : du cas de base **vers** le cas inclus.

| N° | De (base) | Vers (inclus) | Justification dans le code |
|---:|---|---|---|
| I1 | `Ouvrir une visite` | `Rechercher un patient` | L'identifiant du patient est obligatoire à la création |
| I2 | `Ouvrir une consultation` | `Consulter la file d'attente` | La consultation part d'une visite existante |
| I3 | `Créer et valider une ordonnance` | `Vérifier le droit de prescrire` | Appel systématique de la garde |
| I4 | `Émettre un bon de pharmacie` | `Vérifier l'éligibilité de la catégorie` | Appel systématique, prestation « médicament » |
| I5 | `Émettre un bon d'examen` | `Vérifier l'éligibilité de la catégorie` | Appel systématique, prestation « examen » |
| I6 | `Clôturer une consultation` | `Clôturer la visite parente` | La clôture pose l'état terminal sur la visite |
| I7 | `Se connecter` | `Accepter les conditions d'utilisation` | Un portail bloque l'accès tant que l'acceptation n'est pas faite |

### Extensions — trait **pointillé**, tête de flèche **ouverte**, stéréotype `«extend»`

Sens : du cas **étendant** vers le cas **de base**. ⚠️ **C'est l'inverse de l'inclusion.** Erreur la plus fréquente sur ce type de diagramme.

| N° | De (étendant) | Vers (base) | Condition à écrire sur le trait |
|---:|---|---|---|
| X1 | `Valider le second facteur` | `Se connecter` | `[second facteur activé]` |
| X2 | `Résoudre une connexion concurrente` | `Se connecter` | `[session déjà ouverte]` |
| X3 | `Changer son mot de passe` | `Se connecter` | `[mot de passe temporaire]` |
| X4 | `Initier une évacuation` | `Clôturer une consultation` | `[décision = évacuation]` |
| X5 | `Ouvrir un suivi de traitement` | `Clôturer une consultation` | `[décision = suivi de traitement]` |
| X6 | `Émettre un bon de pharmacie` | `Créer et valider une ordonnance` | `[ordonnance pharmaceutique validée]` |
| X7 | `Émettre un bon d'examen` | `Créer et valider une ordonnance` | `[ordonnance d'examen validée]` |

### Généralisation — trait **plein**, tête de flèche **triangulaire creuse**

Sens : de la spécialisation **vers** le cas général.

| N° | De | Vers |
|---:|---|---|
| GN1 | `Gérer les sites` | `Gérer un référentiel` |
| GN2 | `Gérer les médicaments` | `Gérer un référentiel` |

Une **note** à côté de la généralisation :

> *« Neuf référentiels partagent ce comportement ; deux sont représentés à titre d'exemple. »*

## Bloc 6 — Plan de placement

**Trois zones, de haut en bas.**

**Zone 1 — Authentification** *(haut)* : `Se connecter` au centre. Autour, en arc de cercle au-dessus : `Valider le second facteur`, `Résoudre une connexion concurrente`, `Changer son mot de passe` — leurs flèches d'extension descendent vers lui. En dessous : `Accepter les conditions d'utilisation`, relié par inclusion.

**Zone 2 — Parcours de soin** *(centre, la plus large)* : chaîne horizontale de gauche à droite —
`Rechercher un patient` ← `Ouvrir une visite` → `Consulter la file d'attente` ← `Ouvrir une consultation` → `Créer et valider une ordonnance` → `Émettre un bon de pharmacie` / `Émettre un bon d'examen`.
`Vérifier le droit de prescrire` se place **sous** l'ordonnance. `Vérifier l'éligibilité de la catégorie` se place **sous** les deux bons, à égale distance des deux — c'est le point focal de la figure.
`Clôturer une consultation` à droite, avec `Clôturer la visite parente` en dessous, et `Initier une évacuation` / `Ouvrir un suivi de traitement` au-dessus.

**Zone 3 — Généralisation** *(bas, isolée)* : `Gérer un référentiel` au centre, avec ses deux spécialisations en dessous. Cette zone est **visuellement séparée** des deux autres par un espace blanc : elle illustre une autre nature de relation.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Cas métier | Ovale, trait plein |
| Cas technique | Ovale, **trait pointillé** |
| `«include»` | Trait pointillé, flèche ouverte, **base → inclus** |
| `«extend»` | Trait pointillé, flèche ouverte, **étendant → base**, condition entre crochets |
| Généralisation | Trait plein, **triangle creux** vers le général |

**Légende à reproduire :**

> **Figure 6.3 — Relations entre cas d'utilisation**
> Les ovales en pointillés représentent des contrôles internes systématiques, non des services rendus à un acteur. Les conditions d'extension sont écrites entre crochets.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 21 ovales sont présents
[ ] T01 et T02 sont en trait POINTILLÉ, les autres en trait plein
[ ] Les 7 inclusions vont bien de la BASE vers l'INCLUS
[ ] Les 7 extensions vont bien de l'ÉTENDANT vers la BASE — sens inverse
[ ] Chaque extension porte sa condition entre crochets
[ ] Les 2 généralisations pointent vers le cas général, avec un triangle CREUX
[ ] « Vérifier l'éligibilité » reçoit bien DEUX inclusions (I4 et I5)
[ ] La note sur les neuf référentiels est présente
[ ] La zone de généralisation est visuellement séparée
```

## Vérification finale

| Point | Source |
|---|---|
| Les gardes sont appelées systématiquement | INV-01 § 5.5, utilitaires transverses |
| La clôture de consultation entraîne celle de la visite | INV-07 § 3.2 |
| Un bon exige une ordonnance validée du bon type | INV-07 §§ 3.5 et 3.6 |
| Neuf référentiels partagent le même comportement | INV-04 § 4.1 |
