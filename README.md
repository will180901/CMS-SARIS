# CMS SARIS

**Système d'information médical pour le Centre Médico-Sanitaire de SARIS-CONGO**
Mémoire de fin de cycle — Licence en Informatique, option Génie Logiciel Applicatif — CFI-CIRAS

---

## Ce que contient ce dépôt

| Dossier | Contenu |
|---|---|
| **`CMS/APP/CMS-SARIS/`** | **Le code de l'application** — monorepo pnpm : serveur, interface web, client de bureau |
| **`Docs/CMS/memoire/`** | **Le dossier source du mémoire** — chapitres, inventaires, fiches de dessin, annexes |
| `Docs/CMS/charte graphique/` | Charte graphique en 12 fiches |
| `Docs/CMS/prompts/` | Méthodologie de production de la documentation |
| `Docs/documents soutenance/` | Modèles académiques, rapport de fin de stage |
| `Docs/Recueil_Existant_CME_v6.docx` | **Recueil de l'existant** — quatre entretiens de terrain |
| `render.yaml` | Configuration de déploiement |
| `saris-cms.drawio` | Diagrammes d'architecture |

---

## Le projet

Le Centre Médico-Sanitaire de SARIS-CONGO assure les soins de premier recours pour **plus de 2 000 agents** et leurs ayants droit, sur **deux sites distants** — Moutéla et Nkayi — dans un contexte de connectivité instable.

Avant ce projet, la gestion reposait entièrement sur le papier : un carnet de santé transporté par le patient, des registres et des fichiers tableur **locaux à chaque site**, aucun lien informatique entre les deux.

Le système couvre le **parcours de soin** — accueil, triage, consultation, décision, génération des documents — et fonctionne **en connexion comme hors connexion**.

### Chiffres

| Grandeur | Valeur |
|---|---:|
| Lignes de code | ≈ 93 500 |
| Points d'accès de l'interface de programmation | 268 |
| Entités de données | 88, reliées par 97 associations |
| Permissions | 128, sur 3 rôles |
| Écrans | 15, plus 25 onglets |
| Migrations de base | 41 |
| Entités synchronisées hors connexion | 52 |
| Cas de test | 145, dont 103 exécutés et réussis |

---

## Pile technique

| Couche | Technologies |
|---|---|
| Interface | React 19 · Vite 7 · Tailwind CSS 4 · TanStack Query · Zustand · react-i18next |
| Client de bureau | Electron 33 · installateur NSIS · mise à jour automatique |
| Serveur | NestJS 11 · Prisma 6 · authentification par jeton · double facteur temporel |
| Bases de données | **PostgreSQL 16** au central · **SQLite** sur le poste autonome |
| Monorepo | pnpm workspaces · Turborepo · TypeScript 5.9 |

---

## Démarrage rapide

**Prérequis** : Node.js 20+, pnpm 9+, PostgreSQL 16, Git.

```bash
git clone <url-du-depot>
```

```bash
cd CMS-SARIS/CMS/APP/CMS-SARIS && pnpm install
```

```bash
powershell -ExecutionPolicy Bypass -File .\setup-db.ps1
```

Puis, dans deux terminaux :

```bash
pnpm --filter api start:dev
```

```bash
pnpm --filter web dev
```

L'interface est alors accessible sur `http://localhost:5173`. Les identifiants du jeu de démonstration figurent dans `CMS/APP/CMS-SARIS/README.md`.

> ⚠️ **Toujours utiliser `pnpm`** dans ce monorepo — jamais `npm`, `npx` ni `yarn` — et **toujours depuis `CMS/APP/CMS-SARIS`**, racine de l'espace de travail.

### Tests

```bash
pnpm --filter api test
```

```bash
pnpm --filter web test
```

```bash
pnpm --filter @cms-saris/types test
```

Ces trois commandes couvrent les **5 suites unitaires — 103 cas, sans dépendance externe**. Les 4 suites d'intégration et la suite de bout en bout exigent en plus une interface de programmation démarrée et une base chargée :

```bash
pnpm --filter api test:integration
```

---

## Deux particularités d'architecture

### Le fonctionnement hors connexion — deux mécanismes distincts

| | Web | Poste de bureau autonome |
|---|---|---|
| Stockage local | Base du navigateur | SQLite, via un serveur embarqué |
| Écritures hors connexion | **File de mutations rejouées** | Écriture directe en base |
| Réconciliation | Rejeu des requêtes dans l'ordre | **Deltas et résolution de conflit** |

Le rejeu de requêtes réutilise **intégralement la validation, les permissions et la logique métier du serveur** — il n'existe aucun moteur de règles dupliqué côté client.

### Le contrôle d'accès à deux étages

Une **permission** ouvre la porte ; une **règle métier** autorise l'acte.

Un infirmier possède la permission de créer une ordonnance, mais le service la refuse tant qu'aucune **délégation active** accordée par le médecin chef ne le couvre. De même, l'émission d'un bon de pharmacie exige que la **catégorie du patient** y ouvre droit — règle portée par une table de la base, donc modifiable sans redéploiement.

---

## La documentation

Le dossier `Docs/CMS/memoire/` contient le dossier source du mémoire : **65 fichiers**, organisés en chapitres, inventaires, fiches de dessin et annexes.

**Point d'entrée** : [`Docs/CMS/memoire/00_pilotage_et_preuves/00_HOME.md`](Docs/CMS/memoire/00_pilotage_et_preuves/00_HOME.md)

### Comment cette documentation a été produite

Deux sources font autorité, et **une seule sur chaque question** :

| Source | Fait autorité sur |
|---|---|
| **Le code** | Ce qui est **livré** |
| **Le recueil de l'existant** | Le **besoin** et le **terrain** |

**Neuf inventaires** extraits mécaniquement de ces sources — routes, entités, permissions, écrans, hors connexion, tests, parcours métier, recueil, rapport de stage — servent de base à toute affirmation. Chaque ligne porte sa référence.

Une **réconciliation** vérifie ensuite, ligne par ligne, qu'aucune capacité du système et aucun besoin exprimé ne reste sans traitement. Le résultat est de **zéro orphelin**.

### Règles appliquées

1. En cas de divergence entre un document et le code, **c'est le code qui est décrit**, et l'écart est consigné — jamais effacé.
2. **Rien ne s'invente.** Une information indisponible produit un bloc `⛔ EN ATTENTE DE SOURCE` et une entrée au registre des questions ouvertes.
3. Chaque affirmation porte son statut : `OBSERVÉ`, `IMPLÉMENTÉ`, `PARTIELLEMENT IMPLÉMENTÉ`, `HORS PÉRIMÈTRE`, `NON IMPLÉMENTÉ`, `À CONFIRMER`.
4. **Aucun résultat de test n'est affirmé** sans sortie console à l'appui.
5. Aucun secret — mot de passe, clé, chaîne de connexion, donnée patient — n'apparaît nulle part.

---

## Périmètre

Le recueil de l'existant couvre l'ensemble du Service Médico-Social et recense **18 besoins** sur trois métiers. Le projet en a retenu un.

| Verdict sur les 18 besoins | Nombre |
|---|---:|
| Couverts | 6 |
| Partiellement couverts | 4 |
| **Hors du périmètre retenu, avec motif** | **8** |
| **Non couverts dans le périmètre** | **0** |

**Sont explicitement écartés** : la gestion de stock pharmaceutique, la facturation, les processus administratifs du personnel, le volet financier des évacuations, et les pôles radiologie, laboratoire, maternité et kinésithérapie du centre.

Ce ne sont pas des lacunes mais des **décisions de cadrage**, chacune motivée. Détail : [`perimetre_et_hors_perimetre.md`](Docs/CMS/memoire/00_pilotage_et_preuves/perimetre_et_hors_perimetre.md).

---

## État du travail

**Ce qui est fait** : le système couvre les 23 besoins fonctionnels identifiés. La documentation est complète sur 9 chapitres sur 10. Les 5 suites de tests unitaires passent — 103 cas, 100 %.

**Ce qui reste** :

| Point | Qui |
|---|---|
| Tracer les 24 figures — les fiches sont prêtes | Les auteurs |
| Produire les captures d'écran — le protocole est prêt | Les auteurs |
| Lire les 8 références bibliographiques — vérifiées, non lues | Les auteurs |
| Relever l'infrastructure réseau du centre — 1 figure, 3 pages | Entretien à conduire |

Détail chiffré et priorisé : [`rapport_ecarts_non_resolus.md`](Docs/CMS/memoire/11_revue_finale/rapport_ecarts_non_resolus.md).

---

## Auteurs

**BOUWAYI MIKOUYA Déo Cherel** et **NZILA Oscarvie Verdi**

Le stage à la SARIS a été effectué par **Nzila Oscarvie Verdi**, qui a conduit les entretiens de terrain et produit le recueil de l'existant. L'analyse de ces éléments, la sélection du périmètre, la conception et la réalisation de l'application relèvent du **travail commun des deux auteurs**.

Année académique 2025–2026 · CFI-CIRAS

---

## Licence

Projet académique. Tous droits réservés — SARIS-CONGO.
