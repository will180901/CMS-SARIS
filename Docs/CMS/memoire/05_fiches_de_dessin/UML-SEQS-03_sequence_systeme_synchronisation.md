# UML-SEQS-03 — Séquence système : synchroniser un poste local

## Bloc 1 — Cartouche

```
Identifiant       : UML-SEQS-03
Figure du mémoire : Figure 6.6 — Diagramme de séquence système : synchroniser un poste local
Chapitre / section: 6 — § 6.7
Type UML          : Diagramme de séquence système (boîte noire)
Sources de preuve : INV-05 § 5 · INV-07 § 4.9
Statut            : PARTIELLEMENT IMPLÉMENTÉ — validation d'exécution restant à faire
Format conseillé  : A4 portrait
Densité           : 2 lignes de vie · 13 messages · 1 loop · 1 alt · 1 opt
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Que la synchronisation est un cycle **déclenché par une notification et non par une interrogation périodique**, qu'elle procède en deux temps — réception puis envoi — et qu'un conflit est **tranché puis journalisé, jamais bloquant**.

**Particularité de ce cas.** C'est le seul dont l'acteur principal est un **système** et non un humain.

## Bloc 3 — Éléments à dessiner

| N° | Libellé exact | Forme | Placement |
|---|---|---|---|
| L1 | `: Poste local autonome` | **Rectangle** avec ligne de vie | gauche |
| L2 | `: Serveur central` | **Rectangle** avec ligne de vie | droite |

> Deux rectangles, aucun bonhomme-bâton : les deux extrémités sont des systèmes. C'est une particularité à ne pas gommer.

## Bloc 4 — Contenu des formes

Chaque rectangle contient exactement le libellé indiqué, deux points inclus.

## Bloc 5 — Messages à tracer

### Phase 1 — Établissement

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M01 | Poste local | Serveur central | `enregistrerPoste(identitéDuPoste)` | appel |
| M02 | Serveur central | Poste local | `poste enregistré` | retour |
| M03 | Poste local | Serveur central | `sAbonnerAuCanalDeNotification()` | appel |

### Phase 2 — Attente — fragment `loop`

Cadre `loop`, garde `[tant que le poste est en service]`.

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M04 | Serveur central | Poste local | `battement()` | **asynchrone** |
| M05 | Serveur central | Poste local | `nouveauté(origine)` | **asynchrone** |

Une **note** attachée à ce cadre :

> *« Le battement et la notification portent des types différents : le poste ne synchronise que sur la notification. Sans cette distinction, il synchroniserait à chaque battement — ce qui reviendrait à une interrogation périodique. »*

Fragment `opt` imbriqué, garde `[origine = ce poste]` :
- M06 : Poste local → Poste local — `ignorer` (auto-appel). Le poste n'est pas réveillé pour son propre travail.

### Phase 3 — Réception

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M07 | Poste local | Serveur central | `demanderModifications(depuis = dernierHorodatage)` | appel |
| M08 | Serveur central | Poste local | `deltas + marques de suppression (paginés)` | retour |
| M09 | Poste local | Poste local | `appliquerLocalement()` | auto-appel |

### Phase 4 — Envoi

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M10 | Poste local | Serveur central | `envoyerModificationsLocales(lot)` | appel |
| M11 | Serveur central | Serveur central | `résoudreConflitPourChaqueEnregistrement()` | auto-appel |

### Fragment `alt` — Résultat par enregistrement

Cadre `alt`, trois branches :

| Branche | Garde | Message |
|---|---|---|
| A | `[aucun conflit]` | M12 : Serveur central → Serveur central — `appliquer()` |
| B | `[entrant périmé]` | M13 : Serveur central → Serveur central — `ignorer()` |
| C | `[écriture concurrente détectée]` | M14 : Serveur central → Serveur central — `appliquerLeGagnantParDernièreÉcriture()` <br> M15 : Serveur central → Serveur central — `journaliserLeConflitPourRevue()` |

### Phase 5 — Compte rendu

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M16 | Serveur central | Poste local | `compte rendu : appliqués / ignorés / conflits` | retour |
| M17 | Poste local | Poste local | `mettreÀJourLeCurseurDeSynchronisation()` | auto-appel |

### Cas d'exception — fragment `opt`

Cadre `opt`, garde `[serveur central injoignable]` :
- M18 : Poste local → Poste local — `continuerSurLaBaseLocale()` (auto-appel)

Une **note** attachée :

> *« Le poste ne s'arrête jamais. L'indisponibilité du central est un état normal, pas une erreur. »*

## Bloc 6 — Plan de placement

Deux lignes de vie verticales, écartées d'environ 60 % de la largeur.

Ordre vertical strict : phases 1 → 2 → 3 → 4 → 5, puis le fragment d'exception en bas.

**Règles de tracé :**
- M04 et M05 sont **asynchrones** : flèche à **tête ouverte en demi-pointe**, jamais tête pleine. Le serveur n'attend pas de réponse.
- Le fragment `loop` englobe M04 à M06, avec le `opt` imbriqué en retrait.
- Le fragment `alt` de la phase 4 contient trois branches séparées par des pointillés horizontaux — donner de l'espace à la branche C, la plus riche.
- Toutes les résolutions de conflit sont des **auto-appels sur la ligne de vie du serveur central** : c'est lui qui arbitre.
- Le fragment d'exception se place **en dernier**, visuellement détaché.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Appel synchrone | Flèche pleine, tête pleine |
| **Appel asynchrone** | Flèche pleine, **tête ouverte en demi-pointe** |
| Retour | Flèche pointillée, tête ouverte |
| Auto-appel | Boucle sur la ligne de vie |
| `loop`, `alt`, `opt` | Cadre avec mot-clé en pentagone, gardes entre crochets |

**Légende à reproduire :**

> **Figure 6.6 — Diagramme de séquence système : synchroniser un poste local**
> Les deux extrémités sont des systèmes. Un conflit est tranché par la règle de la dernière écriture, puis journalisé pour revue — il n'est jamais bloquant.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Deux rectangles — aucun bonhomme-bâton
[ ] Les 18 messages sont présents, dans l'ordre du bloc 5
[ ] M04 et M05 sont ASYNCHRONES (tête en demi-pointe)
[ ] Le fragment loop englobe la phase d'attente, avec le opt imbriqué
[ ] Le fragment alt comporte bien TROIS branches
[ ] La branche C comporte les DEUX messages : appliquer le gagnant, puis journaliser
[ ] Les résolutions sont des auto-appels du SERVEUR, pas du poste
[ ] Les deux notes obligatoires sont présentes
[ ] Le fragment d'exception « serveur injoignable » est en bas, détaché
[ ] Nulle part il n'est écrit qu'un conflit bloque ou met en attente
```

## Vérification finale

| Point | Source |
|---|---|
| Le canal ne transporte aucune donnée | INV-05 § 5.4 |
| Battement et notification de types différents | INV-05 § 5.4 |
| Le poste à l'origine n'est pas réveillé | INV-05 § 5.4 |
| Les trois issues de la résolution | INV-05 § 5.3, table de décision |
| Le compte rendu en trois catégories | Réponse du service d'envoi |
