# Figure 8.2 — Modèle physique de données

> **Ce fichier n'est pas une figure à dessiner.** La fiche `SCH-MPD-01` prescrit une représentation textuelle. Sur décision de l'auteur, le modèle physique est présenté **en tableaux plutôt qu'en instructions SQL** : l'information est la même — types exacts, nullité, valeurs par défaut, contraintes — et la présentation se lit sans connaître le langage.

> **Établi le 4 septembre 2026 depuis le schéma de données lui-même.** Deux chiffres de la fiche ont été corrigés au passage, voir la décision **D-77**.

---

## A. Les types réellement employés

Sur les quatre-vingt-huit tables du schéma :

| Type | Occurrences | Usage |
|---|---:|---|
| `TEXT` | 492 | identifiants, libellés, textes libres |
| `TIMESTAMP(3)` | 214 | horodatages, à la milliseconde |
| `INTEGER` | 25 | compteurs, mesures entières |
| `BOOLEAN` | 21 | indicateurs |
| `DOUBLE PRECISION` | 11 | mesures physiologiques |
| `JSONB` | 6 | contenus structurés variables |
| Types énumérés | 6 | `StatutCompte`, `StatutPatient`, `StatutVisite`, `StatutConsultation`, `ModeOverridePermission`, `TypeEvenementVisite` |
| `BIGINT` | 1 | compteur de séquence de synchronisation |

> La migration initiale du 18 mai 2026 n'employait que **quatre** types énumérés ; les deux autres sont arrivés par des migrations ultérieures.

**Les identifiants sont des `TEXT`, non des entiers auto-incrémentés.** Ce sont des identifiants universels engendrés par l'application. Ce choix est **imposé par le fonctionnement hors connexion** : un poste isolé doit pouvoir créer un enregistrement sans demander un numéro au serveur. Avec des entiers séquentiels, deux postes hors ligne produiraient une collision à chaque création.

---

## B. Trois tables représentatives

### Une table du parcours de soin — `Visite`

Elle réunit tous les cas de figure du schéma : un type énuméré, des valeurs par défaut, des colonnes facultatives, un compteur de version et la marque de suppression logique.

| Colonne | Type | Nullité | Valeur par défaut | Contrainte |
|---|---|---|---|---|
| `id` | `TEXT` | obligatoire | identifiant généré | clé primaire |
| `patientId` | `TEXT` | obligatoire | — | — |
| `siteId` | `TEXT` | obligatoire | — | — |
| `motifPrincipalId` | `TEXT` | obligatoire | — | — |
| `soignantId` | `TEXT` | — | — | — |
| `statut` | `StatutVisite` | obligatoire | EN_ATTENTE | — |
| `dateOuverture` | `TIMESTAMP(3)` | obligatoire | date du jour | — |
| `dateCloture` | `TIMESTAMP(3)` | — | — | — |
| `typeCloture` | `TEXT` | — | — | — |
| `notesAccueil` | `TEXT` | — | — | — |
| `motifAnnulation` | `TEXT` | — | — | — |
| `creerHorsLigne` | `BOOLEAN` | obligatoire | faux | — |
| `version` | `INTEGER` | obligatoire | 1 | — |
| `createdAt` | `TIMESTAMP(3)` | obligatoire | date du jour | — |
| `updatedAt` | `TIMESTAMP(3)` | obligatoire | — | — |
| `deletedAt` | `TIMESTAMP(3)` | — | — | — |

**Ce qu'elle montre.** `statut` est un **type énuméré** : la base elle-même refuse toute valeur hors de la liste. `creerHorsLigne` trace l'origine de la saisie, donnée propre au fonctionnement hors connexion. `deletedAt` est facultative — sa présence marque la suppression logique. Et `updatedAt` est obligatoire **sans valeur par défaut** : elle est renseignée par l'application, ce qui est précisément la raison pour laquelle la synchronisation doit restaurer l'horodatage d'origine après écriture.

### La table qui porte la règle centrale — `DroitCategoriePatient`

C'est la table la plus importante du schéma au regard du métier, et l'une des plus simples.

| Colonne | Type | Nullité | Valeur par défaut | Contrainte |
|---|---|---|---|---|
| `id` | `TEXT` | obligatoire | identifiant généré | clé primaire |
| `categorieId` | `TEXT` | obligatoire | — | — |
| `typePrestation` | `TEXT` | obligatoire | — | — |
| `couvert` | `BOOLEAN` | obligatoire | vrai | — |
| `plafondConsultations` | `INTEGER` | — | — | — |
| `periode` | `TEXT` | — | — | — |
| `updatedAt` | `TIMESTAMP(3)` | obligatoire | date du jour | — |

**Ce qu'elle montre.** La règle d'éligibilité aux bons tient en six colonnes. Elle est **modifiable sans redéploiement**, ce qui correspond à sa nature : une politique d'entreprise, non une constante technique.

### Une table de liaison à clé composite — `RolePermission`

Elle matérialise le lien plusieurs-à-plusieurs entre les rôles et les permissions.

| Colonne | Type | Nullité | Valeur par défaut | Contrainte |
|---|---|---|---|---|
| `roleId` | `TEXT` | obligatoire | — | — |
| `permissionId` | `TEXT` | obligatoire | — | — |
| `updatedAt` | `TIMESTAMP(3)` | obligatoire | date du jour | — |

**Ce qu'elle montre.** Sa clé primaire est **composite** : le couple `roleId` + `permissionId`. La base garantit ainsi qu'une permission ne peut être accordée deux fois au même rôle.

---

## C. Index, contraintes et comportements de suppression

| Élément | Nombre | Rôle |
|---|---:|---|
| Index déclarés | **76** | dont un index sur `updatedAt` pour **chaque table synchronisée** : c'est lui qui rend le calcul des écarts possible |
| Contraintes d'unicité | **35** | `login`, `email`, les codes de référentiel, les matricules, le numéro de patient |
| Clés primaires composites | **2** | `UtilisateurRole` et `RolePermission` |
| Relations déclarées | **102** | sur l'ensemble des 88 tables |
| Dont suppression en cascade | **10** | les autres refusent la suppression d'un parent encore référencé |

> **L'index sur `updatedAt` n'est pas un détail de performance.** Sans lui, la synchronisation devrait relire une table entière pour trouver ce qui a changé depuis le dernier échange. C'est la contrainte technique que le choix du fonctionnement hors connexion impose au schéma.

---

## D. Mise en forme dans Word

| Réglage | Valeur |
|---|---|
| Tableaux | style de tableau simple, en-tête en gras, **quadrillage fin** |
| Police des tableaux | police du corps, **9 pt** |
| Colonnes techniques | garder l'ordre donné : la clé d'abord, les colonnes techniques en dernier |
| Titres de section | *Une table du parcours de soin*, etc. — en gras, dans la police du corps |

Les commentaires en gras sous chaque tableau font partie de la figure : ce sont eux qui disent **ce que le tableau démontre**, et non ce qu'il contient.
