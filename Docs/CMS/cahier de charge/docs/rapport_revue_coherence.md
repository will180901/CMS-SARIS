# Rapport de revue de cohérence — Cahier des charges CMS SARIS

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Validé · **Portée** : les 39 documents du coffre (Phases 0 à 4 + traçabilité) + [[_SOURCE_systeme]].

> Revue finale exigée par la méthodologie (`methodologie_creation_systeme`, étape 6). Objectif : garantir que le cahier des charges « as-built » est **cohérent, sans contradiction, sans lien cassé, et fidèle au code**.

---

## 1. Périmètre vérifié

- **40 fichiers Markdown** : `00_HOME`, `_SOURCE_systeme`, 7 docs de cadrage (Phase 0), 7 docs d'architecture (Phase 1), 16 specs de module (Phase 2), 5 docs transverses (Phase 3), 2 docs UX (Phase 4), `tracabilite`, ce rapport.
- **Volumétrie produite** : ~363 exigences fonctionnelles (EF), ~111 cas d'usage (CU), 23 décisions (D-001→D-023), 49 paramètres (PM), 13 contrats d'interface (C-1→C-13), ENF, risques.

## 2. Vérifications automatisées

| Contrôle | Méthode | Résultat |
|----------|---------|----------|
| **Liens `[[...]]` résolus** | extraction de toutes les cibles vs noms de fichiers réels | ✅ **Tous résolvent** après correction (les liens aliasés `[[doc\|libellé]]` sont valides). |
| **Chiffres canoniques** | grep des valeurs périmées | ✅ **0 résidu** « 79 tables » / « 88 permissions » comme compte courant. |
| **Décompte vérifié dans le code** | `grep -c "^model"` + comptage `PERMISSIONS` | **87 tables**, **110 permissions** (110 lignes, 110 chaînes distinctes ; `ADMIN_SYSTEME = [...ALL_PERMISSIONS]`). |
| **Rôles / sites / modules** | recoupement code | **3 rôles** (ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER ; *MEDECIN* = profession → rôle MEDECIN_CHEF), **2 sites**, **16 modules** — cohérents partout. |

## 3. Anomalies trouvées et corrigées

| # | Anomalie | Localisation | Correction |
|---|----------|--------------|------------|
| A-01 | **Permissions comptées à 88** (sous-estimation) au lieu de 110 | `parametres_metier` (PM-47), `MODULE_02`, `MODULE_13` | Corrigé à **110** + preuve du décompte ajoutée. |
| A-02 | **« ~79 tables »** présenté comme compte réel | `vision`, `modele_economique`, `exigences_non_fonctionnelles` | Corrigé à **87** (le schéma fait foi). Les mentions explicatives « le brief annonçait ~79 » sont conservées. |
| A-03 | **« ~110 »** approximatif | ~17 docs | Uniformisé à **110** (valeur confirmée exacte). |
| A-04 | **Liens copiés de la mémoire** (`project_*`, `feedback_*`, `reference_*`, `cms_saris_context`) — non pertinents dans le coffre | nombreux docs (40 dans `registre_decisions`, 57 dans `plan_releases`…) | **Dé-liés** (transformés en texte simple) ou remappés vers le bon doc du coffre. |
| A-05 | **Liens internes mal nommés** (`[[consultation]]`, `[[modele_donnees]]`, `[[dossier_patient]]`…) | plusieurs docs | **Remappés** vers les noms valides (`[[MODULE_09_consultation]]`, `[[modele_donnees_global]]`, `[[MODULE_07_dossier_patient]]`…). |
| A-06 | Dernier lien-mémoire résiduel `[[reference_ip_geo_navigateur]]` | `modele_menaces` | Dé-lié (réf. code `main.ts`). |

## 4. Coutures de fond vérifiées (cohérence sémantique)

- **Une seule source de vérité** respectée : les chiffres renvoient à [[parametres_metier]] (PM-xx), les décisions à [[registre_decisions]] (D-xxx), les termes à [[glossaire]].
- **Graphe de dépendances** [[plan_modules]] : acyclicité démontrée par tri topologique, sans `forwardRef`.
- **Traçabilité** [[tracabilite]] : chaque module a ses EF/CU identifiés, aucun trou (363 EF / 111 CU couverts).
- **Honnêteté as-built** : les agents ont recoupé le code et corrigé le brief de départ (87 vs 79, modules réels vs annoncés, couplages par-donnée vs par-imports) — fidélité au réel privilégiée sur l'embellissement.

## 5. Points résiduels mineurs (non bloquants)

- Quelques **citations de sources en texte simple** renvoyant à des noms de fichiers de la mémoire projet (`reference_ip_geo_navigateur`, `project_systeme_robuste`) subsistent dans des colonnes « source » de tableaux. Elles ne sont **pas des liens cassés** ; elles peuvent être nettoyées ultérieurement pour un rendu 100 % « public ».
- Statut documentaire : tous les fichiers sont en **Brouillon v1.0**. Passage à « Validé » à faire par le porteur après lecture.

## 6. Conclusion

Le cahier des charges « as-built » est **complet, cohérent et navigable** depuis [[00_HOME]] :
- couverture des **5 phases** + traçabilité,
- chiffres **vérifiés dans le code** et uniformes,
- liens internes **tous résolus**,
- conventions d'identifiants (EF/CU/RM/PM/D/C/ENF/R) appliquées.

Aucune anomalie bloquante. Le document peut servir de **référence de soutenance** et de base au cahier des charges « cible » si des évolutions sont décidées.
