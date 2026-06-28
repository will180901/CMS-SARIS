# MÉTHODOLOGIE — Créer un système d'information complet avec une IA
> Le processus exact qui a produit le cahier des charges ULAMU (40 décisions, 29 documents, 12 modules spécifiés).
> Réutilisable pour n'importe quel projet. À utiliser avec `generic_prompt_v2.md` (le prompt méthodologique) — ce document-ci décrit **comment toi, le porteur, tu pilotes la collaboration**.

---

## L'idée en une phrase

> **Toi tu apportes la vision et les décisions, l'IA apporte la structure et la rigueur — et tout ce qui se dit est immédiatement écrit dans des fichiers, jamais seulement dans le chat.**

---

## ÉTAPE 0 — Préparer le terrain

1. Crée un dossier projet propre. Si tu as des documents existants (anciens cahiers, notes, charte graphique), mets-les dedans.
2. Première demande à l'IA : *« Liste-moi les dossiers actuels, l'arborescence. »* — elle doit d'abord **voir** ce qui existe.
3. Si tes documents sont en Word/PDF : *« Lis-les tous, convertis chaque fichier en .md, puis supprime les anciennes versions. »* (le Markdown est le format que l'IA et Obsidian lisent le mieux).

## ÉTAPE 1 — Faire critiquer la méthode avant de produire

**Le réflexe qui a tout changé :** avant de refaire le travail, j'ai fait critiquer ma méthode.

> *« Analyse en profondeur ce projet, critique-le rigoureusement selon les réalités de [mon pays/contexte], la complexité… Voilà le prompt avec lequel j'ai créé ces documents : lis-le d'abord, critique-le et dis-moi si tu peux apporter des améliorations qui nous mettraient sur la ligne des bonnes pratiques de développement et de conception des systèmes d'information. »*

L'IA doit produire : les failles **prouvées par les documents existants** (pas des généralités), puis proposer un **workflow amélioré**. Tu valides → elle écrit le prompt V2 dans un dossier `prompt/`.

## ÉTAPE 2 — Installer le deuxième cerveau (Obsidian)

1. Demande : *« Structure le cahier des charges en coffre Obsidian (liens `[[...]]` + page d'accueil de navigation) et utilise cette base tout au long du projet comme deuxième cerveau. »*
2. Exige dès le départ **3 fichiers fondateurs** :
   - `00_HOME.md` — la page d'accueil avec l'état d'avancement de chaque document ;
   - `registre_decisions.md` — **chaque décision validée y est numérotée (D-001, D-002…)** avec sa justification ;
   - plus tard `parametres_metier.md` — **chaque chiffre du métier y est numéroté (PM-01, PM-02…)**, jamais de chiffre en dur ailleurs.

> C'est le registre des décisions qui empêche le projet de se contredire : tout ce que tu valides en discussion est écrit, daté, numéroté, lié.

## ÉTAPE 3 — Transmettre la vision (le cadrage par conversation)

Les questions exactes qui ont fait émerger ULAMU, dans l'ordre :

1. **Vérifier la compréhension** : *« Résume-moi en 2-3 paragraphes, en français simple, ce que tu as compris des documents et de ma vision. Fais comme si tu me racontais une histoire. Avant de créer les fichiers, on doit tomber d'accord. »*
2. **Si ce n'est pas exactement ça** : *« Pas exactement ! Tu me permets de te faire part de mes idées ? »* — puis déverse ta vision en vrac, l'IA structure.
3. **Cadrer le mode de travail** : *« Je vais te poser des questions et toi tu vas me répondre en proposant. »* — **toi tu questionnes, elle propose, toi tu tranches.**
4. **Les acteurs** : *« Quels sont les acteurs qui vont interagir avec le système ? »* — attention aux pièges (ex. : une pharmacie n'est pas une personne, c'est une structure avec plusieurs employés).
5. **LA question magique** : *« Dans la vraie vie, quel est le processus ? »* (quand on va à la clinique, à la mairie, à l'école…). Puis : *« On prend ce flux-là et on le numérise, étape par étape. »* — chaque étape réelle devient une fonctionnalité, et tu décides **où la plateforme gagne de l'argent** à chaque étape.
6. **La philosophie économique** : dire clairement tes lignes rouges (ex. : *« le client ne doit jamais se sentir arnaqué, tout transparent, commissions discrètes, contrats numériques signés »*). L'IA doit reformuler et tu valides.

## ÉTAPE 4 — Dérouler les phases du prompt V2, un document à la fois

Ordre : **Phase 0** (vision, personas, concurrence, réglementaire, économie, risques) → **Phase 1** (glossaire, domaines, plan des modules, données, paramètres, exigences chiffrées, plan de releases/MVP) → **Phase 2** (un module à la fois) → **Phase 3** (architecture/stack, menaces, offline, tests, opérationnel).

Tes réponses peuvent être ultra-courtes : *« je valide »*, *« vas y »*, *« avance »*. Mais :
- Quand l'IA propose des **chiffres** (commissions, délais, prix), elle doit te les présenter en tableau ❓ et attendre ta décision — chaque chiffre validé entre au référentiel PM-xx.
- Quand tu n'es pas d'accord, dis-le simplement (*« non je préfère le TOTP »*) — l'IA doit expliquer la nuance technique puis appliquer ton choix.
- Quand tu hésites, délègue : *« choisis toi-même »* — l'IA tranche et **l'écrit au registre comme décision déléguée**.

## ÉTAPE 5 — Les garde-fous à exiger de l'IA (ce qui fait la qualité)

1. **Messages courts** : *« Je ne veux pas des messages kilométriques, sois bref et efficace. Le détail va dans les documents, pas dans le chat. »*
2. **Une chose à la fois** — jamais deux documents sans validation entre les deux.
3. **Recherche web obligatoire** pour la concurrence et le réglementaire — chaque fait sourcé ou marqué « à vérifier », jamais inventé.
4. **Identifiants partout** : décisions D-xxx, paramètres PM-xx, exigences EF-xx-xx, règles RM-xx-xx, cas d'utilisation CU-xx-xx avec critères « Étant donné / Quand / Alors » — c'est ce qui rend tout testable et traçable.
5. **Dépendances sans cycles** entre modules + **contrats d'interface** nommés (C1, C2…).
6. **L'IA doit oser te contredire** : les meilleures avancées d'ULAMU sont nées de ses contre-propositions (poignée de main protégée, dévoilement présenté comme réservation, posture stricte de vérification). Si elle dit oui à tout, méfie-toi.

## ÉTAPE 6 — La revue finale (ne jamais sauter)

> *« Fais la revue : relis tout, analyse et confirme que tout ce que tu as produit est cohérent et bien aligné. Ensuite continue la suite, sois autonome sur ce point. »*

L'IA doit faire des **vérifications automatisées** (toutes les références D-xxx/PM-xx résolues, liens valides, statuts alignés) + une relecture des « coutures » de fond, produire un **rapport de revue** dans le coffre, corriger ce qu'elle trouve, et l'acter au registre.

## ÉTAPE 7 — Préparer le développement

1. *« Liste-moi la stack technique »* → elle doit sortir des ADR déjà écrits, pas l'inventer.
2. *« Donne-moi le squelette du monorepo »* → structure de code avec un dossier par module.
3. Vérifier : *« Tout ce que tu me dis se trouve dans l'un des fichiers ? »* — si non, elle doit l'y mettre **avant** d'avancer. Rien ne vit dans le chat.
4. Seulement après : initialisation du dépôt et premier chantier de code.

---

## Les 7 règles d'or (résumé à imprimer)

1. **Critique la méthode avant de produire** — fais auditer ton prompt/process par l'IA.
2. **Tout est écrit dans des fichiers liés (Obsidian)** — le chat n'est qu'un lieu de décision.
3. **Toi tu questionnes et tranches, l'IA propose et structure.**
4. **« Dans la vraie vie, comment ça se passe ? »** — puis numérise le flux réel, étape par étape, monétisation comprise.
5. **Chaque décision a un numéro, chaque chiffre a un numéro** — registre + référentiel.
6. **Une chose à la fois, validation courte, MVP chirurgical** — pas 25 modules « critiques ».
7. **Revue de cohérence automatisée avant de coder.**

---

## Checklist de fin de spécification

- [ ] Coffre Obsidian navigable depuis HOME, tous statuts à jour
- [ ] Registre des décisions complet, questions ouvertes listées avec échéance
- [ ] Référentiel des paramètres : zéro chiffre en dur dans les autres documents
- [ ] Modules avec EF/RM/CU identifiés et critères d'acceptation testables
- [ ] Graphe de dépendances sans cycle + contrats d'interface
- [ ] Plan de releases avec un MVP minimal et des critères de succès chiffrés
- [ ] ADR/stack, menaces, offline, tests, modèle opérationnel rédigés
- [ ] Rapport de revue de cohérence produit et anomalies corrigées
- [ ] Référence technique (squelette du code) prête

---

*Méthodologie v1.0 — issue du projet ULAMU (juin 2026). Compagnon de `generic_prompt_v2.md`.*
