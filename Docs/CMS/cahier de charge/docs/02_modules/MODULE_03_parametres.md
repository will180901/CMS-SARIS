# Module 03 — Paramètres système

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » du module **Paramètres système** (catalogue de configuration clé-valeur typée, réellement appliqué par le code). Source de vérité : [[_SOURCE_systeme]]. Alignée sur [[plan_modules]], [[parametres_metier]], [[modele_donnees_global]], [[registre_decisions]].
> **Honnêteté** : ce document décrit le code réel sous `apps/api/src/modules/parametres` et son consommateur d'administration `apps/api/src/modules/admin/parametres.controller.ts`, ainsi que le frontend `apps/web/src/modules/admin/.../GenerauxTab.tsx`. Tout point non vérifié est marqué « à confirmer ».

---

## 1. Mission et périmètre

### Mission
Fournir un **catalogue de paramètres système typés** (clé-valeur), modifiables par un administrateur à l'exécution et **réellement lus par le code métier** (sécurité d'authentification, politique de mot de passe, notifications). Le principe directeur, posé dans le code (`parametres.service.ts`, en-tête), est : **aucun paramètre décoratif** — chaque entrée du catalogue est effectivement consommée par un service.

Le module est un **module support** au sens [[plan_modules]] : `ParametresModule` (`parametres/parametres.module.ts`) n'est **pas** importé directement dans `AppModule` ; il est tiré en cascade par `SecurityModule`, `NotificationModule` et `AdminModule`. Son service `ParametresService` est exporté et injecté par ces modules (contrat **C-10** de [[plan_modules]]).

### Dans le périmètre (vérifié dans le code)
- Catalogue de **12 paramètres** répartis en **3 groupes** : « Sécurité & authentification » (3), « Politique de mot de passe » (5), « Notifications » (4) — `PARAMETRES_CATALOGUE` dans `parametres.service.ts`.
- **Lecture** de la valeur effective (valeur en base sinon valeur par défaut du catalogue), avec **cache court** (TTL 30 s) invalidé à chaque écriture.
- **Écriture** (`update`) et **réinitialisation** (`reset`) d'un paramètre, avec **validation par type et bornes**.
- **Journalisation d'audit** propre au module (écriture explicite d'une ligne `JournalAudit` aux actions `UPDATE`/`RESET`).
- **Politique de mot de passe effective** (`getPasswordPolicy`) et **validateur** (`assertPasswordValid`) consommés par la sécurité et l'administration des comptes.
- **Écran d'administration** « Paramètres › Généraux » (onglet, sous-nav par groupe) exposant lecture/édition/reset par paramètre, avec gel en lecture seule sans la permission d'écriture.

### Hors périmètre (explicite)
- **Sauvegardes / planification de sauvegarde** : bien que le brief [[_SOURCE_systeme]] cite « planification sauvegardes » au titre des Paramètres, **le catalogue `PARAMETRES_CATALOGUE` ne contient AUCUN paramètre de sauvegarde**. La sauvegarde de configuration et son cron relèvent du module `sync` / écran Synchronisation (voir [[modele_donnees_global]], [[MODULE_16_synchronisation]]). À traiter dans la spec du module Synchronisation, pas ici. **(écart brief↔code signalé honnêtement).**
- **Réglages du compte connecté** (préférences, langue, sécurité du compte, sessions, mentions légales) : ce sont les « Paramètres › Personnel » (self-service), portés par d'autres composants (`PersonnelTab`, `LegalLangSection` dans `ParametresPage.tsx`) et d'autres endpoints (préférences utilisateur). **Hors de ce module.**
- **Permissions / rôles** : la sous-section « Comptes & accès » des Généraux n'est qu'un **raccourci de navigation** vers `/admin/utilisateurs` et `/admin/roles` (`ComptesAccesShortcut`) ; la gestion réelle relève du module Accès & habilitations.
- **Paramètres « configurables par variable d'environnement seulement »** (TTL refresh, rate-limits, cadences de synchronisation, etc.) : ils figurent dans [[parametres_metier]] mais ne sont **pas** dans ce catalogue éditable et ne sont **pas** pilotés par cet écran.

---

## 2. Acteurs et rôles

| Acteur | Accès au module Paramètres système |
|--------|-------------------------------------|
| **ADMIN_SYSTEME** | Lecture **et** écriture de tous les paramètres (détient `parametre.read` + `parametre.update` via le catalogue complet, cf. [[registre_decisions]] D-004). |
| **MEDECIN_CHEF** | Selon attribution de `parametre.read` / `parametre.update` à son rôle (à confirmer dans `permissions.ts` ; par défaut, l'écran est gouvernance/admin). |
| **INFIRMIER** | Pas d'accès attendu (aucune permission `parametre.*` requise pour le clinique). |

> L'accès est gouverné **uniquement** par deux permissions : `parametre.read` (lecture / affichage de l'onglet Généraux) et `parametre.update` (édition + reset). Définitions : `packages/types/src/permissions.ts` (`PARAMETRE_READ`, `PARAMETRE_UPDATE`). Sans `parametre.update`, l'écran s'affiche en **lecture seule** (bandeau « lecture seule », contrôles désactivés). Les **catégories de patient** ne sont pas pertinentes pour ce module.

---

## 3. Exigences fonctionnelles

> IDs `EF-03-xx`. Chaque exigence est vérifiable et tracée au code.

- **EF-03-01** — Le système expose un **catalogue de paramètres** typés (clé, type, valeur par défaut, description, groupe, bornes/options éventuelles). *(`PARAMETRES_CATALOGUE`)*
- **EF-03-02** — Pour chaque paramètre, le système renvoie sa **valeur effective** : valeur enregistrée en base si elle existe, sinon **valeur par défaut** du catalogue. *(`getValue` / `findAll`)*
- **EF-03-03** — Le système met en **cache** la lecture d'un paramètre pendant **30 s** (TTL) et **invalide** ce cache à chaque écriture/réinitialisation du paramètre concerné. *(voir RM-03-06 ; valeur PM à confirmer dans [[parametres_metier]])*
- **EF-03-04** — Un administrateur autorisé peut **modifier** la valeur d'un paramètre du catalogue (`PATCH /admin/parametres/:cle`). *(perm `parametre.update`)*
- **EF-03-05** — Un administrateur autorisé peut **réinitialiser** un paramètre à sa valeur par défaut (`POST /admin/parametres/:cle/reset`), ce qui supprime la ligne de surcharge en base. *(perm `parametre.update`)*
- **EF-03-06** — Toute écriture est **validée par type et bornes** : entier dans `[min,max]` pour `number`/`duration_minutes` ; `true`/`false` pour `boolean` ; valeur appartenant aux options pour `enum` ; longueur ≤ 200 pour `string`. Toute valeur invalide est **rejetée (400)**. *(`validate`)*
- **EF-03-07** — Une clé **inconnue** du catalogue est rejetée (400) en update comme en reset. *(« Paramètre inconnu »)*
- **EF-03-08** — Le système **journalise** chaque `UPDATE` (avec valeur avant/après) et chaque `RESET` dans `JournalAudit` (module `parametre`, statut `SUCCES`), **sans jamais bloquer** l'opération si l'audit échoue. *(voir RM-03-04)*
- **EF-03-09** — Le système expose la **politique de mot de passe effective** (longueur minimale, exigences majuscule/minuscule/chiffre/spécial) calculée à partir des paramètres `mdp.*`. *(`getPasswordPolicy`)*
- **EF-03-10** — Le système fournit un **validateur de mot de passe** (`assertPasswordValid`) appliquant la politique live et rejetant (400) tout mot de passe non conforme avec un message listant les exigences manquantes.
- **EF-03-11** — Les paramètres `auth.*` pilotent **en direct** la sécurité d'authentification : seuil de tentatives avant blocage, durée du blocage initial (avec escalade), durée de validité de la session (TTL du token d'accès). *(consommé par `security.service.ts`)*
- **EF-03-12** — Les paramètres `notif.*` pilotent **en direct** l'émission des notifications : interrupteur global (`notif.app_enabled`) et bascules par catégorie (clinique / sorties critiques / administratif), plus la rétention. *(consommé par `notification.service.ts` et le cron de purge)*
- **EF-03-13** — L'écran d'administration affiche les paramètres **groupés** (une sous-page par groupe) et, par paramètre : son libellé i18n, son état (**Personnalisé** vs **Valeur par défaut**), la valeur par défaut, un contrôle adapté au type, et les actions **Enregistrer** (si modifié) / **Réinitialiser** (si personnalisé). *(`GenerauxTab.tsx`)*
- **EF-03-14** — Sans la permission `parametre.update`, l'écran s'affiche en **lecture seule** (bandeau d'avertissement + contrôles désactivés, pas de bouton d'action). *(`canWrite`)*
- **EF-03-15** — Les libellés/descriptions des paramètres sont **bilingues FR/EN** via une clé i18n stable `params.<cle>` (repli sur la description FR du catalogue). *(`descriptionKeyFor`)*

---

## 4. Cas d'utilisation

> IDs `CU-03-xx`. Critères « Étant donné / Quand / Alors ».

### CU-03-01 — Durcir la politique de mot de passe
- **Acteur** : ADMIN_SYSTEME.
- **Déclencheur** : décision d'exiger un caractère spécial.
- **Scénario nominal** : l'admin ouvre Paramètres › Généraux › « Politique de mot de passe », passe `mdp.exiger_special` à « Activé », enregistre. Le système valide (booléen), upsert la valeur, invalide le cache, journalise l'UPDATE. À la prochaine création/changement de mot de passe, `assertPasswordValid` exige désormais un caractère spécial.
- **Scénarios d'erreur** : valeur non booléenne → 400 ; clé absente du catalogue → 400 ; appelant sans `parametre.update` → 403 (et UI en lecture seule).
- **Hors-ligne** : sur un poste desktop en backend local, l'écriture s'applique à la base SQLite locale et se propage par la synchronisation (`ParametreSysteme` étant soumis au modèle de synchro — portée **à confirmer** dans [[modele_donnees_global]]).
- **Critères** :
  - *Étant donné* `mdp.exiger_special = false`, *quand* l'admin l'active et enregistre, *alors* `getPasswordPolicy().exigerSpecial = true` et un mot de passe sans caractère spécial est refusé (400).

### CU-03-02 — Allonger la durée de session
- **Acteur** : ADMIN_SYSTEME.
- **Déclencheur** : besoin d'éviter les déconnexions fréquentes.
- **Scénario nominal** : l'admin modifie `auth.session_timeout_minutes` (défaut **480**, cf. [[parametres_metier]] PM-01) dans les bornes 5…10080 et enregistre. À l'**émission du prochain token d'accès**, `security.service.ts` lit la nouvelle valeur (`getNumber('auth.session_timeout_minutes')`) et fixe le TTL en conséquence.
- **Scénarios d'erreur** : valeur < 5 ou > 10080 → 400 (« Valeur minimale/maximale ») ; valeur non entière → 400.
- **Hors-ligne** : applicable au backend local (token émis localement en mode offline-fallback, cf. [[registre_decisions]] D-020).
- **Critères** :
  - *Étant donné* une valeur hors bornes, *quand* l'admin tente d'enregistrer, *alors* le système renvoie 400 et la valeur n'est pas persistée.

### CU-03-03 — Couper une catégorie de notifications
- **Acteur** : ADMIN_SYSTEME.
- **Déclencheur** : trop de notifications cliniques.
- **Scénario nominal** : l'admin désactive `notif.evenements_cliniques`. À l'émission d'une notification de catégorie *clinique*, `notification.service.ts` (`categoryEnabled`) lit la bascule et **n'émet pas** la notification.
- **Scénarios d'erreur** : si le paramètre est absent/illisible, le service **n'empêche pas** la notification (politique « en cas de doute, on notifie » — `categoryEnabled` renvoie `true` sur erreur).
- **Hors-ligne** : applicable localement.
- **Critères** :
  - *Étant donné* `notif.app_enabled = false`, *quand* un événement de toute catégorie survient, *alors* **aucune** notification applicative n'est émise.
  - *Étant donné* `notif.evenements_cliniques = false`, *quand* un événement *clinique* survient, *alors* aucune notification clinique n'est émise (les autres catégories restent émises).

### CU-03-04 — Réinitialiser un paramètre à sa valeur d'usine
- **Acteur** : ADMIN_SYSTEME.
- **Déclencheur** : retour à la configuration par défaut.
- **Scénario nominal** : pour un paramètre marqué « Personnalisé », l'admin clique « Réinitialiser ». Le système supprime la ligne `ParametreSysteme` correspondante, invalide le cache, journalise le `RESET`, et l'écran réaffiche l'état « Valeur par défaut ».
- **Scénarios d'erreur** : clé inconnue → 400 ; sans `parametre.update` → 403 (bouton absent).
- **Critères** :
  - *Étant donné* un paramètre personnalisé, *quand* l'admin le réinitialise, *alors* `findAll` renvoie `modifie = false` et `valeur = defaultVal`.

### CU-03-05 — Consulter les paramètres sans pouvoir les modifier
- **Acteur** : utilisateur disposant de `parametre.read` mais **pas** de `parametre.update`.
- **Scénario nominal** : l'onglet « Généraux » s'affiche ; un bandeau « lecture seule » apparaît, les contrôles sont désactivés, aucun bouton Enregistrer/Réinitialiser n'est rendu.
- **Critères** :
  - *Étant donné* l'absence de `parametre.update`, *quand* l'utilisateur ouvre Généraux, *alors* il voit les valeurs mais ne peut rien soumettre ; tout `PATCH`/`POST reset` éventuel est refusé (403) côté API.

---

## 5. Données du module

> Renvoi : [[modele_donnees_global]] pour le schéma complet. Le module possède **une** entité propre.

### Entité propre
- **`ParametreSysteme`** — table de **surcharge** clé-valeur (seules les clés réellement modifiées y existent ; un paramètre non surchargé n'a **pas** de ligne et prend sa valeur par défaut du catalogue). Champs vérifiés via le code : `id`, `cle` (unique), `valeur` (string), `description`, `updatedBy` (acteur), `updatedAt`. *(`prisma.parametreSysteme` — `upsert`/`findUnique`/`findMany`/`deleteMany`)*

### Définition (en code, hors base)
- **`PARAMETRES_CATALOGUE`** (`parametres.service.ts`) : la **source de vérité du catalogue** (clé, type, défaut, bornes/options, groupe, description). Ce n'est pas une table : c'est une constante TypeScript. Les **valeurs par défaut** y sont définies et **référencent** les `PM-xx` de [[parametres_metier]] (voir §6).

### Entité écrite par effet de bord
- **`JournalAudit`** — une ligne par `UPDATE`/`RESET` (cf. EF-03-08, RM-03-04). Entité partagée du domaine Audit ([[modele_donnees_global]]).

---

## 6. Règles métier

> IDs `RM-03-xx`. **Toute valeur chiffrée renvoie à [[parametres_metier]] (PM-xx)** ; jamais en dur ici.

- **RM-03-01** — **Valeur effective = surcharge sinon défaut.** Si une ligne `ParametreSysteme` existe pour la clé, sa `valeur` prime ; sinon la valeur par défaut du catalogue s'applique. *(`getValue`, `findAll`)*
- **RM-03-02** — **Validation stricte au type et aux bornes** (cf. EF-03-06). Les bornes des paramètres `auth.*` et `mdp.*` sont celles de [[parametres_metier]] : tentatives **PM-07** (min 3, max 10), blocage **PM-08** (min 1, max 1440 min), session **PM-01** (min 5, max 10080 min), longueur mot de passe **PM-09** (min 8, max 64), rétention notifications **PM-37** (min 7, max 365 j).
- **RM-03-03** — **Politique de mot de passe par défaut** : longueur **PM-09** (10), majuscule **PM-10** (vrai), minuscule **PM-11** (vrai), chiffre **PM-12** (vrai), spécial **PM-13** (faux). `assertPasswordValid` agrège les manquements et lève un 400 listant les exigences.
- **RM-03-04** — **Audit non bloquant.** L'écriture du `JournalAudit` est encapsulée et **ne propage jamais** d'erreur : l'échec de journalisation ne fait pas échouer l'update/reset.
- **RM-03-05** — **Bascules de notifications** : `notif.app_enabled` est l'**interrupteur global** (s'il est faux, aucune notification applicative) ; les bascules par catégorie (`notif.evenements_cliniques` → clinique, `notif.sorties_critiques` → sortie/évacuation, `notif.evenements_administratifs` → administratif) filtrent par catégorie ; la catégorie *système* est **toujours active**. En cas de paramètre illisible, **la notification passe** (fail-open). *(`categoryEnabled`)*
- **RM-03-06** — **Cache de lecture 30 s**, invalidé clé par clé à chaque update/reset (cohérence quasi-immédiate des valeurs live). *(la durée 30 s est un PM à formaliser dans [[parametres_metier]] — à confirmer)*
- **RM-03-07** — **Rétention des notifications** : le cron de purge supprime les notifications plus anciennes que `notif.retention_jours` (**PM-37**, défaut 30 j). Ce cron ne s'exécute que sur le **serveur central** (PostgreSQL) ; les **postes locaux SQLite ne purgent pas** (no-op). *(`notification-purge.cron.ts`)*
- **RM-03-08** — **Escalade de blocage** : le 1ᵉʳ blocage dure `auth.duree_blocage_minutes` (**PM-08**), puis la durée est multipliée (×4) aux blocages suivants. *(règle portée par `security.service.ts`, paramètre fourni par ce module — détail dans [[MODULE_01_securite_authentification]])*

---

## 7. Interfaces

> Contrats [[plan_modules]] : ce module **réalise C-10** (Configuration système : `Parametres → Security, Notification, Admin`).

### Ce que le module **expose**
- **Service `ParametresService`** (exporté par `ParametresModule`) :
  - `getValue / getNumber / getBool(cle)` — lecture typée mise en cache.
  - `findAll()` — catalogue + valeurs effectives + métadonnées (type, groupe, description, descriptionKey, defaultVal, min/max/options, `modifie`, `updatedAt`, `updatedBy`).
  - `update(cle, valeur, acteurId)` / `reset(cle, acteurId)`.
  - `getPasswordPolicy()` / `assertPasswordValid(mdp)`.
- **API REST d'administration** (`admin/parametres.controller.ts`, base `/admin/parametres`, gardes `JwtAuthGuard` + `PermissionsGuard`) :
  - `GET /admin/parametres` — `parametre.read`.
  - `PATCH /admin/parametres/:cle` — `parametre.update` (corps `{ valeur }`, `MaxLength 200`).
  - `POST /admin/parametres/:cle/reset` — `parametre.update` (200).

### Ce que le module **consomme**
- **`PrismaModule`** (seule dépendance `imports`) — accès à `parametreSysteme` et `journalAudit`.

### Consommateurs (couplage par `imports` / injection)
- **`SecurityModule`** (`security.service.ts`) : `getNumber('auth.tentatives_max' | 'auth.duree_blocage_minutes' | 'auth.session_timeout_minutes')`, `assertPasswordValid`.
- **`AdminModule`** (`utilisateurs.service.ts`) : `assertPasswordValid` à la création de compte et au changement de mot de passe.
- **`NotificationModule`** (`notification.service.ts` + `notification-purge.cron.ts`) : `getBool('notif.*')`, `getNumber('notif.retention_jours')`.

> Le module **n'importe pas** `SecurityModule` (volontairement, pour éviter un cycle : c'est `SecurityModule` qui importe `ParametresModule` — cf. en-tête de `parametres.module.ts` et l'acyclicité démontrée dans [[plan_modules]] §5).

---

## 8. Exigences non fonctionnelles spécifiques

- **Performance** — lecture mise en cache (TTL 30 s) pour éviter un accès base à chaque login / chaque émission de notification (cf. RM-03-06).
- **Cohérence (live)** — l'invalidation ciblée du cache à l'écriture garantit que les valeurs de sécurité/notifications sont prises en compte sans redémarrage.
- **Sécurité** — endpoints protégés par JWT + permissions dédiées (`parametre.read` / `parametre.update`) ; aucun bypass (la garde vérifie `userPerms.has(p)`).
- **Traçabilité** — audit explicite avant/après pour chaque mutation (en plus de l'audit transverse global) ; audit non bloquant (RM-03-04).
- **Robustesse (fail-open notifications)** — un paramètre `notif.*` illisible ne bloque pas la notification (choix assumé, RM-03-05) ; pour la sécurité (`auth.*`/`mdp.*`), le repli est la **valeur par défaut** du catalogue (`getNumber`/`getBool`).
- **i18n** — libellés bilingues FR/EN via clé stable `params.<cle>` (repli FR) ; unités et états traduits côté UI.
- **Offline-first** — le service fonctionne identiquement sur backend embarqué (SQLite) ; la propagation multi-poste de `ParametreSysteme` dépend de sa portée de synchronisation (**à confirmer** dans [[modele_donnees_global]]).
- **Responsive** — l'écran Généraux s'adapte (grille empilée en mode compact, `useIsCompact`).

---

## 9. Risques et points ouverts

- **Écart brief↔code « sauvegardes »** : le brief rattache la « planification sauvegardes » aux Paramètres, mais **aucun paramètre de sauvegarde n'existe** dans le catalogue. La sauvegarde/cron est dans le module Synchronisation. **Décision documentée : hors de ce module** (cf. §1). À acter explicitement si une divergence persiste.
- **Portée de synchronisation de `ParametreSysteme`** : non vérifiée dans cette passe. Si l'entité est **globale**, une modification sur un poste se propage à tous ; si elle est **par site**, chaque site a sa config. **À confirmer** dans [[modele_donnees_global]] / module `sync`.
- **PM manquant pour le cache 30 s** : la durée de cache (30 s) n'a pas d'identifiant `PM-xx` dans [[parametres_metier]]. **À formaliser** (RM-03-06).
- **Couverture des rôles** : l'attribution exacte de `parametre.read` / `parametre.update` à `MEDECIN_CHEF` n'a pas été recoupée ligne à ligne dans `permissions.ts` ici (seules les définitions de permissions l'ont été). **À confirmer** avec [[MODULE_02_acces_habilitations]].
- **Catalogue restreint volontairement** : de nombreux réglages techniques (TTL refresh, rate-limits, cadences de sync — [[parametres_metier]]) ne sont **pas** éditables via cet écran (env-only). C'est un choix, pas un manque ; à rappeler dans la doc utilisateur pour éviter l'attente d'un réglage UI inexistant.
- **Version applicative affichée en dur** : l'« À propos » de l'écran Paramètres affiche `CMS SARIS v0.1.0` (codé en dur dans `ParametresPage.tsx`), à découpler de la version réelle de build (point cosmétique).

---

*Sources de vérité lues : `apps/api/src/modules/parametres/parametres.service.ts`, `apps/api/src/modules/parametres/parametres.module.ts`, `apps/api/src/modules/admin/parametres.controller.ts`, `apps/api/src/modules/security/security.service.ts`, `apps/api/src/modules/notification/notification.service.ts` (+ `notification-purge.cron.ts`), `apps/api/src/modules/admin/utilisateurs.service.ts`, `apps/web/src/modules/admin/pages/ParametresPage.tsx` et `.../components/parametres/GenerauxTab.tsx`, `packages/types/src/permissions.ts`. Renvois : [[_SOURCE_systeme]], [[plan_modules]], [[parametres_metier]], [[modele_donnees_global]], [[registre_decisions]], [[MODULE_01_securite_authentification]], [[MODULE_02_acces_habilitations]], [[MODULE_16_synchronisation]].*
