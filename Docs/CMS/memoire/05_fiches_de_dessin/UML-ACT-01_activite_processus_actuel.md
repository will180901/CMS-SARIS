# UML-ACT-01 — Diagramme d'activité du processus de consultation actuel

> ✅ **Fiche re-sourcée le 2026-08-10 sur la source primaire.** Elle repose sur le **recueil de l'existant**, section 3 — le processus de consultation **formalisé par le Médecin Chef lui-même** et décrit lors des entretiens.

## Bloc 1 — Cartouche

```
Identifiant       : UML-ACT-01
Figure du mémoire : Figure 5.1 — Diagramme d'activité du processus de consultation antérieur
Chapitre / section: 5 — § 5.2.3
Type UML          : Diagramme d'activité avec couloirs
Sources de preuve : Recueil de l'existant — section 3 « Processus de consultation médicale »,
                    section 1.3 « Organisation bi-sites », section 5 « Confidentialité »
                    Extrait dans INV-08 §§ 2.3, 4, 5 et 6
                    SOURCE PRIMAIRE : entretiens Médecin Chef et Infirmière
Statut            : OBSERVÉ
Format conseillé  : A3 portrait, ou A4 portrait en abrégeant les libellés
Densité           : 3 couloirs · 18 actions · 5 décisions · 5 points de rupture
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Le processus de consultation tel qu'il fonctionnait, **intégralement sur support papier**, avec ses quatre étapes formalisées et ses points de rupture.

**Sa raison d'être.** Elle est la **seule** représentation graphique du parcours de soin dans le mémoire. Le diagramme d'activité du parcours outillé, auquel elle devait être comparée, a été retiré lors de la réduction du document. Elle doit donc se suffire à elle-même : un lecteur qui ne verrait qu'elle doit comprendre où le papier fait rupture.

**Un point d'honnêteté à porter en légende.** Ce processus est **structuré et formalisé** — ce n'est pas un fonctionnement improvisé. Le Médecin Chef l'avait défini par écrit. Ce qui manquait n'était pas la méthode, mais **l'outil pour l'appliquer et en garder trace**. Le mémoire doit le dire : le système n'a pas inventé le processus, il l'a outillé.

**Ce qu'elle ne montre pas.** Les processus de la pharmacie et du service RH — hors périmètre.

---

## Bloc 3 — Éléments à dessiner

### Couloirs

| N° | Libellé exact | Position |
|---|---|---|
| P1 | `Infirmière (triage)` | gauche |
| P2 | `Médecin Chef ou infirmier délégué` | centre |
| P3 | `Supports papier` | droite |

> Le troisième couloir n'est pas un acteur : c'est **le support**. Choix délibéré, à expliquer en légende — il rend visible que l'information n'existe nulle part ailleurs.

### Nœuds

| N° | Libellé exact | Forme | Couloir |
|---|---|---|---|
| N00 | *(sans libellé)* | **Cercle plein** | P1 |
| A01 | `Le patient se présente au CMS` | Rectangle arrondi | P1 |
| A02 | `Relever le statut du patient` | Rectangle arrondi | P1 |
| A03 | `Collecter l'identité : nom, prénom, matricule` | Rectangle arrondi | P1 |
| A04 | `Rechercher le dossier dans le classeur ou le fichier local au site` | Rectangle arrondi | P1 |
| D01 | `Dossier trouvé sur CE site ?` | **Losange** | P1 |
| **R01** | `⚠ Patient déjà vu sur l'autre site : non retrouvé` | **Bord épais** | P3 |
| A05 | `Ouvrir une fiche papier` | Rectangle arrondi | P1 |
| D02 | `Consultation spécialisée ?` | **Losange** | P1 |
| A06 | `Renseigner le mode de vie (9 variables)` | Rectangle arrondi | P1 |
| A07 | `Recueillir les antécédents personnels et familiaux` | Rectangle arrondi | P1 |
| A08 | `Conduire l'anamnèse (4 questions)` | Rectangle arrondi | P1 |
| A09 | `Réaliser l'examen clinique (9 paramètres)` | Rectangle arrondi | P1 |
| A10 | `Consigner dans le carnet de santé du patient` | Rectangle arrondi | **P3** |
| **R02** | `⚠ Ordre de passage géré de tête` | **Bord épais** | P3 |
| D03 | `Cas simple ou complexe ?` | **Losange** | P1 |
| A11 | `Transmettre le carnet au Médecin Chef` | Rectangle arrondi | P1 |
| A12 | `Réaliser l'examen physique` | Rectangle arrondi | P2 |
| A13 | `Formuler les hypothèses diagnostiques` | Rectangle arrondi | P2 |
| D04 | `Bilan complémentaire nécessaire ?` | **Losange** | P2 |
| A14 | `Rédiger le bon d'examen à la main` | Rectangle arrondi | P2 |
| D05 | `Statut donnant droit ? (contrôle visuel du badge)` | **Losange** | P2 |
| **R03** | `⚠ Droit vérifié de mémoire, sans garde-fou` | **Bord épais** | P3 |
| A15 | `Refuser la prise en charge — orienter vers refacturation` | Rectangle arrondi | P2 |
| A16 | `Écrire l'ordonnance à la main` | Rectangle arrondi | P2 |
| A17 | `Établir la fiche de repos si travailleur` | Rectangle arrondi | P2 |
| A18 | `Rendre le carnet au patient` | Rectangle arrondi | P2 |
| A19 | `Enregistrer le passage dans le registre papier` | Rectangle arrondi | P1 |
| **R04** | `⚠ Aucune trace de qui a décidé quoi` | **Bord épais** | P3 |
| A20 | `Reporter dans le fichier tableur, a posteriori` | Rectangle arrondi | P1 |
| **R05** | `⚠ Comptage manuel — consolidation bi-sites par le Médecin Chef` | **Bord épais** | P3 |
| N99 | *(sans libellé)* | **Cercle plein cerclé** | P1 |

---

## Bloc 4 — Contenu des formes

Libellés à écrire **exactement** comme indiqué.

Les cinq **points de rupture** ne sont pas des actions : ce sont des **annotations de défaut**, en rectangle à bord épais, préfixées ⚠, reliées à leur action par un **trait pointillé sans flèche**. Ce sont eux que le système supprime.

**Trois libellés portent un compte** — 9 variables, 4 questions, 9 paramètres. Ces nombres viennent du recueil et doivent être écrits : ils montrent que le processus était **standardisé**, non improvisé.

---

## Bloc 5 — Transitions

| N° | De | Vers | Garde |
|---:|---|---|---|
| T01 | N00 | A01 | — |
| T02 | A01 | A02 | — |
| T03 | A02 | A03 | — |
| T04 | A03 | A04 | — |
| T05 | A04 | D01 | — |
| T06 | D01 | D02 | `[oui]` |
| T07 | D01 | A05 | `[non]` |
| T08 | A05 | D02 | — |
| T09 | D02 | A11 | `[oui — triage allégé]` |
| T10 | D02 | A06 | `[non — consultation générale]` |
| T11 | A06 | A07 | — |
| T12 | A07 | A08 | — |
| T13 | A08 | A09 | — |
| T14 | A09 | A10 | — |
| T15 | A10 | D03 | — |
| T16 | D03 | A12 | `[cas simple — infirmier délégué]` |
| T17 | D03 | A11 | `[cas complexe ou doute]` |
| T18 | A11 | A12 | — |
| T19 | A12 | A13 | — |
| T20 | A13 | D04 | — |
| T21 | D04 | D05 | `[oui]` |
| T22 | D04 | A16 | `[non]` |
| T23 | D05 | A15 | `[non — CDD, sous-traitant, riverain, autre]` |
| T24 | D05 | A14 | `[oui — CDI ou ayant droit]` |
| T25 | A14 | A16 | — |
| T26 | A15 | A16 | — |
| T27 | A16 | A17 | — |
| T28 | A17 | A18 | — |
| T29 | A18 | A19 | — |
| T30 | A19 | A20 | — |
| T31 | A20 | N99 | — |

**31 transitions.**

### Liens d'annotation — pointillés, sans flèche

| N° | Rupture | Attachée à |
|---|---|---|
| Z01 | R01 | D01, branche « non » |
| Z02 | R02 | A10 |
| Z03 | R03 | D05 |
| Z04 | R04 | A19 |
| Z05 | R05 | A20 |

### Notes obligatoires

| Attachée à | Texte |
|---|---|
| A10 | *« Le carnet de santé individuel est le seul support de circulation de l'information entre les étapes. Le patient le transporte. »* |
| D02 | *« Pour l'ophtalmologie, l'ORL et la stomatologie, le triage est allégé : statut et identité seulement, sans anamnèse ni examen clinique. »* |
| D03 | *« Règle absolue : dès qu'un doute ou une complexité apparaît, le dossier est immédiatement remis au Médecin Chef, seul décisionnaire. »* |
| D05 | *« Prise en charge complète réservée aux CDI et à leurs ayants droit. Pour les autres statuts : soins assurés, puis refacturation à la société employeuse ou à l'assurance. »* |
| Couloir P1, en marge | *« L'infirmière n'a accès qu'au résumé de la consultation en cours — règle de confidentialité du centre. »* |

---

## Bloc 6 — Plan de placement

Trois couloirs verticaux de largeur égale, nommés en haut. Flux descendant, en quatre blocs correspondant aux quatre étapes du processus formalisé.

| Bloc | Étapes | Couloir dominant |
|---|---|---|
| **1 — Triage et identification** | N00 à A05, D02 | P1 |
| **2 — Recueil clinique** *(le plus dense)* | A06 à A10 | P1 |
| **3 — Consultation et décision** | D03 à A18 | P2 |
| **4 — Enregistrement** | A19, A20, N99 | P1 |

**Règles de tracé :**

- Le couloir P3 ne contient **que** `A10` et les cinq ruptures. Il doit paraître **presque vide** : c'est le message visuel de la figure.
- Les cinq ruptures s'alignent le long du bord droit, à hauteur de l'étape annotée.
- La branche `[triage allégé]` de D02 court-circuite tout le bloc 2 : la tracer en longeant le bord gauche, clairement.
- La branche `[cas simple]` de D03 mène directement à A12 sans passer par A11 : c'est la délégation, elle doit se voir.
- Aucune flèche ne remonte.

**Ce que la figure doit porter seule.** Le diagramme comparatif ayant été supprimé, trois exigences se reportent sur celle-ci :

1. orientation de haut en bas, sans exception ;
2. conventions de formes constantes d'un bout à l'autre ;
3. **le troisième couloir doit être nommé `Supports papier`**, et la légende doit dire explicitement que ce couloir disparaît dans le système conçu. Ce glissement résume le projet ; il n'est plus montré par une seconde figure, il doit donc être écrit.

---

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Nœud initial | Cercle plein |
| Nœud final | Cercle plein cerclé |
| Action | Rectangle à coins arrondis |
| Décision | Losange, question à l'intérieur |
| **Point de rupture** | Rectangle à **bord épais**, préfixe ⚠ |
| Transition | Flèche pleine, tête ouverte |
| Lien d'annotation | Trait pointillé, sans flèche |
| Garde | Entre crochets, sur la flèche |

**Légende à reproduire :**

> **Figure 5.1 — Diagramme d'activité du processus de consultation antérieur**
> Processus formalisé par le Médecin Chef, appliqué intégralement sur support papier. Le troisième couloir représente les supports, non un acteur : l'information n'existe que là. Les cinq encadrés à bord épais signalent les points de rupture que le nouveau système supprime.
> *Source : recueil de l'existant, entretiens Médecin Chef et Infirmière.*

---

## Bloc 8 — Contrôles après dessin

```
[ ] Les 3 couloirs sont présents et nommés
[ ] Le couloir « Supports papier » ne contient QUE A10 et les 5 ruptures
[ ] Les 26 actions et 5 décisions sont présentes
[ ] Les 31 transitions sont tracées
[ ] Chaque sortie de losange porte sa garde entre crochets
[ ] La branche « triage allégé » court-circuite bien tout le bloc 2
[ ] La branche « cas simple » va directement à l'examen physique, sans passer par le médecin
[ ] Les 5 points de rupture sont en bord ÉPAIS, préfixés ⚠
[ ] Les 5 liens d'annotation sont en pointillés SANS flèche
[ ] Les 5 notes obligatoires sont présentes
[ ] Les trois comptes — 9 variables, 4 questions, 9 paramètres — sont écrits
[ ] Aucun élément informatique n'apparaît, hormis le fichier tableur
[ ] L'orientation est de haut en bas et les conventions de formes sont constantes
[ ] Un seul nœud final
```

---

## Vérification finale contre la source primaire

| Point | Source dans le recueil |
|---|---|
| Processus en 4 étapes formalisé par le Médecin Chef | Section 3, préambule |
| Étape 1 : relevé du statut puis de l'identité | Section 3.1 |
| Mode de vie — 9 variables | Section 3.1, tableau |
| Antécédents personnels et familiaux | Section 3.1, tableau |
| Anamnèse — 4 questions | Section 3.2 |
| Examen clinique — 9 paramètres, IMC calculé | Section 3.3, tableau |
| Décision cas simple / cas complexe à l'issue de l'examen | Section 3.3 |
| Consultation médicale en 6 sous-étapes | Section 3.4, tableau |
| Fiche de repos si travailleur | Section 3.4, étape 5 |
| **Triage allégé** pour les consultations spécialisées | Section 3.5 |
| Règle absolue de remise au Médecin Chef en cas de doute | Section 4.2 |
| Prise en charge réservée aux CDI et ayants droit | Section 2.2 |
| Refacturation pour les autres statuts | Section 2.2, tableau |
| Confidentialité — infirmier limité au résumé en cours | Section 5, tableau |
| Consolidation bi-sites manuelle par le Médecin Chef | Section 1.3 |
| Flux papier et verbal | Section 2.1 de l'entretien RH |

## Ce qui reste à confirmer

| Point | Question |
|---|---|
| Le carnet est-il conservé par le patient ou au centre entre deux visites ? | QO-04 |
| Quelle durée prenait un passage complet ? | QO-04 |
| Existait-il un transfert d'information informel entre les deux sites — téléphone, courrier ? | QO-04 |

> Ces trois points enrichiraient la figure sans la remettre en cause. Elle est traçable en l'état.
