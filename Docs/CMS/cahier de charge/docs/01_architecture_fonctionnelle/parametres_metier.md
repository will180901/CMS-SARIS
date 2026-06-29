# Référentiel des paramètres métier — CMS SARIS

**Version** 1.1 · **Date** 2026-06-29 · **Statut** Brouillon · **Historique** : v1.0 création ; v1.1 ajout **PM-50→PM-62** (audit de fidélité : externalisation des nombres « type-B » — rate-limits messagerie, seuils d'alerte clinique, supervision/rétention sync, CGU/soft-delete)

> **Source unique des chiffres.** Tout autre document du cahier des charges référence ce
> référentiel par identifiant (`PM-xx`) plutôt que de recopier une valeur. Chaque paramètre
> est documenté « as-built » : valeur, unité, emplacement d'application et chemin de code.
> Documents liés : [[plan_modules]], [[MODULE_01_securite_authentification]], [[MODULE_13_messagerie]],
> [[MODULE_16_synchronisation]], [[MODULE_07_dossier_patient]], [[modele_operationnel]], [[cadre_reglementaire]].

---

## 1. Conventions de lecture

- **Chemins de code** relatifs à la racine du monorepo `CMS/APP/CMS-SARIS/`.
- Un paramètre marqué **« configurable »** possède une valeur par défaut codée mais
  modifiable à l'exécution (catalogue `ParametresService` ou variable d'environnement).
  La valeur indiquée est le **défaut**.
- **« à confirmer »** signale un fait non vérifié dans le code au moment de la rédaction.

---

## 2. Authentification & session

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-01** | Durée du jeton d'accès (access JWT) | **480** (8 h) | minutes | `apps/api/src/modules/security/security.service.ts` (`accessTtlSec`) |
| **PM-02** | Durée du jeton de rafraîchissement (refresh JWT) | **7** (valeur **fixe**, codée en dur) | jours | `security.service.ts` (`REFRESH_TOKEN_TTL = 7*24*60*60`) |
| **PM-03** | Durée du jeton temporaire (étape TOTP) | **5** (valeur **fixe**, codée en dur) | minutes | `security.service.ts` (`TEMP_TOKEN_TTL = 5*60`) |
| **PM-04** | Rate-limit login (anti brute-force) | **10** | requêtes / min / IP | `security.controller.ts` `@Throttle({ limit:10, ttl:60_000 })` sur `POST /auth/login` |
| **PM-05** | Rate-limit vérification code TOTP | **10** | requêtes / min / IP | `security.controller.ts` `@Throttle` sur l'endpoint TOTP |
| **PM-06** | Rate-limit global (toutes routes) | **100** | requêtes / min | `apps/api/src/app.module.ts` `ThrottlerModule` (name `global`) |
| **PM-07** | Tentatives de connexion avant blocage | **5** (min 3, max 10) | tentatives | catalogue `auth.tentatives_max`, `parametres.service.ts` — **configurable** |
| **PM-08** | Durée du 1ᵉʳ blocage de compte (escalade ×4 ensuite) | **15** (min 1, max 1440) | minutes | catalogue `auth.duree_blocage_minutes` ; escalade `prochainBlocage()` (×4) — **configurable** |

> **PM-01 est le SEUL paramètre de session configurable** : c'est le défaut
> `auth.session_timeout_minutes` (**480**, bornes 5 … 10080) du catalogue `ParametresService` ;
> un administrateur peut le modifier via l'écran Paramètres. Lié à la décision « session unique
> par utilisateur ». En revanche, **PM-02 (refresh, 7 j) et PM-03 (jeton temporaire TOTP, 5 min)
> sont des constantes codées en dur** (`REFRESH_TOKEN_TTL`, `TEMP_TOKEN_TTL` dans
> `security.service.ts`) : ni configurables au catalogue, ni par variable d'environnement.

---

## 3. Politique de mot de passe (configurable)

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-09** | Longueur minimale du mot de passe | **10** (min 8, max 64) | caractères | catalogue `mdp.longueur_min`, `parametres.service.ts` |
| **PM-10** | Exiger une majuscule | **vrai** | booléen | `mdp.exiger_majuscule` |
| **PM-11** | Exiger une minuscule | **vrai** | booléen | `mdp.exiger_minuscule` |
| **PM-12** | Exiger un chiffre | **vrai** | booléen | `mdp.exiger_chiffre` |
| **PM-13** | Exiger un caractère spécial | **faux** | booléen | `mdp.exiger_special` |

---

## 4. Messagerie interne

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-14** | Fenêtre d'édition / suppression d'un message | **15** | minutes | `apps/api/src/modules/messagerie/messagerie.service.ts` (`EDIT_DELETE_WINDOW_MS = 15*60*1000`) ; appliqué en édition, suppression « pour tout le monde » et calcul UI |
| **PM-15** | Taille maximale d'un fichier joint | **16** | Mio (16 × 1024 × 1024) | backend `messagerie.controller.ts` `limits.fileSize` ; front `mediaUtils.ts` (image/vidéo/audio/document) |
| **PM-16** | Nombre maximal de fichiers par envoi | **10** | fichiers | `messagerie.controller.ts` `limits.files: 10` |
| **PM-17** | Durée maximale d'une vidéo partagée | **120** (2 min) | secondes | `apps/web/src/modules/messagerie/components/mediaUtils.ts` (`VIDEO_MAX_SEC = 120`) ; bornage du rogneur via `videoMaxSpan()` |
| **PM-18** | Aperçu textuel d'un message (longueur) | **120** | caractères | `messagerie.service.ts` (`apercu = …slice(0,120)`) |
| **PM-19** | TTL « regarde la conversation » (présence fil) | **45 000** (45 s) | millisecondes | `apps/api/src/modules/notification/presence.service.ts` (`VIEWING_TTL_MS`) |
| **PM-50** | Aperçu d'un message dans la **liste** de conversations | **80** | caractères | `messagerie.service.ts` (troncature liste ; l'aperçu citation/notification reste **PM-18** = 120) |
| **PM-51** | Rate-limit messagerie (lecture / listing — défaut du contrôleur) | **150** | requêtes / min / utilisateur | `messagerie.controller.ts` `@Throttle({ limit:150, ttl:60_000 })` |
| **PM-52** | Rate-limit **envoi** de message (anti-flood) | **40** | envois / min / utilisateur | `messagerie.controller.ts` `@Throttle({ limit:40, ttl:60_000 })` |
| **PM-53** | Rate-limit **signal de présence / frappe** (« regarde le fil ») | **240** | requêtes / min / utilisateur | `messagerie.controller.ts` `@Throttle({ limit:240, ttl:60_000 })` (429 au-delà) |

> Détails fonctionnels du module : voir [[MODULE_13_messagerie]].

---

## 5. Connectivité & synchronisation (offline-first)

### 5.1 Sonde de santé serveur (client web)

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-20** | Intervalle de sonde `/health` (badge En ligne / Hors ligne) | **10 000** (10 s) | millisecondes | `apps/web/src/hooks/useServerHealth.ts` (`INTERVAL_MS`) |
| **PM-21** | Délai d'expiration (timeout) de la sonde `/health` | **8 000** (8 s) | millisecondes | `useServerHealth.ts` (`TIMEOUT_MS`) — tolérant au réveil d'un hébergement gratuit |
| **PM-22** | Anti-clignotement : échecs consécutifs avant « Hors ligne » | **2** | échecs | `useServerHealth.ts` (`MAX_FAILS`) |
| **PM-23** | Cycle de rejeu de la file offline (filet web) | **30 000** (30 s) | millisecondes | `apps/web/src/hooks/useSyncEngine.ts` (`CYCLE_INTERVAL_MS`) |

### 5.2 Sonde de connectivité du desktop (Electron, bascule central ⇄ local)

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-24** | Intervalle de sonde du central par le desktop | **5 000** (5 s) | millisecondes | `apps/desktop/electron/main.ts` (`connectivityTimer` setInterval) |
| **PM-25** | Hystérésis : sondes consécutives concordantes avant bascule backend | **2** (≈ 10 s) | sondes | `main.ts` (`flips < 2`) — évite le « flickering » des reconnexions SSE |
| **PM-26** | Délai avant rendre la main au central à la reconnexion | **3 000** (3 s) | millisecondes | `main.ts` (`setTimeout(pushRendererUrl, 3000)`) — laisse le backend local pousser ses changements |
| **PM-27** | Délai d'attente de la 1ʳᵉ synchro avant ouverture (hors-ligne) | **90 000** (90 s) | millisecondes | `main.ts` (`waitForInitialSync(…, 90000)`) |
| **PM-28** | Pas de scrutation `/sync/ready` (1ʳᵉ synchro) | **700** | millisecondes | `main.ts` (boucle `waitForInitialSync`) |
| **PM-29** | Intervalle de rafraîchissement du jeton d'accès (sync desktop) | **15** | minutes | `apps/desktop/electron/sync-auth.ts` (`15*60*1000`) |
| **PM-30** | Délai d'attente santé backend embarqué au démarrage | **30 000** (timeout) / **300** (pas) | millisecondes | `apps/desktop/electron/backend.ts` (`waitForHealth(timeoutMs=30000, intervalMs=300)`) |

### 5.3 Boucle de synchronisation du backend embarqué (mode local)

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-31** | Délai avant la synchro initiale au démarrage (bootstrap) | **1 500** (1,5 s) | millisecondes | `apps/api/src/modules/sync/sync-client.service.ts` (`onApplicationBootstrap`) |
| **PM-32** | Intervalle de la sonde de joignabilité (synchro instantanée à la reconnexion) | **4** | secondes | `sync-client.service.ts` (`SYNC_PROBE_SEC`, défaut 4, plancher 2) — **configurable (env)** |
| **PM-33** | Filet de sécurité : synchro périodique espacée | **300** (5 min) | secondes | `sync-client.service.ts` (`SYNC_SAFETY_SEC`, défaut 300, plancher 60) — **configurable (env)** |
| **PM-34** | Timeout d'une requête de synchro | **4 000** (4 s) | millisecondes | `sync-client.service.ts` (`setTimeout(ctrl.abort, 4000)`) |
| **PM-35** | Backoff sur échec de synchro (borné) | **5 000 → 60 000** | millisecondes | `sync-client.service.ts` (`triggerSync`, doublement borné à 60 s) |
| **PM-36** | Purge des tombstones (soft-delete) | quotidienne **à 03 h 00** | cron | `apps/api/src/modules/sync/tombstone-purge.cron.ts` (`EVERY_DAY_AT_3AM`) |

### 5.4 Supervision & rétention (central)

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-58** | Fenêtre « poste en ligne » (un poste est en ligne s'il s'est synchronisé depuis moins de…) | **3** | minutes | `apps/api/src/modules/sync/sync-supervision.service.ts` (`ONLINE_WINDOW_MS = 3 * 60_000`) |
| **PM-59** | Rétention des tombstones avant purge **physique** (et seulement si tous les postes les ont vus) | **90** | jours | `apps/api/src/modules/sync/tombstone-purge.cron.ts` (`retentionDays = 90`) |
| **PM-60** | Cardinalités de la supervision (par site) | **30** journaux récents · **50** conflits max | éléments | `sync-supervision.service.ts#getSupervision` |

> Vision et mécanique offline-first : voir [[MODULE_16_synchronisation]], [[modele_operationnel]].

---

## 6. Notifications & rétention

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-37** | Rétention des notifications | **30** (min 7, max 365) | jours | catalogue `notif.retention_jours`, `parametres.service.ts` — **configurable** |
| **PM-38** | Notifications applicatives activées | **vrai** | booléen | `notif.app_enabled` |
| **PM-39** | Notifications d'événements cliniques | **vrai** | booléen | `notif.evenements_cliniques` |
| **PM-40** | Notifications de sorties critiques | **vrai** | booléen | `notif.sorties_critiques` |
| **PM-41** | Notifications d'événements administratifs | **vrai** | booléen | `notif.evenements_administratifs` |

---

## 7. Application web (PWA) & cache

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-42** | Taille max d'un asset précaché par le service worker | **6** | Mio (6 × 1024 × 1024) | `apps/web/vite.config.ts` (`workbox.maximumFileSizeToCacheInBytes`) — relevé de 2 Mio (défaut) pour inclure sprite emoji + bundle |
| **PM-43** | Intervalle de rafraîchissement des tableaux de bord (React Query) | **120 000** (2 min) | millisecondes | `apps/web/src/modules/dashboard/hooks/useDashboard.ts` (`refetchInterval`) |

---

## 8. Sécurité & divers (backend)

| ID | Paramètre | Valeur | Unité | Où appliqué |
|----|-----------|--------|-------|-------------|
| **PM-44** | Cache de géolocalisation par IP | **1** | heure (TTL) | `apps/api/src/common/geo/geo.util.ts` (`TTL_MS = 60*60*1000`) |
| **PM-45** | Chiffrement at-rest (TOTP, messagerie) | **AES-256-GCM** | algorithme | secret TOTP + contenu messagerie ; clés versionnées (format `v2:keyId`) |
| **PM-61** | Version courante des **CGU** (un changement re-déclenche l'acceptation par tous) | **`v1-2026.06`** | chaîne | `apps/api/src/modules/security/me.service.ts` (`CGU_VERSION`) |
| **PM-62** | Effacement applicatif = **soft-delete** (`deletedAt`), non destructif | soft-delete | mécanisme | `packages/db/prisma/schema.prisma` + `prisma.service` (filtre global) — voir [[registre_decisions]] D-015 |

---

## 9. Seuils d'alerte clinique (alertes calculées)

> Seuils de la règle « constante critique » des **alertes cliniques calculées** (non saisies)
> du dossier patient (cf. [[MODULE_07_dossier_patient]] EF-07-16 / RM-07-08). Valeurs codées
> dans `apps/api/src/modules/patient/patient.service.ts` (calcul des alertes cliniques).

| ID | Constante | Seuil(s) | Gravité | Où appliqué |
|----|-----------|----------|---------|-------------|
| **PM-54** | Saturation en O₂ (SpO₂) | **< 90 %** | CRITIQUE (Hypoxie) | `patient.service.ts` (`saturationO2 < 90`) |
| **PM-55** | Température | **≥ 38,5 °C** (ELEVE) · **≥ 39,5 °C** (CRITIQUE) | ELEVE / CRITIQUE | `patient.service.ts` (`temperature >= 38.5` ; `>= 39.5`) |
| **PM-56** | Tension artérielle systolique | **≥ 160 mmHg** (ELEVE) · **≥ 180** (CRITIQUE) | ELEVE / CRITIQUE | `patient.service.ts` (`tensionSystolique >= 160` ; `>= 180`) |
| **PM-57** | Fréquence cardiaque | **≥ 120 bpm** (tachycardie) · **< 50** (bradycardie) | ELEVE | `patient.service.ts` (`frequenceCardiaque >= 120` ; `< 50`) |

---

## 10. Volumétrie & cardinalités du système (as-built)

> Ces valeurs sont des **comptes de référence** de l'architecture, pas des paramètres de
> configuration. Elles fixent l'échelle du système. **Source = code à la date du document.**

| ID | Élément | Valeur (code vérifié) | Source / chemin |
|----|---------|-----------------------|-----------------|
| **PM-46** | Nombre de **rôles** d'habilitation | **3** (`ADMIN_SYSTEME`, `MEDECIN_CHEF`, `INFIRMIER`) | `packages/types/src/permissions.ts` (`ROLE_CATALOG`) — voir [[MODULE_02_acces_habilitations]] |
| **PM-47** | Nombre de **permissions** | **110** (objet `PERMISSIONS`) | `packages/types/src/permissions.ts` |
| **PM-48** | Nombre de **tables** (modèles Prisma, schéma PostgreSQL) | **87** modèles (+ 6 enums) | `packages/db/prisma/schema.prisma` |
| **PM-49** | Nombre de **sites** (seed) | **2** : `MOUTELA` (Centre Médico-Social Moutela), `NKAYI` (Centre Médico-Social Nkayi) | `packages/db/prisma/seed.ts` (`SITES`) |

### Écarts à signaler (honnêteté as-built)

- **PM-47 (permissions)** : décompte définitif vérifié dans le code = **110** (l'objet
  `PERMISSIONS` contient 110 lignes `CLÉ: 'x.y'` et 110 chaînes de permission DISTINCTES ;
  `ALL_PERMISSIONS = Object.values(PERMISSIONS)` et `ADMIN_SYSTEME = [...ALL_PERMISSIONS]`).
  Concorde avec le brief et la mémoire projet. *(Un décompte intermédiaire à « 88 » lors de
  la rédaction était une sous-estimation, corrigé.)*
- **PM-48 (tables)** : le brief annonce « ~79 tables » ; le schéma PostgreSQL contient
  **87 modèles** `model` au moment de la rédaction. La valeur **87 est vérifiée dans le code**
  et fait foi. L'écart avec « ~79 » est **à confirmer** (le schéma a pu croître depuis la
  fixation du chiffre canonique). Le schéma SQLite desktop (`packages/db/prisma/sqlite/schema.prisma`)
  est une cible générée distincte.
- **PM-49 (sites)** : le seed crée bien **2** sites. Leurs **codes** sont `MOUTELA` / `NKAYI`
  (le brief les nomme « Moutela » et « Nkayi », cohérent).
- **PM-46 (rôles)** : le système compte **3 rôles d'habilitation** (`ADMIN_SYSTEME`,
  `MEDECIN_CHEF`, `INFIRMIER`), vérifiés dans `ROLE_CATALOG` + `DEFAULT_ROLE_PERMISSIONS`.
  **`MEDECIN` n'est PAS un rôle** : c'est une **profession** du personnel médical (`TypePersonnel`)
  **mappée au rôle `MEDECIN_CHEF`** (`seed.ts:379` `MEDECIN: 'MEDECIN_CHEF'` — « un seul rôle
  médecin = Médecin Chef »). Tout médecin reçoit donc le rôle `MEDECIN_CHEF`.

---

## 11. Traçabilité

- Chiffres d'authentification / session → [[MODULE_01_securite_authentification]] (EF / RM correspondantes).
- Messagerie (PM-14 à PM-19, **PM-50 à PM-53**) → [[MODULE_13_messagerie]].
- Synchronisation (PM-20 à PM-36, **PM-58 à PM-60**) → [[MODULE_16_synchronisation]], [[modele_operationnel]].
- **Seuils d'alerte clinique (PM-54 à PM-57)** → [[MODULE_07_dossier_patient]] (EF-07-16 / RM-07-08).
- **CGU & cycle de vie des données (PM-61, PM-62)** → [[MODULE_01_securite_authentification]], [[cadre_reglementaire]], [[registre_decisions]] D-015.
- Rôles & permissions (PM-46, PM-47) → [[MODULE_02_acces_habilitations]].
- Tout document citant une de ces valeurs **doit** la référencer par identifiant `PM-xx`
  et ne jamais la redéfinir localement (principe « une seule source de vérité », méthodo ULAMU).
