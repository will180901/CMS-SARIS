# UML-UC-01 — Diagramme de cas d'utilisation global

## Bloc 1 — Cartouche

```
Identifiant       : UML-UC-01
Figure du mémoire : Figure 6.2 — Diagramme de cas d'utilisation global du système CMS SARIS
Chapitre / section: 6 — § 6.3
Type UML          : Diagramme de cas d'utilisation
Sources de preuve : INV-01 (routes) · INV-03 (permissions par rôle) · INV-04 (écrans)
Statut            : IMPLÉMENTÉ
Format conseillé  : A3 paysage — 65 cas ne tiennent pas lisiblement en A4
Densité           : 4 acteurs · 22 cas d'utilisation regroupés · 12 paquets
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** Que le système couvre douze domaines fonctionnels, et que **chaque acteur y accède différemment** — l'infirmier ne voyant qu'une partie de ce que voit le médecin chef, lui-même n'accédant pas à tout ce que voit l'administrateur.

**Décision de représentation.** Les **65 cas d'utilisation identifiés au chapitre 6 ne sont pas tous tracés**. Une planche de 65 ovales serait illisible et n'apprendrait rien. Le diagramme représente **22 cas regroupés**, chacun correspondant à un ensemble cohérent d'opérations sur un même objet métier.

Ce regroupement est une **simplification de représentation, pas une réduction du périmètre** : la liste exhaustive des 65 cas figure au chapitre 6 § 6.3, et les spécifications détaillées en annexe C. La légende doit le préciser.

---

## Bloc 3 — Éléments à dessiner

### Acteurs

| N° | Libellé exact | Forme | Placement |
|---|---|---|---|
| A1 | `Administrateur Système` | Bonhomme-bâton | gauche, haut |
| A2 | `Médecin Chef` | Bonhomme-bâton | gauche, milieu |
| A3 | `Infirmier` | Bonhomme-bâton | gauche, bas |
| A4 | `Poste local autonome` | Rectangle `«système»` | **droite** |

### Frontière du système

Un **rectangle englobant** portant en haut à gauche le libellé `CMS SARIS`. Tous les cas d'utilisation sont **à l'intérieur**, tous les acteurs **à l'extérieur**.

### Cas d'utilisation — ovales

| N° | Libellé exact à écrire | Paquet | Regroupe |
|---|---|---|---|
| U01 | `Se connecter` | Sécurité | UC01 à UC03, UC07 |
| U02 | `Gérer son compte personnel` | Sécurité | UC04 à UC06, UC08 |
| U03 | `Gérer les comptes et les rôles` | Habilitations | UC09 à UC13 |
| U04 | `Consulter le journal d'audit` | Supervision | UC14 |
| U05 | `Paramétrer le système` | Supervision | UC15, UC16 |
| U06 | `Consulter les référentiels` | Référentiels | UC17 |
| U07 | `Administrer les référentiels` | Référentiels | UC18, UC19 |
| U08 | `Tenir le registre des employés` | Référentiels | UC20 |
| U09 | `Gérer le personnel médical` | Acteurs | UC21 |
| U10 | `Gérer les délégations de prescription` | Acteurs | UC22 à UC24 |
| U11 | `Gérer le dossier patient` | Dossier | UC25 à UC29, UC33 |
| U12 | `Administrer un dossier` | Dossier | UC30 à UC32 |
| U13 | `Enregistrer une visite` | Triage | UC34 à UC36, UC38 |
| U14 | `Consulter la file d'attente` | Triage | UC37 |
| U15 | `Conduire une consultation` | Consultation | UC39 à UC41, UC48, UC49 |
| U16 | `Prescrire` | Consultation | UC42, UC47 |
| U17 | `Émettre et suivre les bons` | Consultation | UC43 à UC46 |
| U18 | `Gérer une évacuation` | Sorties critiques | UC50, UC51 |
| U19 | `Gérer un suivi de traitement` | Sorties critiques | UC52, UC53 |
| U20 | `Communiquer` | Communication | UC54 à UC58 |
| U21 | `Piloter l'activité` | Pilotage | UC59 à UC61 |
| U22 | `Synchroniser les données` | Synchronisation | UC62 à UC65 |

## Bloc 4 — Contenu des formes

Chaque ovale contient **uniquement** son libellé, tel qu'écrit ci-dessus. Aucun identifiant, aucune numérotation dans l'ovale.

Les **paquets** sont des rectangles à onglet regroupant visuellement les ovales apparentés. Ils portent le nom du paquet sur l'onglet. Ils sont facultatifs mais fortement recommandés : sans eux, 22 ovales flottent sans structure.

---

## Bloc 5 — Associations à tracer

Chaque association est un **trait plein simple, sans tête de flèche**, reliant un acteur à un ovale.

| Cas | `Administrateur Système` | `Médecin Chef` | `Infirmier` | `Poste local` |
|---|:---:|:---:|:---:|:---:|
| U01 Se connecter | ✅ | ✅ | ✅ | |
| U02 Gérer son compte personnel | ✅ | ✅ | ✅ | |
| U03 Gérer les comptes et les rôles | ✅ | ✅ | | |
| U04 Consulter le journal d'audit | ✅ | ✅ | | |
| U05 Paramétrer le système | ✅ | | | |
| U06 Consulter les référentiels | ✅ | ✅ | ✅ | |
| U07 Administrer les référentiels | ✅ | ✅ | | |
| U08 Tenir le registre des employés | ✅ | ✅ | ✅ | |
| U09 Gérer le personnel médical | ✅ | ✅ | | |
| U10 Gérer les délégations | ✅ | ✅ | ✅ *(consultation seule)* | |
| U11 Gérer le dossier patient | ✅ | ✅ | ✅ | |
| U12 Administrer un dossier | ✅ | ✅ | | |
| U13 Enregistrer une visite | ✅ | ✅ | ✅ | |
| U14 Consulter la file d'attente | ✅ | ✅ | ✅ | |
| U15 Conduire une consultation | ✅ | ✅ | ✅ | |
| U16 Prescrire | ✅ | ✅ | ✅ *(sous délégation)* | |
| U17 Émettre et suivre les bons | ✅ | ✅ | ✅ | |
| U18 Gérer une évacuation | ✅ | ✅ | | |
| U19 Gérer un suivi de traitement | ✅ | ✅ | ✅ | |
| U20 Communiquer | ✅ | ✅ | ✅ | |
| U21 Piloter l'activité | ✅ | ✅ | ✅ | |
| U22 Synchroniser les données | ✅ *(supervision)* | | | ✅ |

**Total : 61 associations à tracer.**

### Annotations obligatoires

Deux associations portent une **note** attachée par un trait pointillé — sans elles, le diagramme ment sur les droits réels.

| Association | Note à écrire dans une bulle |
|---|---|
| `Infirmier` → `Prescrire` | *« uniquement sous délégation active accordée par le médecin chef »* |
| `Infirmier` → `Gérer les délégations` | *« consultation de ses propres délégations uniquement »* |

### Contrainte de cloisonnement

Une **note générale**, attachée au paquet Consultation :

> *« L'infirmier ne voit que les consultations qu'il a lui-même conduites. »*

---

## Bloc 6 — Plan de placement

**Deux zones séparées par la frontière du système.**

**À gauche de la frontière** : les trois acteurs humains, empilés verticalement, dans l'ordre A1, A2, A3 de haut en bas. Cet ordre reflète le niveau de droits décroissant.

**À droite de la frontière** : l'acteur système A4, seul, à hauteur du paquet Synchronisation.

**À l'intérieur de la frontière** : les 22 ovales, organisés en **quatre rangées** correspondant à quatre bandes thématiques.

| Rangée | Paquets | Ovales |
|---|---|---|
| 1 — haut | Sécurité, Habilitations, Supervision | U01, U02, U03, U04, U05 |
| 2 | Référentiels, Acteurs | U06, U07, U08, U09, U10 |
| 3 — **centrale, la plus importante** | Dossier, Triage, Consultation | U11 à U17 |
| 4 — bas | Sorties critiques, Communication, Pilotage, Synchronisation | U18 à U22 |

**Règles de tracé :**
- La rangée 3 porte le **cœur métier** : lui donner le plus d'espace vertical.
- Les traits partant de l'`Administrateur Système` sont les plus nombreux (21 sur 22) : les faire longer le bord supérieur pour éviter qu'ils ne traversent la planche en diagonale.
- Aucun trait ne doit traverser un ovale.
- Le seul trait venant de la droite est celui du poste local vers U22.

---

## Bloc 7 — Conventions et légende

| Élément | Convention |
|---|---|
| Cas d'utilisation | Ovale, libellé centré, verbe à l'infinitif |
| Acteur humain | Bonhomme-bâton |
| Acteur système | Rectangle `«système»` |
| Association | Trait plein, sans tête de flèche |
| Frontière | Rectangle englobant, titre en haut à gauche |
| Paquet | Rectangle à onglet |
| Note | Bulle rectangulaire à coin corné, reliée en pointillés |

**Légende à reproduire :**

> **Figure 6.2 — Diagramme de cas d'utilisation global du système CMS SARIS**
> Les 22 cas représentés regroupent les 65 cas d'utilisation identifiés, listés au chapitre 6 § 6.3 et spécifiés en annexe C. Ce regroupement est une simplification de représentation, non une réduction du périmètre.
> *Source : conception propre, dérivée des permissions et des routes du système.*

## Bloc 8 — Contrôles après dessin

```
[ ] Les 4 acteurs sont présents, à l'EXTÉRIEUR de la frontière
[ ] Les 22 ovales sont présents, à l'INTÉRIEUR de la frontière
[ ] Les 61 associations correspondent case par case au tableau du bloc 5
[ ] L'infirmier n'est PAS relié à : U03, U04, U05, U07, U09, U12, U18, U22
[ ] Le médecin chef n'est PAS relié à : U05, U22
[ ] Les 2 notes obligatoires sont présentes et reliées en pointillés
[ ] La note de cloisonnement est attachée au paquet Consultation
[ ] Aucun trait ne traverse un ovale
[ ] Aucun acteur supplémentaire n'a été inventé
[ ] La légende précise le regroupement 22 / 65
```

## Vérification finale

| Point | Source |
|---|---|
| Répartition des droits par acteur | INV-03 § 3, matrice permission × rôle |
| L'infirmier n'a aucune permission d'administration | INV-03 § 1.1 |
| Le médecin chef n'a ni paramètres ni synchronisation | INV-04 § 3 |
| La prescription infirmière exige une délégation | INV-07 § 5.2 |
