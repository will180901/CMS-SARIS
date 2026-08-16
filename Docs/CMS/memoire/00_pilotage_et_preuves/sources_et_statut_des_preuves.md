# Sources et statut des preuves

> **Date de vérification** : 2026-08-10. Chaque chemin a été testé sur la machine de travail.

---

## 1. Hiérarchie de preuve appliquée

Deux sources font autorité, et **une seule** sur chaque question.

| Rang | Source | Fait autorité sur | Ne fait **pas** autorité sur |
|---:|---|---|---|
| **1** | **Le code de l'application** — `CMS/APP/CMS-SARIS/` | **Ce qui est livré** : fonctions, règles implémentées, modèle de données, comportements | Le besoin, le contexte, l'organisation |
| **2** | **Le recueil de l'existant** — `Docs/Recueil_Existant_CME_v6.docx` | **Le besoin et le terrain** : organisation, processus antérieur, statuts, règles observées, besoins exprimés | Ce qui a été réalisé |
| 3 | Modèle de mémoire et plan officiel de l'école | La **forme** du document | Le fond |
| 4 | Hypothèses | Rien, tant qu'elles ne sont pas validées |

**Règle de résolution.** Le recueil dit ce qu'il **fallait** faire ; le code dit ce qui **a été** fait ; l'écart entre les deux est documenté dans `matrice_besoins_couverture.md`, jamais effacé.

---

## 2. Sources disponibles

| Source | Chemin | Volume | Usage |
|---|---|---|---|
| **Code applicatif** | `CMS/APP/CMS-SARIS/` | 547 fichiers, ≈ 93 500 lignes | **Autorité sur le livré.** Base des inventaires INV-01 à INV-07 |
| **Recueil de l'existant** | `Docs/Recueil_Existant_CME_v6.docx` | 4 entretiens, 18 besoins | **Autorité sur le besoin.** Base de INV-08 |
| Schéma de données | `packages/db/prisma/schema.prisma` + 41 migrations | 88 modèles | Diagramme de classes, schéma relationnel, modèle physique |
| Modèle de mémoire | `Docs/documents soutenance/…/Modele_Memoire_Soutenance.docx` | 8 chapitres | **Structure obligatoire** |
| Plan officiel de l'école | `Docs/documents soutenance/…/PLAN_RAPPORT_GLA-Orienté_Objet.pdf` | 6 pages | **Contraintes de forme** : 75-90 pages, typographie, pagination, plafonds de diagrammes |
| Rapport de fin de stage | `Docs/documents soutenance/Rapport de fin de stage/` | — | Référence complémentaire, propre à Verdi |
| Charte graphique | `Docs/CMS/charte graphique/` | 12 fiches | Justification des choix d'interface, chapitre 7 § 7.8 |
| Blueprint de déploiement | `render.yaml` | 104 lignes | Chapitre 8 : déploiement, incidents datés |

---

## 3. Le recueil de l'existant — source primaire du besoin

| | |
|---|---|
| **Titre** | *Recueil de l'existant — Centre Médical d'Entreprise* |
| **Auteur** | **Nzila Verdi Oscarvie**, lors de son stage à la SARIS |
| **Contenu** | 4 entretiens complétés : gestionnaire RH et service social, pharmacienne, médecin chef, infirmière |
| **Portée** | **L'ensemble du Service Médico-Social** — plus large que le périmètre du système |
| **Extrait dans** | `INV-08_recueil_existant.md` |

**Ce qu'il apporte** : l'organigramme, les six pôles du centre, les neuf statuts de patients, la règle de prise en charge, le processus de consultation en quatre étapes, la règle de délégation, la règle de confidentialité, les dix axes statistiques attendus, et **18 besoins exprimés avec leur priorité**.

**Ce qu'il ne documente pas** : la période et la durée des entretiens, les effectifs, le parc informatique, les chiffres d'activité, le statut juridique du centre. Voir § 6.

---

## 4. ⛔ Le cahier de charge antérieur — écarté

Un cahier de charge avait été produit **avant** le développement des applications, dans le dossier `Docs/CMS/cahier de charge/`.

**Il est écarté de ce travail**, pour un motif de fond énoncé par les auteurs :

> Il a été produit **avant** la réalisation. Beaucoup de choses ont ensuite été réadaptées puis modifiées. Le maintenir comme source produirait des contradictions avec le code, qui seul reflète le système réel.

Trois divergences constatées le confirment :

| Point | Cahier antérieur | Réalité du code |
|---|---:|---:|
| Entités de données | 87 | **88** |
| Permissions | 110 | **128** |
| Décisions médicales | 4 | **2** |

**Aucun document du dossier de mémoire ne s'appuie sur lui.** Les faits qui en provenaient ont été **re-sourcés** sur le recueil de l'existant ou sur le code. Ce cahier sera supprimé du dépôt à l'issue du travail ; il reste récupérable dans l'historique du dépôt le cas échéant.

> **Point de méthode.** Un document intermédiaire périmé est plus dangereux qu'un document absent : il fait autorité par sa seule présence, et l'on n'y regarde pas la date. Le retirer est un acte de rigueur, pas une perte.

---

## 5. Les huit inventaires — sources dérivées

Produits par extraction directe, chaque ligne portant sa référence.

| Inventaire | Source d'origine | Contenu | Volume |
|---|---|---|---|
| `INV-01_routes_api.md` | Code | 268 routes, 26 contrôleurs, architecture transverse | 570 lignes |
| `INV-02_modele_donnees.md` | Code | 88 modèles, 97 relations avec cardinalités | 1 529 lignes |
| `INV-03_permissions_roles.md` | Code | 128 permissions × 3 rôles | 314 lignes |
| `INV-04_ecrans_web.md` | Code | 15 écrans, 25 onglets, 6 impressions | 158 lignes |
| `INV-05_desktop_offline.md` | Code | 2 modes, 2 mécanismes hors-ligne, 52 entités synchronisées | 260 lignes |
| `INV-06_tests.md` | Code + exécution réelle | 10 fichiers, 145 cas, **102 exécutés** | 190 lignes |
| `INV-07_parcours_metier.md` | Code | 9 parcours, 9 machines à états | 297 lignes |
| **`INV-08_recueil_existant.md`** | **Recueil** | **4 entretiens, organigramme, 18 besoins** | **280 lignes** |

Ces inventaires ont **valeur de preuve** : ils sont l'extraction vérifiable de leur source.

---

## 6. Ce qui reste indisponible

| Élément manquant | Impact | Question |
|---|---|---|
| Période, durée, lieu et mode d'enregistrement des entretiens | Chapitre 5 § 5.1.2 | QO-04 |
| Effectifs par fonction et par site | Chapitre 1 § 1.4 · Tableau 1.1 | QO-02 |
| Historique et statut juridique du centre | Chapitre 1 § 1.1 | QO-02 |
| Chiffres d'activité — consultations, bénéficiaires | Chapitre 1 § 1.5 | QO-02 |
| Infrastructure réseau et parc informatique | Chapitre 2 § 2.2 · Tableau 2.1 | QO-03 |

**Volume concerné** : environ 6 à 8 pages, contre 24 avant l'arrivée du recueil.

---

## 7. Statuts employés dans tout le dossier

| Statut | Sens | Exemple |
|---|---|---|
| `OBSERVÉ` | Constaté sur le terrain, par le recueil | Le processus papier en quatre étapes |
| `IMPLÉMENTÉ` | Présent dans le code, vérifié | Les 268 routes |
| `PARTIELLEMENT IMPLÉMENTÉ` | Présent mais incomplet | Le mode autonome du client de bureau |
| `HORS PÉRIMÈTRE` | Volontairement exclu, avec motif | La gestion de stock pharmaceutique |
| `NON IMPLÉMENTÉ / PERSPECTIVE` | Prévu, pas fait | La signature de code |
| `À CONFIRMER` | Information manquante ou douteuse | La ventilation par les neuf statuts réels |
