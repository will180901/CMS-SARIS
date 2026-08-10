# INV-06 — Inventaire des tests

> **Statut** : extrait · **Date d'extraction** : 2026-08-10
> **Sources** : `apps/api/test/`, `apps/web/test/`, `packages/types/test/`, scripts `package.json` de chaque paquet
> **Nature de la preuve** : `IMPLÉMENTÉ` pour l'existence et le contenu des suites. **Aucun résultat d'exécution n'est disponible** — voir § 2.

---

## 1. Synthèse

| Indicateur | Valeur |
|---|---|
| Fichiers de test | **10** |
| Cas de test (assertions nommées) | **145** |
| Suites rattachées à un script exécutable | **10 sur 10** ✅ |
| Suites orphelines | **0** ✅ — corrigé le 2026-08-10, voir § 5 |
| Suites purement unitaires (sans dépendance externe) | **5** |
| Suites d'intégration (exigent une API démarrée + base seedée) | **4** |
| Suite end-to-end (Jest + Supertest) | **1** |
| **Cas exécutés et vérifiés** | **103** |
| **Réussis** | **103** — soit **100 %** ✅ |
| **Échoués** | **0** — le test périmé a été corrigé, voir § 2.3 |
| Cas non exécutés | **43** — exigent une API active |

---

## 2. ✅ Statut d'exécution — campagne réelle du 2026-08-10

**Cinq suites sur dix ont été exécutées, avec sorties console à l'appui.** Les cinq autres exigent une API démarrée et une base chargée, non disponibles.

### 2.1 Méthode d'exécution

Le monorepo complet n'a pas pu être installé (l'installation a été interrompue par épuisement mémoire). Les suites de **logique pure** ont donc été exécutées directement par l'exécuteur TypeScript, sans installer le monorepo :

```bash
npm install -g tsx@4
```

```bash
tsx packages/types/test/sync-conflict.test.ts
```

Deux suites ont exigé une dépendance unique — l'une pour la validation de schéma, l'autre pour le journal applicatif — installées à part et exposées par la variable `NODE_PATH`.

### 2.2 Résultats réels

**Deux campagnes ont été conduites** : une première le 2026-08-10 au matin, qui a révélé un test périmé ; une seconde après correction.

#### Campagne 1 — avant correction

| # | Suite | Cas | Réussis | Échoués | Verdict |
|---|---|---:|---:|---:|---|
| 1 | `sync-conflict` — résolution de conflit | 17 | **17** | 0 | ✅ |
| 2 | `soft-delete-core` — suppression logique | 10 | **10** | 0 | ✅ |
| 3 | `totp-secret` — chiffrement du second facteur | 11 | **11** | 0 | ✅ |
| 4 | `message-crypto` — chiffrement de la messagerie | 23 | **23** | 0 | ✅ |
| 5 | `validation` — règles de saisie | 41 | **40** | **1** | ⚠️ **test périmé** |
| | **Total** | **102** | **101** | **1** | 99 % |

#### Campagne 2 — après correction du test périmé

| # | Suite | Cas | Réussis | Échoués | Verdict |
|---|---|---:|---:|---:|---|
| 1 | `sync-conflict` — résolution de conflit | 17 | **17** | 0 | ✅ |
| 2 | `soft-delete-core` — suppression logique | 10 | **10** | 0 | ✅ |
| 3 | `totp-secret` — chiffrement du second facteur | 11 | **11** | 0 | ✅ |
| 4 | `message-crypto` — chiffrement de la messagerie | 23 | **23** | 0 | ✅ |
| 5 | `validation` — règles de saisie | **42** | **42** | **0** | ✅ **corrigée** |
| | **Total** | **103** | **103** | **0** | **100 %** |
| | Non exécutées — exigent une API active | 43 | — | — | ⏳ |

**Taux de réussite : 103 sur 103, soit 100 %.**

> Le passage de 41 à 42 cas dans la suite `validation` n'est pas un ajout de test : c'est une **boucle de comparaison qui itère désormais sur 9 plages au lieu de 8**. Le garde-fou couvre à nouveau l'intégralité des constantes vitales.

### 2.3 ⚠️ L'échec constaté — analyse

Un seul cas échoue, dans la suite `validation` :

```
✗ toutes les clés vitales du front existent (8)
   Expected values to be strictly equal:
   9 !== 8
```

**Diagnostic.** Ce n'est **pas** une erreur du code applicatif, mais **une dérive du test lui-même**.

| Élément | Constantes vitales déclarées |
|---|---:|
| Interface web (`VITAL_RANGES`) | **9** |
| Objet de transfert du serveur (`@Min`/`@Max`) | **9** |
| **Liste de comparaison du test** (`DTO_RANGES`) | **8** |
| **Assertion de comptage du test** | **8** |

La constante **`frequenceRespiratoire`** (plage 4 à 80 cycles par minute) a été ajoutée **des deux côtés** — interface et serveur — mais **jamais au test**. Le front et le serveur sont donc **parfaitement alignés** ; c'est le garde-fou qui est resté en arrière.

**Deux conséquences, l'une rassurante et l'autre non.**

Rassurante : les huit comparaisons de plages passent, l'alignement client-serveur est vérifié pour huit constantes sur neuf.

Préoccupante : le test « anti-désynchronisation » **ne couvre pas** la neuvième constante. Une divergence sur la fréquence respiratoire passerait inaperçue. Le garde-fou est incomplet là où il prétend être exhaustif.

### ✅ Correction appliquée le 2026-08-10

La plage manquante a été ajoutée à la liste de comparaison, et l'assertion de comptage porte désormais sur les deux ensembles — pour qu'une dérive du même type ne puisse plus se produire :

```typescript
const DTO_RANGES: Record<string, { min: number; max: number }> = {
  // … les 8 existantes
  frequenceRespiratoire: { min: 4, max: 80 },   // ← ajoutée
}

test('toutes les clés vitales du front sont couvertes par le garde-fou (9)', () => {
  assert.equal(Object.keys(VITAL_RANGES).length, 9)
  assert.equal(Object.keys(DTO_RANGES).length, 9)   // ← les DEUX ensembles sont vérifiés
})
```

**Résultat après correction** : la boucle de comparaison itère sur **9 plages**, la suite passe à **42 cas, 42 réussis, 0 échec**. Le garde-fou couvre à nouveau l'intégralité des constantes vitales.

> ### C'est la démonstration concrète du défaut des suites orphelines
>
> Cette suite **n'était rattachée à aucune commande**. Personne ne l'exécutait, donc **personne n'a vu la dérive**. Le test est resté figé sur huit constantes pendant que le code en gagnait une neuvième.
>
> Le risque n'était pas théorique : il est ici **prouvé, puis corrigé**. Ce constat est porté au chapitre 8 § 8.6 (difficultés rencontrées) — il vaut mieux qu'un long développement sur l'intérêt de l'intégration continue.
>
> **Les deux suites ont depuis été rattachées à une commande** (§ 5). La même dérive ne peut plus passer inaperçue.

### 2.4 Les cinq suites non exécutées

| Suite | Cas | Obstacle |
|---|---:|---|
| `crud-integration` | 19 | Exige une API démarrée et une base chargée |
| `messaging-integration` | 12 | Idem, plus deux comptes du jeu de démonstration |
| `conversation-firstmessage` | 9 | Idem |
| `soft-delete-revive` | 8 | Idem |
| `app.e2e-spec` | 2 | Exige le monorepo installé |

Pour les exécuter :

```bash
pnpm install
```

```bash
pnpm --filter api start:dev
```

```bash
pnpm --filter api test:integration
```

### 2.5 Ce que la documentation du projet rapporte par ailleurs

Une documentation antérieure du projet — datée du 2026-06-26, écartée depuis comme source mais conservée ici pour la seule mention de ces constats — fait état d'exécutions plus larges :

| Source | Constat rapporté |
|---|---|
| Registre des risques, R-12 | Tests d'intégration exécutés **aussi sur le backend embarqué SQLite : 48 sur 48** |
| Stratégie de tests, ST-04-01 | Parcours clinique **40/40**, infirmier et mentions **19/19**, annonces et personnel **14/14**, certificat **11/11** |
| Stratégie de tests, ST-04-02 | Synchronisation phase B **19/19**, phase C **10/10**, refonte des parcours **126/126** |

> ⚠️ **Ces chiffres ne sont pas vérifiables ici**, et la stratégie de tests du projet le dit elle-même : *« ces scripts de flux sont ad-hoc et non tous committés dans le dépôt ; les compteurs valent constat d'exécution daté, pas garantie rejouable en l'état »*.
>
> **Formulation exacte à retenir pour le mémoire** : 102 cas exécutés et vérifiés le 2026-08-10, dont 101 réussis ; la documentation du projet rapporte en outre des campagnes antérieures dont les scripts ne sont pas tous versionnés.

---

## 3. Suites unitaires — sans dépendance externe

Ce sont les plus solides : logique pure, déterministe, exécutable partout, sans base ni réseau.

### 3.1 `soft-delete-core.test.ts` — 10 cas

**Portée** : logique pure de la suppression logique (offline-first). Fonctions `isSoftDeletable`, `toSoftDeleteUpdate`, `addNotDeletedFilter`, `delegateName`.
**Ce que ça prouve** : un enregistrement supprimé est marqué, jamais effacé, et disparaît automatiquement des lectures. C'est le fondement de la propagation des suppressions par tombstone (INV-05 § 5.3).
**Script** : `pnpm --filter api test`

### 3.2 `message-crypto.test.ts` — 23 cas

**Portée** : chiffrement de la messagerie interne (AES-256-GCM).
**Ce que ça prouve** :

- aller-retour texte et binaire (chiffrer puis déchiffrer redonne l'original) ;
- **le contenu chiffré ne contient jamais le clair** ;
- format de stockage versionné `v2:<idClé>:<iv>:<tag>:<chiffré>` ;
- authentification GCM : toute altération du chiffré, du tag ou de l'IV **casse** le déchiffrement — aucun message falsifié n'est accepté ;
- rétrocompatibilité avec le format v1 et repli sur la clé TOTP ;
- rotation de clés : la clé courante chiffre, les anciennes restent lisibles, la ré-encryption n'est pas destructive.

C'est la suite la plus fournie du projet, et la preuve directe de la confidentialité des échanges. **À mettre en avant au chapitre 8.**
**Script** : `pnpm --filter api test`

### 3.3 `totp-secret.test.ts` — 11 cas

**Portée** : chiffrement au repos des secrets de double authentification.
**Ce que ça prouve** : la clé maîtresse de la 2FA n'est jamais stockée en clair ; format `v1:<iv>:<tag>:<chiffré>`, IV 96 bits, tag 128 bits ; toute altération lève une erreur ; migration douce des secrets non préfixés ; `isEncrypted()` distingue clair et chiffré.
**Script** : `pnpm --filter api test`

### 3.4 `sync-conflict.test.ts` — 17 cas ✅

**Portée** : résolution de conflit de synchronisation (Last-Write-Wins, tombstones, `baseUpdatedAt`).
**Ce que ça prouve** : le cœur du fonctionnement hors-ligne — la fonction pure décrite en INV-05 § 5.3, réutilisée à l'identique par le serveur central et par le poste local.
**Script** : **aucun**. Voir § 5.

### 3.5 `validation.test.ts` — 42 cas ✅

**Portée** : bibliothèque de validation métier partagée par tous les formulaires.
**Ce que ça prouve** : noms propres (lettres et accents, pas de chiffres), téléphone Congo et international (9 à 12 chiffres), courriel, date de naissance (rejet du futur et des âges supérieurs à 120 ans), code, matricule, mot de passe, et surtout les **plages physiologiques des constantes vitales alignées sur le DTO du serveur** — une preuve anti-désynchronisation entre le client et l'API.

C'est la suite qui compte le plus de cas du projet. Qu'elle ne soit rattachée à aucun script est le principal défaut de la stratégie de test.
**Script** : **aucun**. Voir § 5.

---

## 4. Suites d'intégration et end-to-end — exigent un environnement actif

### 4.1 `crud-integration.test.ts` — 19 cas

**Portée** : pile complète sur le référentiel « pathologies » — contrôleur → gardes (JWT puis permissions) → validation du DTO → service → Prisma → PostgreSQL.
**Ce que ça couvre** : authentification, refus sans jeton (401), création, lecture, mise à jour, changement de statut, validation (400), suppression, vérification de l'absence.
**Prérequis** : API démarrée, base seedée (`admin` / mot de passe du seed).
**Script** : `pnpm --filter api test:integration`

### 4.2 `messaging-integration.test.ts` — 12 cas

**Portée** : messagerie chiffrée, notifications et indicateur « en train d'écrire », entre **deux utilisateurs réels**.
**Ce que ça couvre** : connexion de deux comptes, ouverture d'une conversation, envoi multipart chiffré au repos, réception côté destinataire avec compteur de non-lus, lecture déchiffrée, événement de saisie et sa sécurité.
**Prérequis** : API démarrée, base seedée avec les comptes du personnel.
**Script** : `pnpm --filter api test:integration`

### 4.3 `conversation-firstmessage.test.ts` — 9 cas

**Portée** : règle « c'est le premier message qui crée la conversation ».
**Ce que ça prouve** : ouvrir une conversation directe sans rien envoyer ne la fait apparaître chez personne ; dès le premier message, elle apparaît des deux côtés.
**Origine** : test de non-régression écrit pour verrouiller un correctif. À citer au chapitre 8 § 8.4 (difficultés rencontrées).
**Script** : `pnpm --filter api test:integration`

### 4.4 `soft-delete-revive.test.ts` — 8 cas

**Portée** : résurrection après suppression logique.
**Ce que ça prouve** : après une suppression, on peut recréer un enregistrement portant la même clé unique — le tombstone est ressuscité au lieu de provoquer une collision (erreur 500 historique). Couvre aussi la traduction globale des erreurs Prisma : contrainte d'unicité → 409, enregistrement absent → 404.
**Origine** : régressions trouvées par un audit interne. Deuxième excellent exemple pour le chapitre 8 § 8.4.
**Script** : `pnpm --filter api test:integration`

### 4.5 `app.e2e-spec.ts` — 2 cas

**Portée** : démarrage de l'application NestJS complète (Jest + Supertest).
**Ce que ça couvre** : amorçage du module racine et réponse d'un point d'entrée.
**Script** : `pnpm --filter api test:e2e`

---

## 5. ✅ Les deux suites orphelines — rattachées le 2026-08-10

### 5.1 Le problème constaté

Deux suites n'étaient déclarées dans aucun script. Elles ne s'exécutaient que si on les invoquait à la main.

| Suite | Cas | Paquet | Problème |
|---|---:|---|---|
| `apps/web/test/validation.test.ts` | 42 | `web` | Aucun script de test dans son `package.json` |
| `packages/types/test/sync-conflict.test.ts` | 17 | `types` | Idem |

**59 cas ne pouvaient être lancés par aucune commande.** Ce sont pourtant les deux suites couvrant la **logique la plus critique** : la résolution de conflit hors connexion et l'alignement des plages de constantes vitales entre le client et le serveur.

**Le risque s'est matérialisé** : la suite de validation avait silencieusement cessé de couvrir la neuvième constante vitale (§ 2.3).

### 5.2 La correction appliquée

Un script de test a été déclaré dans chacun des deux paquets, et l'exécuteur TypeScript ajouté à leurs dépendances de développement — alignant ces paquets sur la convention déjà en vigueur dans `apps/api`.

| Paquet | Script ajouté |
|---|---|
| `apps/web` | `"test": "tsx test/validation.test.ts"` |
| `packages/types` | `"test": "tsx test/sync-conflict.test.ts"` |

```bash
pnpm --filter web test
```

```bash
pnpm --filter @cms-saris/types test
```

### 5.3 Résultat

| Indicateur | Avant | Après |
|---|---:|---:|
| Suites rattachées à un script | 8 sur 10 | **10 sur 10** ✅ |
| Cas lançables par commande | 86 | **145** ✅ |
| Cas non atteignables automatiquement | **59** | **0** ✅ |

> **Ces deux suites sont désormais lançables comme les autres.** La dérive constatée au § 2.3 ne peut plus passer inaperçue : la prochaine exécution la signalerait.
>
> Reste que l'exécution demeure **manuelle**. Une intégration continue — qui lancerait ces commandes à chaque modification — figure toujours en perspective au chapitre de conclusion.

---

## 6. Ce qui n'est pas testé

Établi par différence entre les inventaires et les suites existantes. À énoncer honnêtement au chapitre 8.

| Domaine | Couverture | Commentaire |
|---|---|---|
| Chiffrement (messagerie, TOTP) | **forte** | 34 cas purs |
| Suppression logique | **forte** | 18 cas, unitaires et intégration |
| Résolution de conflit | **forte** | 17 cas, exécutés et réussis, désormais rattachés à une commande |
| Validation des saisies | **forte** | 42 cas, exécutés et réussis, garde-fou complété et rattaché |
| CRUD des référentiels | **partielle** | 1 référentiel sur 9 (« pathologies »), choisi comme représentatif |
| Messagerie | **partielle** | Parcours à deux utilisateurs couvert |
| **Triage, consultation, ordonnance, bons, évacuation** | **aucune** | Le cœur clinique n'a pas de test dédié |
| **Droits par catégorie de patient** | **aucune** | La règle métier la plus structurante (CDI et ayants droit seuls éligibles aux bons) n'est couverte par aucun test |
| **Permissions et rôles** | **aucune** en test automatisé | Un script PowerShell de 49 Ko existe (`test-permissions.ps1`) — banc de vérification manuel, à documenter comme tel |
| Interface web (composants) | **aucune** | Pas de test de rendu |
| Application de bureau | **aucune** | Validation d'exécution encore à faire (INV-05 § 8) |
| Synchronisation de bout en bout | **aucune** | Le code réclame une validation à deux postes : ordre des clés étrangères, portées, liaison des dates |

---

## 7. Écarts et points de vigilance

| # | Constat | Conséquence documentaire |
|---|---|---|
| E-01 | **Aucun résultat d'exécution disponible** : dépendances non installées, environnement d'intégration absent. | Le tableau 8.1 du mémoire porte `prévu — non exécuté` partout, jusqu'à campagne réelle. Ne jamais présenter une suite comme réussie sans sortie console à l'appui. |
| E-02 | 2 suites sur 10 (35 % des cas) ne sont rattachées à aucun script. | À corriger, ou à déclarer en limite. |
| E-03 | Le cœur clinique — triage, consultation, prescription, bons, évacuation — n'a **aucun test automatisé**. | Limite majeure, à énoncer franchement en conclusion et à porter en perspective. |
| E-04 | Les tests d'intégration dépendent de mots de passe du seed écrits en clair dans les en-têtes de fichier. | **Ne jamais reproduire ces identifiants dans le mémoire** (§ 2.3 du prompt maître). |
| E-05 | `test-permissions.ps1` (49 Ko) est un banc de vérification des droits, mais ce n'est pas un test automatisé. | Le décrire comme outil de **vérification manuelle**, pas comme suite de tests. |
| E-06 | Aucun outil de mesure de couverture n'est configuré. | Ne jamais annoncer de pourcentage de couverture : il n'existe pas. |

---

## 8. Alimente

| Destination | Usage |
|---|---|
| Chapitre 8 § 8.3 | Tests et validation fonctionnelle, Tableau 8.1 |
| Chapitre 8 § 8.4 | Difficultés rencontrées : les tests de non-régression `conversation-firstmessage` et `soft-delete-revive` racontent deux corrections réelles |
| Conclusion, limites | Absence de test sur le cœur clinique, exécution encore manuelle, pas de couverture mesurée |
| Conclusion, perspectives | Intégration continue, tests du parcours de soin, validation de la synchronisation à deux postes |
| Matrice de traçabilité | Colonne « test ou statut de test » |
