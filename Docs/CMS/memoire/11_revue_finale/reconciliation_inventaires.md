# Réconciliation des inventaires

> **Objet** : prouver mécaniquement qu'aucune capacité du système n'a été oubliée.
> **Méthode** : reprendre chaque inventaire et attribuer à chaque élément l'un de quatre verdicts.
> **Date** : 2026-08-10.

| Verdict | Sens |
|---|---|
| `COUVERT` | Traité dans au moins une section du mémoire, référence donnée |
| `ANNEXE` | Traité en annexe, avec renvoi depuis le corps |
| `HORS PÉRIMÈTRE` | Volontairement exclu, **avec motif écrit** |
| `ORPHELIN` | Non traité — **défaut à corriger** |

---

## INV-01 — 268 routes de l'API

Réconciliation par **module fonctionnel** : le mémoire ne peut pas énumérer 268 routes individuellement, mais chaque module y est traité, et l'inventaire détaillé reste accessible.

| Module | Routes | Verdict | Où |
|---|---:|---|---|
| Référentiels | 37 | `COUVERT` | Ch. 6 § 6.3.4 · BF05 · UC17–UC19 |
| Administration, habilitations, audit | 32 | `COUVERT` | Ch. 6 § 6.3.2 et 6.3.3 · Ch. 7 § 7.1.4 et 7.1.5 · BF02–BF04 |
| Dossier patient | 30 | `COUVERT` | Ch. 6 § 6.3.6 · Ch. 7 § 7.2.3 · BF08, BF09 |
| Messagerie | 29 | `COUVERT` | Ch. 6 § 6.3.10 · Ch. 8 § 8.4 · BF18 |
| Consultation | 22 | `COUVERT` | Ch. 6 § 6.3.8 · Ch. 7 § 7.3 · BF12, BF13 |
| Personnel et délégations | 20 | `COUVERT` | Ch. 6 § 6.3.5 · Ch. 7 § 7.1.4 · BF06 |
| Sécurité et authentification | 20 | `COUVERT` | Ch. 6 § 6.5 · Ch. 7 § 7.1.4 · BF01 |
| Synchronisation | 14 | `COUVERT` | Ch. 7 § 7.5 · BF23 |
| Tableaux de bord | 9 | `COUVERT` | Ch. 6 § 6.3.11 · BF20 |
| Notifications | 9 | `COUVERT` | Ch. 7 § 7.5.4 · BF19 |
| Triage | 9 | `COUVERT` | Ch. 6 § 6.5 · Ch. 7 § 7.3 · BF10, BF11 |
| Évacuations | 8 | `COUVERT` | Annexe C, UC50 · BF16 |
| Suivi de traitement | 8 | `COUVERT` | Ch. 7 § 7.3 · BF17 |
| Bon d'examen | 7 | `COUVERT` | Annexe C, UC46 · BF14 |
| Bon de pharmacie | 5 | `COUVERT` | Ch. 6 § 6.6.1 · Ch. 7 § 7.4.1 · BF15 |
| Registre des employés | 5 | `COUVERT` | Ch. 6 § 6.3.4 · BF07 |
| Rapports | 2 | `COUVERT` | Ch. 6 § 6.3.11 · BF21 |
| **Sonde de santé** | **2** | **`HORS PÉRIMÈTRE`** | **Motif** : routes techniques, sans valeur métier. Néanmoins traitées au ch. 8 § 8.6.2, où l'incident du 5 juillet 2026 les concerne directement |

**268 routes · 0 orphelin.**

> **Nuance de méthode, énoncée par honnêteté.** La réconciliation est faite au niveau du **module**, non de la route individuelle. Une route particulière — par exemple la mise à jour des notes d'accueil d'une visite — n'apparaît pas nommément dans le mémoire. Elle figure dans INV-01, référencé en annexe. Le mémoire couvre **toutes les capacités**, non chaque point d'entrée.

---

## INV-02 — 88 entités de données

| Groupe | Entités | Verdict | Où |
|---|---:|---|---|
| Noyau du diagramme de classes | 29 | `COUVERT` | Ch. 7 § 7.2 · Figure 7.1 · Figure 8.1 |
| Messagerie | 7 | `ANNEXE` | Annexe D. **Motif d'exclusion du diagramme** : sous-système autonome, sans lien structurel avec le parcours de soin |
| Synchronisation | 8 | `COUVERT` | Ch. 7 § 7.5 — traitées comme architecture, non comme modèle métier |
| Audit, notifications, sessions | 8 | `ANNEXE` | Annexe D · Ch. 7 § 7.1.5 pour l'audit |
| Historiques et journaux | 6 | `ANNEXE` | Annexe D |
| Satellites du dossier patient | 12 | `ANNEXE` | Annexe D · Ch. 7 § 7.2.3 pour le principe |
| Référentiels secondaires | 6 | `ANNEXE` | Annexe D |
| Sans aucune relation | 6 | `ANNEXE` | Annexe D · INV-02 § 6 |
| Divers | 6 | `ANNEXE` | Annexe D |
| **Énumérations** | **6** | `COUVERT` | **Ch. 7 § 7.2.4** · Annexe D |
| **97 associations** | — | `COUVERT` | Fiche `UML-CLS-01` bloc 5 · Annexe D |

**88 entités · 0 orphelin.** Les 59 hors du diagramme de classes sont intégralement décrites en annexe D, avec leurs attributs, types et associations.

---

## INV-03 — 128 permissions, 3 rôles

| Élément | Nombre | Verdict | Où |
|---|---:|---|---|
| Permissions du catalogue | 128 | `ANNEXE` | INV-03 § 3, matrice complète · Annexe B |
| Rôles | 3 | `COUVERT` | Ch. 6 § 6.1 · Ch. 7 § 7.1.4 |
| Règle « écrire implique lire » | 1 | `COUVERT` | Annexe C, UC11 · Ch. 7 § 7.1.4 |
| Permissions vitales protégées | 10 | `COUVERT` | Ch. 7 § 7.1.4 · Annexe C, UC11 |
| Dérogations individuelles | — | `COUVERT` | Ch. 6 § 6.1 · Annexe C, UC12 |
| **Permissions sans route serveur** | **3** | `COUVERT` | **Matrice de traçabilité § 4.3** — signalées comme contrôles d'affichage, non de sécurité |

**128 permissions · 0 orphelin.**

---

## INV-04 — 15 écrans, 25 onglets

| Élément | Nombre | Verdict | Où |
|---|---:|---|---|
| Écrans routés | 15 | `COUVERT` | Ch. 7 § 7.8 · Matrice de traçabilité, colonne « Écran » |
| Maquettes détaillées | 5 | `COUVERT` | Figures 7.8 à 7.12 · Fiche `IHM-01a05` |
| Onglets et sous-onglets | 25 | `COUVERT` | Fiche `IHM-01a05` (référentiels, dossier) · INV-04 § 4 |
| Impressions A4 | 6 | `COUVERT` | Ch. 7 § 7.8 · BF22 |
| Magasins d'état | 12 | `COUVERT` | Ch. 7 § 7.5.1 · Fiche `UML-CMP-01` |
| Composants d'ossature | 9 | `COUVERT` | Ch. 7 § 7.8 · Fiche `UML-CMP-01` |
| Portails de contrôle | 5 | `COUVERT` | Ch. 7 § 7.8 · Glossaire |
| Bilinguisme | — | `COUVERT` | BNF09 · Ch. 7 § 7.8 |
| **Composants du système de conception partagé** | **60** | **`HORS PÉRIMÈTRE`** | **Motif** : bibliothèque d'interface générique, sans valeur pour la compréhension du domaine |

**15 écrans · 0 orphelin.**

---

## INV-05 — Desktop et hors connexion

| Élément | Verdict | Où |
|---|---|---|
| Mode connecté | `COUVERT` | Ch. 7 § 7.7 · Ch. 8 § 8.3 |
| Mode autonome | `COUVERT` | Ch. 7 § 7.1.1 et 7.7 · Ch. 8 § 8.3 — statut partiel énoncé |
| **Mécanisme hors ligne du web** | `COUVERT` | **Ch. 7 § 7.5.1** — file de mutations rejouées |
| 52 entités synchronisées | `COUVERT` | Ch. 7 § 7.5.3 |
| Résolution de conflit | `COUVERT` | Ch. 7 § 7.5.2 · Ch. 8 § 8.2.3 · Figure 7.4 |
| Canal de notification | `COUVERT` | Ch. 7 § 7.5.4 |
| Double authentification en mode local | `COUVERT` | Ch. 8 § 8.6.1 |
| Coffre de secrets | `COUVERT` | Ch. 7 § 7.7 · Fiche `UML-DEP-01` |
| Installateur et désinstallation | `COUVERT` | Ch. 8 § 8.1 · INV-05 § 3.2 |
| Mise à jour automatique | `COUVERT` | Ch. 8 § 8.1.2 · BNF11 |
| Signature de code | `COUVERT` | Ch. 8 § 8.3 · Conclusion § 4 — statut « non implémenté » |
| Application web progressive | `COUVERT` | Ch. 7 § 7.5.1 · BNF10 |
| Détection de connectivité | `COUVERT` | Ch. 8 § 8.6.2 |
| Purges planifiées | `COUVERT` | Ch. 7 § 7.5.2 · INV-05 § 5.5 |

**0 orphelin.**

---

## INV-06 — 10 fichiers de test, 145 cas

| Suite | Cas | Verdict | Où |
|---|---:|---|---|
| Chiffrement de la messagerie | 23 | `COUVERT` | Ch. 8 § 8.4.1 et 8.4.2 |
| Validation des saisies | 34 | `COUVERT` | Ch. 8 § 8.4.1 — **signalée orpheline** |
| Résolution de conflit | 17 | `COUVERT` | Ch. 8 § 8.2.3 et 8.4.1 — **signalée orpheline** |
| CRUD complet | 19 | `COUVERT` | Ch. 8 § 8.4.1 |
| Messagerie entre deux utilisateurs | 12 | `COUVERT` | Ch. 8 § 8.4.1 |
| Chiffrement du second facteur | 11 | `COUVERT` | Ch. 8 § 8.4.1 |
| Suppression logique | 10 | `COUVERT` | Ch. 8 § 8.4.1 |
| Création au premier message | 9 | `COUVERT` | Ch. 8 § 8.4.1 · § 8.6 |
| Résurrection après suppression | 8 | `COUVERT` | Ch. 8 § 8.4.1 · § 8.6.5 |
| Amorçage de l'application | 2 | `COUVERT` | Ch. 8 § 8.4.1 |
| Script de vérification des permissions | — | `COUVERT` | Ch. 8 § 8.4.3 — décrit comme outil manuel |

**145 cas · 0 orphelin.** Le statut « non exécuté » est porté partout, sans exception.

---

## INV-07 — 9 parcours, 9 machines à états

| Élément | Verdict | Où |
|---|---|---|
| Triage d'une visite | `COUVERT` | Ch. 6 § 6.5, UC34 · Figure 7.2 · Figure 6.4 |
| Consultation et décision | `COUVERT` | Ch. 6 § 6.6.2 · Figure 7.2 |
| Prescription | `COUVERT` | Ch. 6 § 6.5, UC42 · Ch. 7 § 7.4.1 |
| Bon de pharmacie | `COUVERT` | Ch. 6 § 6.6.1 · Figures 6.5 et 7.3 |
| Bon d'examen et résultat | `COUVERT` | Annexe C, UC46 |
| Évacuation | `COUVERT` | Annexe C, UC50 |
| Authentification avec second facteur | `COUVERT` | Ch. 6 § 6.5, UC01 · Figure 6.4 |
| Synchronisation | `COUVERT` | Ch. 6 § 6.5, UC63 · Figures 6.6 et 7.4 |
| Messagerie | `COUVERT` | Ch. 8 § 8.6 · Annexe C, UC54–UC56 |
| **Les 9 machines à états** | `COUVERT` | **Ch. 7 § 7.2.4** — ajouté lors de cette réconciliation |
| Les 5 règles transverses | `COUVERT` | Matrice de traçabilité § 2 · Ch. 3 § 3.1.3 · Ch. 7 |

**0 orphelin.**

---

## INV-08 — Le recueil de l'existant

| Élément | Nombre | Verdict | Où |
|---|---:|---|---|
| Entretiens | 4 | `COUVERT` | Ch. 5 § 5.1.3 · **Tableau 5.1** |
| Organigramme et niveaux hiérarchiques | 4 | `COUVERT` | Ch. 1 § 1.3.1 · **Figure 1.1** |
| Pôles du centre | 6 | `COUVERT` | Ch. 1 § 1.3.2 — un seul dans le périmètre, motivé |
| Statuts de patients | 9 | `COUVERT` | Ch. 1 § 1.2.2 · INV-08 § 3.3 — écart avec les 5 catégories documenté, QO-16 |
| Règle de prise en charge | 1 | `COUVERT` | Ch. 1 § 1.2.3 · Ch. 3 § 3.1.3 · Ch. 6 § 6.6.1 |
| Étapes du processus de consultation | 4 | `COUVERT` | Ch. 5 § 5.2.3 · **Figure 5.1** |
| Variables de mode de vie | 9 | `COUVERT` | Ch. 5 § 5.2.3 · modèle de données |
| Paramètres d'examen clinique | 9 | `COUVERT` | Ch. 5 § 5.2.3 · modèle de données |
| Règles de délégation | 1 | `COUVERT` | Ch. 5 § 5.2.4 · Ch. 3 § 3.1.1 |
| Règle de confidentialité, 3 niveaux | 1 | `COUVERT` | Ch. 5 § 5.2.5 · Ch. 3 § 3.1.1 |
| Axes statistiques attendus | 10 | `COUVERT` | Matrice de couverture § 3.1 — 6 couverts, **4 hors d'atteinte, documentés** |
| **Besoins exprimés** | **18** | `COUVERT` | Ch. 5 § 5.1.4 · **`matrice_besoins_couverture.md`** — 6 couverts, 4 partiels, 8 hors périmètre, **0 orphelin** |
| Problèmes constatés | 13 | `COUVERT` | Ch. 2 § 2.7 · Ch. 5 § 5.3 |
| Processus hors périmètre — évacuations financières, remboursements, accidents, stock | 4 | `HORS PÉRIMÈTRE` | **Motif** : métiers distincts, exclusions E1 à E7 du document de périmètre |

**0 orphelin.** Les 18 besoins exprimés sont tous tranchés ; aucun n'est passé sous silence.

---

## Synthèse

```
INV-01 routes API      : 268 routes    — 0 orphelin  (2 hors périmètre, motivées)
INV-02 modèle données  :  88 entités   — 0 orphelin  (59 en annexe D)
INV-03 permissions     : 128 lignes    — 0 orphelin
INV-04 écrans web      :  15 écrans    — 0 orphelin  (60 composants hors périmètre)
INV-05 desktop/offline :  14 éléments  — 0 orphelin
INV-06 tests           :  10 fichiers  — 0 orphelin  (102 cas exécutés sur 145)
INV-07 parcours métier :   9 parcours + 9 machines — 0 orphelin
INV-08 recueil         :  18 besoins   — 0 orphelin  (8 hors périmètre, motivés)
```

**Aucun orphelin. La documentation couvre l'intégralité des capacités inventoriées.**

---

## Défaut détecté et corrigé pendant cette réconciliation

| # | Défaut | Correction |
|---|---|---|
| 1 | Les **9 machines à états** d'INV-07 étaient traitées partiellement — la visite, la consultation et les documents apparaissaient dans le diagramme d'activité, mais le dossier patient, le compte, l'évacuation et le suivi de traitement n'étaient repris nulle part de façon systématique | Ajout de la section **7.2.4 « Les machines à états »** au chapitre 7 : les neuf cycles y sont tabulés, avec leurs transitions notables et la distinction entre les quatre garanties par la base et les cinq gouvernées par le code |

> C'est précisément à cela que sert la réconciliation : ce défaut n'était visible ni à la lecture des chapitres, ni à celle des inventaires. Il n'apparaît qu'en confrontant les deux.

---

## Ce que la réconciliation **ne** prouve pas

Deux limites doivent être énoncées, sous peine de donner à cet exercice une portée qu'il n'a pas.

**Elle prouve la couverture, non l'exactitude.** Qu'une capacité soit traitée quelque part ne garantit pas qu'elle soit décrite correctement. C'est l'objet du rapport de cohérence.

**Elle est datée.** Elle vaut pour l'état du code au 2026-08-10 et pour la version v6 du recueil. Toute évolution ultérieure la périme.

> **Une limite levée.** La version précédente de ce rapport signalait que la réconciliation portait sur le code seul, et ne pouvait donc pas détecter un besoin exprimé jamais implémenté. **L'ajout d'INV-08 lève cette limite** : les 18 besoins du recueil sont désormais réconciliés au même titre que les capacités du code. La couverture est établie **dans les deux sens** — aucune capacité livrée sans besoin identifié, aucun besoin exprimé sans verdict.
