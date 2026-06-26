# Sécurité — JWT, bcrypt, TOTP, RBAC, audit et chiffrement

> Document « as-built » : il décrit la sécurité **réellement implémentée** dans le code
> (`apps/api/src/...`), vérifiée fichier par fichier. La défense en profondeur du CMS SARIS
> repose sur huit piliers : authentification multi-facteurs, contrôle d'accès granulaire (RBAC),
> audit persistant, chiffrement au repos, durcissement de la messagerie, durcissement HTTP,
> traçabilité IP/géo et conformité (CGU).

---

## 0. Vue d'ensemble

| Pilier | Mécanisme | Implémentation principale |
|---|---|---|
| **Authentification** | JWT (access + refresh) + 2FA TOTP + codes de secours | `modules/security/security.service.ts` |
| **Mots de passe** | bcrypt (12 rounds) + politique paramétrable + blocage à escalade | `security.service.ts`, `parametres.service.ts` |
| **Autorisation (RBAC)** | 110 permissions granulaires, 6 rôles, dérogations individuelles | `packages/types/src/permissions.ts`, guards NestJS |
| **Audit** | Journal des mutations + journal des authentifications | `common/interceptors/audit.interceptor.ts`, `modules/admin/audit.service.ts` |
| **Chiffrement au repos** | AES-256-GCM (secrets TOTP, messages, pièces jointes) | `common/crypto/totp-secret.ts`, `common/crypto/message-crypto.ts` |
| **Durcissement messagerie** | Rate-limit, sanitize fichiers, magic-bytes, cloisonnement site | `modules/messagerie/messagerie.controller.ts` |
| **Durcissement HTTP** | Helmet, CORS strict, `ValidationPipe` global, `trust proxy` | `apps/api/src/main.ts` |
| **Conformité** | Conditions d'utilisation versionnées (porte bloquante) | `modules/security/me.service.ts` |

---

## 1. Stratégie d'authentification

### 1.1 Flux complet (avec 2FA)

```
[Utilisateur] ── POST /auth/login { login, password }
                     │
                     ▼
        [bcrypt.compare(password, passwordHash)]
                     │
        ┌────────────┴─────────────┐
        │                          │
   TOTP désactivé             TOTP activé
        │                          │
        ▼                          ▼
{ requireTotp: false,    { requireTotp: true,
  accessToken,             tempToken }      ← validité 5 min
  refreshToken, user }            │
                                  ▼
              [Utilisateur] ── POST /auth/totp/verify { code, tempToken }
                                  │
                     [otplib verifySync — ±30 s  OU  code de secours bcrypt]
                                  │
                                  ▼
                   { accessToken, refreshToken, user }
```

> **Anti-énumération** : un login inconnu et un mot de passe erroné renvoient le même message
> générique (« Identifiant ou mot de passe incorrect »). Chaque tentative est journalisée
> (succès comme échec) dans `JournalAuthentification`.

### 1.2 Endpoints d'authentification réellement exposés

| Route | Méthode | Garde | Rôle |
|---|---|---|---|
| `/auth/login` | POST | publique | Identification login + mot de passe |
| `/auth/totp/verify` | POST | publique (tempToken) | Vérification 2FA (code TOTP ou code de secours) |
| `/auth/refresh` | POST | publique (refresh token) | Renouvellement du couple de tokens (rotation) |
| `/auth/change-password` | POST | `JwtAuthGuard` | Changement de son propre mot de passe |
| `/auth/logout` | POST | `JwtAuthGuard` | Révocation de toutes ses sessions |
| `/auth/me` | GET | `JwtAuthGuard` | Profil + permissions effectives (données fraîches DB) |

La gestion fine du compte (préférences, sessions, 2FA, CGU) est exposée séparément sous `/me/*`
(cf. §6 et §8).

---

## 2. JWT — Tokens d'accès

### 2.1 Pourquoi JWT (et non des sessions serveur classiques)

Les sessions serveur (cookie + stockage central) sont mal adaptées à une architecture
**offline-first** : un poste sans connexion ne peut interroger le serveur pour valider une
session. Le JWT est auto-porteur — sa validité (signature, expiration) se vérifie sans appel
réseau. Le contrôle d'accès s'appuie sur les **permissions embarquées** dans le token, ce qui
évite une requête base de données à chaque appel.

### 2.2 Structure réelle du payload

```typescript
// Payload signé (apps/api/src/modules/security/security.service.ts → creerSession)
interface JwtPayload {
  sub:                string          // userId (UUID)
  siteId:             string          // site de rattachement (cloisonnement multi-site)
  roles:              string[]        // ex. ['INFIRMIER'] (un utilisateur peut cumuler des rôles)
  permissions:        string[]        // permissions EFFECTIVES, pré-calculées (rôles ∪ GRANTs − REVOKEs)
  personnelMedicalId: string | null   // lien vers la fiche personnel (signature des actes)
  sid:                string          // identifiant de session (= clé primaire de SessionUtilisateur)
  iat:                number          // émis le
  exp:                number          // expiration
}
```

> Le champ `sid` lie chaque token à une ligne `SessionUtilisateur` précise, ce qui rend la
> révocation et le suivi des sessions possibles malgré l'aspect auto-porteur du JWT.

### 2.3 Durées de vie (paramétrables)

| Token | Durée | Source |
|---|---|---|
| **Access token** | paramètre système `auth.session_timeout_minutes` (défaut **480 min = 8 h**, bornes 5 min – 7 j) | live, lu à chaque création de session |
| **Refresh token** | **7 jours** (`REFRESH_TOKEN_TTL`), stocké **haché** (`SessionUtilisateur.refreshTokenHash`) | constante service |
| **Token temporaire TOTP** | **5 minutes** (`TEMP_TOKEN_TTL`) | constante service |

La durée du token d'accès n'est **pas** codée en dur : elle est relue dans les paramètres
système (`ParametresService`) à chaque connexion, ce qui permet à un administrateur de durcir
ou d'assouplir le timeout sans redéploiement.

### 2.4 Rotation du refresh token

À chaque appel `/auth/refresh`, l'ancienne session est révoquée (`revokedAt = now()`) et une
**nouvelle** session est créée avec un refresh token neuf. Un refresh token rejoué ne
correspond plus à aucune session active → `401`. Seul le **hash bcrypt** du refresh token est
conservé en base : le token brut n'est jamais stocké.

---

## 3. bcrypt — Hachage des mots de passe

### 3.1 Configuration

```typescript
// apps/api/src/modules/security/security.service.ts
await bcrypt.hash(nouveauMotDePasse, 12)   // mots de passe utilisateur : 12 rounds
await bcrypt.hash(refreshToken, 10)        // refresh tokens : 10 rounds
```

Le facteur 12 (~300 ms par hash) ralentit fortement les attaques par force brute. Les **codes
de secours TOTP** sont eux aussi hachés via bcrypt (10 rounds) — jamais stockés en clair.

### 3.2 Politique de mot de passe (paramétrable, double contrôle)

La politique est **lue en direct** dans les paramètres système et appliquée côté serveur par
`ParametresService.assertPasswordValid()` :

| Paramètre | Défaut | Bornes |
|---|---|---|
| `mdp.longueur_min` | 8 | 8 – 64 |
| `mdp.exiger_majuscule` | oui | booléen |
| `mdp.exiger_minuscule` | oui | booléen |
| `mdp.exiger_chiffre` | oui | booléen |
| `mdp.exiger_special` | oui | booléen |

La validation est faite **deux fois** : côté frontend (feedback immédiat) et côté backend
(autorité finale, via `assertPasswordValid` + `ValidationPipe` global). Un changement de mot de
passe lève automatiquement le flag `motDePasseTemp`.

### 3.3 Blocage de compte à escalade dynamique

Après `auth.tentatives_max` échecs consécutifs (défaut **5**, bornes 3 – 10), le compte passe à
l'état `BLOQUE`. La durée du blocage **augmente à chaque récidive** :

```
1er blocage : auth.duree_blocage_minutes (défaut 15 min)
puis  : durée ← durée × 4   (escalade)
```

Le compteur (`tentativesEchec`) et l'escalade (`blocageMinutes`) sont remis à zéro à la
première connexion réussie. Une fois le délai expiré, le compte se débloque automatiquement
tout en conservant l'historique d'escalade.

---

## 4. TOTP — Authentification à deux facteurs

### 4.1 Bibliothèque

`otplib` (v13.4.0) implémente le standard **TOTP (RFC 6238)** — compatible Google
Authenticator, Authy, etc. La 2FA est **auto-hébergée et activée par l'utilisateur lui-même**
depuis ses paramètres (cf. §6).

### 4.2 Cycle d'activation (`/me/totp/*`)

```typescript
// 1. Setup — génère le secret + l'URI otpauth (QR code), sans activer
const secret      = generateSecret()
const secretChiffre = encryptSecret(secret)                 // chiffré AVANT stockage (AES-256-GCM)
const otpauthUrl  = generateURI({ secret, issuer, label: user.login, strategy: 'totp' })

// 2. Activate — vérifie un code, active la 2FA, génère 8 codes de secours
const { valid } = verifySync({ token: code, secret: decryptSecret(cfg.secretChiffre),
                               strategy: 'totp', epochTolerance: 30 })
// codes de secours : 8 codes lisibles « XXXX-XXXX », hachés bcrypt, affichés UNE seule fois

// 3. Disable — désactive après vérification d'un code valide (purge des codes de secours)
```

> **L'`issuer` du QR code** reprend le nom de l'établissement (`etab.nom`) configuré dans les
> paramètres, avec repli sur « CMS SARIS ».

### 4.3 Vérification à la connexion

```typescript
// apps/api/src/modules/security/security.service.ts → verifyTotp
const { valid } = verifySync({
  token:          dto.code,
  secret:         decryptSecret(user.configTotp.secretChiffre),   // déchiffré à la volée
  strategy:       'totp',
  epochTolerance: 30,                                              // ±30 s (décalage d'horloge)
})
```

La saisie peut être **soit** un code TOTP à 6 chiffres, **soit** un code de secours. Un code de
secours est comparé via bcrypt à la liste des codes non utilisés puis marqué **à usage unique**
(`utilise = true`, `utilisedAt`). L'événement est journalisé distinctement
(`SUCCES_LOGIN_TOTP` vs `SUCCES_LOGIN_CODE_SECOURS`).

### 4.4 Chiffrement at-rest du secret TOTP

Le secret TOTP est la clé maîtresse de la 2FA : une fuite de base le compromettrait. Il est
donc **chiffré AES-256-GCM** avant écriture (`common/crypto/totp-secret.ts`) :

- **Format** : `v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>`
- **Clé** : dérivée par `scrypt` de la variable d'environnement `TOTP_ENC_KEY` (sel applicatif
  fixe `cms-saris.totp.v1`).
- **Rétro-compatibilité** : un secret sans préfixe `v1:` est traité comme un ancien secret en
  clair (migration transparente, ré-écrit chiffré au prochain setup).

---

## 5. Contrôle d'accès — RBAC granulaire

### 5.1 Catalogue de permissions

Le catalogue central (`packages/types/src/permissions.ts`) déclare **110 permissions**
granulaires au format `module.action`, réparties sur l'ensemble des domaines :
dashboard, patient, visite/triage, consultation, ordonnance, bon_examen, suivi_chronique,
evacuation, accident_travail, referentiel (avec écriture **par service** : sites, motifs,
pathologies, médicaments, catégories, examens), personnel, sous_traitant, delegation,
utilisateur, role, audit, parametre, synchronisation, notification, messagerie.

### 5.2 Les 6 rôles métier

| Rôle | Portée |
|---|---|
| **ADMIN_SYSTEME** | Super-administrateur — **catalogue complet** (gouvernance système + lecture/action clinique) |
| **ADMIN_MEDICAL** | Gouvernance clinique : référentiels (CRUD complet), personnel, délégations, lecture de l'activité clinique, audit |
| **MEDECIN_CHEF** | Pleins droits cliniques (triage, consultation, prescription, sorties critiques, suivis) |
| **INFIRMIER** | Triage uniquement, **sans** prescription |
| **INFIRMIER_DELEGUE** | Triage + prescription **limitée** (dans le cadre d'une délégation) |
| **AGENT_RH** | Personnel, sous-traitants, dossiers administratifs (ayants droit / sous-traitants) |

**Baseline commune à tous les rôles** : `notification.read`, `notification.update`, et le quatuor
messagerie (`messagerie.read/create/update/delete`) — chacun peut consulter ses notifications et
échanger en interne. La création d'annonces (`notification.create`) reste réservée à
`ADMIN_SYSTEME`.

### 5.3 Formule des permissions effectives

```
permissions effectives = (permissions des rôles  ∪  GRANTs)  −  REVOKEs
```

1. Union des permissions de tous les rôles de l'utilisateur (déduplication).
2. Ajout des dérogations individuelles **GRANT** (droit accordé en plus).
3. Retrait des dérogations individuelles **REVOKE** — appliqué **en dernier**, donc prioritaire.

Les dérogations (table `UtilisateurPermission` : `mode` GRANT/REVOKE, `motif`, `accordePar`,
horodatages) sont auditées. Le calcul (`chargerPermissions`) est l'**unique point d'assemblage**
injecté dans le JWT.

### 5.4 Guards NestJS

| Guard | Rôle |
|---|---|
| `JwtAuthGuard` | Vérifie signature + expiration du JWT, injecte `req.user` (id, siteId, roles, permissions) |
| `PermissionsGuard` | Vérifie les permissions du JWT via `@RequirePermissions(...)` (mode ANY/ALL) |
| `RolesGuard` | Vérifie l'appartenance à un rôle via `@Roles(...)` |
| `UserThrottlerGuard` | Rate-limiting **par utilisateur** (clé `u:{userId}`), repli IP pour le non-authentifié |

Exemple d'usage canonique (ordre des gardes significatif) :

```typescript
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('patient.read')
@Get('/patients')
findAll() { ... }
```

L'autorisation se fait à partir des permissions **embarquées dans le JWT** : aucun appel base de
données par requête.

### 5.5 Cloisonnement multi-site

Le `siteId` du JWT restreint **toutes** les requêtes métier (triage, consultation, dossier
patient, sorties critiques, messagerie, tableau de bord). Un agent ne voit que les données de
son site.

---

## 6. Compte utilisateur — gestion personnelle (`/me/*`)

L'utilisateur pilote son propre compte sans intervention admin :

| Route | Méthode | Objet |
|---|---|---|
| `/me` ou `/me/preferences` | GET | Profil + préférences (thème, densité, langue, page d'accueil, notifications) + statut CGU |
| `/me/preferences` | PATCH | Mise à jour des préférences |
| `/me/sessions` | GET | Liste des sessions actives (IP, user-agent, géolocalisation) |
| `/me/sessions/:id/revoke` | POST | Révocation d'une session précise |
| `/me/sessions/revoke-others` | POST | Révocation de toutes les autres sessions |
| `/me/cgu/accept` | POST | Acceptation des conditions d'utilisation (cf. §10) |
| `/me/totp/setup` | POST | Étape 1 : secret + URI otpauth |
| `/me/totp/activate` | POST | Étape 2 : activation + codes de secours |
| `/me/totp/disable` | POST | Désactivation de la 2FA |

---

## 7. Gestion des sessions

### 7.1 Table `SessionUtilisateur`

```prisma
model SessionUtilisateur {
  id                String   @id              // = sid embarqué dans le JWT
  utilisateurId     String
  refreshTokenHash  String                    // hash bcrypt — jamais le token brut
  ipAdresse         String?
  userAgent         String?
  createdAt         DateTime @default(now())
  expiresAt         DateTime
  revokedAt         DateTime?

  utilisateur       Utilisateur @relation(fields: [utilisateurId], references: [id])
}
```

### 7.2 Révocation

- **Déconnexion** (`/auth/logout`) : révoque **toutes** les sessions actives de l'utilisateur.
- **Révocation ciblée** (`/me/sessions/...`) : l'utilisateur ferme une session distante précise
  ou « toutes les autres ».
- **Rotation** (`/auth/refresh`) : l'ancienne session est révoquée à chaque renouvellement.

Une session révoquée ou expirée rejette tout `/auth/refresh` ultérieur (`401`).

---

## 8. Audit persistant

Deux journaux distincts assurent la traçabilité, conformément à la règle R-SEC-018 (écriture
seule, aucune route de modification/suppression).

### 8.1 Journal des mutations (`JournalAudit`)

Géré par un **interceptor global** (`APP_INTERCEPTOR`) déclenché uniquement sur les routes
annotées `@Audit('module', 'EntiteType')` ET pour les méthodes mutantes (POST/PUT/PATCH/DELETE) :

```typescript
// apps/api/src/common/interceptors/audit.interceptor.ts
// → une entrée par mutation : utilisateurId, action (CREATE/UPDATE/DELETE),
//   module, entiteType, entiteId, ipAdresse, statut (SUCCES | ERREUR)
```

Le logging est **best-effort** : il n'altère jamais la requête métier (un échec d'écriture du
journal est ignoré). Les `GET` ne sont pas audités. Les actions purement administratives
réalisées par le système (seed, etc.) sont exclues.

### 8.2 Journal des authentifications (`JournalAuthentification`)

Chaque tentative de connexion est tracée, **succès comme échec** :
`SUCCES_LOGIN`, `SUCCES_LOGIN_TOTP`, `SUCCES_LOGIN_CODE_SECOURS`, `SUCCES_LOGOUT`,
`SUCCES_CHANGEMENT_MDP`, `ECHEC_LOGIN_INCONNU`, `ECHEC_MOT_DE_PASSE`, `ECHEC_COMPTE_BLOQUE`,
`ECHEC_COMPTE_DESACTIVE`, `ECHEC_CODE_TOTP`… — avec `ipAdresse` et `userAgent`.

### 8.3 Consultation des journaux

| Route | Filtres |
|---|---|
| `/admin/audit/actions` | module, action, utilisateur, entiteType, entiteId, plage de dates (bornes inclusives), limite (max 500, défaut 100) |
| `/admin/audit/authentifications` | utilisateur, résultat, plage de dates, géolocalisation IP |

Permission requise : `audit.read`.

---

## 9. Chiffrement au repos de la messagerie interne (AES-256-GCM)

Le contenu d'un message et ses pièces jointes ne sont **jamais** stockés en clair
(`common/crypto/message-crypto.ts`). Combiné à TLS en transport (production), cela protège la
confidentialité des échanges entre agents.

### 9.1 Format de stockage versionné

```
v2:<keyId>:<iv_b64>:<authTag_b64>:<ciphertext_b64>   ← format courant (rotation possible)
v1:<iv_b64>:<authTag_b64>:<ciphertext_b64>           ← legacy, toujours déchiffrable (clé id "1")
```

- **Algorithme** : AES-256-GCM, IV de 12 octets, tag d'authentification inclus.
- **Dérivation des clés** : `scrypt(passphrase, "cms-saris.message.v1", 32)`, mise en cache.

### 9.2 Rotation et versioning de clé (Vault-ready)

Le trousseau de clés est chargé selon l'ordre de priorité suivant :

| Source | Format | Usage |
|---|---|---|
| `MESSAGE_ENC_KEYS_FILE` | fichier monté (JSON `{"1":"…","2":"…"}` ou `1:phraseA,2:phraseB`) | **Vault / secret Kubernetes** — prioritaire |
| `MESSAGE_ENC_KEYS` | `1:phraseA,2:phraseB` (env) | Plusieurs clés actives |
| `MESSAGE_ENC_KEY_CURRENT` | id de clé (ex. `2`) | Clé utilisée pour **chiffrer** (défaut : plus grand id) |
| `MESSAGE_ENC_KEY` / `TOTP_ENC_KEY` | mono-clé | Repli (clé id `1`) |

Les **anciennes clés restent dans le trousseau** pour pouvoir déchiffrer les messages
historiques après une rotation. Un avertissement est émis si `MESSAGE_ENC_KEY` est absente en
production (repli sur `TOTP_ENC_KEY`).

### 9.3 Outillage de ré-encryption (non destructif)

L'API expose `currentKeyId()`, `isCurrent(stored)` et `reencryptToCurrent(stored)`. Après une
rotation, la routine `reencrypterMessages()` (service de synchronisation, endpoint
`POST /synchronisation/messagerie/rechiffrer`, permission `synchronisation.execute`) re-chiffre
progressivement les messages vers la clé courante. L'opération est **idempotente et non
destructive** : un message n'est ré-écrit que s'il a pu être déchiffré au préalable.

> **Robustesse de lecture** : `decryptMessage` renvoie le placeholder « [message illisible] »
> plutôt que de planter sur un contenu corrompu ; `decryptBytes` (pièces jointes) lève une
> erreur gérée par l'appelant.

---

## 10. Durcissement de la messagerie

`MessagerieController` (protégé par `JwtAuthGuard` + `PermissionsGuard` + `UserThrottlerGuard`)
combine plusieurs défenses :

### 10.1 Rate-limiting par utilisateur

- **Plafond général** : 150 requêtes / min / utilisateur (`@Throttle` au niveau du contrôleur).
- **Anti-flood d'envoi** : 40 messages / min / utilisateur sur `POST .../messages`.
- Le throttling est **clé par utilisateur** (`UserThrottlerGuard`), pas par IP, pour ne pas
  pénaliser des agents partageant la même IP derrière un NAT/proxy.

### 10.2 Cloisonnement et anti-IDOR cross-site

Toute conversation est cloisonnée au `siteId`. Un destinataire d'un autre site renvoie une
erreur **uniforme** (« Destinataire introuvable ») qui ne révèle pas l'existence de comptes
inter-sites.

### 10.3 Pièces jointes — défense en profondeur

| Contrôle | Détail |
|---|---|
| **Stockage** | en mémoire puis **chiffré en base** (aucun fichier sur disque) |
| **Quota** | 10 fichiers max, 16 Mo / fichier |
| **Whitelist MIME** | images (jpeg/png/webp/gif), vidéo, audio, PDF, texte (plain/csv), Office (Word/Excel) |
| **Sanitize du nom** | suppression des chemins (anti path-traversal), des caractères de contrôle et de `<>:"/\|?*`, borné à 200 caractères, défaut « fichier » |
| **Magic-bytes** | `assertSafeBinary()` rejette les exécutables/scripts quel que soit le MIME déclaré : MZ (Windows PE), ELF (Linux), Mach-O (macOS), `#!` (script shell) |

### 10.4 Cycle de vie des messages

- **Édition / suppression** : fenêtre de **15 minutes** après envoi (« pour tout le monde »).
- **Suppression à deux niveaux** : « pour moi » (masque permanent, table `MessageMasque`,
  toujours disponible) vs « pour tout le monde » (`deletedAt`, ≤ 15 min, ses propres messages).
- **Groupe** : plafond de participants validé à la création.

---

## 11. Durcissement HTTP & validation

`apps/api/src/main.ts` applique au bootstrap :

| Mesure | Détail |
|---|---|
| **Helmet** | en-têtes de sécurité HTTP (CSP, HSTS, X-Frame-Options…) |
| **CORS strict** | origine = `FRONTEND_URL` uniquement, `credentials: true`, méthodes limitées |
| **`ValidationPipe` global** | `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true` → défense XSS / mass-assignment |
| **`trust proxy`** | configurable via `TRUST_PROXY` (nombre de hops, `true`/`false`, ou plage) pour lire la vraie IP via `X-Forwarded-For` |
| **Filtre d'exceptions global** | `GlobalExceptionFilter` — réponses d'erreur homogènes |

> ⚠️ Au déploiement, `TRUST_PROXY` doit être réglé selon le nombre réel de reverse-proxies en
> amont (défaut : 1 hop).

### Traçabilité IP & géolocalisation

`common/geo/geo.util.ts` enrichit les journaux avec la localisation : appel prioritaire à
**ip-api.com** (ville, région, pays, coordonnées, fuseau, en français ; cache 1 h par IP) avec
**repli hors-ligne sur `geoip-lite`** (base embarquée) si le service externe est indisponible.

---

## 12. Conformité — Conditions d'utilisation (CGU)

- **Version serveur** : `CGU_VERSION = 'v1-2026.06'` (`me.service.ts`).
- **Traçabilité** : colonnes `cguAccepteeLe` (DateTime) et `cguVersion` (String) dans
  `PreferenceUtilisateur`.
- **Porte bloquante** : `GET /me/preferences` renvoie `cguAJour` (booléen, vrai si
  `cguVersion === CGU_VERSION`) et `cguVersionRequise`. Tant que l'utilisateur n'a pas accepté la
  version courante, le frontend (CguGate dans l'AppShell) bloque l'accès à l'application.
- **Re-acceptation forcée** : incrémenter `CGU_VERSION` redéclenche automatiquement la modale
  d'acceptation pour tous les utilisateurs au prochain login.

---

## 13. Modèle de données — sécurité

Le schéma Prisma (`packages/db/prisma/schema.prisma`, **79 modèles** au total, **22 migrations**)
regroupe pour la sécurité et l'audit notamment :

| Modèle | Rôle |
|---|---|
| `Utilisateur` | login (unique), `passwordHash` (bcrypt), `statut` (ACTIF/DESACTIVE/BLOQUE), `tentativesEchec`, `blocageJusquA`, `blocageMinutes`, `motDePasseTemp`, `siteId`, `personnelMedicalId` |
| `SessionUtilisateur` | sessions actives (id = sid, `refreshTokenHash`, IP, user-agent, expiration, révocation) |
| `ConfigurationTotp` | `secretChiffre` (AES-256-GCM), `actif`, `activatedAt` |
| `CodeSecoursTotp` | `codeHash` (bcrypt), `utilise`, `utilisedAt` |
| `Role`, `Permission`, `UtilisateurRole`, `RolePermission` | matrice RBAC |
| `UtilisateurPermission` | dérogations individuelles (mode GRANT/REVOKE, motif, accordePar) |
| `PreferenceUtilisateur` | préférences + traçabilité CGU (`cguAccepteeLe`, `cguVersion`) |
| `JournalAudit` | mutations métier (utilisateur, action, module, entité, IP, statut) |
| `JournalAuthentification` | tentatives d'authentification (login, résultat, IP, user-agent) |
| `Conversation`, `ConversationParticipant`, `Message`, `MessagePieceJointe`, `MessageReaction`, `MessageMasque` | messagerie chiffrée |

---

## 14. Synthèse de la posture de sécurité

| Domaine | Technique | Détail |
|---|---|---|
| **Authentification** | JWT + TOTP | Access token (défaut 8 h, paramétrable), refresh 7 j avec rotation, 2FA otplib + 8 codes de secours |
| **Mots de passe** | bcrypt 12 rounds | Politique paramétrable + blocage à escalade (×4) |
| **Chiffrement messages** | AES-256-GCM | Trousseau de clés versionnées (v2), legacy v1, rotation + ré-encryption non destructive, Vault-ready |
| **Chiffrement TOTP** | AES-256-GCM | Secret chiffré, clé dérivée scrypt, rétro-compatibilité |
| **RBAC** | 110 permissions | 6 rôles, dérogations GRANT/REVOKE, baseline commun, cloisonnement multi-site |
| **Audit** | 2 journaux persistants | Toutes les mutations + tous les événements d'authentification, IP/géo |
| **Messagerie** | durcissement complet | Rate-limit 40/min (envoi) & 150/min (global), magic-bytes, sanitize, anti-IDOR |
| **HTTP** | Helmet + CORS + validation | En-têtes durcis, CORS strict, `ValidationPipe` global, trust proxy |
| **Conformité** | CGU v1-2026.06 | Version tracée, porte bloquante d'acceptation |

---

## 15. Limites connues & extensions futures

Distinction explicite entre l'existant et le **hors périmètre** :

| Point | Statut |
|---|---|
| Tests automatisés de sécurité (unitaires / intégration) | **Extension future** — seuls 2 tests E2E basiques existent aujourd'hui |
| Authentification offline (mode déconnecté avec fenêtre de grâce) | **Extension future** — l'authentification requiert actuellement le serveur ; l'offline-first couvre la file de rejeu des écritures, pas le login |
| Audit de conformité formel (RGPD/HDS, pentest externe) | **Extension future** |
| Rotation effective des clés de chiffrement en masse | **Outillé** mais la procédure complète reste à exécuter le jour d'une vraie rotation |
| Détection d'anomalies avancée (`AlerteAnomalie`) | Modèle présent en base, **exploitation à approfondir** |

> La sécurité « as-built » est robuste et défensive en profondeur (crypto, RBAC, audit,
> durcissement réseau et applicatif). Les éléments ci-dessus relèvent du durcissement
> opérationnel et de la couverture de tests, non du cœur fonctionnel.
