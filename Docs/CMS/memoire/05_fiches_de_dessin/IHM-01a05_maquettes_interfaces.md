# IHM-01 à IHM-05 — Maquettes des interfaces principales

> **Note d'organisation.** Ces cinq maquettes partagent leurs conventions de tracé et leur charte. Elles sont regroupées dans une fiche unique pour éviter cinq fois la même page de conventions. Chacune conserve son cartouche, ses éléments et ses contrôles propres.

---

## Conventions communes — valent pour les cinq maquettes

### Ce qu'est une maquette dans ce mémoire

⚠️ **Distinction à ne jamais brouiller.** Une maquette est un **schéma de structure** : rectangles, zones, libellés. Ce n'est ni une capture d'écran, ni une illustration décorative. Les captures d'écran de l'application réelle figurent au **chapitre 8** (figures 8.3 et suivantes), avec leur propre protocole.

Le chapitre 7 présente la **conception** de l'interface ; le chapitre 8 présente ce qui a été **réalisé**. Confondre les deux serait une faute d'analyse.

### Conventions de tracé

| Élément | Convention |
|---|---|
| Zone de l'écran | Rectangle à trait plein, libellé à l'intérieur en haut à gauche |
| Zone conditionnelle | Rectangle à **trait pointillé**, avec sa condition d'affichage |
| Bouton | Rectangle arrondi, libellé centré |
| Champ de saisie | Rectangle avec son étiquette au-dessus |
| Liste ou tableau | Rectangle avec trois lignes horizontales schématiques |
| Zone floutée | Rectangle avec **hachures diagonales** |
| Annotation | Bulle reliée en pointillés, numérotée |

### Charte graphique appliquée

L'interface suit une charte formalisée en douze fiches. Les maquettes étant en noir et blanc, **ne pas colorer** : indiquer les intentions chromatiques par annotation lorsque c'est signifiant.

### Légende commune

Chaque maquette porte en légende :

> *Source : conception propre, conforme à la charte graphique du projet.*

---

# IHM-01 — Écran de connexion

## Bloc 1 — Cartouche

```
Identifiant       : IHM-01
Figure du mémoire : Figure 7.8 — Maquette de l'écran de connexion
Chapitre / section: 7 — § 7.8
Sources de preuve : Page de connexion · INV-07 § 4.8
Statut            : IMPLÉMENTÉ
Format conseillé  : demi-page A4
```

## Bloc 2 — Objectif

Montrer que l'authentification est **progressive** : l'écran change selon l'étape atteinte, au lieu d'afficher tous les champs d'emblée.

## Bloc 3 — Éléments à dessiner

| N° | Zone | Contenu |
|---|---|---|
| Z1 | En-tête | Logo, `CMS SARIS`, sous-titre `Centre Médico-Sanitaire` |
| Z2 | Carte centrale | Zone principale, centrée, largeur limitée |
| Z3 | Champ | Étiquette `Identifiant` + champ de saisie |
| Z4 | Champ | Étiquette `Mot de passe` + champ masqué |
| Z5 | Bouton | `Se connecter` |
| Z6 | Pied | Sélecteur de langue `FR / EN` |
| Z7 | **Zone conditionnelle** | `Étape 2 — Code de vérification` : champ à 6 caractères + compte à rebours |
| Z8 | **Zone conditionnelle** | `Session déjà ouverte` : message + boutons `Poursuivre ici` / `Annuler` |
| Z9 | **Zone conditionnelle** | `Mot de passe temporaire` : deux champs de nouveau mot de passe |

## Bloc 5 — Annotations obligatoires

| N° | Attachée à | Texte |
|---|---|---|
| 1 | Z7 | *« N'apparaît que si le second facteur est activé sur le compte. »* |
| 2 | Z8 | *« N'apparaît que si une autre session est ouverte. Règle de session unique. »* |
| 3 | Z9 | *« Bloquant : aucun accès tant que le mot de passe temporaire n'est pas changé. »* |

## Bloc 6 — Placement

Carte centrée horizontalement et verticalement, largeur d'environ 40 % de l'écran. Les trois zones conditionnelles se dessinent **à droite de la maquette principale**, reliées par des flèches annotées de leur condition — elles ne se superposent pas.

## Bloc 8 — Contrôles

```
[ ] Les 9 zones sont présentes
[ ] Les 3 zones conditionnelles sont en POINTILLÉS
[ ] Chaque zone conditionnelle porte sa condition d'affichage
[ ] Le champ mot de passe est représenté masqué
[ ] AUCUN identifiant ni mot de passe réel n'est écrit — utiliser des points ou « … »
[ ] Le sélecteur de langue est présent
```

---

# IHM-02 — Tableau de bord

## Bloc 1 — Cartouche

```
Identifiant       : IHM-02
Figure du mémoire : Figure 7.9 — Maquette du tableau de bord
Chapitre / section: 7 — § 7.8
Sources de preuve : Page de tableau de bord · INV-03 (permissions) · INV-04 § 3
Statut            : IMPLÉMENTÉ
Format conseillé  : pleine page A4 paysage — deux variantes côte à côte
```

## Bloc 2 — Objectif

**Le point capital de cette maquette** : le tableau de bord **n'est pas le même selon le rôle**. Chaque profil ne charge que ses propres données. Il faut donc dessiner **deux variantes côte à côte**, c'est la démonstration la plus directe de l'adaptation par rôle.

## Bloc 3 — Éléments à dessiner

### Ossature commune (les deux variantes)

| N° | Zone | Contenu |
|---|---|---|
| Z1 | Barre latérale gauche | Menu filtré par permission — voir bloc 5 |
| Z2 | En-tête | Recherche, bascule de confidentialité, cloche de notifications, menu utilisateur |
| Z3 | Fil d'Ariane | Chemin de navigation |
| Z4 | Rangée d'indicateurs | 3 à 4 tuiles chiffrées |
| Z5 | Zone de graphiques | 2 à 3 blocs |

### Variante A — Profil clinique *(médecin chef ou infirmier)*

| Zone | Contenu |
|---|---|
| Z4 | `File d'attente` · `Consultations du jour` · `Bons en attente` · `Évacuations en cours` |
| Z5 | `Tendance de l'activité` (courbe) · `Affluence par heure` (barres) · `Motifs les plus fréquents` (barres classées) |
| Z6 | Bloc `Mes délégations` |

### Variante B — Profil administrateur système

| Zone | Contenu |
|---|---|
| Z4 | `Comptes actifs` · `Connexions du jour` · `Sessions ouvertes` · `Postes synchronisés` |
| Z5 | `Authentifications` (courbe) · `Actions auditées` (barres) · `Répartition par rôle` (anneau) |

## Bloc 5 — Le menu latéral, filtré

C'est l'élément le plus démonstratif. Dessiner **les deux menus côte à côte**, avec les entrées absentes visiblement manquantes.

| Groupe | Entrée | Administrateur | Médecin Chef | Infirmier |
|---|---|:---:|:---:|:---:|
| Espace de travail | Tableau de bord | ✅ | ✅ | ✅ |
| Espace de travail | Rapports | ✅ | ✅ | ✅ |
| Espace de travail | Triage | ✅ | ✅ | ✅ |
| Espace de travail | Dossiers médicaux | ✅ | ✅ | ✅ |
| Espace de travail | Consultations | ✅ | ✅ | ✅ |
| Espace de travail | Messagerie | ✅ | ✅ | ✅ |
| Administration médicale | Référentiels | ✅ | ✅ | ✅ |
| Administration | Accès & habilitations | ✅ | ✅ | ⬜ |
| Administration | Paramètres système | ✅ | ⬜ | ⬜ |
| Administration | Journaux d'audit | ✅ | ✅ | ⬜ |
| Administration | Synchronisation | ✅ | ⬜ | ⬜ |
| Administration | Base de données | ✅ | ⬜ | ⬜ |

**Annotation obligatoire** :

> *« Le groupe Administration disparaît entièrement pour l'infirmier : un groupe dont toutes les entrées sont refusées n'est pas affiché grisé, il n'existe pas. »*

## Bloc 8 — Contrôles

```
[ ] Les DEUX variantes sont dessinées côte à côte
[ ] Les indicateurs diffèrent entre les deux variantes
[ ] Les deux menus montrent visiblement des entrées différentes
[ ] Le groupe Administration est ABSENT du menu infirmier, pas grisé
[ ] L'annotation sur la disparition du groupe est présente
[ ] Aucune donnée chiffrée réelle — utiliser des valeurs manifestement fictives
```

---

# IHM-03 — File de triage

## Bloc 1 — Cartouche

```
Identifiant       : IHM-03
Figure du mémoire : Figure 7.10 — Maquette de la file de triage
Chapitre / section: 7 — § 7.8
Sources de preuve : Page de triage · INV-07 §§ 3.1 et 4.1
Statut            : IMPLÉMENTÉ
Format conseillé  : pleine largeur A4 paysage
```

## Bloc 2 — Objectif

Montrer la disposition en **deux panneaux** — file à gauche, détail à droite — et le fait que la file est ordonnée **par arrivée**, sans aucun marqueur de priorité.

## Bloc 3 — Éléments à dessiner

| N° | Zone | Contenu |
|---|---|---|
| Z1 | Barre latérale | Menu, entrée `Triage` mise en évidence |
| Z2 | En-tête de page | Titre `Triage`, bouton `Nouvelle visite`, filtres `Actives / Clôturées / Annulées` |
| Z3 | **Panneau gauche — file** | Liste de cartes de visite, **largeur fixe** |
| Z4 | Carte de visite *(élément répété)* | Numéro de patient · nom · **heure d'arrivée** · motif · état · soignant assigné |
| Z5 | **Panneau droit — détail** | Détail de la visite sélectionnée |
| Z6 | Dans Z5 | Bloc `Constantes vitales` : température, tension, pouls, saturation, poids, taille, indice de masse corporelle |
| Z7 | Dans Z5 | Bloc `Actions` : `Prendre en charge` · `Assigner un soignant` · `Annuler` |
| Z8 | **Zone conditionnelle** | Panneau `Nouvelle visite`, remplaçant Z5 |
| Z9 | **Zone conditionnelle** | État vide : « Sélectionnez une visite » |

## Bloc 5 — Annotations obligatoires

| N° | Attachée à | Texte |
|---|---|---|
| 1 | Z3 | *« Ordre d'arrivée strict. Aucune notion de priorité clinique n'existe dans le système. »* |
| 2 | Z6 | *« Zone floutée en permanence, révélée au survol — rideau de confidentialité, actif par défaut. »* |
| 3 | Z3 | *« Sur mobile, les deux panneaux s'empilent : la file occupe la largeur, le détail la remplace à la sélection. »* |

**Z6 doit être dessinée avec des hachures diagonales** — c'est la représentation du floutage.

## Bloc 8 — Contrôles

```
[ ] Les deux panneaux sont visibles, avec une largeur fixe à gauche
[ ] La carte de visite affiche l'HEURE D'ARRIVÉE
[ ] AUCUN indicateur de priorité, de gravité ou de couleur d'urgence n'apparaît
[ ] Le bloc des constantes est HACHURÉ (rideau de confidentialité)
[ ] Les 3 annotations sont présentes
[ ] Les zones conditionnelles sont en pointillés
[ ] Aucun nom de patient réel — utiliser « Patient A », « Patient B »
```

---

# IHM-04 — Dossier patient

## Bloc 1 — Cartouche

```
Identifiant       : IHM-04
Figure du mémoire : Figure 7.11 — Maquette du dossier patient
Chapitre / section: 7 — § 7.8
Sources de preuve : Page de dossier · INV-04 § 4.2
Statut            : IMPLÉMENTÉ
Format conseillé  : pleine largeur A4 paysage
```

## Bloc 2 — Objectif

Montrer la navigation à **deux niveaux** — quatre sections, chacune contenant des sous-onglets — et le fait que certains sous-onglets **n'existent pas** pour certains profils.

## Bloc 3 — Éléments à dessiner

| N° | Zone | Contenu |
|---|---|---|
| Z1 | En-tête de dossier | Photo · nom · numéro de patient · matricule · **badge de catégorie** · badge de verrouillage si posé |
| Z2 | Navigation de section | 4 onglets : `Aperçu` · `Dossier médical` · `Parcours de soin` · `Administratif` |
| Z3 | Sous-onglets | Varient selon la section active — voir bloc 4 |
| Z4 | Zone de contenu | Contenu du sous-onglet actif |
| Z5 | Barre d'actions | `Imprimer le dossier` · `Changer la catégorie` · `Verrouiller` |

## Bloc 4 — Les neuf sous-onglets

| Section | Sous-onglets | Restriction |
|---|---|---|
| `Aperçu` | `Identité` · `Alertes` | — |
| `Dossier médical` | `Antécédents` · `Documents` | `Documents` réservé aux profils cliniques |
| `Parcours de soin` | `Visites` · `Consultations` · `Suivi de traitement` | **les trois** réservés aux profils cliniques |
| `Administratif` | `Rattachements` · `Historique de catégorie` | `Rattachements` exige une permission dédiée |

Dessiner la section `Parcours de soin` comme section active : c'est celle qui porte le plus d'information.

## Bloc 5 — Annotations obligatoires

| N° | Attachée à | Texte |
|---|---|---|
| 1 | Z1, badge de catégorie | *« La catégorie détermine l'éligibilité aux bons de pharmacie et d'examen. »* |
| 2 | Z1, badge de verrouillage | *« Verrou de confidentialité posé par le médecin chef — protection de données, à distinguer du rideau visuel. »* |
| 3 | Z3 | *« Un sous-onglet non autorisé n'est pas grisé : il n'apparaît pas. »* |
| 4 | Z4 | *« L'infirmier consultant l'historique n'accède qu'à la visite en cours, non aux visites passées. »* |

## Bloc 8 — Contrôles

```
[ ] Les 4 sections et les 9 sous-onglets sont représentés
[ ] La section « Parcours de soin » est active
[ ] Le badge de catégorie est visible dans l'en-tête
[ ] Les 4 annotations sont présentes
[ ] Aucune identité réelle — utiliser des données manifestement fictives
[ ] Aucune donnée médicale plausible n'est inventée dans la zone de contenu
```

---

# IHM-05 — Consultation

## Bloc 1 — Cartouche

```
Identifiant       : IHM-05
Figure du mémoire : Figure 7.12 — Maquette de l'écran de consultation
Chapitre / section: 7 — § 7.8
Sources de preuve : Page de consultation · INV-07 §§ 4.2 à 4.5
Statut            : IMPLÉMENTÉ
Format conseillé  : pleine largeur A4 paysage
```

## Bloc 2 — Objectif

Montrer l'écran où se concentre l'essentiel de l'acte clinique, et surtout **la clôture guidée par la décision** — le point où le parcours bifurque.

## Bloc 3 — Éléments à dessiner

| N° | Zone | Contenu |
|---|---|---|
| Z1 | **Panneau gauche — file** | Consultations en cours, largeur fixe |
| Z2 | **Panneau droit — détail** | Consultation sélectionnée |
| Z3 | Dans Z2 | En-tête : patient, soignant, état, horodatage d'ouverture |
| Z4 | Dans Z2 | Bloc `Anamnèse` : date de début, durée, mode de début, symptômes |
| Z5 | Dans Z2 | Bloc `Examen clinique` : zone de texte |
| Z6 | Dans Z2 | Bloc `Diagnostics` : liste, avec type et degré de certitude |
| Z7 | Dans Z2 | Bloc `Ordonnances` : liste, avec état et bouton `Générer un bon` |
| Z8 | Dans Z2 | Bloc `Conclusion` : zone de texte + jours de repos |
| Z9 | Dans Z2 | Barre `Clôturer` : sélecteur de décision + bouton |
| Z10 | **Zone conditionnelle** | Modale d'impression : ordonnance, bon, certificat |

## Bloc 5 — Annotations obligatoires

| N° | Attachée à | Texte |
|---|---|---|
| 1 | Z7, bouton `Générer un bon` | *« Actif seulement si l'ordonnance est validée. Le contrôle d'éligibilité par catégorie s'applique à ce moment. »* |
| 2 | Z9, sélecteur | *« Deux valeurs seulement : évacuation, suivi de traitement. L'absence de décision vaut clôture simple. »* |
| 3 | Z9 | *« La clôture entraîne obligatoirement celle de la visite parente. »* |
| 4 | Z4 à Z8 | *« Zones floutées en permanence, révélées au survol — rideau de confidentialité. »* |
| 5 | Z1 | *« L'infirmier ne voit que ses propres consultations. »* |

Les zones Z4 à Z8 sont **hachurées**.

## Bloc 8 — Contrôles

```
[ ] Les deux panneaux sont visibles
[ ] Les 6 blocs du détail sont présents, dans l'ordre du bloc 3
[ ] Le sélecteur de décision propose EXACTEMENT deux valeurs, plus « aucune »
[ ] Le bouton « Générer un bon » est représenté sur l'ordonnance, pas ailleurs
[ ] Les zones cliniques sont hachurées
[ ] Les 5 annotations sont présentes
[ ] Aucune donnée clinique réelle ni vraisemblable n'est écrite
```

---

## Vérification finale — les cinq maquettes

| Point | Source |
|---|---|
| Disposition en deux panneaux du triage et de la consultation | Pages correspondantes, disposition scindée |
| Tableau de bord adaptatif par profil | Page de tableau de bord, chargement conditionné par permission |
| Quatre sections et neuf sous-onglets du dossier | INV-04 § 4.2 |
| Menu filtré, groupe vide supprimé | INV-04 § 3 |
| Deux décisions médicales | INV-07 § 3.3 |
| Rideau de confidentialité actif par défaut | INV-04 § 5.2 |
| Ordre d'arrivée sans priorité | INV-07 § 3.1 |
