# Audit du mémoire avant soutenance

**Date** : 5 septembre 2026
**Portée** : document Word, 26 planches draw.io, confrontation au dépôt `CMS-SARIS`
**Méthode** : recalcul direct sur le code, pas de reprise des inventaires. Le code fait foi.

---

## 1. Verdict

> ✅ **Les cinq erreurs du § 2 ont été corrigées le 5 septembre 2026.** Le détail de chaque correction est ajouté sous l'erreur concernée. Le contrôle complet a été repassé après coup : renvois, légendes, numérotation et sauts de page sont intacts.

Le document n'est **pas encore** au niveau que vous visez. Cinq erreurs sont confirmées, dont trois qu'un membre du jury peut trouver en ouvrant le dépôt et en tapant une commande. Toutes sont corrigeables en une passe.

En regard, **la très grande majorité des chiffres est exacte** — et exacte au sens fort : recalculée aujourd'hui sur le code, pas recopiée d'un inventaire.

| | |
|---|---|
| Affirmations chiffrées recensées dans le document | 157 |
| Vérifiées conformes | 21 familles de chiffres, toutes justes |
| **Erreurs confirmées** | **5** |
| Points défendables mais attaquables | 7 |
| Hors de ma portée de vérification | 6 domaines |

---

## 2. Les cinq erreurs confirmées

### 2.1 🔴 « 41 migrations » — il y en a 40

Le dossier `packages/db/prisma/migrations/` contient 41 entrées, mais la quarante-et-unième est `migration_lock.toml`, le fichier de verrou de Prisma. Ce n'est pas une migration : c'est le fichier qui enregistre le moteur de base de données utilisé.

**Vérification** : 40 dossiers, 40 fichiers `migration.sql`.

Le chiffre apparaît à **cinq endroits** : § 8.2, tableau 7.2, la synthèse du chapitre 8, et deux fois dans la conclusion générale.

**Gravité** : élevée. Un jury qui ouvre le dossier compte 40.

> **Corrigé** — les cinq occurrences portent désormais « 40 migrations ». Vérifié : zéro occurrence restante de « 41 migrations ».

### 2.2 🔴 « 52 entités synchronisées, 36 non synchronisées » — c'est 46 et 42

Le registre des modèles synchronisables est le fichier `sync-models.ts` du module de synchronisation. Il déclare **46 modèles**, nommément listés. Sur 88 entités, **42** ne sont donc pas synchronisées, et non 36.

**Gravité** : élevée. Le chiffre est énoncé deux fois, dont une dans la conclusion générale.

> **Corrigé** — « Quarante-six entités sur 88 sont synchronisées : quarante-deux en portée globale et quatre par site. » La ventilation d'origine (42 globales, 3 par site, 7 par chemin de relation) a également été refaite : le registre ne déclare aucun modèle par chemin de relation. Les mentions dérivées sont alignées : 42 entités non synchronisées, 46 modèles au besoin BF23, 46 entités dans la conclusion.

### 2.3 🔴 « environ 93 500 lignes réparties sur 547 fichiers » — non reproductible

J'ai recompté selon trois définitions raisonnables, en excluant systématiquement les dépendances et les dossiers générés :

| Périmètre retenu | Fichiers | Lignes |
|---|---:|---:|
| Toutes les sources du dépôt | 683 | 131 828 |
| Sources applicatives seules | 524 | 103 050 |
| Serveur et interface web seuls | 404 | 84 052 |

**Aucune** ne donne 547 fichiers ni 93 500 lignes. Le chiffre a probablement été mesuré à une date antérieure, sur un dépôt plus petit.

**Ce qui aggrave le point** : la conclusion générale écrit « les chiffres viennent d'un comptage direct dans le code ». Le document se réclame donc d'une méthode que ce chiffre-là ne respecte pas.

**Gravité** : élevée, et c'est celle que je corrigerais en premier.

> **Corrigé** — remplacé par « environ 122 000 lignes de TypeScript réparties sur 644 fichiers, dépendances et fichiers générés exclus », aux deux endroits. La définition est écrite dans la phrase, donc reproductible : fichiers `.ts` et `.tsx` de `apps/` et `packages/`, hors dépendances, dossiers générés et fichiers de déclaration. Mesure exacte au 5 septembre 2026 : 644 fichiers, 122 124 lignes.
>
> ⚠️ Ce chiffre vieillit avec le dépôt. Si le code évolue avant la soutenance, il faudra le remesurer.

### 2.4 🟠 « 976 champs » au tableau 8.2 — je compte 971

La somme des dix domaines du tableau est arithmétiquement juste (976). Mais en comptant les champs déclarés des 88 modèles du schéma, j'obtiens **971**. Un écart de cinq que je n'arrive pas à expliquer par une convention de comptage.

**Gravité** : moyenne. Peu de jurys recomptent 976 champs, mais la colonne apporte peu et fait courir un risque.

> **Corrigé, sur arbitrage de l'auteur** — la colonne « Champs » est retirée du tableau 8.2, qui garde Domaine et Tables, dont le total 88 est vérifié exact. La phrase du § 7.3 qui annonçait « avec le nombre de champs de chacun » a été retouchée en conséquence.
>
> Pourquoi ce choix plutôt qu'un recalcul : une reconstitution de la répartition retrouve les dix comptes de tables à l'exact (18, 13, 12, 12, 11, 8, 7, 3, 2, 2) et trois domaines au champ près — accueil et triage 54, sorties critiques 21, suivi de traitement 27 — mais pas les sept autres. La ventilation interne d'origine n'est pas récupérable, et publier la mienne aurait substitué mon jugement à celui de l'auteur.

### 2.5 🟠 Formulation trompeuse au § 8.2 sur les machines à états

Le texte dit : « Six énumérations seulement sont portées par la base. Les cinq machines à états restantes reposent sur des champs texte. »

Lu naturellement, cela annonce **onze** machines à états. Or le tableau 7.6 en annonce **neuf**.

Les deux chiffres sont pourtant vrais séparément. La réalité est celle-ci : la base porte bien six énumérations, mais **quatre seulement** sont des statuts (`StatutCompte`, `StatutPatient`, `StatutVisite`, `StatutConsultation`). Les deux autres — `ModeOverridePermission` et `TypeEvenementVisite` — ne sont pas des machines à états. Quatre plus cinq font bien les neuf du tableau 7.6.

**Gravité** : moyenne. C'est le genre de contradiction apparente qu'un jury attentif relève, et qui coûte cher parce qu'elle donne l'impression que l'auteur ne maîtrise pas ses propres chiffres.

> **Corrigé** — nouvelle formulation : « La base porte six énumérations, dont quatre seulement correspondent à une machine à états : le statut du compte, celui du patient, celui de la visite et celui de la consultation. Les cinq autres machines à états du système reposent sur des champs texte contraints par le code applicatif. » Le § 8.2 dit désormais la même chose que le § 7.4, qui était déjà juste.

---

## 3. Sept points défendables, mais qu'il vaut mieux préciser

### 3.1 « 17 modules métier » (tableau 7.2)

Le dossier `src/modules` contient **18** sous-dossiers. Le dix-huitième, `parametres`, ne contient qu'un service et un module : son contrôleur est physiquement rangé dans le dossier `admin`. Dix-sept modules exposent donc des routes.

L'affirmation est vraie sous cette définition. Elle est fragile si le jury compte les dossiers.

### 3.2 « 151 routes auditées » (BF03)

Exact, et le compte tombe juste : les douze contrôleurs porteurs du décorateur `@Audit` totalisent exactement 151 routes. Mais l'intercepteur ne journalise que les **mutations** — POST, PATCH, PUT, DELETE — soit **110 routes** parmi ces 151.

« 151 routes placées sous audit » serait exact. « 151 routes auditées » se discute.

### 3.3 « 15 écrans »

Le code déclare **16 routes** applicatives hors connexion, et **17 composants de page**. Le compte de 15 s'obtient ainsi : douze entrées du menu latéral, plus trois pages d'administration qui n'y figurent pas. Le dossier patient (`/patients/:id`) est alors compté avec la liste des patients, et l'écran de connexion n'est pas compté.

C'est cohérent, mais la définition n'est écrite nulle part.

### 3.4 « Cent trois cas de test » et « les dix suites »

> ⚠️ **Ce point a été révisé le 5 septembre après vérification. Il n'est pas un défaut.**

Les deux chiffres viennent de l'inventaire `INV-06_tests.md`, qui documente une campagne réelle du 10 août 2026 : dix suites rattachées à un script exécutable, 103 cas exécutés, 103 réussis, 43 cas non exécutés faute d'API active. Le mémoire est fidèle à son inventaire, et l'inventaire est daté.

Ma première remarque annonçait « 26 fichiers de test et 189 cas » et concluait à un écart. **Elle était fondée sur un comptage plus large que celui de l'inventaire** — tous les fichiers de test du dépôt, serveur et interface web confondus, et tous les appels `it` ou `test`, y compris ceux des 43 cas non exécutés et des suites du front. Ce n'est pas la même population.

Il reste que la mesure a un mois. Si le dépôt a bougé, la refaire avant la soutenance serait prudent — mais le document, lui, n'est pas en défaut.

### 3.5 Les méthodes des diagrammes de classes

Huit méthodes dessinées n'existent pas sous ce nom dans le code : `bloquer`, `changerStatut`, `archiver`, `verrouiller`, `affecterSoignant`, `ajouterEtapeSuivi`, `delivrer`, `valider`. Le code les nomme autrement — `setStatut`, `setVerrou`, `updateSoignant`, `validerOrdonnance`.

**C'est légitime** : un diagramme de classes de conception nomme les opérations dans le vocabulaire du métier, pas dans celui de l'implémentation. Le § 7.3 ne prétend nulle part que les diagrammes sont extraits du code. Le point ne devient gênant que si le jury demande où se trouve `verrouiller()` — la réponse est `setVerrou`, et elle doit être prête.

### 3.6 Les identifiants des modèles MERISE

Les planches 8.1a à 8.1c nomment les identifiants `idVisite`, `idConsultation`, `idOrdonnance`. Dans la base, la colonne s'appelle `id`. C'est la convention MERISE, et **le cartouche de chaque planche le dit**. Le point est couvert, mais il faut savoir le défendre à l'oral.

### 3.7 Le sigle « RH »

Employé deux fois dans le corps, absent de la liste des abréviations.

---

## 4. Ce qui est vérifié conforme

Recalculé aujourd'hui, directement sur le dépôt :

| Affirmation du mémoire | Mesure sur le code |
|---|---|
| 273 routes HTTP | **273** — GET 90, POST 78, PATCH 65, DELETE 38, PUT 2 |
| 26 contrôleurs | **26** |
| 88 entités de données | **88** modèles Prisma |
| 97 associations | **97** relations porteuses de clé |
| 130 permissions | **130** entrées distinctes au catalogue |
| Rôles à 130, 102 et 51 permissions | **130 / 102 / 51** |
| 47 entités à suppression logique | **47** |
| Six énumérations en base | **6** |
| 76 index déclarés | **76** |
| 25 onglets | **25** déclencheurs d'onglet |
| Constantes vitales : 23 champs | **23** |
| 151 routes sous audit | **151** (voir § 3.2) |
| Ventilation des routes par besoin, BF01 à BF23 | **les 18 valeurs sont exactes** — 8, 33, 3, 37, 20, 5, 30, 9, 22, 7, 5, 8, 8, 29, 9, 9, 4, 14 |
| 65 cas d'utilisation, dont 37 prioritaires | **cohérent** entre le § 6.2.5 (16+8+9+20+12) et le tableau 6.5 (douze modules) |
| 88 tables réparties en dix domaines | **la somme du tableau 8.2 fait 88** |
| 29 classes retenues, 59 écartées | **29 + 59 = 88**, et la ventilation des 59 est cohérente |

Contrôles éditoriaux :

- **Tous les renvois résolvent.** Chaque « figure X », « tableau X », « § X » cité dans le texte désigne une cible existante. Aucun renvoi orphelin.
- **Aucune figure ni aucun tableau n'est orphelin** : les 29 figures et les 58 tableaux sont appelés au moins une fois dans le corps.
- **Numérotation continue**, sans trou ni doublon, pour les figures comme pour les tableaux.
- **26 planches sur 26 sans défaut graphique** : aucun texte qui déborde, aucune forme hors page, aucun chevauchement, aucune étiquette posée sur une entité. Lisibilité sur papier de 8,29 à 11,23 points, seuil fixé à 8.
- **29 figures sur 29 seules sur leur page**, conformément à la décision D-20.

---

## 5. Ce que je ne peux pas vérifier

Je préfère l'écrire noir sur blanc plutôt que de laisser croire à un audit total.

1. **L'orthographe et la grammaire.** Je n'ai pas conduit de relecture linguistique exhaustive des 110 pages. Une relecture humaine reste nécessaire.
2. **Les chiffres des chapitres 1 et 2** — histoire de SARIS-CONGO, effectifs, parc informatique, population couverte. Ils proviennent de documents que je ne peux pas recouper. Les questions QO-02bis et QO-03 sont toujours ouvertes.
3. **Le contenu des entretiens du chapitre 5.** Source unique, non recoupable par nature.
4. **La justesse des quatre références bibliographiques.** Je ne les ai pas lues ; je ne peux pas garantir que les idées qui leur sont attribuées sont bien les leurs.
5. **Les attentes précises du promoteur** sur le fond et la forme.
6. **Les trois captures d'écran**, qui n'existent pas encore.

---

## 6. Ordre de correction recommandé

1. Les cinq erreurs du § 2 — c'est la seule partie réellement bloquante.
2. Préciser les définitions du § 3.1 et 3.3, une incise suffit dans chaque cas.
3. Reformuler le § 3.2 en « 151 routes placées sous audit, dont 110 mutations journalisées ».
4. Décider pour le § 3.4 : garder la mesure datée, ou remesurer.
5. Ajouter « RH » à la liste des sigles.

Le reste du travail restant ne relève pas de l'audit : figures à coller, captures à prendre, page de garde à compléter.


---

## 7. Contrôle après correction — 5 septembre 2026

Repassé sur le document corrigé :

| Contrôle | Résultat |
|---|---|
| Intégrité du fichier | 1 012 paragraphes, 59 tableaux, lisible |
| Renvois internes | tous résolvent, aucun orphelin |
| Figures et tableaux appelés dans le texte | 29 sur 29, 58 sur 58 |
| Numérotation | continue, sans trou ni doublon |
| Figures seules sur leur page (D-20) | 29 sur 29 |
| Occurrences fautives restantes | **aucune** — ni 41 migrations, ni 52 ou 36 entités, ni 93 500, ni 547, ni 976, ni l'ancienne phrase sur les énumérations |

Les sept points du § 3 restent ouverts : ce sont des précisions de formulation, pas des erreurs.
