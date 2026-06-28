# Module 01 — Sécurité & Authentification

**Version** 1.0 · **Date** 2026-06-26 · **Statut** Brouillon · **Release** MVP · **Historique** : v1.0 création

> Spécification « as-built » du module de sécurité (le système est développé et déployé). Les faits techniques renvoient au code réel sous `apps/api/src/modules/security/` (backend NestJS) et `apps/web/src/modules/auth/` (frontend React). Aligné sur le brief [[_SOURCE_systeme]], le [[glossaire]], le [[plan_modules]] (`SecurityModule`, contrats C-9 et C-10), les paramètres [[parametres_metier]] et le [[registre_decisions]] (D-013, D-021, D-004, D-003, D-020). Aucune valeur chiffrée n'est définie ici : toute valeur renvoie à un `PM-xx`.

---

## 1. Mission et périmètre

### 1.1 Mission

`SecurityModule` est le point d'entrée d'authentification et le socle d'autorisation de CMS SARIS. Il **authentifie** chaque utilisateur (login / mot de passe, puis double authentification TOTP optionnelle), **émet et fait tourner les jetons** (JWT d'accès + jeton de rafraîchissement), **gère le cycle de vie des sessions** (session unique par utilisateur, révocation immédiate) et **autorise** chaque requête via trois gardes (`JwtAuthGuard`, `PermissionsGuard`, `RolesGuard`) appliqués transversalement à tous les contrôleurs protégés (contrat [[plan_modules]] **C-9**).

Il porte aussi le **self-service du compte** (`/me`) : préférences d'affichage, acceptation des **CGU**, liste/révocation des sessions, et **enrôlement/désactivation de la 2FA TOTP** avec codes de secours.

### 1.2 Dans le périmètre

- Authentification login + mot de passe (`POST /auth/login`), avec compteur d'échecs, blocage de compte escaladé, et journalisation de chaque tentative.
- Double authentification TOTP en deux étapes (`POST /auth/totp/verify`) ; acceptation d'un **code de secours** à usage unique.
- Émission, rafraîchissement avec rotation (`POST /auth/refresh`) et révocation des jetons (`POST /auth/logout`).
- Session unique par utilisateur + **révocation immédiate** (vérification du `sid` en base à chaque requête, déconnexion SSE des anciennes sessions — [[registre_decisions]] D-021).
- Autorisation : gardes JWT, permissions granulaires (`@RequirePermissions`), rôles (`@Roles`).
- Changement de mot de passe par l'utilisateur connecté (`POST /auth/change-password`) avec application de la politique en vigueur.
- Profil courant (`GET /auth/me`) et self-service `/me` (préférences, CGU, sessions, enrôlement TOTP + codes de secours).
- Exemption de session unique pour les sessions de **synchronisation desktop** (champ `posteLocalId`) et confiance à la signature côté **backend embarqué** (mode SQLite) — [[registre_decisions]] D-020.

### 1.3 Hors périmètre (explicite)

- **Création / modification / suppression des comptes utilisateurs, rôles et permissions** : assurées par `AdminModule` (module « Accès & habilitations », à documenter dans son propre module). Le présent module **consomme** le catalogue de permissions mais ne l'administre pas.
- **Récupération de compte par un administrateur** (réinitialisation de mot de passe d'un tiers) : relève de `AdminModule`.
- **Catalogue des permissions et matrice rôle→permissions** : défini dans `packages/types/src/permissions.ts`, documenté dans [[MODULE_02_acces_habilitations]] (référencé, pas redéfini ici).
- **Journal d'audit applicatif transverse** (`@Audit` + `AuditInterceptor` global) : mécanisme décrit en [[registre_decisions]] D-014 ; ce module écrit un journal d'authentification **dédié** (`JournalAuthentification`), distinct du `JournalAudit`.
- **Politique de mot de passe et durées de session configurables** : les valeurs vivent dans `ParametresService` (module support `parametres`, contrat **C-10**) ; ce module les **lit et applique** mais ne gère pas leur écran de configuration.
- **Géolocalisation / IP réelle** : utilitaires transverses (`common/geo`) consommés en lecture pour l'affichage des sessions ; non spécifiés ici.
- **Chiffrement at-rest du secret TOTP** : algorithme `PM-45` (AES-256-GCM), implémenté dans `common/crypto/totp-secret` ; ce module l'invoque (`encryptSecret`/`decryptSecret`) sans en porter l'implémentation.

---

## 2. Acteurs et rôles

Le module distingue l'**autorisation par rôle** (4 rôles du système, [[glossaire]] « Rôle », [[registre_decisions]] D-003) de l'**autorisation par permission** (granulaire). Tout utilisateur authentifié — quel que soit son rôle — accède au self-service `/me` et aux endpoints `/auth` (changement de mot de passe, profil, logout) **sans permission particulière**.

| Acteur | Rôle système | Interaction avec le module |
|--------|--------------|----------------------------|
| **Utilisateur authentifié** (tout rôle) | `ADMIN_SYSTEME`, `MEDECIN_CHEF`, `MEDECIN`, `INFIRMIER` | Se connecte, change son mot de passe, gère ses sessions, active/désactive sa 2FA, accepte les CGU. |
| **ADMIN_SYSTEME** | super-administrateur ([[registre_decisions]] D-004) | Mêmes droits self-service ; l'administration des comptes/rôles relève de `AdminModule` (hors périmètre §1.3). |
| **MEDECIN_CHEF / MEDECIN / INFIRMIER** | rôles cliniques | Mêmes droits self-service ; leurs permissions cliniques sont chargées dans le JWT et vérifiées par les gardes. |
| **Session de synchronisation desktop** | (technique, non humaine) | Authentification portant `posteLocalId` → exemptée de la session unique ([[registre_decisions]] D-021, D-020). |

> Note honnêteté ([[registre_decisions]] D-003) : le catalogue de rôles réellement présent peut diverger (« 3 vs 4 ») ; le rôle `MEDECIN` est documenté comme rôle de droits mais son existence au catalogue est **à confirmer** sur `packages/types/src/permissions.ts`. Le module de sécurité ne définit pas les rôles : il les lit depuis les `UtilisateurRole` et les injecte dans le JWT.

Les catégories de patient (ASSURE_CDI, AYANT_DROIT_CDI, etc.) **ne sont pas pertinentes** pour ce module (aucun patient n'est un acteur de l'authentification).

---

## 3. Exigences fonctionnelles

> Source : `security.controller.ts`, `security.service.ts`, `me.controller.ts`, `me.service.ts`, `strategies/jwt.strategy.ts`, `guards/*.ts`, `dto/*.ts`.

### 3.1 Authentification (login)

- **EF-01-01** — Le système expose `POST /auth/login` acceptant un identifiant (`login`, ≤ 100 car.) et un mot de passe (`password`, ≤ 200 car.), tous deux obligatoires (`dto/login.dto.ts`).
- **EF-01-02** — Un identifiant inconnu **ou** un compte soft-supprimé (`deletedAt` non nul) renvoie une erreur **générique** (401, message identique au mot de passe erroné) pour éviter l'énumération d'utilisateurs.
- **EF-01-03** — Un compte au statut `DESACTIVE` est refusé (401) avec un message dédié invitant à contacter l'administrateur.
- **EF-01-04** — Un compte au statut `BLOQUE` dont la fin de blocage (`blocageJusquA`) est dans le futur est refusé (401) avec le nombre de minutes restantes. Si le blocage est expiré, le compte est automatiquement réactivé (`ACTIF`, compteur d'échecs remis à zéro) puis l'authentification se poursuit.
- **EF-01-05** — Le mot de passe est vérifié par comparaison `bcrypt` contre le `passwordHash` stocké ; le mot de passe en clair n'est jamais persisté.
- **EF-01-06** — À chaque échec de mot de passe, le compteur `tentativesEchec` est incrémenté ; le message indique le nombre de tentatives restantes (cf. seuil `PM-07`).
- **EF-01-07** — Quand le nombre de tentatives atteint le maximum (`PM-07`), le compte passe `BLOQUE` jusqu'à `maintenant + durée` (`PM-08`), avec **escalade** : le 1er blocage vaut `PM-08`, chaque blocage suivant est multiplié par 4 (`prochainBlocage`).
- **EF-01-08** — Un login réussi remet à zéro le compteur d'échecs et l'escalade de blocage (« ardoise propre »).
- **EF-01-09** — Le rate-limiting anti brute-force s'applique à `POST /auth/login` (`PM-04`) et à `POST /auth/totp/verify` (`PM-05`).
- **EF-01-10** — Toute tentative d'authentification (succès comme échec, avec son motif : `SUCCES_LOGIN`, `ECHEC_MOT_DE_PASSE`, `ECHEC_COMPTE_BLOQUE`, `ECHEC_COMPTE_DESACTIVE`, `ECHEC_LOGIN_INCONNU`, `SUCCES_LOGIN_TOTP_REQUIS`, `SUCCES_LOGIN_TOTP`, `SUCCES_LOGIN_CODE_SECOURS`, `SUCCES_LOGOUT`, `SUCCES_CHANGEMENT_MDP`) est journalisée dans `JournalAuthentification` (login, résultat, IP, user-agent), de façon non bloquante.

### 3.2 Double authentification (TOTP)

- **EF-01-11** — Si le compte a une `ConfigurationTotp` active, `POST /auth/login` ne délivre **pas** de jeton final mais renvoie `{ requireTotp: true, tempToken }`, le `tempToken` étant valable `PM-03`.
- **EF-01-12** — `POST /auth/totp/verify` accepte `{ code, tempToken }` et délivre les jetons finaux après vérification. Le `code` est soit 6 chiffres (code applicatif), soit un code de secours `XXXX-XXXX` (tiret optionnel, casse indifférente — `dto/totp-verify.dto.ts`).
- **EF-01-13** — Le code applicatif est validé contre le secret **déchiffré** avec une tolérance d'horloge (`epochTolerance` ±30 s) pour absorber le décalage client/serveur.
- **EF-01-14** — Un code de secours valide (comparaison `bcrypt` contre les codes non utilisés) est accepté **une seule fois** : il est marqué `utilise` avec horodatage à l'usage.
- **EF-01-15** — Un `tempToken` invalide, expiré ou dont l'étape (`step`) n'est pas `totp` est refusé (401).

### 3.3 Enrôlement / gestion de la 2FA (self-service `/me`)

- **EF-01-16** — `GET /me/totp` renvoie l'état de la 2FA de l'utilisateur (`actif`, `enAttente`).
- **EF-01-17** — `POST /me/totp/setup` génère un secret, le **chiffre** avant stockage (`PM-45`), crée/met à jour la configuration en état **non actif**, et renvoie le secret en clair + l'URI `otpauth` (à scanner) + l'émetteur (nom de l'établissement). Refusé si la 2FA est déjà active.
- **EF-01-18** — `POST /me/totp/activate` vérifie un code valide puis **active** la 2FA et génère **8 codes de secours** lisibles (`XXXX-XXXX`) renvoyés **une seule fois**, stockés hachés (`bcrypt`).
- **EF-01-19** — `POST /me/totp/disable` désactive la 2FA après vérification d'un code valide, en supprimant la configuration et tous les codes de secours.
- **EF-01-20** — L'activation et la désactivation de la 2FA sont auditées (`TOTP_ACTIVE` / `TOTP_DESACTIVE` dans `JournalAudit`).

### 3.4 Jetons & sessions

- **EF-01-21** — Une session réussie crée une `SessionUtilisateur` (clé = `sid` UUID) et délivre un **jeton d'accès** (TTL `PM-01`, durée live lue dans les paramètres) et un **jeton de rafraîchissement** (TTL `PM-02`), ce dernier portant un `sid` qui le rend unique et stocké **uniquement haché** (`bcrypt`).
- **EF-01-22** — `POST /auth/refresh` échange un jeton de rafraîchissement valide contre un nouveau couple de jetons (**rotation** : l'ancienne session est révoquée, une nouvelle est créée). Le type de session (interactive vs synchro, via `posteLocalId`) est **préservé**.
- **EF-01-23** — Le rafraîchissement retrouve la session par son `sid` signé et vérifie : appartenance à l'utilisateur, non-révocation, non-expiration et concordance `bcrypt` du jeton. Les anciens jetons **sans** `sid` sont tolérés (rétro-compat, boucle) le temps de leur expiration.
- **EF-01-24** — `POST /auth/logout` révoque **toutes** les sessions actives de l'utilisateur.
- **EF-01-25** — Session unique : à la création d'une session **interactive** (sans `posteLocalId`), les autres sessions interactives du même utilisateur sont révoquées et notifiées en temps réel (`SESSION_REVOKED` via SSE, best-effort). Les sessions de **synchronisation** (`posteLocalId` rempli) ne sont **pas** révoquées (RM-01-08).
- **EF-01-26** — `GET /me/sessions` liste les sessions actives (avec drapeau `current`, IP, user-agent, dates, localisation dérivée de l'IP). `POST /me/sessions/revoke-others` révoque toutes les autres ; `DELETE /me/sessions/:id` révoque une session précise (uniquement parmi les siennes).

### 3.5 Profil, mot de passe, CGU

- **EF-01-27** — `GET /auth/me` (JWT requis) renvoie le profil courant à jour depuis la base : id, login, site, rôles, permissions effectives, `personnelMedicalId`.
- **EF-01-28** — `POST /auth/change-password` (JWT requis) vérifie le mot de passe actuel, applique la politique de mot de passe **en vigueur** (`PM-09` à `PM-13`, via `assertPasswordValid`), enregistre le nouveau haché (`bcrypt`, coût 12) et lève le marqueur `motDePasseTemp`.
- **EF-01-29** — `GET /me/preferences` / `PUT /me/preferences` lisent/écrivent les préférences d'affichage (thème, densité, langue, page d'accueil, lignes/page, notif e-mail), avec valeurs par défaut (langue par défaut de l'établissement) sans créer de ligne tant que rien n'est modifié.
- **EF-01-30** — `POST /me/cgu/accepter` enregistre l'acceptation des CGU (version serveur courante `CGU_VERSION`) ; `GET /me/preferences` expose si l'acceptation est à jour (`cguAJour`) et la version requise.

### 3.6 Autorisation (gardes)

- **EF-01-31** — `JwtAuthGuard` protège toute route annotée et peuple `request.user` via `JwtStrategy` ; un token sans `sub`, `siteId` ou `roles` est rejeté (401).
- **EF-01-32** — `JwtStrategy` impose la **révocation immédiate** : si le token porte un `sid`, la session correspondante doit être présente, non révoquée et non expirée en base, sinon 401 (RM-01-06). **Exception** : en backend embarqué (`DATABASE_PROVIDER = sqlite`), la vérification de session est sautée (confiance à la signature, loopback) — [[registre_decisions]] D-020.
- **EF-01-33** — `PermissionsGuard` (après `JwtAuthGuard`) autorise selon `@RequirePermissions(...)` en mode `ANY` (au moins une) ou `ALL` (toutes) ; en l'absence d'annotation, l'accès est libre (JWT suffit). Refus → 403 listant les permissions requises.
- **EF-01-34** — `RolesGuard` autorise selon `@Roles(...)` (au moins un rôle) ; en l'absence d'annotation, accès libre. Refus → 403. Marqué « legacy, à éviter » au profit des permissions (`security.module.ts`).
- **EF-01-35** — Les permissions effectives injectées dans le JWT sont calculées par `chargerPermissions` : (permissions des rôles ∪ GRANTs individuels) − REVOKEs individuels, le REVOKE l'emportant toujours (RM-01-09).

---

## 4. Cas d'utilisation

### CU-01-01 — Connexion sans 2FA

- **Acteur** : utilisateur authentifié (tout rôle).
- **Déclencheur** : saisie identifiant + mot de passe sur l'écran de connexion (`LoginPage.tsx`).
- **Scénario nominal** : 1) l'utilisateur soumet `login`/`password` ; 2) le système valide le compte (actif, non bloqué) et le mot de passe ; 3) aucune 2FA active → création d'une session, émission des jetons et du profil ; 4) la session se charge, les autres sessions interactives sont révoquées (session unique).
- **Scénarios d'erreur** : identifiant/mot de passe erroné → 401 générique + tentatives restantes ; compte désactivé → 401 dédié ; compte bloqué → 401 + minutes restantes ; seuil d'échecs atteint → blocage escaladé.
- **Hors-ligne** : sur **desktop hors-ligne**, le login est servi par le backend embarqué local (le token émis par le central reste accepté localement, [[registre_decisions]] D-020). Sur le **web**, hors-ligne, le login échoue (pas de central joignable) ; le badge de connectivité (`PM-20`) signale l'état.
- **Critères** :
  - *Étant donné* un compte actif sans 2FA et un mot de passe correct, *quand* il appelle `POST /auth/login`, *alors* il reçoit `requireTotp:false` avec `accessToken`, `refreshToken` et `user`.
  - *Étant donné* un mot de passe incorrect sous le seuil `PM-07`, *quand* il se connecte, *alors* il reçoit un 401 indiquant les tentatives restantes et `tentativesEchec` est incrémenté.

### CU-01-02 — Connexion avec 2FA (TOTP)

- **Acteur** : utilisateur ayant activé la 2FA.
- **Déclencheur** : connexion réussie en étape 1 avec une `ConfigurationTotp` active.
- **Scénario nominal** : 1) `POST /auth/login` renvoie `{ requireTotp:true, tempToken }` ; 2) l'écran bascule sur la saisie du code à 6 chiffres ; 3) `POST /auth/totp/verify` valide le code (tolérance ±30 s) ; 4) session créée, jetons + profil délivrés.
- **Scénarios d'erreur** : code invalide → 401 (`ECHEC_CODE_TOTP`) ; `tempToken` expiré (> `PM-03`) → 401, retour à l'étape 1 ; trop de tentatives → rate-limit `PM-05`.
- **Hors-ligne** : identique à CU-01-01 quant à la source (central en ligne / backend embarqué hors-ligne).
- **Critères** :
  - *Étant donné* un `tempToken` valide et un code TOTP correct, *quand* il appelle `POST /auth/totp/verify`, *alors* il reçoit les jetons finaux et l'événement `SUCCES_LOGIN_TOTP` est journalisé.
  - *Étant donné* un `tempToken` expiré, *quand* il soumet un code, *alors* il reçoit un 401 « token temporaire invalide ou expiré ».

### CU-01-03 — Récupération par code de secours

- **Acteur** : utilisateur 2FA ayant perdu son application d'authentification.
- **Déclencheur** : sur l'étape TOTP, bascule « utiliser un code de secours ».
- **Scénario nominal** : 1) l'utilisateur saisit un code `XXXX-XXXX` ; 2) le système le normalise (majuscules, sans espaces, tiret réinséré) et le compare aux codes non utilisés ; 3) match → connexion + marquage du code comme **utilisé** (usage unique).
- **Scénarios d'erreur** : code déjà utilisé ou inconnu → 401 ; format invalide → rejet DTO (`dto/totp-verify.dto.ts`).
- **Hors-ligne** : sans objet côté web ; en desktop embarqué, dépend de la présence du code en base locale (à confirmer selon le périmètre synchronisé de `CodeSecoursTotp`).
- **Critères** :
  - *Étant donné* un code de secours valide non utilisé, *quand* il le soumet, *alors* il est authentifié (`SUCCES_LOGIN_CODE_SECOURS`) et ce code ne peut plus resservir.

### CU-01-04 — Enrôlement de la 2FA

- **Acteur** : utilisateur authentifié sans 2FA active.
- **Déclencheur** : action « activer la double authentification » dans Paramètres.
- **Scénario nominal** : 1) `POST /me/totp/setup` → secret + URI `otpauth` à scanner ; 2) l'utilisateur scanne dans son application ; 3) `POST /me/totp/activate` avec un code valide → 2FA active + **8 codes de secours** affichés une seule fois.
- **Scénarios d'erreur** : 2FA déjà active → 400 ; code de validation invalide → 400 ; activation sans setup préalable → 400.
- **Hors-ligne** : non spécifié (opération de configuration nécessitant l'écriture du secret chiffré).
- **Critères** :
  - *Étant donné* un setup réalisé, *quand* l'utilisateur valide un code correct via `POST /me/totp/activate`, *alors* la 2FA passe active et 8 codes de secours hachés sont stockés et renvoyés une fois.

### CU-01-05 — Session unique et révocation immédiate

- **Acteur** : utilisateur se connectant depuis un nouveau poste interactif.
- **Déclencheur** : nouveau login interactif (sans `posteLocalId`).
- **Scénario nominal** : 1) la nouvelle session est créée ; 2) les autres sessions interactives du même utilisateur sont révoquées ; 3) un événement `SESSION_REVOKED` (SSE) déconnecte instantanément les anciens postes ; 4) au prochain appel, l'ancien token est rejeté par `JwtStrategy` (session révoquée).
- **Scénarios d'erreur** : émission SSE en échec → best-effort, n'empêche pas le login.
- **Hors-ligne** : les sessions de synchronisation (`posteLocalId`) sont **exemptées** et conservées (RM-01-08, [[registre_decisions]] D-021/D-020).
- **Critères** :
  - *Étant donné* une session interactive active, *quand* le même utilisateur se connecte ailleurs en interactif, *alors* la première session est révoquée et son prochain appel renvoie 401 « session expirée ou révoquée ».
  - *Étant donné* une session de synchronisation (`posteLocalId`), *quand* un login interactif survient, *alors* la session de synchronisation reste active.

### CU-01-06 — Changement de mot de passe

- **Acteur** : utilisateur authentifié.
- **Déclencheur** : action « changer mon mot de passe ».
- **Scénario nominal** : 1) `POST /auth/change-password` avec actuel + nouveau ; 2) vérification de l'actuel ; 3) application de la politique en vigueur (`PM-09`..`PM-13`) ; 4) enregistrement haché, levée de `motDePasseTemp`, journalisation.
- **Scénarios d'erreur** : mot de passe actuel erroné → 401 ; nouveau non conforme à la politique → erreur de validation.
- **Hors-ligne** : non spécifié (opération sensible nécessitant écriture).
- **Critères** :
  - *Étant donné* l'ancien mot de passe correct et un nouveau conforme, *quand* il appelle l'endpoint, *alors* il reçoit 204 et le marqueur `motDePasseTemp` repasse à faux.

### CU-01-07 — Gestion de ses sessions

- **Acteur** : utilisateur authentifié.
- **Déclencheur** : écran « Sessions » des paramètres.
- **Scénario nominal** : `GET /me/sessions` liste les sessions actives (avec localisation IP) ; l'utilisateur révoque une session (`DELETE /me/sessions/:id`) ou toutes les autres (`POST /me/sessions/revoke-others`).
- **Scénarios d'erreur** : session inexistante ou n'appartenant pas à l'utilisateur → 404.
- **Critères** :
  - *Étant donné* plusieurs sessions actives, *quand* l'utilisateur révoque les autres, *alors* seule sa session courante demeure.

---

## 5. Données du module

Le module ne définit pas son propre schéma : il agit sur des entités du modèle global ([[modele_donnees_global]]). Entités directement manipulées :

| Entité | Rôle dans le module |
|--------|---------------------|
| `Utilisateur` | Identité (login, `passwordHash`), statut (`ACTIF`/`BLOQUE`/`DESACTIVE`), compteurs `tentativesEchec`/`blocageMinutes`/`blocageJusquA`, `motDePasseTemp`, `siteId`, `personnelMedicalId`, `deletedAt`. |
| `UtilisateurRole`, `Role`, `RolePermission`, `Permission` | Source des rôles et permissions héritées (lecture). |
| `UtilisateurPermission` | Dérogations individuelles `GRANT`/`REVOKE` appliquées par `chargerPermissions`. |
| `SessionUtilisateur` | Session active (clé `sid`), `refreshTokenHash`, `ipAdresse`, `userAgent`, `expiresAt`, `revokedAt`, `posteLocalId`. |
| `ConfigurationTotp` | Secret TOTP **chiffré** (`secretChiffre`), `actif`, `activatedAt`. |
| `CodeSecoursTotp` | Codes de secours hachés, `utilise`, `utilisedAt`, rattachés à `configId`. |
| `PreferenceUtilisateur` | Préférences d'affichage + suivi d'acceptation CGU (`cguAccepteeLe`, `cguVersion`). |
| `JournalAuthentification` | Trace dédiée des tentatives d'authentification (distinct de `JournalAudit`). |
| `JournalAudit` | Cible des audits TOTP (`TOTP_ACTIVE`/`TOTP_DESACTIVE`). |

> Le détail des champs et relations est tenu dans [[modele_donnees_global]] (source unique). Ne pas redéfinir ici.

---

## 6. Règles métier

> Toute valeur chiffrée renvoie à [[parametres_metier]] ; aucune n'est en dur ici.

- **RM-01-01** — Réponse **générique** sur login inconnu ou compte supprimé (anti-énumération) : même message qu'un mot de passe erroné (EF-01-02).
- **RM-01-02** — Blocage de compte au seuil d'échecs `PM-07` ; durée du 1er blocage `PM-08`, **escaladée ×4** à chaque blocage successif ; un blocage expiré est automatiquement levé à la prochaine tentative.
- **RM-01-03** — Un login réussi réinitialise `tentativesEchec` et l'escalade de blocage.
- **RM-01-04** — Rate-limiting : `PM-04` sur login, `PM-05` sur vérification TOTP, plus le rate-limit global `PM-06` ; le refresh est limité à 30/min/IP (à inscrire comme variante de `PM-04`/`PM-05`, **à confirmer** comme PM dédié).
- **RM-01-05** — Durées de jetons : accès `PM-01` (configurable, lu en live dans les paramètres), rafraîchissement `PM-02`, jeton temporaire TOTP `PM-03`.
- **RM-01-06** — **Révocation immédiate** : tout token portant un `sid` n'est accepté que si sa session est présente, non révoquée et non expirée (EF-01-32). Exception backend embarqué SQLite (signature de confiance, [[registre_decisions]] D-020).
- **RM-01-07** — **Rotation** au refresh : l'ancienne session est révoquée et un nouveau couple de jetons est émis ; le `sid` rend chaque refresh token unique (évite la collision `bcrypt` au-delà de 72 octets).
- **RM-01-08** — **Session unique** appliquée aux seules sessions interactives (`posteLocalId` absent) ; les sessions de synchronisation desktop sont **exemptées** ([[registre_decisions]] D-021/D-020).
- **RM-01-09** — Permissions effectives = (rôles ∪ GRANT) − REVOKE, le REVOKE étant prioritaire (EF-01-35).
- **RM-01-10** — Secret TOTP **chiffré at-rest** (`PM-45`) avant tout stockage ; le secret en clair ne sert qu'à construire l'URI `otpauth` à l'enrôlement.
- **RM-01-11** — Code de secours TOTP **à usage unique** (marqué `utilise` à la consommation) ; 8 codes générés à l'activation, stockés hachés.
- **RM-01-12** — Politique de mot de passe **appliquée au changement** : longueur `PM-09`, exigences `PM-10`..`PM-13`, via `assertPasswordValid` (valeurs live des paramètres) ; hash `bcrypt`.
- **RM-01-13** — Vérification TOTP avec tolérance d'horloge ±30 s (`epochTolerance`).
- **RM-01-14** — Journalisation de l'authentification **non bloquante** : un échec d'écriture du journal ne casse jamais l'opération principale.
- **RM-01-15** — CGU versionnées : l'acceptation est rattachée à `CGU_VERSION` ; un bump de version re-déclenche la demande d'acceptation (cohérent front/back).

---

## 7. Interfaces

### 7.1 Ce que le module expose

| Contrat | Description | Référence |
|---------|-------------|-----------|
| **C-9** ([[plan_modules]]) | Authentification & autorisation : `SecurityModule` exporte `JwtAuthGuard`, `PermissionsGuard`, `RolesGuard` et `JwtModule`, consommés par tous les contrôleurs protégés. | `security.module.ts` (`exports`) |
| Endpoints publics `/auth` | `POST /auth/login`, `POST /auth/totp/verify`, `POST /auth/refresh` ; protégés : `POST /auth/change-password`, `POST /auth/logout`, `GET /auth/me`. | `security.controller.ts` |
| Endpoints self-service `/me` | préférences, CGU, sessions (liste/révocation), TOTP (statut/setup/activate/disable). | `me.controller.ts` |
| Décorateurs d'autorisation | `@RequirePermissions(...)`, `@Roles(...)`, `@CurrentUser()` consommés par les autres modules. | `common/decorators/*` |
| Événement temps réel `SESSION_REVOKED` | Émis vers `NotificationService` (SSE) lors d'une révocation par session unique. | `security.service.ts` (`pushSessionRevoked`) |

### 7.2 Ce que le module consomme

| Contrat | Description | Référence |
|---------|-------------|-----------|
| **C-10** ([[plan_modules]]) | Configuration système via `ParametresService` : seuils d'échecs/blocage (`PM-07`, `PM-08`), durée de session (`PM-01`), politique de mot de passe (`PM-09`..`PM-13`), nom/langue de l'établissement. | `parametres.service.ts` |
| `NotificationService` (résolu à l'exécution via `ModuleRef`) | Diffusion de `SESSION_REVOKED` ; résolution paresseuse pour éviter le cycle `Security ⇄ Notification`. | `security.service.ts` |
| `common/crypto/totp-secret` | `encryptSecret` / `decryptSecret` (AES-256-GCM, `PM-45`). | `me.service.ts`, `security.service.ts` |
| `common/geo` | `resolveGeo(ip)` pour la localisation affichée des sessions (`PM-44`). | `me.service.ts` |
| `otplib`, `bcrypt`, `@nestjs/jwt`, `@nestjs/throttler` | TOTP, hachage, signature JWT, rate-limiting. | divers |

### 7.3 Frontend correspondant

`apps/web/src/modules/auth/` : `LoginPage.tsx` (parcours 2 étapes login → TOTP, bascule code de secours, lien CGU), `hooks/useLogin.ts` (mutations login / vérif TOTP), `useRefreshSession.ts`, `useLogout.ts`, `useChangePassword.ts`, `ChangePasswordDialog.tsx`, `SessionBootstrap.tsx`. Schémas de saisie validés côté client (Zod) miroir des DTO backend.

---

## 8. Exigences non fonctionnelles spécifiques

- **Sécurité** : mots de passe et refresh tokens stockés **uniquement hachés** (`bcrypt`) ; secret TOTP **chiffré** (`PM-45`) ; codes de secours hachés et à usage unique ; anti-énumération (RM-01-01) ; rate-limiting (RM-01-04).
- **Révocation effective** : déconnexion au prochain appel (≤ une requête) côté central via vérification du `sid` (RM-01-06) ; hors-ligne, le jeton expire naturellement (≤ `PM-01`).
- **Offline-first / desktop** : le backend embarqué (SQLite) accepte les jetons signés par le central sans vérifier la session, pour la bascule online-first/offline-fallback ([[registre_decisions]] D-020) ; loopback uniquement.
- **Robustesse** : journalisation et notification SSE **best-effort** (jamais bloquantes) ; résolution paresseuse de `NotificationService` pour éviter les dépendances circulaires.
- **i18n** : écran de connexion et messages d'erreur bilingues FR/EN (`react-i18next`), conformément au brief [[_SOURCE_systeme]].
- **Traçabilité** : chaque tentative d'authentification est journalisée (`JournalAuthentification`) avec IP réelle et user-agent.

---

## 9. Risques et points ouverts

- **Nombre de rôles (D-003)** : divergence « 3 vs 4 » au catalogue ; existence du rôle `MEDECIN` **à confirmer** dans `packages/types/src/permissions.ts`. Sans impact sur la mécanique d'autorisation (le module lit les rôles présents), mais à régulariser pour la cohérence documentaire.
- **Rate-limit du refresh** : valeur 30/min/IP codée dans `security.controller.ts` sans `PM` dédié → **à confirmer** comme paramètre métier référencé (RM-01-04).
- **Codes de secours en mode desktop** : disponibilité des `CodeSecoursTotp` sur un poste embarqué hors-ligne dépend du périmètre synchronisé (CU-01-03) — **à confirmer**.
- **Backend embarqué sans vérification de session (D-020)** : la révocation immédiate n'est pas effective hors-ligne (le jeton reste valide jusqu'à expiration `PM-01`) ; compromis assumé, sécurité reposant sur le central et le loopback.
- **`RolesGuard` legacy** : marqué « à éviter » au profit des permissions ; risque d'incohérence si des routes en dépendent encore. À auditer côté contrôleurs consommateurs.
- **Réduction prévue d'`ADMIN_SYSTEME` (D-004)** : l'accès clinique complet est temporaire ; sans effet sur ce module mais à garder en tête pour la cohérence des permissions injectées.
- **Anciens tokens sans `sid`** : tolérés en rétro-compat (EF-01-23) avec une boucle de comparaison imparfaite ; résiduel jusqu'à expiration des sessions historiques.
