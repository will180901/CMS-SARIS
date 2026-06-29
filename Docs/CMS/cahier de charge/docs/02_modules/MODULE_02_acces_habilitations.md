# Module 02 — Accès & Habilitations

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » (le système est développé et déployé). Elle documente le module
> d'administration des **comptes utilisateur**, des **rôles** et des **permissions**, ainsi que la
> **récupération de compte** (reset 2FA, codes de secours, révocation de sessions, reset mot de passe).
> Source de vérité du code : `apps/api/src/modules/admin` (controllers `utilisateurs`/`roles`, services,
> DTOs), `apps/api/src/common/governance.ts`, et frontend `apps/web/src/modules/admin` (`AccesPage`).
> Documents liés : [[_SOURCE_systeme]], [[plan_modules]], [[modele_donnees_global]], [[parametres_metier]],
> [[glossaire]], [[registre_decisions]], [[MODULE_02_acces_habilitations]], [[MODULE_01_securite_authentification]].

---

## 1. Mission et périmètre

### 1.1 Mission

Le module **Accès & habilitations** administre **qui peut se connecter** au système et **ce que chaque
utilisateur a le droit de faire**. Il couvre :

- la **gestion du cycle de vie des comptes** `Utilisateur` (création, modification, activation /
  désactivation / blocage, suppression définitive) ;
- l'**attribution des rôles** et la gestion de la **matrice de permissions** des rôles ;
- les **dérogations de permissions par utilisateur** (GRANT / REVOKE individuels, en plus du rôle) ;
- la **récupération de compte** par un administrateur (réinitialisation du mot de passe, retrait de la
  2FA/TOTP, régénération des codes de secours, révocation forcée de toutes les sessions).

Côté frontend, ces fonctions sont réunies dans un écran unifié **« Accès & habilitations »**
(`apps/web/src/modules/admin/pages/AccesPage.tsx`) à onglets : **Utilisateurs**, **Rôles & permissions**,
**Personnel soignant**, **Délégations**.

Le module s'inscrit dans le **domaine Sécurité & Accès** ([[plan_modules]] §3) : il s'appuie sur
`SecurityModule` (gardes JWT + permissions, contrat **C-9**), sur `ParametresService` pour la politique de
mot de passe (contrat **C-10**) et sur `NotificationModule` pour les annonces administratives (contrat
**C-8**). Voir [[plan_modules]] §4.

### 1.2 Hors-périmètre (explicite)

Ne relèvent **pas** de ce module (mais lui sont reliés) :

- **L'authentification** elle-même (login, JWT access/refresh, étape TOTP de connexion, blocage par
  tentatives, session unique) : portée par `SecurityModule` → voir [[MODULE_01_securite_authentification]]. Ce module **consomme** les
  mécanismes de session (révocation) mais ne réalise pas le flux d'authentification.
- **L'enrôlement self-service de la 2FA** par l'utilisateur lui-même (activation TOTP, vérification) : porté
  par `SecurityModule` (D-013). Ce module n'opère que la **récupération administrative** (retrait, codes de
  secours).
- **Le catalogue figé de permissions et la définition des rôles seedés** : la **source** est
  `packages/types/src/permissions.ts` (constante `PERMISSIONS`, `PM-47`) ; ce module **lit** ce catalogue
  (table `Permission`) et **édite** l'affectation rôle ↔ permission, mais ne définit pas le catalogue.
- **La gestion du personnel médical, des délégations de prescription et de la RH** : portée par
  `PersonnelModule` ([[plan_modules]]). Les onglets « Personnel soignant » et « Délégations » de l'écran
  `AccesPage` **réutilisent** ces modules (composants `acteurs`) ; ils ne sont pas décrits ici (voir leur
  module dédié). La création d'un compte de rôle clinique crée toutefois la fiche `PersonnelMedical` liée
  (cf. RM-02-12).
- **Le journal d'audit transversal** (`AuditInterceptor` global, D-014) : ce module **écrit** ses propres
  traces `JournalAudit` (audit applicatif explicite dans les services, cf. RM-02-13) mais ne gère pas
  l'infrastructure d'audit.
- **L'audit consultable, la supervision de synchronisation et les paramètres système** : exposés par
  d'autres controllers de `AdminModule` (`audit.controller`, `synchronisation.controller`,
  `parametres.controller`) → hors de cette spec, qui se limite à `utilisateurs` + `roles`.

---

## 2. Acteurs et rôles

Le système compte **3 rôles** d'habilitation (`ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER` ; [[glossaire]]
« Rôle », `PM-46`, D-003). L'accès à ce module est piloté par les permissions de gouvernance, non par le
rôle nominal.

| Acteur | Accès au module (as-built) |
|--------|----------------------------|
| **ADMIN_SYSTEME** | Acteur principal. Détient l'ensemble du catalogue (D-004), donc toutes les permissions `utilisateur.*` et `role.*`. Seul à pouvoir gérer rôles et permissions en pratique. |
| **MEDECIN_CHEF** | Accès **partiel** selon les permissions effectivement détenues. Sur l'écran `AccesPage`, l'onglet **Délégations** lui est ouvert s'il détient `delegation.read` (il gère ses propres délégations) ; les onglets Utilisateurs / Rôles ne s'affichent que s'il détient `utilisateur.read` / `role.read`. *(Le détail des rôles porteurs de ces permissions est dans [[MODULE_02_acces_habilitations]] ; à confirmer côté seed.)* |
| **INFIRMIER** | Pas d'accès de gouvernance en standard (ne détient pas `utilisateur.*` / `role.*`). *(La profession `MEDECIN` du personnel est mappée au rôle `MEDECIN_CHEF`, ci-dessus.)* |

> **Catégories de patient** : sans objet pour ce module (il n'agit pas sur les patients).

**Cloisonnement multi-site** :
- La gestion des **comptes** est **cloisonnée par site** : un administrateur ne liste, ne crée et ne modifie
  que les comptes de **son** site (le `siteId` est forcé depuis le JWT ; un compte d'un autre site est traité
  comme inexistant → 404). Source : `utilisateurs.service.ts` (`requireSite`, `getOrThrow(id, siteId)`).
- La gestion des **rôles** est de **gouvernance globale** (tous sites) : le catalogue de rôles et le compteur
  de détenteurs (`nbUtilisateurs`) sont globaux ; la liste des détenteurs d'un rôle est multi-site. Source :
  `roles.service.ts` (`getUtilisateurs`).

**Groupe SUPERVISION** = { ADMIN_SYSTEME, MEDECIN_CHEF } ([[glossaire]]) — notion clinique, sans effet
direct ici hormis l'éligibilité aux permissions de gouvernance.

---

## 3. Exigences fonctionnelles

> Permissions citées : voir le catalogue `packages/types/src/permissions.ts` et [[MODULE_02_acces_habilitations]].
> Toutes les routes du module exigent `JwtAuthGuard` + `PermissionsGuard`.

### Comptes utilisateur

- **EF-02-01** — Le système liste les comptes utilisateur du site de l'appelant, avec filtres par texte
  (login, email, nom/prénom du personnel), par **statut** (ACTIF / DESACTIVE / BLOQUE) et par **rôle**.
  Permission `utilisateur.read`. *(Le `siteId` de la requête est ignoré au profit du JWT.)*
- **EF-02-02** — Le système affiche le détail d'un compte (rôles, site, personnel médical lié, indicateur
  **2FA active** `aDeuxFacteurs`), sans jamais exposer le hash du mot de passe. Permission `utilisateur.read`.
- **EF-02-03** — Le système crée un compte (login, email, mot de passe initial, rôle(s)). Le compte est créé
  **ACTIF** avec **mot de passe temporaire** (changement forcé au 1ᵉʳ login). Permission `utilisateur.create`.
- **EF-02-04** — Le système modifie un compte existant (email, lien vers un personnel médical) sans toucher
  au mot de passe. Permission `utilisateur.update`.
- **EF-02-05** — Le système change le **statut** d'un compte : ACTIF, DESACTIVE ou BLOQUE. La réactivation
  (passage à ACTIF) **réinitialise** les compteurs de blocage (tentatives, blocage, durée). Permission
  `utilisateur.update`.
- **EF-02-06** — Le système attribue / remplace l'**ensemble des rôles** d'un compte (au moins un rôle).
  Permission `utilisateur.assign_role`.
- **EF-02-07** — Le système supprime **définitivement** un compte (suppression physique avec retrait des
  rôles, dérogations et sessions). Permission `utilisateur.delete`.

### Récupération de compte (administrateur)

- **EF-02-08** — Le système réinitialise le **mot de passe** d'un compte (nouvelle valeur, indicateur de
  changement forcé), puis **révoque toutes les sessions** du compte. Permission `utilisateur.reset_password`.
- **EF-02-09** — Le système **retire la double authentification (TOTP)** d'un compte qui l'a perdue (supprime
  la configuration TOTP et ses codes de secours), permettant de se reconnecter sans 2FA puis de la
  reconfigurer. Permission `utilisateur.reset_password`.
- **EF-02-10** — Le système **régénère les codes de secours** TOTP d'un compte (8 codes), renvoyés **une
  seule fois** en clair. Exige une 2FA **active**. Permission `utilisateur.reset_password`.
- **EF-02-11** — Le système **révoque toutes les sessions actives** d'un compte (déconnexion forcée),
  renvoyant le nombre de sessions révoquées. Permission `utilisateur.reset_password`.

### Dérogations de permissions par utilisateur

- **EF-02-12** — Le système restitue la **ventilation des permissions effectives** d'un utilisateur :
  permissions héritées des rôles, GRANT individuels, REVOKE individuels, et l'ensemble **effectif** =
  (rôles ∪ GRANT) − REVOKE. Permission `utilisateur.read` **et** `utilisateur.manage_permissions`.
- **EF-02-13** — Le système **remplace l'ensemble** des dérogations d'un utilisateur (liste complète de
  GRANT + REVOKE, idempotent). Permission `utilisateur.manage_permissions`.
- **EF-02-14** — Le système applique **une dérogation** (GRANT, REVOKE ou RESET) à **plusieurs utilisateurs**
  en une opération. RESET supprime toute dérogation existante (retour au comportement du rôle). Permission
  `utilisateur.manage_permissions`.

### Rôles & catalogue de permissions

- **EF-02-15** — Le système liste les rôles avec, pour chacun : code, libellé, indicateur **système**
  (`isSystem`), liste des permissions et **nombre de détenteurs** (`nbUtilisateurs`, global). Permission
  `role.read`.
- **EF-02-16** — Le système affiche le détail d'un rôle et la **liste de ses détenteurs** (tous sites), avec
  login, nom/prénom, statut et site. Permission `role.read`.
- **EF-02-17** — Le système expose le **catalogue des permissions** disponibles (code, module), trié par
  module puis code. Permission `role.read`.
- **EF-02-18** — Le système crée un **rôle personnalisé** (code UPPER_SNAKE, libellé, liste de permissions).
  Permission `role.create`.
- **EF-02-19** — Le système modifie un rôle : libellé + **matrice de permissions** (remplacement complet).
  Permission `role.update`.
- **EF-02-20** — Le système supprime un rôle, **sauf** s'il est **système** ou **attribué à au moins un
  utilisateur**. Permission `role.delete`.

---

## 4. Cas d'utilisation

> Critères au format « Étant donné / Quand / Alors ». Aucun de ces flux n'a de comportement hors-ligne
> spécifique au-delà du socle offline-first commun : l'administration des comptes/rôles est une donnée
> synchronisée (LWW, D-016) ; les actions de gouvernance se font normalement en ligne sur le central. Les
> sessions et la 2FA ne sont pas réplicables localement de façon administrable hors-ligne (**à confirmer**
> côté desktop ; non testé dans ce module).

### CU-02-01 — Créer un compte soignant

- **Acteur** : ADMIN_SYSTEME (perm. `utilisateur.create`).
- **Déclencheur** : besoin d'ouvrir un accès à un nouvel agent.
- **Nominal** : l'admin saisit login, email, mot de passe initial et rôle(s) ; pour un rôle **clinique**
  (MEDECIN_CHEF ou INFIRMIER) sans personnel existant, il fournit nom + prénom + matricule. Le backend valide
  l'unicité (login/email/matricule, **tombstones inclus**), valide la politique de mot de passe live
  (RM-02-08), crée la fiche `PersonnelMedical` si nécessaire (RM-02-12), crée le compte **ACTIF** avec
  **mot de passe temporaire**, attribue les rôles, journalise (CREATE) et émet une notification
  `UTILISATEUR_CREE`.
- **Erreurs** : login/email déjà pris ou appartenant à un compte supprimé → **409** ; matricule déjà
  utilisé / supprimé → **409** ; rôle invalide → **400** ; compte clinique sans identité → **400** ;
  `siteId` ≠ site du JWT → **400** ; mot de passe non conforme → **400**.
- **Critères** :
  - *Étant donné* un login disponible et un mot de passe conforme, *quand* l'admin crée le compte, *alors*
    le compte existe, est ACTIF, porte `motDePasseTemp = vrai` et les rôles demandés.
  - *Étant donné* un rôle clinique sans `personnelMedicalId` ni identité, *quand* l'admin valide, *alors* la
    création est refusée (400) avec « Un compte soignant nécessite un nom, un prénom et un matricule ».

### CU-02-02 — Désactiver / réactiver un compte

- **Acteur** : ADMIN_SYSTEME (perm. `utilisateur.update`).
- **Déclencheur** : départ, suspension ou retour d'un agent.
- **Nominal (désactivation)** : l'admin passe le compte à **DESACTIVE** → toutes les **sessions actives sont
  révoquées**, audit `SET_STATUT`, notification `UTILISATEUR_DESACTIVE`.
- **Nominal (réactivation)** : passage à **ACTIF** → réinitialisation des compteurs de blocage, notification
  `UTILISATEUR_REACTIVE`.
- **Erreurs** : auto-désactivation interdite → **409** ; désactivation du **dernier ADMIN_SYSTEME actif**
  interdite → **409**.
- **Critères** :
  - *Étant donné* un compte ACTIF d'un autre agent, *quand* l'admin le désactive, *alors* son statut devient
    DESACTIVE et ses sessions sont révoquées.
  - *Étant donné* qu'il ne reste qu'un seul administrateur système actif, *quand* on tente de le désactiver,
    *alors* l'action est refusée (409).

### CU-02-03 — Récupérer l'accès d'un agent ayant perdu son téléphone (2FA)

- **Acteur** : ADMIN_SYSTEME (perm. `utilisateur.reset_password`).
- **Déclencheur** : l'agent ne peut plus fournir son code TOTP.
- **Nominal** : l'admin **retire la 2FA** du compte (EF-02-09) → suppression de `ConfigurationTotp` +
  `CodeSecoursTotp`, audit `RESET_TOTP`. L'agent se reconnecte sans 2FA puis la reconfigure (self-service,
  hors module).
- **Erreurs** : le compte n'a pas de 2FA configurée → **400**.
- **Variante** : si la 2FA est encore **active** et que l'agent a seulement perdu ses codes de secours,
  l'admin **régénère 8 codes** (EF-02-10), affichés **une seule fois**.
- **Critères** :
  - *Étant donné* un compte avec 2FA active, *quand* l'admin retire la 2FA, *alors* la connexion ne requiert
    plus de second facteur.
  - *Étant donné* un compte **sans** 2FA, *quand* l'admin tente de régénérer des codes de secours, *alors*
    l'action échoue (400 « pas de double authentification active »).

### CU-02-04 — Réinitialiser un mot de passe oublié

- **Acteur** : ADMIN_SYSTEME (perm. `utilisateur.reset_password`).
- **Déclencheur** : agent ayant oublié son mot de passe / déblocage.
- **Nominal** : l'admin fixe un nouveau mot de passe (validé par la politique live, RM-02-08), avec
  changement forcé par défaut ; le compte est **déverrouillé** (tentatives remises à 0, blocage levé) et
  **toutes ses sessions révoquées** ; audit `RESET_PASSWORD`.
- **Erreurs** : mot de passe non conforme → **400** ; compte d'un autre site → **404**.
- **Critères** : *Étant donné* un compte existant, *quand* l'admin réinitialise le mot de passe, *alors* le
  compte peut se reconnecter avec la nouvelle valeur (changement forcé) et ses anciennes sessions sont
  invalides.

### CU-02-05 — Forcer la déconnexion (révoquer les sessions)

- **Acteur** : ADMIN_SYSTEME (perm. `utilisateur.reset_password`).
- **Déclencheur** : suspicion de session compromise / poste oublié connecté.
- **Nominal** : l'admin révoque **toutes** les sessions actives ; le système renvoie le **nombre** de
  sessions révoquées ; audit `FORCE_DECONNEXION`. La révocation est immédiate (D-021).
- **Critères** : *Étant donné* un compte avec N sessions actives, *quand* l'admin force la déconnexion,
  *alors* `count = N` et les jetons de rafraîchissement deviennent inopérants.

### CU-02-06 — Ajuster les permissions d'un rôle

- **Acteur** : ADMIN_SYSTEME (perm. `role.update`).
- **Déclencheur** : besoin d'élargir/restreindre les droits d'un rôle.
- **Nominal** : l'admin envoie le libellé + la **liste complète** des permissions ; le backend valide chaque
  code, remplace la matrice (`RolePermission`), journalise (UPDATE) et émet `ROLE_MODIFIE` (portée globale).
- **Erreurs** : permission inconnue → **400** ; **auto-castration** : si l'acteur possède ce rôle et que le
  changement lui ferait perdre une **permission vitale de gouvernance** qu'il détenait, l'action est
  **refusée (409)** (RM-02-09).
- **Critères** :
  - *Étant donné* un rôle existant et des codes valides, *quand* l'admin sauvegarde, *alors* la matrice du
    rôle reflète exactement la liste envoyée.
  - *Étant donné* un acteur qui détient le rôle édité, *quand* le changement lui retirerait `utilisateur.read`
    (vitale) sans qu'un autre rôle la lui rende, *alors* l'action est bloquée (409).

### CU-02-07 — Supprimer un rôle personnalisé

- **Acteur** : ADMIN_SYSTEME (perm. `role.delete`).
- **Déclencheur** : nettoyage d'un rôle obsolète.
- **Nominal** : suppression du rôle et de ses liaisons de permissions ; audit `DELETE`.
- **Erreurs** : rôle **système** (ADMIN_SYSTEME / MEDECIN_CHEF / INFIRMIER) → **409** ; rôle **attribué** à
  au moins un utilisateur → **409** (« retirez-le d'abord »).
- **Critères** : *Étant donné* un rôle non-système sans détenteur, *quand* l'admin le supprime, *alors* il
  disparaît du catalogue ; *étant donné* un rôle système, *quand* on tente de le supprimer, *alors* l'action
  est refusée (409).

### CU-02-08 — Accorder/retirer une permission ponctuelle à un utilisateur

- **Acteur** : ADMIN_SYSTEME (perm. `utilisateur.manage_permissions`).
- **Déclencheur** : besoin d'un droit hors du rôle standard.
- **Nominal** : l'admin pose des **GRANT/REVOKE** individuels (par utilisateur ou en masse). L'effectif
  recalculé est (rôles ∪ GRANT) − REVOKE.
- **Erreurs** : un code à la fois GRANT et REVOKE → **400** ; code inconnu → **400** ; **REVOKE d'une
  permission vitale** sur soi-même ou sur le **dernier admin actif** → **409** (RM-02-09).
- **Critères** : *Étant donné* un utilisateur sans `patient.lock`, *quand* l'admin lui accorde un GRANT
  `patient.lock`, *alors* l'effectif de l'utilisateur contient `patient.lock`.

### CU-02-09 — Supprimer définitivement un compte

- **Acteur** : ADMIN_SYSTEME (perm. `utilisateur.delete`).
- **Déclencheur** : compte créé par erreur / jamais utilisé.
- **Nominal** : retrait des rôles, dérogations et sessions puis suppression physique ; audit `DELETE` ;
  notification `UTILISATEUR_SUPPRIME`.
- **Erreurs** : auto-suppression interdite → **409** ; dernier ADMIN_SYSTEME actif → **409** ; compte
  **référencé par l'historique** (audit, notifications) → **409** avec invite à **désactiver** plutôt
  (RM-02-11).
- **Critères** : *Étant donné* un compte sans dépendance d'historique, *quand* l'admin le supprime, *alors*
  il n'existe plus ; *étant donné* un compte référencé par un journal d'audit, *quand* on tente de le
  supprimer, *alors* l'action est refusée (409) et la désactivation est proposée.

---

## 5. Données du module

Entités décrites dans [[modele_donnees_global]] §3.1 (Sécurité, identité & habilitations). Entités
manipulées par ce module :

- **`Utilisateur`** — compte (login·, email·, `passwordHash`, `statut` ACTIF/DESACTIVE/BLOQUE,
  `motDePasseTemp`, `siteId`, `personnelMedicalId`·, compteurs `tentativesEchec`/`blocageJusquA`/
  `blocageMinutes`, `createdBy`/`updatedBy`). Soft-delete (tombstone) → l'unicité login/email/personnel est
  vérifiée sur le **client brut** `raw` pour détecter les tombstones (RM-02-10).
- **`Role`** (code·, libelle), **`Permission`** (code·, module), **`RolePermission`** (PK composite
  rôle↔permission), **`UtilisateurRole`** (PK composite utilisateur↔rôle).
- **`UtilisateurPermission`** — dérogation par utilisateur (`mode` GRANT/REVOKE, `motif`, `accordePar`), au
  plus une par couple (utilisateur, permission) (contrainte `utilisateurId_permissionId`).
- **`SessionUtilisateur`** — sessions/refresh ; manipulées en **révocation** (`revokedAt`) lors de
  désactivation, reset mot de passe et déconnexion forcée.
- **`ConfigurationTotp`** (secret chiffré at-rest, `actif`) + **`CodeSecoursTotp`** (`codeHash`, usage
  unique) — manipulées en **récupération de compte** (retrait 2FA, régénération de codes).
- **`JournalAudit`** — traces écrites par les services (cf. RM-02-13).
- **`Notification`** — diffusion administrative émise via `NotificationService` (contrat C-8).

> Entités **système** (catalogue figé) : `Permission` est alimentée d'après `packages/types/src/permissions.ts`
> (`PM-47`). Les rôles **système** sont identifiés par code : `ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER`
> (constante `SYSTEM_ROLES` dans `roles.service.ts`) — cohérent avec D-003 (catalogue sans clé `MEDECIN`).

---

## 6. Règles métier

> Toute valeur chiffrée renvoie à [[parametres_metier]]. Les règles « anti-castration / dernier admin »
> partagent la **source unique** `VITAL_GOVERNANCE_PERMISSIONS` (`apps/api/src/common/governance.ts`).

- **RM-02-01** — **Cloisonnement des comptes par site** : toute opération sur un compte est restreinte au
  `siteId` du JWT ; un compte d'un autre site est traité comme **inexistant** (404). Le `siteId` fourni en
  paramètre est ignoré (liste) ou refusé s'il diverge (création/modification → 400). Source :
  `utilisateurs.service.ts`.
- **RM-02-02** — **Gouvernance des rôles globale** : le catalogue de rôles, le compteur `nbUtilisateurs` et
  la liste des détenteurs sont **tous sites confondus** (réservés `role.read`). Source : `roles.service.ts`.
- **RM-02-03** — **Compte créé actif + mot de passe temporaire** : un compte naît ACTIF avec
  `motDePasseTemp = vrai` (changement imposé au 1ᵉʳ login).
- **RM-02-04** — **Au moins un rôle** par compte (création et changement de rôles).
- **RM-02-05** — **Pas d'auto-désactivation, pas d'auto-suppression, pas d'auto-castration** : un acteur ne
  peut ni se désactiver, ni se supprimer, ni se retirer la capacité d'attribuer des rôles / les permissions
  vitales → **409**.
- **RM-02-06** — **Protection du dernier administrateur système actif** : interdiction de retirer le rôle
  ADMIN_SYSTEME, de désactiver, de supprimer ou de révoquer une permission vitale au **dernier
  `ADMIN_SYSTEME` au statut ACTIF** (comptage `countActiveAdmins`) → **409**.
- **RM-02-07** — **Révocation des sessions à tout changement de sécurité** : la désactivation et la
  réinitialisation de mot de passe **révoquent toutes les sessions actives** du compte (cohérent avec la
  révocation immédiate, D-021).
- **RM-02-08** — **Politique de mot de passe dynamique** : tout mot de passe (création, reset) est validé par
  `ParametresService.assertPasswordValid()` selon les paramètres **live** (longueur `PM-09`, majuscule
  `PM-10`, minuscule `PM-11`, chiffre `PM-12`, spécial `PM-13`). Les DTOs ne valident que la forme de base
  (longueur max 200). Hachage **bcrypt** (coût 12).
- **RM-02-09** — **Permissions vitales de gouvernance** : l'ensemble protégé est `role.read/create/update/
  delete`, `utilisateur.read/create/update/assign_role/reset_password/manage_permissions` (constante
  `VITAL_GOVERNANCE_PERMISSIONS`). On ne peut les **retirer** ni à soi-même (auto-castration), ni au dernier
  admin, que ce soit par édition de rôle (RM-02 sur `roles.service`) ou par dérogation REVOKE (sur
  `utilisateurs.service`).
- **RM-02-10** — **Unicité tombstone-aware** : les contrôles d'unicité (login, email, `personnelMedicalId`,
  matricule du personnel) interrogent le **client brut `raw`** afin de détecter les contraintes `@unique`
  encore occupées par des comptes **soft-supprimés** ; le message distingue « appartient à un compte
  supprimé » de « déjà utilisé ».
- **RM-02-11** — **Suppression sûre 409** : la suppression d'un compte retire d'abord rôles, dérogations et
  sessions, puis le compte ; si une contrainte d'intégrité subsiste (référencé par audit/notifications,
  `P2003`/`P2014`), l'opération est refusée (**409**) en proposant la **désactivation**.
- **RM-02-12** — **Fusion compte ↔ fiche clinique** : un compte de rôle **clinique** (MEDECIN_CHEF ou
  INFIRMIER) sans `personnelMedicalId` exige nom + prénom + matricule ; le backend **crée** alors la fiche
  `PersonnelMedical` (rôle métier MEDECIN pour MEDECIN_CHEF, sinon INFIRMIER) et la lie au compte. Aligné sur
  le recueil (« on gère des comptes, plus de répertoire de personnel séparé »), cf. D-011.
- **RM-02-13** — **Audit applicatif explicite** : chaque mutation (CREATE, UPDATE, SET_ROLES, SET_STATUT,
  RESET_PASSWORD, RESET_TOTP, REGEN_CODES_SECOURS, FORCE_DECONNEXION, SET_PERMISSIONS, BULK_PERMISSION,
  DELETE pour les comptes ; CREATE/UPDATE/DELETE pour les rôles) écrit une ligne `JournalAudit` (avant/après).
  L'audit ne bloque **jamais** l'opération métier (try/catch silencieux). Ces controllers s'auto-auditant,
  ils ne sont **pas** annotés `@Audit` (anti-double, D-014).
- **RM-02-14** — **Rôles système non supprimables** : un rôle dont le code ∈ {ADMIN_SYSTEME, MEDECIN_CHEF,
  INFIRMIER} est `isSystem` et **ne peut être supprimé** (mais ses permissions restent ajustables). Un rôle
  **attribué** (≥ 1 détenteur) ne peut être supprimé non plus.
- **RM-02-15** — **Codes de secours TOTP** : régénération de **8 codes** au format `XXXX-XXXX` (hex),
  **hachés** (bcrypt) au repos, renvoyés en clair **une seule fois** ; nécessite une 2FA **active**.
- **RM-02-16** — **Dérogations idempotentes** : le remplacement complet (PUT) rejette tout code à la fois
  GRANT et REVOKE (400) et tout code absent du catalogue (400) ; l'opération efface puis recrée l'ensemble
  des dérogations. L'effectif = (rôles ∪ GRANT) − REVOKE.
- **RM-02-17** — **Format des identifiants** : login `^[a-z][a-z0-9._-]*$` (3–32, insensible à la casse),
  email valide, code de rôle UPPER_SNAKE `^[A-Z][A-Z0-9_]*$` (3–32), libellé 2–100. Source : DTOs.

---

## 7. Interfaces

### 7.1 Endpoints exposés (consommés par le frontend)

> Base protégée par `JwtAuthGuard` + `PermissionsGuard`. Détails de payload dans les DTOs
> (`apps/api/src/modules/admin/dto`).

| Méthode + route | Permission | Exigence |
|-----------------|-----------|----------|
| `GET /admin/utilisateurs` | `utilisateur.read` | EF-02-01 |
| `GET /admin/utilisateurs/:id` | `utilisateur.read` | EF-02-02 |
| `POST /admin/utilisateurs` | `utilisateur.create` | EF-02-03 |
| `PATCH /admin/utilisateurs/:id` | `utilisateur.update` | EF-02-04 |
| `PATCH /admin/utilisateurs/:id/statut` | `utilisateur.update` | EF-02-05 |
| `PATCH /admin/utilisateurs/:id/roles` | `utilisateur.assign_role` | EF-02-06 |
| `DELETE /admin/utilisateurs/:id` | `utilisateur.delete` | EF-02-07 / CU-02-09 |
| `POST /admin/utilisateurs/:id/reset-password` | `utilisateur.reset_password` | EF-02-08 |
| `POST /admin/utilisateurs/:id/totp/reset` | `utilisateur.reset_password` | EF-02-09 |
| `POST /admin/utilisateurs/:id/backup-codes` | `utilisateur.reset_password` | EF-02-10 |
| `POST /admin/utilisateurs/:id/sessions/revoke` | `utilisateur.reset_password` | EF-02-11 |
| `GET /admin/utilisateurs/:id/permissions` | `utilisateur.read` + `utilisateur.manage_permissions` | EF-02-12 |
| `PUT /admin/utilisateurs/:id/permissions` | `utilisateur.manage_permissions` | EF-02-13 |
| `POST /admin/utilisateurs/permissions/bulk` | `utilisateur.manage_permissions` | EF-02-14 |
| `GET /admin/roles` | `role.read` | EF-02-15 |
| `GET /admin/roles/:id` | `role.read` | EF-02-16 |
| `GET /admin/roles/:id/utilisateurs` | `role.read` | EF-02-16 |
| `GET /admin/permissions` | `role.read` | EF-02-17 |
| `POST /admin/roles` | `role.create` | EF-02-18 |
| `PATCH /admin/roles/:id` | `role.update` | EF-02-19 |
| `DELETE /admin/roles/:id` | `role.delete` | EF-02-20 |

### 7.2 Interfaces consommées (contrats [[plan_modules]])

- **C-9** — *Authentification & autorisation* : toutes les routes s'appuient sur les gardes exportées par
  `SecurityModule` (`JwtAuthGuard`, `PermissionsGuard`) ; les permissions effectives sont (rôles ∪ GRANT) −
  REVOKE.
- **C-10** — *Configuration système* : `ParametresService` (importé via `ParametresModule`) fournit la
  validation de mot de passe (`assertPasswordValid`, RM-02-08).
- **C-8** — *Notification temps réel* : `NotificationService` (via `NotificationModule`) émet les
  diffusions administratives `UTILISATEUR_CREE`/`_DESACTIVE`/`_REACTIVE`/`_SUPPRIME` et `ROLE_MODIFIE`
  (portée par site pour les comptes, globale pour les rôles).
- **C-11** — *Journalisation d'audit* : ce module écrit directement dans `JournalAudit` (audit applicatif) ;
  il **n'est pas** doublé par l'`AuditInterceptor` global (RM-02-13).
- **Source du catalogue de permissions** : `packages/types/src/permissions.ts` (`PM-47`,
  [[MODULE_02_acces_habilitations]]) → table `Permission` lue par EF-02-17.

### 7.3 Surface frontend

- `apps/web/src/modules/admin/pages/AccesPage.tsx` — écran unifié **« Accès & habilitations »** (onglets
  Utilisateurs / Rôles & permissions / Personnel soignant / Délégations), chaque onglet conditionné par la
  permission correspondante et rendu en mode `embedded`.
- `UtilisateursPage.tsx`, `RolesPage.tsx`, drawers `CreerUtilisateurDrawer` / `UtilisateurDrawer` /
  `ResetPasswordDialog` (`apps/web/src/modules/admin/components`).
- Les permissions backend sont **distinctes** côté UI (jamais regroupées sous un seul « canWrite ») :
  `canCreate`, `canUpdate`, `canResetPassword`, `canDelete`.

---

## 8. Exigences non fonctionnelles spécifiques

- **Sécurité — moindre privilège** : chaque endpoint exige une permission **granulaire** dédiée ; la lecture
  de la ventilation de permissions exige **deux** permissions simultanées (`utilisateur.read` +
  `utilisateur.manage_permissions`).
- **Sécurité — irréversibilité gouvernance** : les garde-fous RM-02-05/06/09 garantissent qu'aucune action
  via l'UI ne peut rendre la plateforme ingérable (la seule issue restante serait une intervention SQL hors
  application — explicitement évitée).
- **Confidentialité des secrets** : le `passwordHash` n'est jamais renvoyé (sanitisation systématique) ; le
  secret TOTP est chiffré at-rest (AES-256-GCM, `PM-45`) ; les codes de secours sont hachés et affichés une
  seule fois.
- **Cloisonnement multi-site** : aucune fuite ni IDOR inter-sites sur les comptes (RM-02-01) ; la
  gouvernance des rôles est volontairement globale (RM-02-02).
- **Robustesse de l'audit** : la journalisation ne doit jamais faire échouer une opération métier (RM-02-13).
- **Intégrité référentielle** : suppression sûre mappée en 409 plutôt qu'en erreur 500 (RM-02-11,
  `GlobalExceptionFilter`).
- **Cohérence offline-first** : `Utilisateur` et entités RBAC portent `updatedAt`/`deletedAt` pour la
  synchronisation LWW (D-015, D-016) ; les comptes restent cloisonnés par site à la synchro (D-005).

---

## 9. Risques et points ouverts

- **Nombre de rôles (D-003)** : la constante `SYSTEM_ROLES` liste **3 rôles** d'habilitation
  (ADMIN_SYSTEME, MEDECIN_CHEF, INFIRMIER), cohérent avec l'absence de clé `MEDECIN` au catalogue.
  `MEDECIN` n'est **pas** un rôle mais une **profession** du personnel mappée au rôle `MEDECIN_CHEF`
  (`seed.ts:379`). Toute mention résiduelle de « 4 rôles » dans [[glossaire]] ou [[_SOURCE_systeme]] est à
  corriger en **3 rôles** (cf. note de cohérence du [[registre_decisions]]).
- **Décompte de permissions** : `PM-47` retient **110** entrées vérifiées dans le code ; ce module ne fige
  pas le chiffre — il lit la table `Permission`.
- **Réduction prévue d'ADMIN_SYSTEME (D-004)** : l'accès clinique complet est **temporaire** ; une réduction
  à la gouvernance pure est prévue. Les permissions vitales de gouvernance resteront le cœur de ce module.
- **MEDECIN_CHEF et la gouvernance des comptes** : l'éligibilité exacte de MEDECIN_CHEF aux permissions
  `utilisateur.*` / `role.*` dépend du seed des rôles → **à confirmer** dans [[MODULE_02_acces_habilitations]].
- **Comportement hors-ligne des actions de session/2FA** : la révocation de session et le retrait de 2FA
  s'appuient sur le central (sessions, `ConfigurationTotp`) ; leur administrabilité depuis un poste local
  hors-ligne n'est pas spécifiée ici (**à confirmer** côté desktop).
- **Codes de secours affichés une seule fois** : aucune ré-affichage possible ; un échec d'enregistrement
  côté administrateur impose une nouvelle régénération (perte des codes précédents).
