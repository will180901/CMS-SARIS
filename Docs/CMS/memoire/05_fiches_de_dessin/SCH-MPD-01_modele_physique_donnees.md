# SCH-MPD-01 — Modèle physique de données

## Bloc 1 — Cartouche

```
Identifiant       : SCH-MPD-01
Figure du mémoire : Figure 8.2 — Modèle physique de données
Chapitre / section: 8 — § 8.2.2
Type              : Modèle physique (script de création)
Sources de preuve : 41 migrations SQL versionnées · schéma dérivé SQLite
Statut            : IMPLÉMENTÉ
Format conseillé  : A4 portrait, police à chasse fixe
Densité           : extrait représentatif de 4 tables + tableau des types
```

## Bloc 2 — Objectif et périmètre

**Ce que la figure doit démontrer.** La forme réellement implantée dans le moteur : types SQL exacts, contraintes de nullité, valeurs par défaut, index, comportements de suppression.

**Décision de représentation.** Reproduire les 88 tables occuperait plusieurs dizaines de pages. La figure présente **quatre tables représentatives**, choisies parce qu'elles couvrent l'ensemble des cas de figure du schéma, plus un tableau récapitulatif des types employés.

Le script complet est versionné dans les 41 migrations du projet ; le mémoire n'en reproduit que des extraits représentatifs.

## Bloc 3 — Contenu à reproduire

### Tableau des types réellement employés

| Type SQL (PostgreSQL) | Occurrences | Usage |
|---|---:|---|
| `TEXT` | 332 | Identifiants, libellés, textes libres |
| `TIMESTAMP(3)` | 77 | Horodatages, à la milliseconde |
| `INTEGER` | 13 | Compteurs, mesures entières |
| `BOOLEAN` | 10 | Indicateurs |
| `DOUBLE PRECISION` | 8 | Mesures physiologiques |
| Types énumérés | 6 | `StatutCompte`, `StatutPatient`, `StatutVisite`, `StatutConsultation`, `ModeOverridePermission`, `TypeEvenementVisite` |

*Décompte de la migration initiale.*

> **Observation à commenter dans le mémoire.** Les identifiants sont des `TEXT` et non des entiers auto-incrémentés : ce sont des identifiants universels générés côté application. Ce choix est **imposé par l'offline-first** — un poste hors connexion doit pouvoir créer un enregistrement sans demander de numéro au serveur. Avec des entiers séquentiels, deux postes hors ligne produiraient des collisions à chaque création.

### Extrait n° 1 — Une table du parcours de soin

```sql
CREATE TABLE "Visite" (
    "id"               TEXT           NOT NULL,
    "patientId"        TEXT           NOT NULL,
    "siteId"           TEXT           NOT NULL,
    "motifPrincipalId" TEXT           NOT NULL,
    "statut"           "StatutVisite" NOT NULL DEFAULT 'EN_ATTENTE',
    "soignantId"       TEXT,
    "dateOuverture"    TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateCloture"      TIMESTAMP(3),
    "creerHorsLigne"   BOOLEAN        NOT NULL DEFAULT false,
    "version"          INTEGER        NOT NULL DEFAULT 1,
    "createdAt"        TIMESTAMP(3)   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"        TIMESTAMP(3)   NOT NULL,
    "deletedAt"        TIMESTAMP(3),
    CONSTRAINT "Visite_pkey" PRIMARY KEY ("id")
);
```

Points à commenter :

- `statut` est un **type énuméré**, avec valeur par défaut : la base garantit qu'aucune autre valeur n'entrera.
- `creerHorsLigne` trace l'origine de la saisie — donnée propre au fonctionnement offline-first.
- `deletedAt` est **nullable** : sa présence marque la suppression logique.
- `updatedAt` est `NOT NULL` sans valeur par défaut : il est renseigné par la couche applicative, ce qui est précisément la raison pour laquelle la synchronisation doit **restaurer** l'horodatage source après écriture.

### Extrait n° 2 — La table qui porte la règle centrale

```sql
CREATE TABLE "DroitCategoriePatient" (
    "id"                   TEXT         NOT NULL,
    "categorieId"          TEXT         NOT NULL,
    "typePrestation"       TEXT         NOT NULL,
    "couvert"              BOOLEAN      NOT NULL DEFAULT true,
    "plafondConsultations" INTEGER,
    "periode"              TEXT,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DroitCategoriePatient_pkey" PRIMARY KEY ("id")
);
```

> C'est la table la plus importante du schéma au regard du métier, et l'une des plus simples. La règle d'éligibilité aux bons tient en six colonnes. Elle est **modifiable sans redéploiement**, ce qui correspond à sa nature : une politique d'entreprise, non une constante technique.

### Extrait n° 3 — Une table de liaison à clé composite

```sql
CREATE TABLE "RolePermission" (
    "roleId"       TEXT         NOT NULL,
    "permissionId" TEXT         NOT NULL,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId","permissionId")
);
```

### Extrait n° 4 — Index et clés étrangères

```sql
-- Unicité fonctionnelle
CREATE UNIQUE INDEX "Utilisateur_login_key"        ON "Utilisateur"("login");
CREATE UNIQUE INDEX "Utilisateur_email_key"        ON "Utilisateur"("email");
CREATE UNIQUE INDEX "Site_code_key"                ON "Site"("code");
CREATE UNIQUE INDEX "CategoriePatient_code_key"    ON "CategoriePatient"("code");

-- Index de synchronisation : indispensable au calcul des deltas
CREATE INDEX "Visite_updatedAt_idx"                ON "Visite"("updatedAt");

-- Intégrité référentielle
ALTER TABLE "Visite"
  ADD CONSTRAINT "Visite_patientId_fkey"
  FOREIGN KEY ("patientId") REFERENCES "Patient"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
```

Points à commenter :

- L'**index sur l'horodatage de modification** n'est pas un détail de performance : c'est lui qui rend la synchronisation par deltas praticable. Sans lui, chaque cycle exigerait un parcours complet des tables.
- Le comportement `RESTRICT` à la suppression est le défaut : la suppression en cascade n'est déclarée que là où elle est voulue. Ailleurs, la cascade est faite **explicitement, dans une transaction applicative**.

## Bloc 4 — Différences entre les deux moteurs

| Aspect | PostgreSQL (serveur) | SQLite (poste autonome) |
|---|---|---|
| Tables | 88 | **88 — identiques** |
| Types énumérés | 6 types natifs | Contraintes textuelles |
| Horodatage | `TIMESTAMP(3)` | Texte au format ISO |
| Recherche insensible à la casse | Option explicite requise | Comportement par défaut |
| Migrations | 39 | 2, dérivées automatiquement |

> **Point à souligner.** La réplique locale n'est pas un sous-ensemble appauvri : le poste autonome dispose du **modèle complet**. C'est un argument fort du mode hors ligne, et il se démontre par ce tableau.

## Bloc 5 — Éléments à ne pas reproduire

| Interdit | Motif |
|---|---|
| Chaîne de connexion à la base | Secret |
| Nom d'hôte, port, identifiants de production | Secret |
| Données réelles de patients | Confidentialité |
| Le script complet des 88 tables | Volume — il reste dans les migrations du projet, hors du mémoire |

## Bloc 6 — Plan de placement

Ordre de présentation : tableau des types → extrait n° 1 → extrait n° 2 → extrait n° 3 → extrait n° 4 → tableau des différences entre moteurs.

Le code SQL est présenté en **police à chasse fixe**, taille 10 ou 11, avec les colonnes alignées comme ci-dessus. L'alignement vertical des types facilite la lecture et signale une présentation soignée.

## Bloc 7 — Légende

> **Figure 8.2 — Modèle physique de données**
> Extraits représentatifs des 88 tables. Le script complet est versionné dans les 41 migrations du projet ; le mémoire n'en reproduit que des extraits représentatifs. Les identifiants sont des chaînes universelles générées côté application, choix imposé par le fonctionnement hors connexion.
> *Source : migrations du projet.*

## Bloc 8 — Contrôles

```
[ ] Le tableau des types est présent, avec les décomptes
[ ] Les 4 extraits sont reproduits sans modification du code réel
[ ] Les colonnes SQL sont alignées verticalement
[ ] Le tableau des différences entre moteurs est présent
[ ] Les 4 commentaires d'analyse sont présents
[ ] Aucune chaîne de connexion, aucun identifiant de production
[ ] Aucune donnée réelle de patient
[ ] La légende précise qu'il s'agit d'extraits, et où se trouve le schéma complet
```

## Vérification finale

| Point | Source |
|---|---|
| Types SQL et décomptes | Migration initiale, comptage direct |
| Définition exacte des tables reproduites | Migrations |
| Index sur l'horodatage de modification | Contraintes de table du schéma |
| Parité des 88 tables entre les deux moteurs | INV-02 § 1 |

---

# ⚠️ Révision du 4 septembre 2026 — forme et décomptes

## 1. La figure se présente en tableaux, non en SQL

**Décision de l'auteur.** Le modèle physique porte la même information — types exacts, nullité, valeurs par défaut, index, contraintes — mais sous forme de **tableaux**, sans instruction SQL. La présentation se lit sans connaître le langage, et elle respecte la consigne de l'auteur sur le code dans les documents.

## 2. Deux décomptes corrigés

| Élément | Ce que disait la fiche | Ce que dit le schéma |
|---|---|---|
| Types énumérés | 6, « au décompte de la migration initiale » | **4** dans la migration initiale, **6** dans le schéma d'aujourd'hui |
| `JSONB` | absent du tableau | **6 occurrences** |

Les cinq autres décomptes de la fiche sont exacts pour la migration initiale : `TEXT` 332, `TIMESTAMP(3)` 77, `INTEGER` 13, `BOOLEAN` 10, `DOUBLE PRECISION` 8.

**La figure retient l'état d'aujourd'hui**, sur les quatre-vingt-huit tables : `TEXT` 492, `TIMESTAMP(3)` 214, `INTEGER` 25, `BOOLEAN` 21, `DOUBLE PRECISION` 11, `JSONB` 6, `BIGINT` 1, six types énumérés.

## 3. La figure ne se compose plus depuis cette fiche

Le contenu est **engendré depuis le schéma de données**, et déposé dans `07_figures_texte/FIG_8-2_modele_physique.md`. Cette fiche reste la spécification ; elle n'est plus la source des contenus.
