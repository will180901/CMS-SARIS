# Matrice d'alignement — code ↔ recueil ↔ documentation antérieure

> **Règle absolue** : un écart n'est **jamais effacé par réécriture**. Il est consigné, daté, puis marqué résolu s'il l'est — en conservant sa trace.
> **Arbitrage** : le **code** fait autorité sur ce qui est livré ; le **recueil de l'existant** sur le besoin et le terrain. La documentation antérieure du projet, produite avant le développement, est **écartée** — voir `sources_et_statut_des_preuves.md` § 4.
>
> ✅ **Six écarts ont été résolus le 2026-08-10** par l'arrivée du recueil de l'existant. Ils sont marqués comme tels, avec leur trace.

---

## 0. Écarts résolus par l'arrivée du recueil de l'existant — 2026-08-10

Six écarts, ouverts avant l'obtention de la source primaire, sont désormais tranchés. Leur trace est conservée.

| # | Écart | Résolution |
|---|---|---|
| **ÉR-01** | Signification du sigle CMS — « Médico-Sanitaire » ou « Médico-Social » ? | ✅ **Centre Médico-Sanitaire**, énoncé par le recueil, section 1.1. La décision D-03 est confirmée par la source primaire |
| **ÉR-02** | L'exclusion des employés en contrat à durée déterminée du droit aux bons est-elle délibérée ? | ✅ **Oui.** Le recueil énonce la règle et documente le mécanisme de **refacturation** qui l'accompagne |
| **ÉR-03** | Le système est-il en usage clinique réel ? | ✅ **Non.** Contexte de soutenance, déploiement en ligne pour démonstration ; la cible réelle est postérieure |
| **ÉR-04** | Le processus antérieur peut-il être reconstitué ? | ✅ **Oui.** Le recueil le décrit en **quatre étapes formalisées par le Médecin Chef**. Figure 5.1 débloquée |
| **ÉR-05** | L'organigramme est-il documenté ? | ✅ **Oui.** DRH → SMS → {SAS, CMS}, avec les six pôles du centre. Figure 1.1 débloquée |
| **ÉR-06** | Les entretiens sont-ils identifiables ? | ✅ **Oui.** Quatre acteurs, tous complétés. Tableau 5.1 débloqué |

### ÉR-07 ✅ Métrologie du stage et données d'entreprise — **RÉSOLUES**

Le rapport de fin de stage de Verdi (INV-09) a débloqué : l'historique de l'entreprise, son organisation en huit directions, l'organisation et l'effectif du service informatique, le parc matériel par type, les applications en production, la population couverte (plus de 2 000 agents), et la période du stage (15 janvier au 14 avril 2026).

> ⚠️ **Mais ce rapport décrit aussi le système sous une autre dénomination et avec d'autres chiffres** — 55 entités contre 88, 13 modules contre 17, module des accidents de travail présenté comme réalisé alors qu'il a été retiré. Ces écarts s'expliquent par la date : le rapport décrit l'état d'**avril 2026**, le présent mémoire celui d'**août 2026**. Voir INV-09 § 6 — **décision requise avant soutenance**.

### Une règle de vocabulaire corrigée

| Terme | Statut antérieur | Statut corrigé |
|---|---|---|
| **Brazzaville, Pointe-Noire, Dolisie** | Interdits — réputés hérités du modèle académique | ⚠️ **Légitimes dans un contexte précis** : ce sont les villes des **établissements de santé partenaires** vers lesquels les patients sont évacués. Ils restent interdits pour désigner les **sites du centre**, qui sont Moutela et Nkayi |

> Cette correction illustre le risque d'une règle appliquée sans sa source : l'interdiction était juste dans son intention, trop large dans sa formulation.

---

## 1. Écarts majeurs

### ÉC-01 — Les décisions médicales : 4 annoncées, 2 réelles

| | |
|---|---|
| **Détecté le** | 2026-08-10, par INV-07 |
| **Cahier de charge** | Le glossaire annonce quatre décisions : `CLOTURE_SIMPLE`, `PRESCRIPTION`, `EXAMEN_COMPLEMENTAIRE`, `EVACUATION` |
| **Code** | `DECISIONS_MEDICALES = ['EVACUATION', 'SUIVI_TRAITEMENT']` — deux valeurs |
| **Explication** | Le modèle a évolué. La prescription et l'examen complémentaire ne sont plus des *décisions* : ils sont matérialisés par des **documents** (ordonnance de type `PHARMACEUTIQUE` ou `PRESCRIPTION_EXAMEN`). La clôture simple est caractérisée par l'**absence** de décision. Et `SUIVI_TRAITEMENT`, absent du cahier, est apparu |
| **Arbitrage** | Le mémoire décrit **2 décisions**, plus l'absence de décision comme clôture simple |
| **Impact** | Chapitre 7 (conception), fiche UML-ACT-02, fiches de spécification des cas d'utilisation |
| **Statut** | ⚠️ **actif** — le glossaire du cahier reste à corriger, ou l'écart à mentionner en soutenance |

### ÉC-02 — Le nombre de permissions : trois valeurs différentes

| | |
|---|---|
| **Détecté le** | 2026-08-10, par INV-03 |
| **Glossaire** | « ~110 permissions » |
| **README de l'application** | « 116 permissions » |
| **Code** | **128** entrées au catalogue, confirmées par 128 entrées de métadonnées, sans doublon de valeur |
| **Arbitrage** | **128** partout dans le mémoire |
| **Impact** | Chapitres 6 et 7, INV-03 |
| **Statut** | ⚠️ **actif** — README et glossaire à corriger |

### ÉC-03 — Le nombre de routes : 268, pas 273

| | |
|---|---|
| **Détecté le** | 2026-08-10, par INV-01 |
| **Origine de l'erreur** | Un comptage textuel naïf trouvait 273 occurrences. Cinq d'entre elles étaient des mentions `@Get(...)` **à l'intérieur de commentaires** expliquant l'ordre de déclaration des routes |
| **Code** | **268** décorateurs HTTP réels, vérifiés par recomptage ancré en début de ligne, fichier par fichier |
| **Arbitrage** | **268** |
| **Statut** | ✅ **résolu** — trace conservée : c'est un bon exemple de la différence entre compter et vérifier |

---

## 2. Écarts moyens

### ÉC-04 — Un état de bon d'examen qui n'existe pas

L'en-tête du service des bons d'examen annonce un cycle `EN_ATTENTE → VALIDE → RECU → CONSULTÉ`. L'état **`CONSULTÉ` n'apparaît nulle part** dans le code : aucune écriture, aucune validation, aucun filtre. Commentaire obsolète.
**Arbitrage** : le mémoire décrit quatre états — `EN_ATTENTE`, `VALIDE`, `RECU`, `ANNULE`. **Statut** : ⚠️ actif.

### ÉC-05 — Le nombre d'écrans : 17 composants, 15 écrans

Le comptage des fichiers de page donne 17. Deux d'entre eux (`UtilisateursPage`, `RolesPage`) ne sont **pas routés** : ils sont montés en onglet dans la page « Accès & habilitations ».
**Arbitrage** : **15 écrans atteignables**. **Statut** : ✅ résolu.

### ÉC-06 — Cinq machines à états non garanties par la base

Quatre machines reposent sur des énumérations PostgreSQL (visite, consultation, patient, compte). **Cinq** reposent sur de simples champs texte : ordonnance, bon de pharmacie, bon d'examen, évacuation, suivi de traitement. Leurs états ne sont donc contraints que par le code applicatif.
**Arbitrage** : à énoncer comme **limite** au chapitre 7 et en conclusion. **Statut** : ⚠️ actif, par conception.

### ÉC-07 — Un modèle rangé dans la mauvaise section

`SyncState` est déclaré dans la section « messagerie » du fichier de schéma alors qu'il relève de la synchronisation.
**Arbitrage** : classé en synchronisation dans la documentation. Détail d'organisation du fichier source, sans effet sur le modèle. **Statut** : ✅ résolu.

### ÉC-08 — Permissions déclarées à deux endroits côté web

Les permissions du menu latéral (`navigation.config.ts`) et celles des gardes de route (`AppShell.tsx`) sont déclarées séparément. Une divergence produit une entrée visible menant à un refus.
**Preuve que le risque est réel** : le code documente un incident sur `/rapports`, dont l'entrée de menu exigeait `consultation.read` alors que le serveur exige `rapport.read` — clic puis erreur 403.
**Arbitrage** : à citer au chapitre 8 § 8.4. **Statut** : ⚠️ actif, corrigé ponctuellement mais la double déclaration demeure.

### ÉC-09 — Règle de cohérence dupliquée

La règle « écrire implique consulter » existe en deux copies : le paquet partagé et l'API, cette dernière ne pouvant pas importer de valeur depuis le premier. Une divergence entre les deux produirait une incohérence de droits invisible.
**Arbitrage** : dette technique assumée, à mentionner au chapitre 8. **Statut** : ⚠️ actif, documenté par le code lui-même.

---

## 3. Écarts mineurs et points à confirmer

| # | Écart | Arbitrage | Statut |
|---|---|---|---|
| ÉC-10 | Trois permissions du catalogue ne sont exigées par **aucune route** (`ordonnance.read`, `ordonnance.print`, `rapport.export`) | Contrôles de **présentation** côté client, pas de sécurité | ⚠️ à confirmer |
| ÉC-11 | Le fichier de test des permissions est un script PowerShell de 49 Ko | Outil de **vérification manuelle**, pas une suite de tests | ✅ résolu |
| ÉC-12 | `ASSURE_CDD` n'ouvre pas droit aux bons alors qu'il s'agit de personnel sous contrat | Conforme au code et à la matrice en base ; contre-intuitif | ⚠️ **à confirmer auprès du terrain** — question probable du jury |
| ÉC-13 | Le glossaire signale un périmètre du **certificat médical** « à confirmer, l'alignement au recueil ayant restreint cette zone » | Écart reconnu par le cahier lui-même | ⚠️ à confirmer |
| ÉC-14 | Deux suites de test (51 cas) ne sont rattachées à aucun script | Défaut réel de la stratégie de test | ⚠️ actif |
| ÉC-15 | La règle « une seule consultation ouverte par soignant » est vérifiée par requête préalable, non par contrainte d'unicité en base | Techniquement sujet à concurrence | ⚠️ actif, faible |

---

## 4. Écarts entre le modèle de mémoire et le plan de l'école

| # | Point | Modèle Word | Plan de l'école | Arbitrage retenu |
|---|---|---|---|---|
| MA-01 | Introduction générale | 8 points | 4 points | **8 points** (le modèle Word ; ils couvrent les 4) |
| MA-02 | Résumé et abstract | présents | absents | **conservés** — ils valorisent le mémoire |
| MA-03 | Titre de la partie II | « Analyse, conception et implémentation » | « Déroulement du stage » | **Modèle Word** — un seul des deux auteurs a fait le stage |
| MA-04 | Diagramme de déploiement | chapitre 7.5 | chapitre 8.2 | **Chapitre 7** (modèle Word), écart consigné |
| MA-05 | Descriptions textuelles d'UC | « au moins 2 » | « **au plus 2** » | **Exactement 2** dans le corps — § 6.8. Trois fiches de spécification en tableau au § 6.7. Les autres cas ne sont pas détaillés : les annexes ont été retirées |
| MA-06 | Numérotation des figures | irrégulière (`7.3ter.1`, `7.3quater.1`) | — | **Numérotation séquentielle** `Figure <chapitre>.<ordre>` |
| MA-07 | Volume | non précisé | **75-90 pages** | **75-90 pages** |
| MA-08 | Typographie, marges, pagination | non précisées | imposées | **Contraintes de l'école appliquées** |
| MA-09 | Sections supplémentaires | absentes | 2.4 domaine du projet, 3.4 intérêts, 3.6 concepts, 1.3bis attributions, 1.5 chiffres | **Ajoutées** au plan du modèle Word |

---

## 5. Termes hérités des modèles, à ne jamais reprendre

| Terme | Origine réelle | Terme retenu ici |
|---|---|---|
| `SGCDM` | ⚠️ **Correction du 2026-08-10** — ce n'est pas le sigle d'un autre projet, mais la **dénomination retenue par le mémoire de Verdi** pour ce même système. Le présent mémoire emploie le nom réel du code et de sa configuration | **CMS SARIS** |
| `SGCDM` | Exemple d'un autre projet | **CMS SARIS** |
| Brazzaville, Pointe-Noire | Exemple d'un autre projet | **Moutela**, **Nkayi** |
| Centre Médico-**Social** | README de l'application | **Centre Médico-Sanitaire** (décision de l'auteur, alignée sur le modèle de mémoire) |
| « Module Pharmacie » comme service autonome | Exemple d'un autre projet | Le système gère des **bons de pharmacie**, pas un service de pharmacie |

---

## 6. Synthèse

| Gravité | Nombre | Dont actifs |
|---|---:|---:|
| Majeurs | 3 | 2 |
| Moyens | 6 | 5 |
| Mineurs et à confirmer | 6 | 5 |
| Écarts de modèle académique | 9 | 0 (tous arbitrés) |
| **Total** | **24** | **12** |

Les 12 écarts actifs sont repris dans `11_revue_finale/rapport_ecarts_non_resolus.md`.
