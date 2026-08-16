# Diagnostic d'alignement — le dossier face au document Word

> **Date** : 2026-08-19
> **Référence** : `Memoire_CMS_SARIS.docx`, 90 pages, corps de 76 pages
> **Périmètre examiné** : les 67 fichiers du dossier `memoire`
> **Aucun fichier n'a été modifié.** Ce rapport constate, il ne corrige pas.

---

## 1. Comment j'ai procédé

J'ai extrait du fichier Word son texte réel — titres, paragraphes, tableaux, légendes — puis je l'ai confronté à chaque fichier du dossier. Les écarts ci-dessous sont mesurés, pas estimés.

Le document Word contient **24 189 mots**. Le dossier en contient **157 696**. Ce rapport de un à six est normal : le dossier porte les preuves, les inventaires et les fiches de travail, pas seulement le texte du mémoire. Mais il signale aussi que beaucoup de matière décrit désormais une version qui n'existe plus.

---

## 2. Ce que dit le document, et qui fait foi

| Élément | Valeur |
|---|---|
| Chapitres | 8, plus introduction et conclusion |
| Sections de niveau 2 | 60 |
| Descriptions textuelles de cas d'utilisation | 2 — UC43 et UC48 |
| Figures | **15** |
| Tableaux | **48** |
| Sigles | 15 |
| Annexes | **aucune** |
| Classes au diagramme | **29**, sur 88 entités, donc 59 écartées |
| Campagne de tests | **103 exécutés, 103 réussis** |

---

## 3. Écarts constatés

### 3.1 Les huit chapitres — réécriture complète

Aucun chapitre ne correspond plus à son fichier. Le tableau donne, pour chaque chapitre, les sections du Word absentes du fichier et les sections du fichier absentes du Word.

| Chapitre | Sections Word | Sections fichier | Divergence |
|---|---:|---:|---|
| 1 | 7 | 9 | 6 sections du Word absentes · 8 sections obsolètes |
| 2 | 8 | 10 | 3 absentes · 5 obsolètes |
| 3 | 8 | 9 | 7 absentes · 9 obsolètes |
| 4 | 5 | 6 | 2 absentes · 3 obsolètes |
| 5 | 6 | 8 | 3 absentes · 5 obsolètes |
| 6 | 10 | 10 | 5 absentes · 5 obsolètes |
| 7 | 6 | 10 | 2 absentes · 6 obsolètes |
| 8 | 7 | 8 | 1 obsolète |

Le chapitre 3 est le plus éloigné : **aucune** de ses huit sections actuelles ne porte le titre qu'elle a dans le mémoire.

Une différence de fond, pas seulement de titre : les fichiers contiennent tous une section « Introduction du chapitre » et une section « Récapitulatif de l'état » qui n'existent pas dans le mémoire, et le chapitre 7 conserve quatre sections dont les figures ont été supprimées — diagramme d'activité, réalisation des cas d'utilisation, architecture en composants séparée du déploiement, conception des interfaces.

### 3.2 Les autres textes du mémoire

| Section | Mots dans le Word | Mots dans le fichier |
|---|---:|---:|
| Introduction générale | 538 | 1 764 |
| Conclusion générale | 1 100 | 2 179 |
| Résumé et abstract | 164 | 628 |
| Dédicace et remerciements | 132 | 541 |
| Bibliographie et webographie | 234 | 1 563 |

Ces écarts ne sont pas des pertes : les fichiers contiennent des consignes de rédaction, des avertissements et des variantes qui n'avaient pas vocation à entrer dans le mémoire. Mais on ne peut plus lire ces fichiers pour savoir ce que dit le mémoire.

### 3.3 Les fiches de dessin

**Douze fiches correspondent à une figure retenue. Six annoncent le mauvais numéro.**

| Fiche | Numéro annoncé | Numéro réel |
|---|---|---|
| `SCH-REL-01` | 7.1 et 8.1 | **8.1** |
| `UML-ACT-01` | 5.1 et 7.2 | **5.1** |
| `UML-CMP-01` | 7.6 | **7.2** |
| `UML-DEP-01` | 7.7 | **7.3** |
| `UML-SEQS-02` | 6.5 | **6.3** |
| `UML-SEQS-03` | 6.6 | **6.4** |

**Huit fiches décrivent des figures qui ne sont plus dans le mémoire** : `IHM-01a05` (les cinq maquettes), `ORG-02` (infrastructure réseau), `UML-ACT-02` (activité du parcours de soin), `UML-COM-01` (communication), `UML-SEQO-01` et `UML-SEQO-02` (séquences objets), `UML-SEQS-01` (séquence de connexion), `UML-UC-02` (relations entre cas).

**Trois figures du mémoire n'ont aucune fiche** : les figures 8.3, 8.4 et 8.5, les trois captures d'écran. Leur protocole existe dans `06_interfaces/protocole_captures.md`, mais aucune fiche ne les référence sous leur numéro définitif.

### 3.4 Les listes

| Fichier | Figures annoncées | Réel |
|---|---:|---:|
| `05_fiches_de_dessin/00_index_des_figures.md` | 24 | 15 |
| `01_preliminaires/liste_figures_et_tableaux.md` | 25 | 15 |

Les deux listent aussi **11 tableaux sur les 48** du mémoire. Elles sont donc à la fois trop larges sur les figures et très incomplètes sur les tableaux.

### 3.5 Les annexes

Les six fichiers d'annexe décrivent du contenu retiré du mémoire. Par ailleurs, **30 fichiers du dossier renvoient encore à une annexe** — dont trois chapitres, l'introduction, la liste des sigles, quatre fiches de dessin et l'ensemble de la revue finale. Le fichier `reconciliation_inventaires.md` y renvoie 31 fois à lui seul.

Dans le mémoire, le mot « annexe » n'apparaît plus une seule fois.

### 3.6 Les fichiers de pilotage

| Fichier | Ce qu'il annonce | Réel |
|---|---|---|
| `budget_pages.md` | budget de 67 à 85 pages, réparti par chapitre | 90 pages, corps de 76 |
| `checklist_conformite.md` | 24 figures · annexes A à F présentes · mise en page « à appliquer » | 15 figures · aucune annexe · mise en page faite |
| `00_HOME.md` | 24 figures · renvois aux annexes | 15 figures |
| `registre_decisions.md` | ne contient aucune des décisions prises pendant la refonte | 11 décisions à consigner |
| `matrice_alignement.md` | renvoie aux annexes pour ce qui déborde | plus d'annexes |

---

## 4. Deux contradictions à trancher — les inventaires contre le document

Les inventaires sont extraits du code. Ils font foi contre le mémoire, jamais l'inverse. Deux d'entre eux contredisent aujourd'hui le document ; dans les deux cas, après vérification, **c'est l'inventaire qui est en retard**.

### Contradiction 1 — le nombre de classes

`INV-02_modele_donnees.md` annonce **27 classes** au diagramme. La fiche de dessin `UML-CLS-01` en énumère vingt-neuf, de C01 à C29, et conclut elle-même : *« 29 classes retenues sur les 88 du modèle complet »*. Le mémoire dit 29.

**L'énumération l'emporte sur le décompte.** `INV-02` doit passer à 29, et le nombre d'entités écartées de 61 à 59.

### Contradiction 2 — le résultat des tests

`INV-06_tests.md` se contredit lui-même. Sa synthèse annonce **103 exécutés, 103 réussis**, et son tableau de campagne après correction confirme 103 sur 103. Mais une phrase en fin de fichier dit encore : *« Formulation exacte à retenir pour le mémoire : 102 cas exécutés et vérifiés, dont 101 réussis »*.

Cette phrase date d'**avant** la correction du test défaillant. Le mémoire retient 103 sur 103, ce qui est le résultat après correction, et c'est le bon. La phrase doit être réécrite, sinon elle contredira le mémoire le jour où un lecteur ouvrira l'inventaire.

Un troisième point demande vérification, sans être une contradiction : l'inventaire donne 103 cas exécutés et 43 non exécutés, soit 146, alors que le total des cas écrits est annoncé à 145 ailleurs. Un cas d'écart, à retrouver.

---

## 5. Ce que je propose de faire, dans cet ordre

| Lot | Contenu | Effet |
|---|---|---|
| **A** | Introduction, chapitres 1 à 8, conclusion, préliminaires, bibliographie | Les fichiers disent enfin ce que dit le mémoire |
| **B** | Les douze fiches conservées, l'index des figures, la liste figures et tableaux | Numérotation juste, 15 figures, 48 tableaux |
| **C** | Annexes A à F et les huit fiches abandonnées, déplacées dans `99_archive` | Rien n'est perdu, plus rien ne trompe |
| **D** | Budget, checklist, HOME, registre des décisions, matrice, carnet de bord | Le pilotage reflète l'état réel |
| **E** | `INV-02` et `INV-06` | Les deux contradictions levées, avec la trace du pourquoi |

Un lot à la fois, avec validation entre chaque.

---

## 6. Ce que je ne toucherai pas

Les inventaires `INV-01`, `INV-03`, `INV-04`, `INV-05`, `INV-07`, `INV-08`, `INV-09`, les matrices de traçabilité et de couverture, le périmètre, le registre des questions ouvertes, les sources et statuts de preuve.

Ces fichiers sont extraits du code et du terrain. Les aligner sur le mémoire reviendrait à effacer la preuve pour faire plaisir au texte. S'ils contredisent le document, c'est le document que je viendrai te proposer de corriger.
