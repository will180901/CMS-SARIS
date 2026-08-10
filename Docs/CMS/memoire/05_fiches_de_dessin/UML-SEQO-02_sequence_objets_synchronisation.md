# UML-SEQO-02 — Séquence objets : cycle de synchronisation avec conflit

## Bloc 1 — Cartouche

```
Identifiant       : UML-SEQO-02
Figure du mémoire : Figure 7.4 — Diagramme de séquence objets : cycle de synchronisation avec conflit
Chapitre / section: 7 — § 7.4.2
Type UML          : Diagramme de séquence (boîte blanche)
Sources de preuve : SyncController · SyncService · resolveConflict · SyncSupervisionService
Statut            : PARTIELLEMENT IMPLÉMENTÉ — validation d'exécution restant à faire
Format conseillé  : A4 paysage
Densité           : 7 lignes de vie · 19 messages · 1 loop · 1 alt à 3 branches
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Comment un conflit est détecté, tranché et journalisé — et que la décision provient d'une **fonction pure**, sans accès aux données, réutilisée à l'identique des deux côtés de la synchronisation.

## Bloc 3 — Lignes de vie à dessiner

| N° | Libellé exact | Forme | Ordre |
|---|---|---|---|
| L1 | `: PosteLocal` | Rectangle `«système»` | 1, extrême gauche |
| L2 | `: SyncController` | Rectangle | 2 |
| L3 | `: SyncService` | Rectangle | 3 |
| L4 | `: PrismaService` | Rectangle | 4 |
| L5 | `resolveConflict` | **Rectangle à bordure double** — fonction pure | 5 |
| L6 | `: SyncSupervisionService` | Rectangle | 6 |
| L7 | `: NotificationService` | Rectangle | 7, extrême droite |

> `resolveConflict` est dessiné à **bordure double** pour signaler qu'il ne s'agit pas d'un objet à état mais d'une **fonction pure**. Cette distinction visuelle est le point pédagogique de la figure, à expliquer en légende.

## Bloc 4 — Contenu des formes

Libellés exacts, deux points initiaux pour les instances. `resolveConflict` s'écrit **sans** les deux points : ce n'est pas une instance.

## Bloc 5 — Messages à tracer

### Phase 1 — Réception

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M01 | `: PosteLocal` | `: SyncController` | `GET /sync/pull(depuis)` | appel |
| M02 | `: SyncController` | `: SyncService` | `pull(idSite, depuis)` | appel |
| M03 | `: SyncService` | `: PrismaService` | `lireDeltas(depuis, tombstones inclus)` | appel |
| M04 | `: PrismaService` | `: SyncService` | `enregistrements modifiés, paginés` | retour |
| M05 | `: SyncService` | `: PosteLocal` | `deltas` | retour |

### Phase 2 — Envoi

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M06 | `: PosteLocal` | `: SyncController` | `POST /sync/push(lot)` | appel |
| M07 | `: SyncController` | `: SyncService` | `push(idSite, modifications)` | appel |

### Fragment `loop` — pour chaque enregistrement du lot

Cadre `loop`, garde `[pour chaque enregistrement du lot]`.

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M08 | `: SyncService` | `: PrismaService` | `lireExistant(modèle, identifiant)` | appel |
| M09 | `: PrismaService` | `: SyncService` | `existant, ou absent` | retour |
| M10 | `: SyncService` | `resolveConflict` | `resolveConflict(entrant, existant)` | appel |
| M11 | `resolveConflict` | `: SyncService` | `décision : apply \| skip \| conflict` | retour |

#### Fragment `alt` imbriqué — trois branches

**Branche A — `[apply]`**

| N° | De | Vers | Message |
|---:|---|---|---|
| M12 | `: SyncService` | `: PrismaService` | `écrire(entrant) puis restaurerHorodatageSource()` |

**Branche B — `[skip]`**

| N° | De | Vers | Message |
|---:|---|---|---|
| M13 | `: SyncService` | `: SyncService` | `ignorer()` — auto-appel |

**Branche C — `[conflict]`**

| N° | De | Vers | Message |
|---:|---|---|---|
| M14 | `: SyncService` | `resolveConflict` | `diffFields(entrant, existant)` |
| M15 | `resolveConflict` | `: SyncService` | `liste des champs divergents` |
| M16 | `: SyncService` | `: PrismaService` | `écrire(gagnant) puis restaurerHorodatageSource()` |
| M17 | `: SyncService` | `: SyncSupervisionService` | `journaliserConflit(modèle, id, champs, gagnant)` |

### Phase 3 — Compte rendu et propagation

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M18 | `: SyncService` | `: NotificationService` | `sonner(origine = ce poste)` | **asynchrone** |
| M19 | `: SyncService` | `: SyncController` | `appliqués / ignorés / conflits` | retour |
| M20 | `: SyncController` | `: PosteLocal` | `compte rendu` | retour |

### Notes obligatoires

| Attachée à | Texte |
|---|---|
| `resolveConflict` | *« Fonction pure : aucune entrée-sortie, aucune dépendance, déterministe. Le même code décide côté serveur central et côté poste autonome. 17 cas de test associés. »* |
| M12 et M16 | *« La restauration de l'horodatage source est indispensable : sans elle, le mécanisme automatique de datation ré-horodaterait l'enregistrement et invaliderait tout le raisonnement. »* |
| M17 | *« Le conflit est journalisé, jamais bloquant. Aucun verrou distribué n'est possible entre machines hors ligne. »* |
| M18 | *« Le poste à l'origine de l'écriture n'est pas réveillé pour son propre travail. »* |

## Bloc 6 — Plan de placement

Sept lignes de vie, dans l'ordre du bloc 3.

Ordre vertical : phase 1 → phase 2 → **cadre `loop`** (occupant environ 60 % de la hauteur) → phase 3.

**Règles de tracé :**
- Le cadre `loop` englobe les lignes de vie 3, 4, 5 et 6.
- Le cadre `alt` est **imbriqué** dans le `loop`, avec un retrait visible.
- La branche C est la plus riche : lui donner deux fois l'espace des branches A et B.
- M18 est **asynchrone** : tête de flèche en demi-pointe.
- Les appels vers `resolveConflict` sont courts et horizontaux : la fonction ne descend jamais vers la base.

> **Point à faire ressortir visuellement** : `resolveConflict` n'échange **jamais** avec `: PrismaService`. Aucun trait ne doit relier ces deux lignes de vie. C'est ce qui démontre la pureté de la fonction.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Instance | Rectangle `: NomDeClasse` |
| **Fonction pure** | Rectangle à **bordure double**, nom sans deux points |
| Appel synchrone | Flèche pleine, tête pleine |
| Appel asynchrone | Flèche pleine, tête en demi-pointe |
| Retour | Flèche pointillée, tête ouverte |
| `loop`, `alt` | Cadre, mot-clé en pentagone, garde entre crochets |

**Légende à reproduire :**

> **Figure 7.4 — Diagramme de séquence objets : cycle de synchronisation avec conflit**
> La bordure double signale une fonction pure, sans état ni accès aux données : le même code arbitre côté serveur central et côté poste autonome.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 7 lignes de vie sont présentes
[ ] resolveConflict est à BORDURE DOUBLE et sans deux points
[ ] AUCUN trait ne relie resolveConflict à PrismaService
[ ] Les 20 messages sont tracés dans l'ordre
[ ] Le fragment loop englobe la phase d'application
[ ] Le fragment alt est imbriqué dans le loop, avec ses TROIS branches
[ ] La branche « conflict » comporte bien : diff, écriture du gagnant, journalisation
[ ] M18 est asynchrone
[ ] Les 4 notes obligatoires sont présentes
[ ] Nulle part il n'est écrit qu'un conflit bloque
```

## Vérification finale

| Point | Source |
|---|---|
| Trois décisions possibles | INV-05 § 5.3 |
| La fonction est pure et testée | Extrait de code, chapitre 8 § 8.2.3 |
| Restauration de l'horodatage source | En-tête du service de synchronisation |
| Le poste d'origine n'est pas réveillé | INV-05 § 5.4 |
| Journalisation par le service de supervision | INV-01, module de synchronisation |
