# UML-SEQS-02 — Séquence système : émettre un bon de pharmacie

## Bloc 1 — Cartouche

```
Identifiant       : UML-SEQS-02
Figure du mémoire : Figure 6.7 — Diagramme de séquence système : émettre un bon de pharmacie
Chapitre / section: 6 — § 6.7
Type UML          : Diagramme de séquence système (boîte noire)
Sources de preuve : INV-07 § 4.4 · INV-01, contrôleur des bons de pharmacie
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 portrait
Densité           : 2 lignes de vie · 10 messages · 1 fragment alt · 2 cas d'erreur
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Que l'émission d'un bon est **conditionnée par la catégorie du patient**, et que le refus, lorsqu'il survient, est explicite et motivé. C'est la figure qui rend visible la règle métier centrale du système.

**Ce qu'elle ne montre pas.** Le mécanisme interne du contrôle — matrice en base, garde applicative. Il figure en `UML-SEQO-01`.

## Bloc 3 — Éléments à dessiner

| N° | Libellé exact | Forme | Placement |
|---|---|---|---|
| L1 | `Soignant` | Bonhomme-bâton avec ligne de vie | extrême gauche |
| L2 | `: CMS SARIS` | Rectangle avec ligne de vie | centre-droit |

## Bloc 4 — Contenu des formes

Identique à `UML-SEQS-01` : deux lignes de vie, le système en boîte noire.

## Bloc 5 — Messages à tracer

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M01 | Soignant | Système | `ouvrirOrdonnanceValidée(idOrdonnance)` | appel |
| M02 | Système | Soignant | `ordonnance (type, lignes, statut)` | retour |
| M03 | Soignant | Système | `demanderGénérationBonPharmacie(idOrdonnance)` | appel |
| M04 | Système | Système | `vérifierOrdonnanceValidée()` | auto-appel |
| M05 | Système | Système | `lireCatégorieDuPatient()` | auto-appel |
| M06 | Système | Système | `vérifierÉligibilité(catégorie, « MEDICAMENT »)` | **auto-appel — point focal** |

### Fragment `alt` — Résultat du contrôle d'éligibilité

Cadre `alt` englobant, placé juste après M06. **C'est le cœur de la figure : lui donner de l'espace.**

**Branche A — `[catégorie couverte]`**

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M07 | Système | Système | `créerBon(statut = EN_ATTENTE)` | auto-appel |
| M08 | Système | Système | `reprendreLignesDeLOrdonnance()` | auto-appel |
| M09 | Système | Système | `journaliserÀLAudit()` | auto-appel |
| M10 | Système | Soignant | `bon créé (identifiant, statut EN_ATTENTE)` | retour |
| M11 | Soignant | Système | `demanderImpression(idBon)` | appel |
| M12 | Système | Soignant | `document A4 prêt à imprimer` | retour |

**Branche B — `[catégorie non couverte]`**

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M13 | Système | Soignant | `refus : « La catégorie « … » n'ouvre pas droit à la prise en charge des médicaments — réservé au personnel CDI et à leurs ayants droit »` | retour |

Terminer la branche B par une **croix** sur la ligne de vie : aucun bon n'est créé.

### Note obligatoire

Une **bulle** attachée à M06 :

> *« Matrice `DroitCategoriePatient` : CONSULTATION et PREMIERS_SOINS ouverts à toutes les catégories ; MEDICAMENT et EXAMEN réservés aux CDI et à leurs ayants droit. »*

## Bloc 6 — Plan de placement

Deux lignes de vie verticales.

Ordre vertical : M01 → M02 → M03 → M04 → M05 → M06 → **cadre `alt`** (branche A au-dessus, branche B en dessous, séparées par un pointillé horizontal).

**Règles de tracé :**
- Les auto-appels M04, M05, M06 sont trois boucles successives sur la ligne de vie du système, bien distinctes.
- Le cadre `alt` occupe au moins **la moitié inférieure** de la planche : c'est là qu'est l'information.
- La branche A est **au-dessus** de la branche B — le cas nominal en premier.
- Le message de refus M13 est long : le tracer sur deux lignes de texte, aligné à droite du trait.
- La bulle de note se place **à gauche** de M06, reliée en pointillés.

## Bloc 7 — Conventions et légende

Mêmes conventions que `UML-SEQS-01`.

**Légende à reproduire :**

> **Figure 6.7 — Diagramme de séquence système : émettre un bon de pharmacie**
> Le contrôle d'éligibilité s'applique au bon, jamais à l'ordonnance : tout patient peut recevoir une ordonnance ; seuls les CDI et leurs ayants droit obtiennent la prise en charge.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Deux lignes de vie seulement
[ ] Les 13 messages sont présents, dans l'ordre du bloc 5
[ ] M04, M05, M06 sont des auto-appels distincts
[ ] Le fragment alt porte ses deux gardes entre crochets
[ ] La branche A (cas nominal) est au-dessus de la branche B
[ ] La branche B se termine par une croix — aucun bon créé
[ ] Le message de refus nomme explicitement la catégorie et rappelle la règle
[ ] La bulle de note sur la matrice des droits est présente
[ ] Aucune mention n'attribue le contrôle à l'ordonnance
```

## Vérification finale

| Point | Source |
|---|---|
| Le contrôle porte sur la prestation « médicament » | Garde d'éligibilité, appel avec ce type de prestation |
| Le message de refus nomme la catégorie | Texte de l'exception, repris mot pour mot |
| L'ordonnance n'est pas restreinte par catégorie | INV-07 § 4.4, remarque d'analyse |
| Le bon naît à l'état « en attente » | INV-07 § 3.5 |
