<!-- Fichier aligné sur Memoire_CMS_SARIS.docx le 24 août 2026. -->
<!-- Le document Word fait foi. Toute divergence est une erreur de ce fichier. -->

# Index des figures du mémoire

> **23 figures.** Le document est passé de 15 à 23 illustrations le 24 août 2026, en découpant par **package** le diagramme de cas d'utilisation et le diagramme de classes — comme le fait le mémoire de référence de NGATSE et KUBEMBULA.
> Les diagrammes de package occupent **une demi-page chacun**, deux par page. Les diagrammes denses gardent une **page entière**.

| Figure | Titre exact dans le mémoire | Chap. | Fiche de préparation | Place | Faite |
|---|---|:---:|---|---|:---:|
| **1.1** | Organigramme du Service Médico-Social de SARIS-CONGO | 1 | `ORG-01` | page entière | ☐ |
| **4.1** | Cycle de développement selon 2TUP | 4 | `ORG-03` | page entière | ☐ |
| **5.1** | Diagramme d'activité du processus de consultation antérieur | 5 | `UML-ACT-01` | page entière | ☐ |
| **6.1** | Diagramme de contexte statique du système | 6 | `UML-CTX-01` | page entière | ☐ |
| **6.2** | Cas d'utilisation du package Sécurité et habilitations | 6 | `UML-UC-01` | demi-page | ☐ |
| **6.3** | Cas d'utilisation du package Référentiels et acteurs médicaux | 6 | `UML-UC-01` | demi-page | ☐ |
| **6.4** | Cas d'utilisation du package Dossier patient | 6 | `UML-UC-01` | demi-page | ☐ |
| **6.5** | Cas d'utilisation du package Parcours de soin | 6 | `UML-UC-01` | demi-page | ☐ |
| **6.6** | Cas d'utilisation du package Fonctions transverses | 6 | `UML-UC-01` | page entière | ☐ |
| **6.7** | Diagramme de séquence système : émettre un bon de pharmacie | 6 | `UML-SEQS-02` | page entière | ☐ |
| **6.8** | Diagramme de séquence système : synchroniser un poste local | 6 | `UML-SEQS-03` | page entière | ☐ |
| **7.1** | Diagramme de classes du package Sécurité et habilitations | 7 | `UML-CLS-01` | demi-page | ☐ |
| **7.2** | Diagramme de classes du package Référentiels et acteurs médicaux | 7 | `UML-CLS-01` | demi-page | ☐ |
| **7.3** | Diagramme de classes du package Dossier patient | 7 | `UML-CLS-01` | demi-page | ☐ |
| **7.4** | Diagramme de classes du package Parcours de soin | 7 | `UML-CLS-01` | demi-page | ☐ |
| **7.5** | Diagramme de classes du système | 7 | `UML-CLS-01` | page entière | ☐ |
| **7.6** | Diagramme de composants | 7 | `UML-CMP-01` | page entière | ☐ |
| **7.7** | Diagramme de déploiement | 7 | `UML-DEP-01` | page entière | ☐ |
| **8.1** | Schéma relationnel du noyau métier | 8 | `SCH-REL-01` | page entière | ☐ |
| **8.2** | Modèle physique de données | 8 | `SCH-MPD-01` | page entière | ☐ |
| **8.3** | Consultation en cours, avec examen clinique et diagnostics (rôle Médecin Chef) | 8 | protocole de captures | page entière | ☐ |
| **8.4** | Émission d'un bon de pharmacie et contrôle d'éligibilité (rôle Infirmier) | 8 | protocole de captures | page entière | ☐ |
| **8.5** | Tableau de bord et journal d'audit (rôle Administrateur système) | 8 | protocole de captures | page entière | ☐ |

## Les cinq packages

Le même découpage gouverne les cas d'utilisation et les classes. C'est ce qui permet de vérifier qu'à chaque groupe de fonctions correspond bien un groupe de données.

| Package | Cas d'utilisation | Classes | Figure UC | Figure classes |
|---|---:|---:|---|---|
| Sécurité et habilitations | 16 | 5 | 6.2 | 7.1 |
| Référentiels et acteurs médicaux | 8 | 8 | 6.3 | 7.2 |
| Dossier patient | 9 | 5 | 6.4 | 7.3 |
| Parcours de soin | 20 | 11 | 6.5 | 7.4 |
| Fonctions transverses | 12 | **0** | 6.6 | — |
| **Total** | **65** | **29** | | |

Le package Fonctions transverses ne porte aucune classe : ses entités font partie des 59 écartées du diagramme. Le mémoire l'explique au § 7.3 plutôt que de le laisser constater.

## Répartition par chapitre

| Chapitre | Figures |
|---|---|
| 1 — Structure d'accueil | 1 |
| 4 — Méthodologie | 1 |
| 5 — Étude de l'existant | 1 |
| 6 — Analyse des besoins | 7, dont **5 diagrammes de package** |
| 7 — Conception | 7, dont **4 diagrammes de package** |
| 8 — Implémentation | 5, dont **3 captures d'écran** |
| **Total** | **23** |

## Règle de vérification, après collage

```
[ ] L'image est au-dessus de sa légende, sur la même page
[ ] Les diagrammes de package tiennent à deux par page
[ ] La légende n'a pas basculé sur la page suivante
[ ] Le libellé de la légende n'a pas été modifié
[ ] Aucune donnée réelle de patient n'apparaît sur les trois captures
[ ] Après le collage des 23 images : Ctrl + A puis F9, quatre mises à jour
```
