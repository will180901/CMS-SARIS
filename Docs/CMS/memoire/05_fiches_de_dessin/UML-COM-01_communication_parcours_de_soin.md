# UML-COM-01 — Diagramme de communication du parcours de soin

## Bloc 1 — Cartouche

```
Identifiant       : UML-COM-01
Figure du mémoire : Figure 7.5 — Diagramme de communication du parcours de soin
Chapitre / section: 7 — § 7.4
Type UML          : Diagramme de communication
Sources de preuve : Mêmes objets et messages que UML-SEQO-01
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 paysage
Densité           : 8 objets · 8 liens · 13 messages numérotés
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Les **liens structurels** entre objets collaborateurs — qui connaît qui — plutôt que l'ordre temporel. C'est le complément du diagramme de séquence objets : mêmes participants, mêmes messages, présentation différente.

**Règle de cohérence obligatoire.** Cette figure et `UML-SEQO-01` décrivent la **même collaboration**. Toute divergence entre les deux est une erreur. La numérotation des messages doit se lire dans le même ordre.

## Bloc 3 — Objets à dessiner

| N° | Libellé exact | Forme | Placement |
|---|---|---|---|
| O1 | `Soignant` | Bonhomme-bâton | extrême gauche |
| O2 | `: ConsultationController` | Rectangle | gauche |
| O3 | `: JwtAuthGuard` | Rectangle | haut-gauche |
| O4 | `: PermissionsGuard` | Rectangle | haut |
| O5 | `: ConsultationService` | Rectangle | **centre — pivot** |
| O6 | `: DroitsCategorie` | Rectangle | bas-centre |
| O7 | `: PrismaService` | Rectangle | droite |
| O8 | `: AuditInterceptor` | Rectangle | haut-droite |

> Contrairement au diagramme de séquence, il n'y a **aucune ligne de vie verticale** : les objets sont posés librement dans le plan.

## Bloc 4 — Contenu des formes

Rectangles contenant le libellé exact, souligné selon la convention UML des objets. Le bonhomme-bâton porte son nom dessous.

## Bloc 5 — Liens et messages

### Liens structurels — traits pleins, sans flèche

| N° | Entre | Et | Nature du lien |
|---:|---|---|---|
| C1 | `Soignant` | `: ConsultationController` | appel HTTP |
| C2 | `: ConsultationController` | `: JwtAuthGuard` | garde |
| C3 | `: ConsultationController` | `: PermissionsGuard` | garde |
| C4 | `: ConsultationController` | `: ConsultationService` | délégation |
| C5 | `: ConsultationService` | `: DroitsCategorie` | règle métier partagée |
| C6 | `: ConsultationService` | `: PrismaService` | accès aux données |
| C7 | `: DroitsCategorie` | `: PrismaService` | accès aux données |
| C8 | `: ConsultationController` | `: AuditInterceptor` | interception |

**8 liens.** Chaque lien est un trait plein reliant deux objets. Les messages se posent **le long de ces traits**, avec une petite flèche indiquant le sens.

### Messages numérotés

La numérotation suit l'ordre d'exécution. Les sous-numéros indiquent l'imbrication : un message `2.1` est déclenché pendant le traitement du message `2`.

| N° | Sur le lien | Sens | Message |
|---|---|---|---|
| **1** | C1 | Soignant → Controller | `genererBon(idConsultation, idOrdonnance)` |
| **1.1** | C2 | Controller → JwtAuthGuard | `canActivate()` |
| **1.2** | C3 | Controller → PermissionsGuard | `canActivate()` |
| **1.3** | C4 | Controller → Service | `genererBonDepuisOrdonnance()` |
| **1.3.1** | C6 | Service → Prisma | `lireOrdonnance()` |
| **1.3.2** | C6 | Service → Prisma | `lireCatégorieDuPatient()` |
| **1.3.3** | C5 | Service → DroitsCategorie | `assertPrestationCouverte(catégorie, MEDICAMENT)` |
| **1.3.3.1** | C7 | DroitsCategorie → Prisma | `chercherDroit(catégorie, prestation, couvert)` |
| **1.3.3.2** | C5 | DroitsCategorie → Service | `[si absent] ForbiddenException` |
| **1.3.4** | C6 | Service → Prisma | `créerBon(EN_ATTENTE) + créerLignes()` |
| **1.4** | C8 | Controller → AuditInterceptor | *(interception de la mutation)* |
| **1.4.1** | — | AuditInterceptor → Prisma | `écrireJournalAudit()` |
| **2** | C1 | Controller → Soignant | `201 — bon créé` |

> ⚠️ Le message **1.4.1** circule entre `: AuditInterceptor` et `: PrismaService`, qui n'ont pas de lien déclaré au tableau ci-dessus. **Ajouter un neuvième lien C9** entre ces deux objets, en trait plein.

### Note obligatoire

Une bulle attachée à l'objet `: DroitsCategorie` :

> *« Utilitaire transverse partagé, désigné source unique de la règle d'éligibilité. Appelé par tous les services émettant un bon. »*

## Bloc 6 — Plan de placement

Disposition **en étoile autour de `: ConsultationService`**, qui est le pivot de la collaboration.

```
                    : JwtAuthGuard      : PermissionsGuard      : AuditInterceptor
                            \                  |                        |
   Soignant ── : ConsultationController ───────┘                        |
                            \                                           |
                             : ConsultationService ──────────── : PrismaService
                                       \                             /
                                        : DroitsCategorie ──────────┘
```

**Règles de tracé :**
- `: ConsultationService` occupe le centre géométrique.
- `: PrismaService` est à droite : trois objets s'y connectent (C6, C7, C9), il doit être accessible sans croisement.
- `: DroitsCategorie` est en bas au centre, entre le service et la base : sa position traduit son rôle d'intermédiaire de règle.
- Les numéros de message s'écrivent **le long du lien**, avec une flèche courte indiquant le sens.
- Aucun lien ne doit en croiser un autre. Si un croisement est inévitable, marquer un petit saut d'arc.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Objet | Rectangle, nom souligné, précédé de deux points |
| Lien | Trait plein, **sans tête de flèche** |
| Message | Petite flèche le long du lien, avec numéro et libellé |
| Numérotation | Décimale hiérarchique : `1`, `1.1`, `1.3.3.1` |

**Légende à reproduire :**

> **Figure 7.5 — Diagramme de communication du parcours de soin**
> Mêmes objets et mêmes messages que la figure 7.3, présentés sous l'angle des liens structurels. La numérotation décimale traduit l'imbrication des appels.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 8 objets sont présents
[ ] Les 9 liens sont tracés (les 8 du tableau + C9 Audit ↔ Prisma)
[ ] Les 13 messages portent leur numéro décimal
[ ] La numérotation est cohérente avec l'ordre de la figure 7.3
[ ] Aucune ligne de vie verticale — ce n'est pas un diagramme de séquence
[ ] Les liens sont sans tête de flèche ; seuls les messages en portent
[ ] : ConsultationService est au centre
[ ] La note sur l'utilitaire transverse est présente
[ ] Aucun croisement de liens, ou saut d'arc marqué
```

## Vérification finale

| Point | Source |
|---|---|
| Mêmes participants que la figure 7.3 | `UML-SEQO-01` bloc 3 |
| Mêmes messages, même ordre | `UML-SEQO-01` bloc 5 |
| L'utilitaire d'éligibilité accède lui-même aux données | Garde d'éligibilité, requête sur la matrice des droits |
