# UML-UC-01 — Diagramme de cas d'utilisation global

## Bloc 1 — Cartouche

```
Identifiant       : UML-UC-01
Figures du mémoire : Figure 6.2 à Figure 6.6 — un diagramme par package
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

Ce regroupement est une **simplification de représentation, pas une réduction du périmètre** : la liste exhaustive des 65 cas est portée par le tableau 6.5 du mémoire, qui les répartit par module, et trois d'entre eux sont spécifiés en détail au § 6.7. La légende doit le préciser.

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

> **Figure 6.2 à 6.6 — Cas d'utilisation, un diagramme par package**
> Les 22 cas représentés regroupent les 65 cas d'utilisation identifiés, listés au chapitre 6 § 6.3 et spécifiés au chapitre 6 § 6.7 pour les trois cas prioritaires. Ce regroupement est une simplification de représentation, non une réduction du périmètre.
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

---

## ⚠️ Changement du 24 août 2026 — cinq diagrammes au lieu d'un

Le mémoire ne comporte plus **un** diagramme de cas d'utilisation global, mais **cinq**, un par package. Soixante-cinq cas d'utilisation sur une seule planche seraient illisibles au format A4, et un diagramme illisible ne communique rien.

Le découpage est celui du § 6.6 du mémoire, tableaux 6.6 à 6.10.

| Figure | Package | Cas d'utilisation | Acteurs à représenter | Place dans le document |
|---|---|---:|---|---|
| Figure 6.2 | Sécurité et habilitations | 16 — UC01 à UC16 | Administrateur système, Médecin Chef, Infirmier | demi-page |
| Figure 6.3 | Référentiels et acteurs médicaux | 8 — UC17 à UC24 | Administrateur système, Médecin Chef, Infirmier | demi-page |
| Figure 6.4 | Dossier patient | 9 — UC25 à UC33 | Administrateur système, Médecin Chef, Infirmier | demi-page |
| Figure 6.5 | Parcours de soin | 20 — UC34 à UC53 | Médecin Chef, Infirmier | demi-page |
| Figure 6.6 | Fonctions transverses | 12 — UC54 à UC65 | Administrateur système, Médecin Chef, Infirmier, Poste local | page entière |

**Comment tracer chacun.** Un rectangle porte le nom du package. À l'intérieur, une ellipse par cas d'utilisation, avec son identifiant et son libellé exact — les libellés sont dans les tableaux 6.6 à 6.10 du mémoire, ne pas les réinventer. À l'extérieur, les acteurs en bonshommes filaires, reliés par un trait plein aux cas qu'ils déclenchent.

**Les relations d'inclusion et d'extension** figurent aux tableaux 6.11 et 6.12. Ne tracer que celles qui concernent le package représenté, en pointillés avec le stéréotype `<<include>>` ou `<<extend>>`.

**Deux diagrammes par page**, sauf le dernier. Chaque image doit donc tenir dans une demi-page A4 : environ 16 cm de large sur 11 cm de haut. Le package Parcours de soin, avec ses 20 cas, est le plus dense — regrouper visuellement le triage, la consultation et les sorties critiques.

**À ne pas oublier en légende** : préciser que le diagramme représente un package, et renvoyer au tableau correspondant pour la liste complète.

---

# Bloc 9 — Découpage par package : ce qu'il faut tracer sur chaque planche

> **Les soixante-cinq cas d'utilisation existent, mais on n'en dessine pas soixante-cinq ovales.** Les tableaux 6.6 à 6.10 du mémoire les nomment tous, un par un. Les planches, elles, représentent les **vingt-deux cas regroupés** du bloc 3 — un ovale par groupe. C'est ce qui rend les diagrammes lisibles, et le mémoire le dit explicitement au § 6.7 : « représenter ces dix-huit cas individuellement rendrait le diagramme illisible sans rien apprendre ».

Chaque planche porte **un rectangle** au nom du package, les ovales de ce package à l'intérieur, et les acteurs concernés à l'extérieur.

---

## Figure 6.2 — Package Sécurité et habilitations *(demi-page)*

**Cinq ovales :** `Se connecter` (U01) · `Gérer son compte personnel` (U02) · `Gérer les comptes et les rôles` (U03) · `Consulter le journal d'audit` (U04) · `Paramétrer le système` (U05)

**Trois acteurs :** Administrateur Système · Médecin Chef · Infirmier

| Ovale | Administrateur | Médecin Chef | Infirmier |
|---|:---:|:---:|:---:|
| Se connecter | ✅ | ✅ | ✅ |
| Gérer son compte personnel | ✅ | ✅ | ✅ |
| Gérer les comptes et les rôles | ✅ | ✅ | |
| Consulter le journal d'audit | ✅ | ✅ | |
| Paramétrer le système | ✅ | | |

**Onze traits.** Ce package couvre UC01 à UC16 — 16 cas d'utilisation regroupés en 5 ovales.

**Relation à tracer :** `Se connecter` est étendu par `Valider le second facteur`, en pointillés avec `<<extend>>` et la condition `[si le second facteur est activé]`. C'est la seule relation de ce package, et elle est au tableau 6.12 du mémoire.

---

## Figure 6.3 — Package Référentiels et acteurs médicaux *(demi-page)*

**Cinq ovales :** `Consulter les référentiels` (U06) · `Administrer les référentiels` (U07) · `Tenir le registre des employés` (U08) · `Gérer le personnel médical` (U09) · `Gérer les délégations de prescription` (U10)

**Trois acteurs :** Administrateur Système · Médecin Chef · Infirmier

| Ovale | Administrateur | Médecin Chef | Infirmier |
|---|:---:|:---:|:---:|
| Consulter les référentiels | ✅ | ✅ | ✅ |
| Administrer les référentiels | ✅ | ✅ | |
| Tenir le registre des employés | ✅ | ✅ | ✅ |
| Gérer le personnel médical | ✅ | ✅ | |
| Gérer les délégations de prescription | ✅ | ✅ | ✅ *(consultation seule)* |

**Douze traits.** Ce package couvre UC17 à UC24.

**Annotation obligatoire.** Sur le trait qui relie l'Infirmier à `Gérer les délégations`, écrire *« consultation seule »*. L'infirmier consulte ses délégations, il n'en accorde jamais. Sans cette note, la planche laisse croire le contraire.

---

## Figure 6.4 — Package Dossier patient *(demi-page)*

Ce package ne compte que deux cas regroupés. Pour éviter une planche trop pauvre, on trace ici **les neuf cas d'utilisation individuels**, dont les libellés exacts sont au tableau 6.8 du mémoire.

**Neuf ovales :** `Rechercher un patient` (UC25) · `Créer un dossier` (UC26) · `Consulter un dossier` (UC27) · `Mettre à jour identité et données médicales` (UC28) · `Gérer les rattachements` (UC29) · `Changer la catégorie` (UC30) · `Verrouiller ou déverrouiller un dossier` (UC31) · `Archiver un dossier` (UC32) · `Imprimer un dossier` (UC33)

**Trois acteurs :** Administrateur Système · Médecin Chef · Infirmier

L'Infirmier est relié à UC25, UC26, UC27, UC28, UC29 et UC33. Il n'est **pas** relié à UC30, UC31 et UC32 : changer une catégorie, verrouiller un dossier et archiver relèvent du Médecin Chef et de l'Administrateur.

**Vingt-quatre traits.** Cette différence de droits est le message de la planche : elle montre visuellement le cloisonnement décrit au § 3.1 du mémoire.

---

## Figure 6.5 — Package Parcours de soin *(demi-page)*

**Sept ovales :** `Enregistrer une visite` (U13) · `Consulter la file d'attente` (U14) · `Conduire une consultation` (U15) · `Prescrire` (U16) · `Émettre et suivre les bons` (U17) · `Gérer une évacuation` (U18) · `Gérer un suivi de traitement` (U19)

**Trois acteurs :** Administrateur Système · Médecin Chef · Infirmier

| Ovale | Administrateur | Médecin Chef | Infirmier |
|---|:---:|:---:|:---:|
| Enregistrer une visite | ✅ | ✅ | ✅ |
| Consulter la file d'attente | ✅ | ✅ | ✅ |
| Conduire une consultation | ✅ | ✅ | ✅ |
| Prescrire | ✅ | ✅ | ✅ *(sous délégation)* |
| Émettre et suivre les bons | ✅ | ✅ | ✅ |
| Gérer une évacuation | ✅ | ✅ | |
| Gérer un suivi de traitement | ✅ | ✅ | ✅ |

**Dix-neuf traits.** Ce package couvre UC34 à UC53, soit vingt cas d'utilisation — c'est le plus fourni du système.

**Deux annotations obligatoires.** Sur le trait Infirmier vers `Prescrire`, écrire *« sous délégation »*. Et l'Infirmier n'est pas relié à `Gérer une évacuation` : la décision d'évacuation appartient au seul Médecin Chef.

**Trois relations à tracer**, toutes au tableau 6.12 du mémoire :

- `Conduire une consultation` **étendu par** `Gérer une évacuation`, condition `[si la décision retenue est l'évacuation]`
- `Conduire une consultation` **étendu par** `Gérer un suivi de traitement`, condition `[si la décision retenue est le suivi]`
- `Prescrire` **étendu par** `Émettre et suivre les bons`, condition `[si l'ordonnance est validée]`

Ces trois relations sont le cœur métier du système. Elles doivent être visibles.

---

## Figure 6.6 — Package Fonctions transverses *(page entière)*

**Trois ovales seulement**, mais quatre acteurs : `Communiquer` (U20) · `Piloter l'activité` (U21) · `Synchroniser les données` (U22)

**Quatre acteurs :** Administrateur Système · Médecin Chef · Infirmier · **Poste local**

| Ovale | Administrateur | Médecin Chef | Infirmier | Poste local |
|---|:---:|:---:|:---:|:---:|
| Communiquer | ✅ | ✅ | ✅ | |
| Piloter l'activité | ✅ | ✅ | ✅ | |
| Synchroniser les données | ✅ *(supervision)* | | | ✅ |

**Huit traits.** Ce package couvre UC54 à UC65.

**C'est la planche la plus importante des cinq pour la soutenance**, et pourtant la plus simple. Elle est la seule où apparaît le **Poste local**, un acteur qui n'est pas une personne mais une machine. Un jury demandera pourquoi : parce que la synchronisation est le seul cas dont l'acteur principal est un système, et c'est ce qui distingue ce mémoire d'un dossier médical ordinaire.

Comme elle occupe une page entière, dessine les acteurs plus grands et laisse respirer. Écris en note, sous le rectangle : *« Le Poste local est un acteur secondaire : il déclenche la synchronisation sans intervention humaine. »*

---

## Récapitulatif des cinq planches

| Figure | Package | Ovales | Acteurs | Traits | Cas couverts |
|---|---|---:|---:|---:|---|
| 6.2 | Sécurité et habilitations | 5 | 3 | 11 | UC01 à UC16 |
| 6.3 | Référentiels et acteurs médicaux | 5 | 3 | 12 | UC17 à UC24 |
| 6.4 | Dossier patient | 9 | 3 | 24 | UC25 à UC33 |
| 6.5 | Parcours de soin | 7 | 3 | 19 | UC34 à UC53 |
| 6.6 | Fonctions transverses | 3 | 4 | 8 | UC54 à UC65 |
| | **Total** | **29 ovales** | | **74 traits** | **65 cas** |

## Contrôle avant de coller les cinq planches

```
[ ] Chaque planche porte un rectangle au nom de son package
[ ] Les libellés des ovales sont copiés du bloc 3, pas réinventés
[ ] Les trois annotations obligatoires sont écrites : « consultation seule »,
    « sous délégation », et la note sur le Poste local
[ ] L'Infirmier n'est relié ni à « Gérer une évacuation », ni à UC30, UC31, UC32
[ ] Les quatre relations d'extension sont en POINTILLÉS avec <<extend>>
    et leur condition entre crochets
[ ] Le Poste local n'apparaît QUE sur la figure 6.6
[ ] Les quatre premières planches tiennent dans 16 cm sur 11
[ ] La planche 6.6 occupe une page entière
```

---

# Bloc 10 — Aide-mémoire de tracé : les 65 cas, prêts à recopier

> Ce bloc existe pour que tu n'aies **jamais à ouvrir le mémoire** pendant que tu dessines. Les libellés ci-dessous sont ceux des tableaux 6.6 à 6.10 du document, au mot près.

**Rappel de la règle.** Sur les planches 6.2, 6.3, 6.5 et 6.6 tu dessines les **cas regroupés** — un ovale par groupe. Sur la planche 6.4 tu dessines les **neuf cas individuels**, parce que ce package n'a que deux groupes.

**Codes des acteurs :** **A** = Administrateur système · **M** = Médecin Chef · **I** = Infirmier · **P** = Poste local.

## Figure 6.2 — Sécurité et habilitations · 5 ovales

| Ovale à dessiner | Regroupe | Acteurs à relier |
|---|---|---|
| `Se connecter` | UC01 Se connecter · UC02 Valider le second facteur · UC03 Résoudre une connexion concurrente · UC07 Accepter les conditions | A M I |
| `Gérer son compte personnel` | UC04 Changer son mot de passe · UC05 Consulter et révoquer ses sessions · UC06 Activer ou désactiver son second facteur · UC08 Gérer ses préférences | A M I |
| `Gérer les comptes et les rôles` | UC09 Créer et gérer un compte · UC10 Attribuer un rôle · UC11 Éditer la matrice d'un rôle · UC12 Accorder ou révoquer une permission individuelle · UC13 Réinitialiser un mot de passe | A M |
| `Consulter le journal d'audit` | UC14 | A M |
| `Paramétrer le système` | UC15 Consulter les paramètres · UC16 Modifier les paramètres | A |

## Figure 6.3 — Référentiels et acteurs médicaux · 5 ovales

| Ovale à dessiner | Regroupe | Acteurs à relier |
|---|---|---|
| `Consulter les référentiels` | UC17 | A M I |
| `Administrer les référentiels` | UC18 Créer, modifier ou désactiver une entrée · UC19 Gérer les sociétés sous-traitantes | A M |
| `Tenir le registre des employés` | UC20 | A M I |
| `Gérer le personnel médical` | UC21 | A M |
| `Gérer les délégations de prescription` | UC22 Accorder une délégation · UC23 Révoquer une délégation · UC24 Consulter ses délégations actives | A M · **I en consultation seule** |

## Figure 6.4 — Dossier patient · 9 ovales individuels

| Ovale à dessiner | Acteurs à relier |
|---|---|
| `Rechercher un patient` (UC25) | A M I |
| `Créer un dossier` (UC26) | A M I |
| `Consulter un dossier` (UC27) | A M I |
| `Mettre à jour identité et données médicales` (UC28) | A M I |
| `Gérer les rattachements` (UC29) | A M I |
| `Changer la catégorie` (UC30) | **A M seulement** |
| `Verrouiller ou déverrouiller un dossier` (UC31) | **A M seulement** |
| `Archiver un dossier` (UC32) | **A M seulement** |
| `Imprimer un dossier` (UC33) | A M I |

## Figure 6.5 — Parcours de soin · 7 ovales

| Ovale à dessiner | Regroupe | Acteurs à relier |
|---|---|---|
| `Enregistrer une visite` | UC34 Ouvrir une visite · UC35 Relever les constantes vitales · UC36 Affecter un soignant · UC38 Annuler une visite | A M I |
| `Consulter la file d'attente` | UC37 | A M I |
| `Conduire une consultation` | UC39 Ouvrir · UC40 Saisir l'examen clinique · UC41 Poser un diagnostic · UC48 Clôturer · UC49 Annuler | A M I |
| `Prescrire` | UC42 Créer et valider une ordonnance · UC47 Délivrer un certificat de repos | A M · **I sous délégation** |
| `Émettre et suivre les bons` | UC43 Bon de pharmacie · UC44 Délivrer le bon · UC45 Bon d'examen · UC46 Saisir un résultat | A M I |
| `Gérer une évacuation` | UC50 Initier · UC51 Suivre et clôturer | **A M seulement** |
| `Gérer un suivi de traitement` | UC52 Ouvrir · UC53 Ajouter une fiche | A M I |

## Figure 6.6 — Fonctions transverses · 3 ovales

| Ovale à dessiner | Regroupe | Acteurs à relier |
|---|---|---|
| `Communiquer` | UC54 Consulter ses conversations · UC55 Envoyer un message · UC56 Réagir, répondre, masquer · UC57 Consulter ses notifications · UC58 Diffuser une annonce | A M I |
| `Piloter l'activité` | UC59 Tableau de bord · UC60 Consulter un rapport · UC61 Exporter un rapport | A M I |
| `Synchroniser les données` | UC62 Enregistrer un poste local · UC63 Synchroniser un poste · UC64 Superviser le parc · UC65 Restaurer une sauvegarde | **P** · A en supervision |

## Les quatre relations d'extension à tracer

En **pointillés**, avec le stéréotype `<<extend>>` et la condition entre crochets. Elles sont au tableau 6.12 du mémoire.

| Sur la planche | Cas de base | Étendu par | Condition |
|---|---|---|---|
| 6.2 | `Se connecter` | `Valider le second facteur` | [si le second facteur est activé] |
| 6.5 | `Conduire une consultation` | `Gérer une évacuation` | [si la décision retenue est l'évacuation] |
| 6.5 | `Conduire une consultation` | `Gérer un suivi de traitement` | [si la décision retenue est le suivi] |
| 6.5 | `Prescrire` | `Émettre et suivre les bons` | [si l'ordonnance est validée] |

## Ce qu'il ne faut jamais faire

```
[ ] Ne pas dessiner les 65 cas individuels sur les planches 6.2, 6.3, 6.5 et 6.6
[ ] Ne pas relier l'Infirmier à « Gérer une évacuation »
[ ] Ne pas relier l'Infirmier à UC30, UC31 et UC32 sur la planche 6.4
[ ] Ne pas oublier les deux annotations : « consultation seule » et « sous délégation »
[ ] Ne pas faire apparaître le Poste local ailleurs que sur la planche 6.6
[ ] Ne pas inventer de relation d'inclusion : seules celles du tableau 6.11 existent
```
