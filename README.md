# Documentation CMS SARIS

Bienvenue dans la documentation du projet **CMS SARIS** (Centre Médical SARIS-CONGO), une
solution de gestion médico-sociale conçue pour des centres de santé d'entreprise répartis
sur **2 sites** (Moutela et Nkayi). Cette page est le **point d'entrée** de l'ensemble de la
documentation : elle décrit l'organisation du dossier et l'ordre de lecture recommandé.

La documentation est rédigée dans une logique **« as-built »** : elle décrit la spécification
cible **et** l'état réellement livré de l'application, en signalant explicitement les écarts.
Elle ne duplique pas le détail des fiches — chaque section ci-dessous **renvoie** vers les
documents qui font foi.

---

## Structure du dossier `Docs/`

| Sous-dossier | Contenu | À lire pour quoi |
|---|---|---|
| [`cahiers de charges/`](./cahiers%20de%20charges/README.md) | 19 documents numérotés **00 à 18** + une page d'index. Vision, architecture fonctionnelle, spécifications par module métier, modèle de données, règles métier, workflows, recette, traçabilité, exigences non-fonctionnelles, périmètre de développement, messagerie chiffrée. | Comprendre **ce que fait l'application** et **pourquoi** : périmètre fonctionnel, règles métier, processus, modèle de données. C'est le cœur de la documentation. |
| [`stack-technique/`](./stack-technique/00-synthese.md) | 8 fiches **00 à 07** : synthèse, frontend, backend, base de données, offline/sync, sécurité, monorepo, application de bureau. | Comprendre **comment c'est construit** : choix technologiques, versions, architecture transversale, conventions d'implémentation. |
| [`conception/`](./conception/blueprint-offline-first.md) | Blueprint d'implémentation détaillé (offline-first), ancré sur le code réel du dépôt. | Préparer ou suivre un **chantier d'implémentation** : faits vérifiés dans le code, plan d'action technique pas-à-pas. |
| [`charte graphique/`](./charte%20graphique/CG-01_Couleurs_et_Tokens.html) | 12 fiches HTML **CG-01 à CG-12** : couleurs & tokens, typographie, espacements & grilles, effets de surface, composants, navigation, données & contenu, feedback, animations, iconographie, états & accessibilité, récapitulatif & règles. | Appliquer le **Design System SARIS** : tokens CSS, composants, règles visuelles strictes (à ouvrir dans un navigateur). |

Un document complémentaire se trouve à la racine du dossier :

- [`plan-offline-first-synchronisation.md`](./plan-offline-first-synchronisation.md) — feuille
  de route (**statut : conception/cible**) de l'évolution vers un fonctionnement offline-first
  à base locale, au-delà du mode centralisé actuel.

---

## Ordre de lecture recommandé

1. **Cahiers de charges d'abord** — commencer par l'index dédié
   [`cahiers de charges/README.md`](./cahiers%20de%20charges/README.md), puis suivre l'ordre
   qu'il propose : vision et périmètre ([doc 00](./cahiers%20de%20charges/00-vision-perimetre-mvp.md)),
   architecture fonctionnelle ([doc 01](./cahiers%20de%20charges/01-architecture-fonctionnelle-globale.md)),
   puis les modules métier, le modèle de données et les workflows.
2. **Stack technique ensuite** — lire la synthèse
   [`stack-technique/00-synthese.md`](./stack-technique/00-synthese.md), qui donne la vue
   d'ensemble, avant les fiches détaillées par couche (frontend, backend, base de données,
   offline/sync, sécurité, monorepo, application de bureau).
3. **Conception** — pour entrer dans le détail d'un chantier d'implémentation, consulter
   [`conception/blueprint-offline-first.md`](./conception/blueprint-offline-first.md).
4. **Charte graphique** — pour la mise en œuvre visuelle, parcourir les fiches
   [`charte graphique/`](./charte%20graphique/CG-01_Couleurs_et_Tokens.html) (à ouvrir dans un
   navigateur), en commençant par CG-01 (couleurs & tokens).

---

## Chiffres clés

> | Indicateur | Valeur |
> |---|---|
> | Tables Prisma (schéma livré) | **79** |
> | Migrations | **22** |
> | Permissions granulaires | **110** |
> | Rôles | **6** (`ADMIN_SYSTEME`, `ADMIN_MEDICAL`, `MEDECIN_CHEF`, `INFIRMIER`, `INFIRMIER_DELEGUE`, `AGENT_RH`) |
> | Modules métier (MVP) | **8** |
> | Sites | **2** (Moutela, Nkayi) |
>
> **Pile technique** — Frontend : React 19 · Vite 7 · Tailwind CSS v4.
> Backend : NestJS 11 · Prisma 6.
> Données : PostgreSQL 16 (serveur) + SQLite (poste autonome).
> Monorepo **pnpm + Turbo** · bilingue **FR/EN** (`react-i18next`) · **offline-first** ·
> client de bureau **Electron** (installateur **NSIS**).

---

## Liens utiles

- Index des cahiers de charges : [`./cahiers de charges/README.md`](./cahiers%20de%20charges/README.md)
- Synthèse de la stack technique : [`./stack-technique/00-synthese.md`](./stack-technique/00-synthese.md)
- Blueprint d'implémentation : [`./conception/blueprint-offline-first.md`](./conception/blueprint-offline-first.md)
- Plan offline-first & synchronisation : [`./plan-offline-first-synchronisation.md`](./plan-offline-first-synchronisation.md)
- Charte graphique (entrée) : [`./charte graphique/CG-01_Couleurs_et_Tokens.html`](./charte%20graphique/CG-01_Couleurs_et_Tokens.html)
