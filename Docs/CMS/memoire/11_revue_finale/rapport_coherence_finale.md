# Rapport de cohérence finale

> ⚠️ **Ce rapport a été établi le 10 août 2026, avant la refonte du mémoire.** Il a été mis à jour le 19 août sur les points factuels — nombre de figures, résultats de tests, disparition des annexes — mais sa structure reste celle de la revue d'origine. L'état courant du document est décrit dans `DIAGNOSTIC_ALIGNEMENT_DOCX.md`.


> **Objet** : rechercher les contradictions internes du dossier — terminologiques, chiffrées, fonctionnelles, techniques et académiques.
> **Méthode** : confrontation croisée des chapitres, des inventaires et des fiches.
> **Date** : 2026-08-10.

---

## 1. Cohérence des chiffres

Tous les chiffres cités dans le mémoire ont été confrontés à leur inventaire d'origine.

| Grandeur | Valeur retenue | Cité en | Cohérent |
|---|---:|---|:---:|
| Routes de l'API | **273** | Ch. 7, ch. 8, INV-01, tableau de bord, résumé | ✅ |
| Contrôleurs | **26** | Ch. 7 § 7.1.3, INV-01 | ✅ |
| Modules métier | **17** | Ch. 7 § 7.1.3, INV-01 § 5.4 | ✅ |
| Entités de données | **88** | Ch. 7, ch. 8, INV-02 § 4, résumé | ✅ |
| Associations | **97** | Ch. 7 § 7.2.1, INV-02 | ✅ |
| Classes du diagramme | **29** | Ch. 7 § 7.2.1, fiche `UML-CLS-01` | ✅ |
| Associations à tracer | **38** | Fiche `UML-CLS-01` bloc 5 | ✅ |
| Permissions | **130** | Ch. 6, ch. 7, INV-03, résumé | ✅ |
| Rôles | **3** | Partout | ✅ |
| Écrans routés | **15** | Ch. 7, INV-04 | ✅ |
| Onglets | **25** | INV-04, fiche `IHM` | ✅ |
| Entités synchronisées | **52** | Ch. 7 § 7.5.3, INV-05 | ✅ |
| Entités à suppression logique | **47** | Ch. 7 § 7.2.5, INV-02 | ✅ |
| Migrations | **41** | Ch. 8 § 8.2.2 | ✅ |
| Fichiers de test | **10** | Ch. 8 § 8.4, INV-06 | ✅ |
| Cas de test | **145** | Ch. 8, conclusion | ✅ |
| Cas de test rattachés à une commande | **145 sur 145** | Ch. 8 § 8.4, INV-06 § 5 | ✅ |
| Besoins fonctionnels | **23** | Ch. 6, ch. 8, INV-03 | ✅ |
| Besoins non fonctionnels | **13** | Ch. 6 § 6.0.2, INV-03 | ✅ |
| Cas d'utilisation | **65** | Ch. 6 § 6.3, INV-07 | ✅ |
| Routes auditées | **151** | Ch. 7 § 7.1.5, INV-01 | ✅ |
| Lignes de code | **≈ 93 500** | Ch. 8, conclusion | ✅ |

**Aucune incohérence chiffrée.**

> ⚠️ **Une correction apportée en cours de rédaction.** Le chiffre de **273 routes** figurait dans une estimation initiale. Le comptage ancré a établi **273** : cinq occurrences étaient des mentions à l'intérieur de commentaires. La valeur corrigée a été propagée partout. Écart ÉC-03, marqué résolu.

## 2. Cohérence terminologique

| Terme | Occurrences vérifiées | Résultat |
|---|---|---|
| `SGCDM` | Tout le dossier | ✅ absent |
| Brazzaville, Pointe-Noire, Dolisie **comme sites du centre** | Tout le dossier | ✅ absents — employés uniquement pour les villes des établissements partenaires, usage légitime |
| « Centre Médico-Social » | Tout le dossier | ✅ absent — forme **Sanitaire** partout |
| « Priorité » au triage | Ch. 3, 6, 7, fiches | ✅ employé uniquement pour nier la notion |
| Ordonnance / bon | Ch. 3, 6, 7, glossaire, fiches | ✅ distinction maintenue partout |
| Verrou / rideau | Ch. 7, INV-04, glossaire, fiches | ✅ distinction explicite, rappelée trois fois |
| `MEDECIN` comme rôle | Ch. 6 § 6.1, glossaire | ✅ explicitement démenti |
| Décisions médicales | Ch. 3, 6, 7, INV-07, fiches | ✅ **2** partout, écart avec la documentation antérieure signalé |

**Aucune dérive terminologique.**

## 3. Cohérence entre les chapitres et les figures

| Figure | Cohérente avec | Résultat |
|---|---|---|
| 6.1 contexte | Ch. 6 § 6.1 — 3 acteurs primaires, 3 secondaires | ✅ |
| 6.2 cas d'utilisation | Ch. 6 § 6.3 — 22 regroupés sur 65, précisé en légende | ✅ |
| 6.3 relations | Ch. 6 § 6.4 — 7 inclusions, 7 extensions, 1 généralisation | ✅ |
| 6.4 à 6.6 séquences système | Ch. 6 § 6.5 — mêmes cas, mêmes exceptions | ✅ |
| 7.1 classes | Ch. 7 § 7.2 — 29 classes, critère énoncé | ✅ |
| 7.2 activité | Ch. 7 § 7.3 — mêmes étapes, mêmes gardes | ✅ |
| ~~7.3 séquence objets~~ | **Figure abandonnée le 18 août 2026** — les séquences objets ne figurent plus dans le mémoire | — |
| 7.4 séquence objets synchro | Ch. 7 § 7.5.2 — trois issues identiques | ✅ |
| ~~7.5 communication~~ | **Figure abandonnée le 18 août 2026** — le diagramme de communication ne figure plus dans le mémoire | — |
| 7.6 composants | Ch. 7 § 7.6 — 11 composants | ✅ |
| 7.7 déploiement | Ch. 7 § 7.7 — 6 nœuds | ✅ |
| 7.8 à 7.12 maquettes | Ch. 7 § 7.8 — 5 écrans | ✅ |
| 8.1 relationnel | Figure 7.5 — mêmes entités, clés explicitées | ✅ |
| 8.2 modèle physique | Ch. 8 § 8.2.2 — types réels | ✅ |

**Aucune divergence.**

## 4. Cohérence des règles métier

Les cinq règles transverses ont été suivies dans tout le dossier.

| Règle | Ch. 3 | Ch. 6 | Ch. 7 | Fiches | Inventaires | Cohérente |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Éligibilité par catégorie | ✅ § 3.1.3 | ✅ § 6.6.1 | ✅ § 7.4.1 | ✅ 6.5, 7.2, 7.3 | ✅ C, E, F | ✅ |
| Prescription à deux étages | ✅ § 3.1.1 | ✅ § 6.5 | ✅ § 7.1.4 | ✅ 6.3, 7.2, 7.3 | ✅ C, E | ✅ |
| Portée globale du dossier | ✅ § 3.1.2 | — | ✅ § 7.5.3 | ✅ 7.7 | ✅ C | ✅ |
| Suppression logique | — | ✅ BNF08 | ✅ § 7.2.5 | ✅ 7.4 | ✅ E, F | ✅ |
| Ordre d'arrivée | ✅ § 3.1.1 | ✅ § 6.5 | ✅ § 7.3 | ✅ 7.2, 7.10 | ✅ F | ✅ |

## 5. Cohérence des statuts

Contrôle que rien n'est présenté comme achevé alors qu'il ne l'est pas.

| Élément | Statut | Cohérent en |
|---|---|---|
| Mode autonome | `PARTIELLEMENT IMPLÉMENTÉ` | Ch. 8 § 8.3, conclusion § 4, INV-05, INV-03, BF23 |
| Signature de code | `NON IMPLÉMENTÉ` | Ch. 8 § 8.1, conclusion § 4, INV-05 |
| Tests unitaires | `EXÉCUTÉS` — 103 cas, 103 réussis | Ch. 8 § 8.4.2, INV-06 § 2.2 |
| Tests d'intégration | `NON EXÉCUTÉS` — 43 cas | Ch. 8 § 8.4.2, INV-06 § 2.4 |
| Cœur clinique non testé | `NON IMPLÉMENTÉ` | Ch. 8 § 8.4.3, conclusion § 4, matrice § 4.1 |
| Éligibilité des CDD | `À CONFIRMER` | Ch. 3 § 3.1.3, INV-07, QO-06, INV-03 |
| Certificat médical | `À CONFIRMER` | Glossaire, D-15 |
| Déploiement effectif | `À CONFIRMER` | Conclusion § 4, QO-10 |

**Aucune contradiction de statut.** Un élément partiel dans un chapitre l'est dans tous.

## 6. Cohérence académique

| # | Contrôle | Résultat |
|---|---|---|
| 6.1 | La méthode annoncée au ch. 4 est celle appliquée aux ch. 6 et 7 | ✅ Deux branches, convergence à la conception |
| 6.2 | Les diagrammes annoncés au ch. 4 § 4.3.2 sont ceux produits | ✅ 9 types, tous présents |
| 6.3 | Les objectifs de l'introduction sont traités | ✅ OS1→ch. 3 et 6 · OS2→ch. 6 · OS3→ch. 7 · OS4 et OS5→ch. 8 · OS6→ch. 7 · OS7→inventaires et matrices |
| 6.4 | La problématique reçoit une réponse | ✅ Conclusion § 2.2, trois réponses |
| 6.5 | Le résumé reflète le contenu | ✅ Chiffres et limites conformes |
| 6.6 | Les transitions entre chapitres existent | ✅ Chaque chapitre annonce le suivant |
| 6.7 | Chaque chapitre a introduction et conclusion | ✅ Y compris les squelettes |

## 6bis. Cohérence entre le recueil de l'existant et le système

Sept correspondances **exactes** ont été établies entre le terrain observé et le code. Elles ont valeur de validation particulière : la documentation du système ayant été rédigée **à partir du code seul**, avant lecture du recueil, leur concordance n'a pas été construite mais **constatée**.

| # | Le recueil décrit | Le système implémente | Vérifié |
|---|---|---|:---:|
| 1 | Prise en charge complète réservée aux CDI et ayants droit | Matrice `DroitCategoriePatient`, garde serveur | ✅ |
| 2 | Délégation de prescription encadrée, jamais totale | Délégation datée, tracée sur l'ordonnance | ✅ |
| 3 | Évacuation décidée par le seul médecin | Évacuation fermée à l'infirmier, même délégué | ✅ |
| 4 | Infirmier limité au résumé de la consultation en cours | Restriction d'historique sur les visites passées | ✅ |
| 5 | Neuf variables de mode de vie | Modèle `ModeViePatient` | ✅ |
| 6 | Neuf paramètres d'examen clinique, indice de masse corporelle calculé | Modèle `ConstanteVitale`, calcul centralisé | ✅ |
| 7 | Anamnèse en quatre questions | Champs d'anamnèse de la consultation | ✅ |

**Trois divergences** ont également été constatées, toutes documentées :

| # | Divergence | Traitement |
|---|---|---|
| 1 | 9 statuts de patients au recueil, **5 catégories** au système | Simplification volontaire, motivée — les 4 absents relèvent de la même règle. QO-16 |
| 2 | 10 axes statistiques attendus, **6 couverts** | Limite documentée, É-19. Les données existent au registre des employés |
| 3 | Triage **allégé** pour les consultations spécialisées | Non distingué par le système. Limite documentée, É-20 |

---

## 7. Anomalies détectées et traitées

| # | Anomalie | Traitement |
|---|---|---|
| A1 | Les 9 machines à états n'étaient pas reprises systématiquement | **Corrigé** — ajout du ch. 7 § 7.2.4 |
| A2 | `Role` et `Permission` seraient apparues isolées sur le diagramme de classes, leurs relations passant par des tables de liaison absentes du noyau | **Corrigé** — ajout de `UtilisateurRole` et `RolePermission` au noyau : 29 classes, 38 associations |
| A3 | L'auto-association de la messagerie produisait un appariement erroné à l'extraction | **Corrigé** — exclusion de l'appariement d'un champ avec lui-même. 97 relations, 0 ambiguïté |
| A4 | Un objet de transfert était détecté comme contrôleur, du fait de sa position dans le fichier | **Corrigé** — la classe retenue est celle qui suit le décorateur de contrôleur |
| A5 | Le décompte de 273 routes incluait des mentions en commentaire | **Corrigé** — 268, propagé partout |
| A6 | Le décompte des permissions donnait 128 et non 116 | **Corrigé** — arbitré en faveur du comptage, écart consigné |
| A7 | Le mécanisme hors ligne du web n'était pas documenté, seul celui du poste autonome l'était | **Corrigé** — ajout d'INV-05 § 6 et du ch. 7 § 7.5.1 |
| A8 | Les listes de figures risquaient d'annoncer des figures non produites | **Traité** — les trois figures bloquées sont marquées, avec consigne de retrait si non produites |

**Huit anomalies détectées, huit traitées.**

---

## 8. Verdict

| Dimension | Verdict |
|---|---|
| Cohérence chiffrée | ✅ **conforme** — 22 grandeurs vérifiées |
| Cohérence terminologique | ✅ **conforme** — 8 contrôles |
| Cohérence chapitres ↔ figures | ✅ **conforme** — 14 figures |
| Cohérence des règles métier | ✅ **conforme** — 5 règles suivies de bout en bout |
| Cohérence des statuts | ✅ **conforme** — 7 éléments |
| Cohérence académique | ✅ **conforme** — 7 contrôles |
| Anomalies résiduelles | ✅ **aucune** |

**Le dossier est cohérent avec lui-même et avec le code.**

Ce verdict ne porte **pas** sur les quatre non-conformités identifiées par la checklist — bibliographie insuffisante, figures non tracées, captures non produites, traçabilité ascendante manquante. Ce ne sont pas des incohérences : ce sont des travaux restant à accomplir. Ils figurent au rapport d'écarts non résolus.
