# UML-SEQS-01 — Séquence système : se connecter au système

## Bloc 1 — Cartouche

```
Identifiant       : UML-SEQS-01
Figure du mémoire : Figure 6.4 — Diagramme de séquence système : se connecter au système
Chapitre / section: 6 — § 6.7
Type UML          : Diagramme de séquence système (boîte noire)
Sources de preuve : INV-07 § 4.8 · INV-01, contrôleur de sécurité
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 portrait
Densité           : 2 lignes de vie · 14 messages · 3 fragments · 3 cas d'erreur
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Que l'authentification n'est pas un simple échange identifiant / mot de passe, mais un enchaînement à **quatre branches conditionnelles** et **trois cas d'erreur**, dont un blocage à durée croissante.

**Ce qu'elle ne montre pas.** Aucun composant interne. Le système est une seule ligne de vie. Les mécanismes internes figurent en `UML-SEQO-*`.

## Bloc 3 — Éléments à dessiner

| N° | Libellé exact | Forme | Placement |
|---|---|---|---|
| L1 | `Agent` | Bonhomme-bâton, avec ligne de vie verticale en pointillés | **extrême gauche** |
| L2 | `: CMS SARIS` | **Rectangle**, avec ligne de vie verticale en pointillés | **centre-droit** |

Deux lignes de vie seulement. Le système est en boîte noire.

## Bloc 4 — Contenu des formes

`Agent` : bonhomme-bâton, nom écrit dessous.
`: CMS SARIS` : rectangle contenant exactement `: CMS SARIS` — les deux points initiaux signalent une instance, convention UML à respecter.

## Bloc 5 — Messages à tracer

**Sens** : `Agent → Système` pour les appels, `Système → Agent` pour les retours.
**Convention** : appel = flèche pleine à tête pleine ; retour = flèche **pointillée** à tête ouverte.

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M01 | Agent | Système | `saisirIdentifiants(login, motDePasse)` | appel |
| M02 | Système | Système | `vérifierBlocageEnCours()` | **auto-appel** |
| M03 | Système | Système | `vérifierMotDePasse()` | **auto-appel** |
| M04 | Système | Agent | `étapeSuivante : totp \| session \| jetons` | retour |

### Fragment `alt` n° 1 — Blocage en cours

Cadre `alt` englobant, **placé juste après M02**.

| Branche | Garde | Messages |
|---|---|---|
| A | `[compte bloqué]` | M05 : Système → Agent — `refus(dureeRestante)` puis **fin du scénario** |
| B | `[sinon]` | la séquence continue en M03 |

### Fragment `alt` n° 2 — Résultat de la vérification du mot de passe

Cadre `alt` englobant, **placé juste après M03**.

| Branche | Garde | Messages |
|---|---|---|
| A | `[mot de passe erroné]` | M06 : Système → Système — `incrémenterTentatives()` <br> M07 : Système → Système — `si seuil atteint : bloquer(durée × 4)` <br> M08 : Système → Agent — `refus` puis **fin** |
| B | `[mot de passe correct]` | M09 : Système → Système — `réinitialiserCompteurs()` |

> ⚠️ Écrire la garde **`durée × 4`** telle quelle : c'est la formule réelle d'escalade du blocage, et c'est un détail que le jury remarquera.

### Fragment `opt` n° 1 — Second facteur

Cadre `opt`, garde `[second facteur activé]`.

| N° | De | Vers | Message |
|---:|---|---|---|
| M10 | Système | Agent | `demanderCodeTemporaire()` |
| M11 | Agent | Système | `saisirCode(code)` |
| M12 | Système | Système | `déchiffrerSecret() puis vérifierCode()` |

Fragment `alt` **imbriqué** dans ce `opt` :
- `[code invalide]` → M13 : Système → Agent — `refus` puis fin
- `[code valide]` → la séquence continue

### Fragment `opt` n° 2 — Session concurrente

Cadre `opt`, garde `[session déjà ouverte ailleurs]`.

| N° | De | Vers | Message |
|---:|---|---|---|
| M14 | Système | Agent | `signalerSessionConcurrente()` |
| M15 | Agent | Système | `confirmerNouvelleSession()` |

### Suite du scénario nominal

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M16 | Système | Système | `émettreJetons()` | auto-appel |
| M17 | Système | Système | `chargerDroitsEffectifs()` | auto-appel |
| M18 | Système | Agent | `session ouverte, droits effectifs` | retour |

### Fragment `opt` n° 3 — Obligations avant accès

Cadre `opt`, garde `[mot de passe temporaire ou conditions non acceptées]`.

| N° | De | Vers | Message |
|---:|---|---|---|
| M19 | Système | Agent | `exigerChangementMotDePasse() ou exigerAcceptationConditions()` |
| M20 | Agent | Système | `satisfaireObligation()` |

### Message final

| N° | De | Vers | Message | Type |
|---:|---|---|---|---|
| M21 | Système | Agent | `rediriger vers page d'accueil du rôle` | retour |

## Bloc 6 — Plan de placement

Deux lignes de vie verticales, écartées d'environ 60 % de la largeur de la page.

Ordre vertical strict, de haut en bas :
M01 → M02 → **alt n° 1** → M03 → **alt n° 2** → **opt n° 1 (second facteur)** → **opt n° 2 (session concurrente)** → M16 → M17 → M18 → **opt n° 3 (obligations)** → M21.

**Règles de tracé :**
- Les auto-appels se dessinent en **boucle sur la ligne de vie du système**, jamais vers l'acteur.
- Les cadres de fragment portent leur mot-clé (`alt`, `opt`) **en haut à gauche**, dans un petit pentagone.
- Dans un `alt`, une **ligne pointillée horizontale** sépare les branches.
- Chaque garde s'écrit **entre crochets**, en haut de sa branche.
- Les branches d'erreur se terminent par une **croix** sur la ligne de vie, marquant la fin du scénario.
- L'`alt` imbriqué du second facteur est **entièrement contenu** dans le cadre `opt` parent, avec un retrait visible.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Appel | Flèche pleine, tête pleine |
| Retour | Flèche **pointillée**, tête ouverte |
| Auto-appel | Boucle sur la ligne de vie elle-même |
| Barre d'activation | Rectangle étroit sur la ligne de vie pendant le traitement |
| Fragment | Cadre rectangulaire, mot-clé dans un pentagone en haut à gauche |
| Garde | Entre crochets, en haut de branche |
| Fin de scénario | Croix sur la ligne de vie |

**Légende à reproduire :**

> **Figure 6.4 — Diagramme de séquence système : se connecter au système**
> Le système est représenté en boîte noire. La durée de blocage est multipliée par quatre à chaque récidive.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Deux lignes de vie seulement — aucun composant interne visible
[ ] Les 21 messages sont présents, dans l'ordre exact du bloc 5
[ ] Les 3 auto-appels sont des boucles sur la ligne de vie du système
[ ] Les retours sont en POINTILLÉS, les appels en trait plein
[ ] Les 2 fragments alt et les 3 fragments opt sont tracés avec leur mot-clé
[ ] L'alt du second facteur est IMBRIQUÉ dans le opt parent
[ ] Chaque garde est écrite entre crochets
[ ] La formule « durée × 4 » apparaît telle quelle
[ ] Les 3 branches d'erreur se terminent par une croix
[ ] Aucun mot de passe, aucun jeton réel n'apparaît
```

## Vérification finale

| Point | Source |
|---|---|
| Ordre des étapes d'authentification | INV-07 § 4.8 |
| Escalade du blocage par multiplication par quatre | Service de sécurité, calcul du prochain blocage |
| Les deux étapes intermédiaires possibles | Type de retour du service : `totp` ou `session` |
| Blocage par les conditions d'utilisation | INV-04 § 5.2 |
