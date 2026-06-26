# Document 02 - Sécurité, Administration et Audit

> **État de réalisation : INTÉGRALEMENT CODÉ ET FONCTIONNEL (as-built).**
> Ce document décrit l'implémentation réelle de la plateforme CMS SARIS, vérifiée
> sur le code source (back-end NestJS 11, front-end React 19, base PostgreSQL via
> Prisma 6). Sauf mention explicite « extension future », chaque fonctionnalité
> décrite ci-dessous est livrée, testée et opérationnelle.

## 1. Objectif

Garantir que seules les personnes autorisées accèdent au système, que leurs droits
sont contrôlés au plus fin et que les actions sensibles restent traçables de bout
en bout. La sécurité de CMS SARIS repose sur quatre piliers complémentaires :

1. **Authentification forte** : mot de passe haché (bcrypt), double authentification
   TOTP avec codes de secours, blocage progressif et géolocalisation des connexions.
2. **Autorisation granulaire (RBAC + dérogations)** : 110 permissions, 6 rôles
   métier, dérogations individuelles GRANT/REVOKE, cloisonnement multi-site.
3. **Traçabilité persistante** : journal d'audit métier alimenté automatiquement,
   journal d'authentification distinct, conservés en base et non modifiables par
   l'interface.
4. **Protection en profondeur** : chiffrement au repos (AES-256-GCM) avec rotation
   de clés, durcissement des entrées (validation stricte, rate-limiting par
   utilisateur, anti-IDOR, contrôle de signature des fichiers), en-têtes HTTP de
   sécurité et conformité tracée (CGU versionnées).

## 2. Acteurs concernés

- **Administrateur système** (`ADMIN_SYSTEME`) : super-administrateur. Accès complet
  au catalogue (les 110 permissions), gouvernance système **et** supervision de
  l'activité clinique. Choix assumé pour ce déploiement.
- **Administrateur médical** (`ADMIN_MEDICAL`) : gouvernance clinique. Contrôle total
  des référentiels, du personnel et des sous-traitants, lecture seule de l'activité
  clinique et de l'audit.
- **Médecin-chef, infirmier, infirmier délégué, agent RH** : rôles métier consommant
  les modules cliniques et administratifs selon leur périmètre.
- **Tous les utilisateurs connectés** : disposent d'une base commune (messagerie
  interne, notifications) et gèrent leur propre compte (préférences, sessions, 2FA).

> *Remarque* : il n'existe pas de rôle « Auditeur » dédié. La consultation des
> journaux est gouvernée par la permission `audit.read`, attribuée par défaut à
> `ADMIN_SYSTEME` et `ADMIN_MEDICAL`, et attribuable à tout rôle ou utilisateur via
> les dérogations.

## 3. Données manipulées

L'implémentation s'appuie sur un schéma Prisma de **79 tables** (PostgreSQL).
Les modèles directement liés à la sécurité, l'administration et l'audit sont :

| Modèle Prisma | Rôle |
|---|---|
| `Utilisateur` | Compte : login unique, `passwordHash` (bcrypt), `statut`, compteurs de blocage, lien personnel médical, site |
| `PreferenceUtilisateur` | Préférences (thème, densité, langue, page d'accueil, lignes/page, notif. e-mail) **+ acceptation CGU** (`cguAccepteeLe`, `cguVersion`) |
| `Role` | Rôles d'accès |
| `Permission` | Catalogue des permissions modulaires |
| `UtilisateurRole` | Liaison N-N utilisateurs ↔ rôles |
| `RolePermission` | Liaison N-N rôles ↔ permissions |
| `UtilisateurPermission` | Dérogations individuelles (mode `GRANT`/`REVOKE`, motif, auteur, horodatage) |
| `SessionUtilisateur` | Sessions actives : `refreshTokenHash`, IP, user-agent, expiration, révocation |
| `ConfigurationTotp` | Configuration 2FA : secret **chiffré**, état actif, date d'activation |
| `CodeSecoursTotp` | Codes de secours TOTP (hachés bcrypt, usage unique, horodaté) |
| `JournalAudit` | Audit métier : auteur, action, module, type/identifiant d'entité, IP, statut, date |
| `JournalAuthentification` | Journal des connexions : login, résultat, IP, user-agent, date |
| `AlerteAnomalie` | Détection d'anomalies / comportements suspects |
| `ParametreSysteme` | Paramètres techniques (sauvegarde, etc.) |
| `ParametreMetier` / `HistoriqueParametreMetier` | Paramètres métier clé-valeur + historisation |
| `AlerteTechnique` | Alertes système / infrastructure |

## 4. Processus principal

1. L'administrateur crée un utilisateur (login, identité, site de rattachement,
   mot de passe initial). Le lien vers une fiche `PersonnelMedical` est requis.
2. Il attribue un ou plusieurs rôles, et au besoin des dérogations individuelles
   (GRANT/REVOKE) avec motif.
3. L'utilisateur se connecte avec identifiant et mot de passe.
4. Si la 2FA est activée sur son compte, le système exige un code TOTP (ou un
   code de secours).
5. Une session est créée : un **token d'accès JWT** (durée de vie = paramètre
   `auth.session_timeout_minutes`) et un **refresh token** (7 jours, haché en base,
   rotation à chaque renouvellement).
6. Les permissions effectives sont calculées et embarquées dans le JWT, puis
   appliquées à la fois dans l'interface (masquage/désactivation) et côté serveur
   (gardes NestJS).
7. Les actions sensibles (mutations) sont journalisées automatiquement dans
   `JournalAudit` ; les événements d'authentification dans `JournalAuthentification`.
8. Les tentatives interdites ou anomalies génèrent une trace et, le cas échéant,
   une alerte.

## 5. Cas alternatifs

- **Mot de passe incorrect** : tentative journalisée (`JournalAuthentification`,
  résultat d'échec), compteur d'échecs incrémenté.
- **Trop de tentatives** : blocage progressif (escalade dynamique, voir §6.2). Le
  compte passe en statut `BLOQUE` pour une durée croissante.
- **Perte du TOTP** : utilisation d'un code de secours, ou réinitialisation/désactivation
  de la 2FA par un administrateur après vérification d'identité.
- **Départ utilisateur** : compte désactivé (`DESACTIVE`) et sessions révoquées
  (révocation unitaire ou en masse).
- **Action interdite** : blocage HTTP (401/403), message clair, et trace d'audit
  en statut `ERREUR` si la route est auditée.
- **Réseau dégradé** : la plateforme étant offline-first (PWA), les écritures sont
  mises en file de rejeu locale ; les routes `/auth` et `/notifications` en sont
  exclues (jamais rejouées hors-ligne).

## 6. Règles métier

### 6.1 Règles générales

- Un utilisateur ne peut pas accéder au système sans compte actif.
- Un compte désactivé ne peut pas ouvrir de session.
- Les mots de passe ne sont **jamais** stockés en clair : hachage **bcrypt à 12
  tours** (refresh tokens hachés à 10 tours).
- La 2FA TOTP est disponible et activable par chaque utilisateur ; son secret est
  **chiffré au repos** (AES-256-GCM).
- Une session expire automatiquement à l'échéance du token d'accès, dont la durée
  est pilotée par le paramètre système `auth.session_timeout_minutes`.
- Toute action critique (mutation) sur un domaine audité est tracée.
- Le journal d'audit n'est jamais modifiable par l'interface : seuls l'intercepteur
  d'audit et les écritures explicites des services d'administration y écrivent
  (règle R-SEC-018) ; aucune route d'écriture publique ne l'expose.
- `ADMIN_SYSTEME` est un super-administrateur assumé : il dispose de l'ensemble du
  catalogue, y compris la lecture/action clinique, afin de piloter et superviser la
  plateforme.

### 6.2 Blocage progressif (escalade dynamique)

Le blocage de compte suit une escalade calculée côté serveur :

- 1er blocage = paramètre `auth.duree_blocage_minutes`.
- À chaque blocage suivant, la durée est **multipliée par 4**.
- Le seuil de déclenchement est le paramètre `auth.tentatives_max`.
- Un login réussi remet le compteur d'échecs **et** l'escalade à zéro (ardoise
  propre).

### 6.3 Permissions effectives

La permission effective d'un utilisateur est calculée par la formule :

> **(permissions héritées des rôles ∪ dérogations GRANT) − dérogations REVOKE**

Le REVOKE est appliqué en dernier et l'emporte toujours. Des garde-fous empêchent
de se retirer un droit vital (p. ex. ne pas pouvoir supprimer le dernier
administrateur).

## 7. États et statuts

**Compte utilisateur** :

- `ACTIF`
- `BLOQUE`
- `DESACTIVE`

> *Note d'implémentation* : le statut « SUSPENDU » du cahier initial n'est pas
> distingué en base ; la suspension fonctionnelle est obtenue par `DESACTIVE`.

**Session** :

- `ACTIVE`
- `EXPIREE` (échéance du token d'accès / refresh atteinte)
- `REVOQUEE` (révocation explicite, unitaire ou en masse)

**Alerte d'anomalie** :

- `OUVERTE`
- `EN_COURS_INVESTIGATION`
- `RESOLUE`

## 8. Écrans attendus

Tous les écrans ci-dessous sont **implémentés** (front-end React) :

- Connexion (`LoginPage`).
- Vérification TOTP (au login, après mot de passe correct).
- **Mon compte** : préférences, sessions actives + géolocalisation, configuration
  2FA (activation/désactivation, codes de secours), acceptation des CGU.
- Gestion des utilisateurs (`UtilisateursPage`) : liste, création (`CreerUtilisateurDrawer`),
  détail (`UtilisateurDrawer`), dérogations en masse (`BulkPermissionDrawer`).
- Rôles et permissions (`RolesPage`) : matrice rôles ↔ permissions.
- Journal d'audit + journal d'authentification (`AuditPage`).
- Paramètres système (`ParametresPage` : onglets Généraux, Personnel…).
- Synchronisation & sauvegardes (`SynchronisationPage`).

> Les « Alertes techniques » disposent d'un modèle de données (`AlerteTechnique`,
> `AlerteAnomalie`) ; leur écran de supervision dédié relève des extensions futures.

## 9. Notifications et alertes

Les notifications sont diffusées **en temps réel** via un flux SSE
(`/notifications/stream`), avec présence en ligne, accusés de lecture et
invalidation automatique des données côté client. Les événements concernés par ce
module incluent :

- Compte bloqué.
- Connexion (succès / échec journalisé).
- Révocation de session.
- Succès / échec de sauvegarde de configuration.
- Anomalie d'audit / alerte technique.

Caractéristiques de la couche notifications :

- Types : clinique, sortie, administratif, système ; niveaux `INFO`, `SUCCES`,
  `AVERTISSEMENT`, `CRITIQUE`.
- Ciblage individuel (`destinataireId`) ou diffusion filtrée par site et permission
  requise (une annonce n'est visible que si l'utilisateur possède la permission).
- État « lu » par utilisateur, suppression « pour moi », rétention en base
  (paramétrable, défaut 30 jours).
- Permissions associées : `notification.read`, `notification.update`,
  `notification.delete` ; émission d'annonces réservée à `ADMIN_SYSTEME`
  (`notification.create`).

## 10. Permissions

### 10.1 Catalogue (110 permissions)

Le système déclare **110 permissions granulaires** au format `module.action`,
réparties par domaine fonctionnel :

| Domaine | Exemples de permissions |
|---|---|
| Tableau de bord | `dashboard.read` |
| Patient | `patient.read/create/update/delete/archive/merge/change_category/rattachement.manage` |
| Visite / Triage | `visite.read/create/update/cancel/close/delete/assign_soignant` |
| Consultation | `consultation.read/create/update/close/cancel/delete/diagnose/examen` |
| Ordonnance | `ordonnance.read/create/validate/cancel/print` |
| Bon d'examen | `bon_examen.read/create/validate/cancel/delete/result` |
| Suivi chronique | `suivi_chronique.read/create/update/close/cancel/delete` |
| Évacuation | `evacuation.read/create/update/cancel/close/delete` |
| Accident du travail | `accident_travail.read/create/update/cancel/close/delete` |
| Référentiels | `referentiel.read` + création/édition/suppression **par service** (site, motif, pathologie, médicament, catégorie, examen) |
| Personnel | `personnel.read/create/update/delete` |
| Sous-traitants | `sous_traitant.read/create/update/delete` |
| Délégations | `delegation.read/create/update/revoke/delete` |
| Utilisateurs | `utilisateur.read/create/update/delete/reset_password/assign_role/manage_permissions` |
| Rôles | `role.read/create/update/delete` |
| Audit | `audit.read` |
| Paramètres | `parametre.read/update` |
| Synchronisation | `synchronisation.read/execute/restore` |
| Notifications | `notification.read/create/update/delete` |
| Messagerie | `messagerie.read/create/update/delete` |

La granularité des référentiels est volontairement fine : l'écriture est séparée
**par service** (p. ex. accorder la création de motifs sans donner accès aux sites
ou aux médicaments).

### 10.2 Rôles par défaut (6 rôles)

| Rôle | Périmètre |
|---|---|
| `ADMIN_SYSTEME` | **Tout le catalogue** (110 permissions) : gouvernance système + activité clinique |
| `ADMIN_MEDICAL` | Référentiels (contrôle total), personnel, sous-traitants, délégations ; lecture clinique et `audit.read` |
| `MEDECIN_CHEF` | Pleins droits cliniques (patients, triage, consultation, prescription, sorties critiques, suivi) + enrichissement référentiel à la volée |
| `INFIRMIER` | Triage uniquement (pas de prescription), saisie d'examen/constantes, résultats de bons d'examen |
| `INFIRMIER_DELEGUE` | Triage + prescription limitée sous délégation |
| `AGENT_RH` | Personnel, sous-traitants, rattachements administratifs (ayants droit, sous-traitants) |

Une **base commune (baseline)** est ajoutée à tous les rôles, y compris ceux créés
ultérieurement : `notification.read/update` et `messagerie.read/create/update/delete`
(chacun gère ses propres notifications et messages).

### 10.3 Tableau de gouvernance synthétique

| Action | Autorisé (par défaut) |
|---|---|
| Créer un utilisateur | `ADMIN_SYSTEME` (`utilisateur.create`) |
| Modifier un rôle / la matrice permissions | `ADMIN_SYSTEME` (`role.update`) |
| Dérogation individuelle GRANT/REVOKE | `ADMIN_SYSTEME` (`utilisateur.manage_permissions`) |
| Modifier les référentiels métier | `ADMIN_MEDICAL`, `ADMIN_SYSTEME` |
| Consulter l'audit complet | `audit.read` (`ADMIN_SYSTEME`, `ADMIN_MEDICAL`) |
| Modifier les paramètres système | `parametre.update` (`ADMIN_SYSTEME`) |
| Lancer / restaurer une sauvegarde | `synchronisation.execute` / `synchronisation.restore` |
| Révoquer une session | `ADMIN_SYSTEME`, ou l'utilisateur pour ses propres sessions |
| Modifier des données médicales | Hors de ce module (gouverné par les rôles cliniques) |

## 11. Authentification (détails d'implémentation)

- **JWT** : token d'accès signé (TTL = `auth.session_timeout_minutes`, configurable
  à chaud) + refresh token (7 jours). Le payload embarque `sub`, `siteId`, rôles,
  permissions effectives, `personnelMedicalId` et l'identifiant de session.
- **bcrypt** : 12 tours pour les mots de passe, 10 tours pour les refresh tokens
  stockés (jamais en clair).
- **TOTP (otplib)** : 2FA par utilisateur. Le secret est chiffré au repos
  (AES-256-GCM, clé dérivée par scrypt depuis `TOTP_ENC_KEY`). Format de stockage
  versionné (`v1:…`), rétro-compatible avec un éventuel secret non chiffré.
- **Codes de secours** : générés à l'activation, présentés à l'utilisateur, **hachés
  bcrypt** en base, usage unique et horodaté. Format normalisé « XXXX-XXXX ».
- **Sessions** : table `SessionUtilisateur` (IP, user-agent, expiration, révocation),
  révocation sélective ou « toutes les autres sessions ».
- **IP réelle & géolocalisation** : prise en charge du reverse-proxy (`trust proxy`,
  variable `TRUST_PROXY`), résolution ville/région/pays/coordonnées via service
  externe avec **repli hors-ligne `geoip-lite`** et cache 1 h par IP.

## 12. Audit et traçabilité (détails d'implémentation)

- **Intercepteur global** (`AuditInterceptor`, `APP_INTERCEPTOR`) : journalise
  automatiquement chaque **mutation** (POST/PATCH/PUT/DELETE) sur les routes
  annotées `@Audit('module', 'EntiteType')`. Une entrée `JournalAudit` est créée
  avec auteur, action (`CREATE`/`UPDATE`/`DELETE`), module, type et identifiant
  d'entité, IP et statut (`SUCCES`/`ERREUR`).
- **Best-effort** : l'échec d'écriture du journal n'altère jamais la requête métier.
- **Couverture** : décorateur appliqué sur les controllers cliniques et de
  configuration (patient, triage, consultation, bon d'examen, sorties critiques,
  référentiels, personnel, sous-traitants, délégations…).
- **Journal d'authentification distinct** (`JournalAuthentification`) : login/logout,
  vérification TOTP, code de secours, avec résultat, IP et user-agent.
- **Recherche** : filtres sur module, action, utilisateur, type/identifiant d'entité,
  plage de dates (bornes inclusives), résultats plafonnés (max 500, défaut 100).

## 13. Chiffrement et rotation de clés

- **Messagerie interne (au repos)** : contenu des messages **et** pièces jointes
  chiffrés en **AES-256-GCM**. Format stocké versionné : `v2:<keyId>:<iv>:<tag>:<ct>`,
  avec déchiffrement rétro-compatible du format legacy `v1`.
- **Trousseau de clés (rotation/versioning)** : plusieurs clés coexistent
  (`MESSAGE_ENC_KEYS`, ou fichier secret `MESSAGE_ENC_KEYS_FILE` compatible
  Vault/Kubernetes). La clé de **chiffrement courante** est sélectionnable
  (`MESSAGE_ENC_KEY_CURRENT`) ; les anciennes restent utilisables pour déchiffrer.
- **Outil de ré-encryption** : endpoint `POST /synchronisation/messagerie/rechiffrer`
  (permission `synchronisation.execute`) ré-encrypte progressivement les messages
  vers la clé courante après une rotation, de façon idempotente et non destructive.
- **Secret TOTP** : également chiffré en AES-256-GCM (clé dérivée scrypt).

> *Note d'exploitation* : la ré-encryption de masse n'a pas vocation à être lancée
> tant qu'aucune rotation réelle de clé n'a lieu ; l'outil est prêt et testé.

## 14. Durcissement (protection en profondeur)

- **En-têtes HTTP** : `helmet` (CSP, HSTS, X-Frame-Options, etc.).
- **CORS** : restreint au front-end (`FRONTEND_URL`), credentials activés.
- **Validation globale** : `ValidationPipe` en mode `whitelist` +
  `forbidNonWhitelisted` + `transform` (défense contre l'injection de champs et le
  mass-assignment).
- **Rate-limiting** : throttler global à 100 requêtes/min ; sur la messagerie,
  rate-limiting **par utilisateur** (`UserThrottlerGuard`) — 150 lectures/min et
  **40 envois/min** (anti-flood).
- **Anti-IDOR (cross-site)** : cloisonnement par `siteId` ; les messages d'erreur
  sont uniformes (« Destinataire introuvable ») afin de ne pas révéler l'existence
  de comptes inter-sites.
- **Sanitisation des fichiers** : noms de fichiers nettoyés (anti path-traversal,
  caractères de contrôle, longueur bornée) ; **vérification de signature binaire
  (magic bytes)** rejetant les exécutables déguisés (PE/DOS, ELF, Mach-O, scripts
  shell), indépendamment du type MIME déclaré.
- **Liste blanche MIME** + limites (10 fichiers, 16 Mo/fichier, traitement en
  mémoire) pour les pièces jointes.

## 15. Conformité — Conditions d'utilisation (CGU)

- Version serveur : `CGU_VERSION` (actuellement `v1-2026.06`).
- Acceptation tracée dans `PreferenceUtilisateur` (`cguAccepteeLe`, `cguVersion`).
- **Porte bloquante** : l'utilisateur doit accepter les CGU à jour ; à chaque
  incrément de version, l'acceptation est redemandée au prochain login.
- Endpoints `GET /me/cgu` (statut) et `POST /me/cgu/accept` ; écran `ConditionsModal`
  (au login et accessible depuis les paramètres).

## 16. Sauvegarde et restauration (configuration)

- **Périmètre** : sauvegarde de la **configuration uniquement** (référentiels,
  matrice rôles ↔ permissions, paramètres). Les **données cliniques/patients ne
  sont JAMAIS incluses** (confidentialité et intégrité).
- **Snapshot** : contenu JSON horodaté, avec taille calculée.
- **Restauration non destructive** : réapplication par upsert (les valeurs sont
  réécrites, rien n'est effacé en cascade).
- **Automatisation** : cron quotidien (`@nestjs/schedule`, 02h00) + rétention des
  30 dernières sauvegardes.
- **Permissions** : `synchronisation.read` (consulter), `synchronisation.execute`
  (lancer/ré-encrypter), `synchronisation.restore` (restaurer).

## 17. Dépendances

- **Tous les modules dépendent de la sécurité** : chaque route protégée passe par
  `JwtAuthGuard`, `PermissionsGuard` et, le cas échéant, `RolesGuard`.
- **L'audit reçoit des événements de tous les modules** via l'intercepteur global.
- **Le cloisonnement multi-site** (`siteId` du JWT) restreint l'ensemble des
  requêtes métier (triage, consultation, patient, sorties critiques, messagerie…).
- **Les alertes techniques / la synchronisation** alimentent la supervision et les
  notifications temps réel (SSE).

### Stack technique de référence

| Couche | Technologie |
|---|---|
| Back-end | NestJS 11, Prisma 6, PostgreSQL |
| Authentification | Passport JWT, `@nestjs/jwt`, otplib (TOTP), bcrypt |
| Sécurité HTTP | helmet, `@nestjs/throttler`, `class-validator` |
| Géolocalisation | service externe + `geoip-lite` (repli hors-ligne) |
| Temps réel | SSE (`@Sse`) + RxJS |
| Planification | `@nestjs/schedule` (`@Cron`) |
| Front-end | React 19, Vite 7, TanStack Query, Zustand, Tailwind CSS v4 |
| Offline / PWA | `vite-plugin-pwa` (Workbox), Dexie (IndexedDB), file de rejeu |

## 18. Critères d'acceptation

- Un utilisateur sans permission ne peut pas accéder à un écran ou à une route
  protégée (contrôle UI **et** serveur). ✅
- Une action interdite est bloquée (401/403) et tracée (audit `ERREUR` si route
  auditée). ✅
- Une session expire à l'échéance du token (durée pilotée par paramètre). ✅
- Un compte désactivé est immédiatement inutilisable. ✅
- Les mutations critiques apparaissent dans `JournalAudit` ; les connexions dans
  `JournalAuthentification`. ✅
- La 2FA TOTP s'active, se vérifie au login et accepte les codes de secours. ✅
- Les CGU non à jour bloquent l'accès tant qu'elles ne sont pas acceptées. ✅
- Les secrets sensibles (mots de passe, refresh tokens, secret TOTP, messages,
  pièces jointes) ne sont jamais stockés en clair. ✅

## 19. Points de risque et limites connues

- Une granularité de permissions très fine (110 permissions) peut complexifier
  l'administration ; les rôles par défaut et les dérogations en masse l'atténuent.
- Un volume d'audit important peut ralentir les recherches ; les requêtes sont
  optimisées (filtres, bornes de dates, plafond à 500 résultats).
- Le TOTP peut bloquer un utilisateur en cas de perte de l'appareil : les codes de
  secours et la désactivation par un administrateur constituent la procédure de
  secours.
- **Couverture de tests automatisés limitée** : seuls quelques tests E2E existent
  (santé, 401 sans token) ; pas de tests unitaires/d'intégration à ce stade. La
  vérification s'appuie largement sur le typage strict (TypeScript) et les essais
  manuels de bout en bout.
- **Internationalisation** : interface en français codé en dur (dictionnaire
  centralisé `labels.ts`), sans système i18n dynamique — extension future.
- **Rotation de clé en production** : l'outillage est prêt et testé ; la ré-encryption
  de masse reste à exécuter le jour d'une rotation réelle.

## 20. Hors périmètre (extensions futures)

Restent volontairement hors du périmètre de ce module et de l'application actuelle :

- Écran de supervision dédié des alertes techniques / anomalies (modèles présents,
  IHM à venir).
- Authentification fédérée (SSO/OIDC), politiques de mot de passe avancées
  (historique, expiration forcée).
- Internationalisation multilingue dynamique.
- Audit immuable externalisé (WORM / SIEM) et signatures cryptographiques des
  entrées de journal.
- Tests automatisés exhaustifs (unitaires/intégration) et audit d'accessibilité
  formel (WCAG).
