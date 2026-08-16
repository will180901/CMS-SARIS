# UML-CMP-01 — Diagramme de composants

## Bloc 1 — Cartouche

```
Identifiant       : UML-CMP-01
Figure du mémoire : Figure 7.6 — Diagramme de composants
Chapitre / section: 7 — § 7.6
Type UML          : Diagramme de composants
Sources de preuve : Organisation du monorepo · INV-01 § 5.4 · INV-04 · INV-05
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 paysage
Densité           : 11 composants · 3 systèmes externes · 16 dépendances
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** De quels blocs déployables le système est fait, quelles interfaces chacun fournit et requiert, et surtout que **le même composant serveur s'exécute à deux endroits** : sur le serveur central et à l'intérieur du client de bureau.

**Ce qu'elle ne montre pas.** Les machines physiques — c'est l'objet du diagramme de déploiement.

## Bloc 3 — Composants à dessiner

Chaque composant est un **rectangle portant l'icône de composant** — deux petits rectangles saillants sur le bord gauche — ou le stéréotype `«composant»`.

| N° | Libellé exact | Groupe | Placement |
|---|---|---|---|
| K01 | `Application web` | Clients | haut-gauche |
| K02 | `Client de bureau` | Clients | haut-centre |
| K03 | `Serveur API` | Serveur | centre |
| K04 | `Serveur API embarqué` | Serveur | centre-droit |
| K05 | `Base PostgreSQL` | Persistance | bas-gauche |
| K06 | `Base SQLite locale` | Persistance | bas-droite |
| K07 | `Paquet de données` | Paquets partagés | bas-centre |
| K08 | `Paquet de types partagés` | Paquets partagés | bas-centre |
| K09 | `Paquet d'interface` | Paquets partagés | haut, entre K01 et K02 |
| K10 | `Moteur de synchronisation` | Serveur | droite |
| K11 | `Base du navigateur` | Persistance | extrême gauche |

**Systèmes externes** — rectangles `«externe»` :

| N° | Libellé exact | Placement |
|---|---|---|
| X1 | `Service de géolocalisation` | extrême droite |
| X2 | `Canal de mise à jour` | haut-droite |

**Deux frontières à tracer** — rectangles pointillés englobants, avec leur nom en haut :

| Frontière | Contient |
|---|---|
| `Serveur central` | K03, K05, K10 |
| `Poste autonome` | K02, K04, K06 |

## Bloc 4 — Interfaces fournies et requises

Les interfaces se dessinent selon la convention **« sucette et prise »** : un cercle plein au bout d'un trait pour une interface **fournie**, un demi-cercle ouvert pour une interface **requise**. Une dépendance se lit quand la prise s'emboîte sur la sucette.

| Composant | Interfaces **fournies** | Interfaces **requises** |
|---|---|---|
| `Application web` | — | `API REST`, `Flux d'événements` |
| `Client de bureau` | `Fenêtre applicative`, `Coffre de secrets`, `Mise à jour` | `API REST`, `Flux d'événements` |
| `Serveur API` | `API REST` (268 routes), `Flux d'événements` | `Accès aux données`, `Géolocalisation` |
| `Serveur API embarqué` | `API REST locale` (boucle locale seulement) | `Accès aux données` |
| `Base PostgreSQL` | `Stockage relationnel` | — |
| `Base SQLite locale` | `Stockage relationnel` | — |
| `Paquet de données` | `Accès aux données`, `Schéma`, `Migrations` | `Stockage relationnel` |
| `Paquet de types partagés` | `Types`, `Catalogue des permissions`, `Résolution de conflit` | — |
| `Paquet d'interface` | `Composants visuels` | — |
| `Moteur de synchronisation` | `API de synchronisation` (14 routes), `Canal de notification` | `Accès aux données`, `Résolution de conflit` |
| `Base du navigateur` | `File de mutations hors ligne` | — |

## Bloc 5 — Dépendances à tracer

Flèches **pointillées à tête ouverte**, du composant dépendant vers le composant fournisseur, stéréotypées `«use»`.

| N° | De | Vers | Interface concernée |
|---:|---|---|---|
| D01 | `Application web` | `Serveur API` | API REST |
| D02 | `Application web` | `Paquet de types partagés` | Types |
| D03 | `Application web` | `Paquet d'interface` | Composants visuels |
| D04 | `Application web` | `Base du navigateur` | File de mutations hors ligne |
| D05 | `Client de bureau` | `Application web` | *embarque le rendu* |
| D06 | `Client de bureau` | `Serveur API` | API REST — **mode connecté** |
| D07 | `Client de bureau` | `Serveur API embarqué` | API REST locale — **mode autonome** |
| D08 | `Client de bureau` | `Canal de mise à jour` | Mise à jour |
| D09 | `Serveur API` | `Paquet de données` | Accès aux données |
| D10 | `Serveur API` | `Paquet de types partagés` | Types, catalogue des permissions |
| D11 | `Serveur API` | `Service de géolocalisation` | Géolocalisation |
| D12 | `Serveur API embarqué` | `Paquet de données` | Accès aux données |
| D13 | `Paquet de données` | `Base PostgreSQL` | Stockage relationnel |
| D14 | `Paquet de données` | `Base SQLite locale` | Stockage relationnel |
| D15 | `Moteur de synchronisation` | `Paquet de types partagés` | Résolution de conflit |
| D16 | `Serveur API embarqué` | `Moteur de synchronisation` | API de synchronisation |

**Deux annotations obligatoires :**

| Sur | Note |
|---|---|
| D06 et D07 | *« Le client de bureau bascule d'un serveur à l'autre selon la joignabilité du central, sondée périodiquement. »* |
| K03 et K04 | *« Même code source. Le serveur embarqué est la même application NestJS, compilée pour s'exécuter au-dessus de SQLite. »* |

## Bloc 6 — Plan de placement

**Trois bandes horizontales.**

**Bande 1 — Clients** *(haut)* : `Application web` à gauche, `Client de bureau` au centre, `Paquet d'interface` entre les deux, `Canal de mise à jour` à droite.

**Bande 2 — Serveurs** *(centre)* : `Serveur API` au centre-gauche, `Serveur API embarqué` au centre-droit, `Moteur de synchronisation` à droite, `Service de géolocalisation` à l'extrême droite.

**Bande 3 — Persistance** *(bas)* : `Base du navigateur` à l'extrême gauche, `Base PostgreSQL` à gauche, les deux paquets partagés au centre, `Base SQLite locale` à droite.

**Les deux frontières** sont des rectangles en pointillés englobant leurs composants respectifs. Elles se chevauchent visuellement sur la colonne centrale : c'est normal et instructif — c'est là que le même code s'exécute des deux côtés. Décaler légèrement pour que les deux cadres restent lisibles.

**Règles de tracé :**
- Le `Paquet de types partagés` reçoit des flèches de partout : le placer bas au centre, avec des traits courts.
- D06 et D07 partent du même composant vers deux cibles différentes : les tracer en éventail, bien écartés, chacun annoté de son mode.
- Aucune flèche ne traverse un composant.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Composant | Rectangle avec icône de composant, ou `«composant»` |
| Interface fournie | Trait terminé par un **cercle plein** |
| Interface requise | Trait terminé par un **demi-cercle ouvert** |
| Dépendance | Flèche **pointillée**, tête ouverte, `«use»` |
| Système externe | Rectangle `«externe»` |
| Frontière | Rectangle pointillé, nom en haut |

**Légende à reproduire :**

> **Figure 7.6 — Diagramme de composants**
> Le serveur API et le serveur API embarqué partagent le même code source, compilé pour deux moteurs de base de données différents. Le client de bureau bascule de l'un à l'autre selon la joignabilité du serveur central.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 11 composants et 2 systèmes externes sont présents
[ ] Chaque composant porte l'icône de composant ou son stéréotype
[ ] Les interfaces fournies sont des cercles PLEINS, les requises des demi-cercles
[ ] Les 16 dépendances sont tracées, en POINTILLÉS
[ ] Les 2 frontières sont tracées et nommées
[ ] D06 et D07 partent du client de bureau vers DEUX cibles distinctes
[ ] Les 2 annotations obligatoires sont présentes
[ ] Le paquet de types reçoit bien des flèches de l'application web, du serveur et de la synchronisation
[ ] Aucune flèche ne traverse un composant
```

## Vérification finale

| Point | Source |
|---|---|
| Six paquets dans le monorepo | Configuration des espaces de travail |
| Le serveur embarqué n'écoute que sur la boucle locale | INV-05 § 2.2 |
| Bascule par sonde de joignabilité | INV-05 §§ 2.2 et 6.4 |
| Le paquet de types porte le catalogue et la résolution de conflit | INV-03, INV-05 § 5.3 |
| Repli hors ligne de la géolocalisation | INV-01 § 5.5 |
