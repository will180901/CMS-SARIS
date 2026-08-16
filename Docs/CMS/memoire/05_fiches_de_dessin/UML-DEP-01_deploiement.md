# UML-DEP-01 — Diagramme de déploiement

## Bloc 1 — Cartouche

```
Identifiant       : UML-DEP-01
Figure du mémoire : Figure 7.7 — Diagramme de déploiement
Chapitre / section: 7 — § 7.7
Type UML          : Diagramme de déploiement
Sources de preuve : Fichier de déploiement · INV-05 §§ 2 et 3
Statut            : IMPLÉMENTÉ pour le serveur · PARTIELLEMENT IMPLÉMENTÉ pour le poste autonome
Format conseillé  : A4 paysage
Densité           : 6 nœuds · 9 artefacts · 7 liens de communication
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Sur quelles machines chaque composant s'exécute, et surtout la différence entre un poste **connecté** — qui ne fait que dialoguer — et un poste **autonome** — qui héberge son propre serveur et sa propre base.

**Limite de la figure, à énoncer.** L'infrastructure réseau du centre — équipements, liaison entre les deux sites — n'est pas représentée : elle relève du chapitre 2, dont la source est absente. Cette figure décrit le déploiement **logiciel**, non l'infrastructure physique du centre.

## Bloc 3 — Nœuds à dessiner

Chaque nœud est un **parallélépipède en perspective**, convention UML du nœud de déploiement.

| N° | Libellé exact | Stéréotype | Placement |
|---|---|---|---|
| N1 | `Serveur d'application` | `«serveur»` | centre-haut |
| N2 | `Serveur de base de données` | `«serveur de données»` | droite-haut |
| N3 | `Poste client — mode connecté` | `«poste de travail»` | gauche |
| N4 | `Poste client — mode autonome` | `«poste de travail»` | droite-bas |
| N5 | `Navigateur` | `«environnement d'exécution»` | extrême gauche |
| N6 | `Service de géolocalisation` | `«externe»` | extrême droite |

## Bloc 4 — Artefacts à placer dans les nœuds

Chaque artefact est un **rectangle portant le stéréotype `«artefact»`**, dessiné **à l'intérieur** de son nœud.

| Nœud | Artefacts contenus |
|---|---|
| `Serveur d'application` | `serveur-api` *(application NestJS compilée)* · `site-web-statique` *(interface React compilée)* |
| `Serveur de base de données` | `base-cms-saris` *(PostgreSQL 16)* |
| `Poste client — mode connecté` | `CMS-SARIS.exe` *(client Electron)* · `coffre-de-secrets` *(chiffré par le système d'exploitation)* |
| `Poste client — mode autonome` | `CMS-SARIS.exe` · `serveur-api-embarque` · `base-locale.db` *(SQLite)* · `coffre-de-secrets` |
| `Navigateur` | `application-web` *(exécutée depuis le cache)* · `base-du-navigateur` *(file hors ligne chiffrée)* |

## Bloc 5 — Liens de communication

Traits **pleins** entre nœuds, annotés du protocole et de son usage.

| N° | De | Vers | Annotation à écrire |
|---:|---|---|---|
| R01 | `Navigateur` | `Serveur d'application` | `HTTPS` — API REST et flux d'événements |
| R02 | `Poste client — mode connecté` | `Serveur d'application` | `HTTPS` — API REST et flux d'événements |
| R03 | `Serveur d'application` | `Serveur de base de données` | `TCP chiffré` |
| R04 | `Poste client — mode autonome` | `Serveur d'application` | `HTTPS` — **synchronisation uniquement**, quand le réseau est disponible |
| R05 | `Serveur d'application` | `Service de géolocalisation` | `HTTPS` — avec **repli hors ligne** en cas d'échec |
| R06 | *interne à N4* | — | `127.0.0.1` — **boucle locale seulement** |
| R07 | *interne à N4* | — | accès fichier à la base locale |

### Annotations obligatoires

| Sur | Note |
|---|---|
| R06 | *« Le serveur embarqué n'écoute que sur la boucle locale. Il n'est jamais exposé au réseau du poste : aucune autre machine ne peut l'interroger. »* |
| R01, R02, R04 | *« HTTPS obligatoire en production. Une liaison non chiffrée ferait transiter jetons d'authentification et données patient en clair. »* |
| N4 | *« Le poste autonome fonctionne sans R04. La synchronisation reprend au retour du réseau. »* |
| `coffre-de-secrets` | *« Chiffré au repos par le système d'exploitation, lié au compte de session. La session survit au redémarrage. »* |
| `base-du-navigateur` | *« File des écritures hors ligne, chiffrée en AES-256-GCM. »* |

## Bloc 6 — Plan de placement

**Deux zones séparées par un espace vertical net.**

**Zone supérieure — Infrastructure hébergée** : `Serveur d'application` au centre, `Serveur de base de données` à sa droite, `Service de géolocalisation` à l'extrême droite. Un cadre pointillé englobant, annoté `Hébergement — région Europe`.

**Zone inférieure — Postes du centre** : `Navigateur` à l'extrême gauche, `Poste client — mode connecté` à gauche, `Poste client — mode autonome` à droite. Un cadre pointillé englobant, annoté `Centre Médico-Sanitaire — sites de Moutela et Nkayi`.

**Règles de tracé :**
- Le `Poste client — mode autonome` doit être **visiblement plus grand** que le mode connecté : il contient quatre artefacts contre deux. Cette différence de taille est pédagogique.
- R04 est le seul lien du poste autonome vers l'extérieur : le tracer en **pointillés**, annoté `intermittent`.
- R06 est un lien **interne** au nœud N4 : le tracer entièrement à l'intérieur du parallélépipède, entre `CMS-SARIS.exe` et `serveur-api-embarque`.
- Aucun lien ne relie directement les deux postes clients entre eux.

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Nœud | Parallélépipède en perspective, stéréotype au-dessus du nom |
| Artefact | Rectangle `«artefact»`, à l'intérieur du nœud |
| Lien de communication | Trait plein, annoté du protocole |
| Lien intermittent | Trait pointillé, annoté |
| Frontière | Rectangle pointillé nommé |

**Légende à reproduire :**

> **Figure 7.7 — Diagramme de déploiement**
> Le poste en mode autonome héberge son propre serveur et sa propre base, et n'a besoin du serveur central que pour se synchroniser. Le serveur embarqué n'écoute que sur la boucle locale. L'infrastructure réseau du centre n'est pas représentée : elle relève du chapitre 2.
> *Source : conception propre.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 6 nœuds sont des parallélépipèdes, avec leur stéréotype
[ ] Les 9 artefacts sont à l'INTÉRIEUR de leur nœud
[ ] Le poste autonome contient bien 4 artefacts
[ ] Les 7 liens sont tracés et annotés de leur protocole
[ ] R04 est en POINTILLÉS et annoté « intermittent »
[ ] R06 est entièrement INTERNE au nœud du poste autonome
[ ] Les 2 frontières sont tracées et nommées
[ ] Les 5 annotations obligatoires sont présentes
[ ] Aucun lien direct entre les deux postes clients
[ ] Le poste autonome est visiblement plus grand que le poste connecté
[ ] Aucune adresse IP réelle, aucun nom d'hôte de production n'apparaît
```

## Vérification finale

| Point | Source |
|---|---|
| Deux services hébergés, base externe | Fichier de déploiement |
| Le serveur embarqué est restreint à la boucle locale | INV-05 § 2.2 |
| HTTPS exigé en production | INV-05 § 2.3 |
| Coffre de secrets chiffré par le système | INV-05 § 3.1 |
| Repli hors ligne de la géolocalisation | INV-01 § 5.5 |
| File du navigateur chiffrée | INV-05 § 6.2 |
