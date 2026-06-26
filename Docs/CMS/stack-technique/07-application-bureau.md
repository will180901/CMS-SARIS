# Application de bureau (Electron) — stack & packaging

> **Statut : document « as-built »** — il décrit l'implémentation **réellement présente dans le code** (paquet `apps/desktop`), et non une cible théorique. Tous les chemins, noms de fichiers, clés de configuration et options de packaging cités ci-dessous sont vérifiables sous `CMS/APP/CMS-SARIS/apps/desktop/` (voir aussi `apps/desktop/README.md`, source de référence des détails).

---

## 1. Rôle & positionnement

CMS SARIS dispose d'une **application de bureau Windows** empaquetée avec **Electron** (`apps/desktop`, nom de package `@cms-saris/desktop`). Elle n'est pas une réécriture : le **renderer EST le build web**. Le script `build:renderer` exécute `pnpm --filter web build:desktop` (soit `vite build --mode desktop`), puis le frontend produit est **copié dans `app/`** et servi tel quel. L'interface de bureau est donc **100 % identique** à la PWA — mêmes modules, mêmes écrans, même design system SARIS.

| Caractéristique | Valeur réelle |
|---|---|
| Package | `apps/desktop` (nom : `@cms-saris/desktop`, version `1.0.0`) |
| Moteur | Electron `^33.2.1`, empaqueteur `electron-builder` `^25.1.8` |
| Renderer | build web (`apps/web`, mode `desktop`) copié dans `app/` |
| Processus principal | `dist-electron/main.js` (compilé depuis `electron/main.ts`) |
| Cibles | Windows x64, installeur **NSIS** |
| Durcissement | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`, `webSecurity` par défaut (SOP/CORS appliqués) ; pont `contextBridge` via `preload.ts` |
| Auteur / appId | Déo Cherel BOUWAYI MIKOUYA — SARIS-CONGO / `cg.sariscongo.cms` |

Le processus principal déclare le schéma privilégié, sert le frontend, gère le menu natif (barre de titre custom façon WhatsApp, `titleBarStyle: 'hidden'` + overlay thématisé), l'écran de configuration serveur, la mise à jour automatique et le pont sécurisé vers le renderer.

---

## 2. Deux modes de fonctionnement : `remote` / `local`

L'application connaît **deux modes**, résolus à l'exécution (`electron/config.ts → resolveMode()`).

| Mode | État | Description |
|---|---|---|
| **`remote`** (défaut) | **build vérifié actuel** | Client lourd d'un **serveur distant** : aucune base ni API embarquée, l'app dialogue en HTTPS avec l'API NestJS centrale. C'est le mode produit par le build par défaut. |
| **`local`** (autonome, offline-first) | code livré (typecheck OK), **packaging à finaliser** | La **même API NestJS** est lancée **embarquée** sur une **base SQLite locale** ; un client de synchronisation réconcilie avec le serveur central. |

Bascule du mode :

```jsonc
// %APPDATA%\CMS SARIS\config.json
{ "mode": "local", "serverUrl": "https://central…" }
```

ou par variables d'environnement : `SARIS_MODE=local`, `SERVER_URL=…`.

En **mode local**, `electron/backend.ts` **fork** l'API compilée (`backend-entry.js`) dans un process Node distinct, sur **`127.0.0.1:<port libre>`** (`findFreePort()`). Le frontend `app://cms-saris` tape ensuite sur cette API locale.

> **Sécurité (données médicales).** L'adresse d'écoute du backend embarqué est **toujours la boucle locale `127.0.0.1`** : l'API n'est **jamais** exposée sur `0.0.0.0` ni sur l'IP du LAN. Tout `HOST` hérité de l'environnement est explicitement **retiré et neutralisé** avant le fork, pour qu'un réglage externe accidentel ne puisse pas ouvrir l'API au réseau. Le backend local ne sert que le poste hôte.

> **Moteur de synchronisation delta.** Le mode local s'appuie sur le moteur de synchronisation `/sync/pull|push|status|run` (LWW + tombstones, curseur `SyncState`), **implémenté et validé en développement** (cf. document « Offline-First / Synchronisation », §4 bis). Lors de la validation en dev, la synchro automatique au démarrage a rempli la base locale (journal « 542 reçus, 0 envoyé, 0 conflit »). Ce n'est donc **pas** un *no-op* : le moteur fonctionne de bout en bout en dev ; ce qui **reste** est l'**empaquetage de l'installateur autonome**, la **bascule globale du soft-delete** (aujourd'hui opt-in) et le **test multi-postes concurrents**.

---

## 3. Résolution de l'URL du serveur (par priorité)

Fichier : `electron/config.ts` (`resolveApiUrl()`). L'URL de l'API distante est résolue **à l'exécution**, dans cet ordre de priorité :

| Priorité | Source | Usage typique |
|---|---|---|
| **1** | Variable d'environnement `SARIS_API_URL` | Déploiement piloté / GPO. |
| **2** | `config.json` → `apiUrl` (`%APPDATA%\CMS SARIS\config.json`) | Réglée via l'écran de connexion ou *Fichier → Paramètres du serveur…*. |
| **3** | Défaut figé au build : `SARIS_DEFAULT_API_URL` | Lu depuis `dist-electron/defaults.json` (`{ "apiUrl": … }`) écrit au moment du `dist`. Optionnel. |
| **4** | (rien résolu) | L'app ouvre l'écran **« Connexion au serveur »** (`server-config.html`) au premier lancement. |

Toutes les URL sont normalisées (`trim` + retrait des `/` finaux). Le mode local utilise en plus `resolveServerUrl()` (env `SERVER_URL` → `config.json.serverUrl`) pour le serveur central de synchro.

Figer un défaut au build :

```powershell
$env:SARIS_DEFAULT_API_URL = "https://api.saris.exemple.cg"
pnpm --filter @cms-saris/desktop dist
```

> **⚠️ Exiger HTTPS en production.** Toute URL configurée **DOIT** être en `https://`. Une URL `http://` non-loopback ferait transiter jetons d'authentification, refresh token et données patient **en clair** sur le réseau. `http://localhost` n'est toléré **qu'en développement** sur le poste lui-même (`defaults.json` du dépôt contient `http://localhost:3000`, valeur de test à ne jamais figer dans un build distribué).

---

## 4. Schéma applicatif privilégié `app://cms-saris`

Fichier : `electron/main.ts`. Le frontend local n'est **pas** servi par `file://` mais par un **schéma applicatif privilégié `app://cms-saris`**, déclaré avant `app.whenReady()` :

```ts
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
])
```

Pourquoi ce choix plutôt que `file://` :

| Avantage | Détail |
|---|---|
| **Origine stable** | `app://cms-saris` est une origine fixe et **autorisable côté CORS** du serveur. |
| **Flux SSE des notifications** | Indispensable : `EventSource` (notifications temps réel) exige une origine CORS valide ; `file://` ne le permet pas. |
| **`fetch` / streaming** | `supportFetchAPI` + `stream` permettent au client API et au SSE de fonctionner normalement. |

Le handler `protocol.handle('app', …)` sert les fichiers depuis `RENDERER_DIR` (`app/`), avec **repli SPA sur `index.html`** pour toute route inconnue et un **garde anti-traversée** (rejet `403` si le chemin résolu sort du dossier renderer). En développement, l'app charge à la place `VITE_DEV_SERVER_URL` (`http://localhost:5173`).

> **Côté serveur** : l'origine `app://cms-saris` est **déjà ajoutée automatiquement** à la liste CORS de l'API. Pour plusieurs origines web, utiliser `CORS_ORIGINS` (sinon `FRONTEND_URL`). HTTPS avec certificat valide et `TRUST_PROXY` réglé derrière le reverse-proxy.

---

## 5. Stockage sécurisé des jetons — DPAPI

Fichier : `electron/config.ts` (section *Stockage sécurisé*). Le coffre des secrets (dont le **refresh token**) utilise **DPAPI** via `safeStorage` d'Electron, lié au compte Windows.

| Plateforme | Stockage de session | Persistance |
|---|---|---|
| **Web (PWA)** | `sessionStorage` (éphémère, effacé à la fermeture — règle de sécurité JWT) | Non |
| **Desktop** | Coffre **DPAPI** : `%APPDATA%\CMS SARIS\secure.bin`, chiffré au repos | **Oui** (« rester connecté » sécurisé) |

`secureGet/secureSet/secureDel` lisent/écrivent un blob JSON chiffré (`safeStorage.encryptString/decryptString`), conditionné par `safeStorage.isEncryptionAvailable()`. Le jeton **n'est jamais en clair**. Le blob est amorcé **synchroniquement** par le preload (`window.__SARIS_SESSION__`) pour éviter tout flash de déconnexion au lancement ; le frontend y accède via le pont `window.saris.secure` (implémentation web : `apps/web/src/stores/session-storage.ts`).

---

## 6. Build de l'installeur NSIS

Commande (depuis la racine du monorepo) :

```bash
pnpm install
pnpm --filter @cms-saris/desktop dist
```

Étapes enchaînées par `dist` (`package.json → scripts`) :

1. **`build:renderer`** — `pnpm --filter web build:desktop` (`vite build --mode desktop`) ;
2. **`build:main`** — `tsc -p tsconfig.json` (compile `electron/*.ts` → `dist-electron/`) ;
3. **`copy-renderer.mjs`** — copie le frontend produit dans `app/` ;
4. **`electron-builder --win`** — packaging NSIS.

Résultat : `apps/desktop/release/CMS SARIS-Setup-<version>.exe` (≈ **91 Mo**, ex. `CMS SARIS-Setup-1.0.0.exe`). Le contenu embarqué (`electron-builder.yml → files`) se limite à `dist-electron/**`, `app/**` et `package.json`.

Commandes annexes :

```bash
pnpm --filter @cms-saris/desktop start          # lance l'app (après un build)
pnpm --filter @cms-saris/desktop dist:unpacked  # dossier non empaqueté (debug)
pnpm --filter @cms-saris/desktop clean          # nettoie dist-electron/ app/ release/
```

> **electron-builder télécharge SON PROPRE Electron** (cache `electron-builder`) même si le binaire npm `electron` est absent du poste : l'installation du monorepo peut donc rester légère (`ELECTRON_SKIP_BINARY_DOWNLOAD`), le packaging récupère son runtime à part. Aucune dépendance native (`electron-log`/`electron-updater` = JS pur) → `npmRebuild: false`, pas d'étape `@electron/rebuild`.

> **Piège build Windows connu :** `Cannot create symbolic link … winCodeSign … darwin … .dylib` — electron-builder n'arrive pas à extraire `winCodeSign` (création de liens symboliques privilégiée). Solutions : activer le **Mode développeur Windows** (ou terminal administrateur), **ou** pré-extraire le cache `winCodeSign` sans les symlinks (`7za x … -xr!darwin -xr!linux`) une seule fois (cf. README, *Dépannage build*).

---

## 7. Options NSIS (installeur assisté, sans administrateur)

Configuration : `electron-builder.yml → nsis`.

| Option | Valeur | Effet |
|---|---|---|
| `oneClick` | **`false`** | Installeur **assisté** (assistant guidé), pas en un clic. |
| `perMachine` | **`false`** | Installation **par utilisateur** → **aucun droit administrateur** requis. |
| `allowElevation` | `false` | Pas d'élévation UAC. |
| `allowToChangeInstallationDirectory` | `true` | L'utilisateur **choisit le dossier** d'installation (étape dédiée). |
| `runAfterFinish` | `true` | Lancement automatique en fin d'installation. |
| `createDesktopShortcut` / `createStartMenuShortcut` | `true` | Raccourcis Bureau + menu Démarrer (`shortcutName: CMS SARIS`). |
| `deleteAppDataOnUninstall` | `true` | Désinstallation **propre** : retire aussi `%APPDATA%`. |
| `installerSidebar` / `uninstallerSidebar` / `installerHeader` | BMP | Branding charte SARIS (généré par `scripts/gen-installer-assets.mjs`). |
| `include` | `build/installer.nsh` | Script NSIS custom (installeur 2-en-1 + affichage détaillé). |

> **Note README vs config.** Le `README.md` mentionne à un endroit `oneClick: true` ; la **source de vérité est `electron-builder.yml`**, qui fixe **`oneClick: false`** (assistant guidé). C'est le comportement réel de l'installeur produit.

**Emplacements Windows** (par utilisateur) :

| Élément | Emplacement |
|---|---|
| Installation (sans admin) | `%LOCALAPPDATA%\Programs\CMS SARIS` |
| Configuration | `%APPDATA%\CMS SARIS\config.json` |
| Secrets chiffrés (DPAPI) | `%APPDATA%\CMS SARIS\secure.bin` |
| Base SQLite locale (mode local) | `%APPDATA%\CMS SARIS\cms-saris.db` (+ `-wal`/`-shm`) |
| Journaux | `%APPDATA%\CMS SARIS\logs`, `…\backend.log` |
| Désinstallation | « Applications et fonctionnalités » Windows |

**Désinstallation propre** (`build/installer.nsh`) : refuse de s'exécuter si l'application tourne (vérification du mutex Electron `cg.sariscongo.cms` — évite de corrompre la base SQLite/WAL) ; supprime, en plus de `deleteAppDataOnUninstall`, la base SQLite locale et ses annexes (`-wal`, `-shm`, `-journal`), `backend.log`, le dossier `logs\`, puis `%APPDATA%\CMS SARIS` et `%LOCALAPPDATA%\CMS SARIS` complets — **aucune trace**.

### Packaging du mode local (à finaliser)

Les clés nécessaires au mode autonome sont **déjà présentes et COMMENTÉES** dans `electron-builder.yml`, pour ne pas casser le build distant par défaut (un `extraResources` pointant vers un chemin absent ferait échouer `electron-builder`) :

- **`asarUnpack`** — moteurs natifs Prisma hors de l'archive asar (`**/node_modules/.prisma/**`, `**/node_modules/@prisma/engines/**`, `**/*.node`) ;
- **`extraResources`** — `../api/dist → api/dist` (API NestJS compilée) et `build/seed.db → seed.db`.

`build/seed.db` est une **base SQLite pré-migrée** (toutes tables créées) : au 1er lancement, `electron/db-init.ts` la **copie** vers `%APPDATA%\CMS SARIS\cms-saris.db`. Sans ce modèle, la base locale serait vide → le backend embarqué ne démarrerait pas. Ordre de build local : `api build` → `db:sqlite:gen` → `db:sqlite:migrate` (génère `seed.db`) → décommenter les blocs → `electron-builder`. **Le mode distant par défaut n'est jamais affecté** tant que ces blocs restent commentés.

---

## 8. Mise à jour automatique (electron-updater)

`electron-updater` (`^6.3.9`) vérifie au démarrage et propose le redémarrage une fois la mise à jour téléchargée (`electron/updater.ts`). Le canal se configure dans `electron-builder.yml → publish` :

```yaml
publish:
  - provider: generic
    url: https://REMPLACEZ-MOI.exemple/updates/cms-saris/
    channel: latest
```

- **Provider générique** : héberger `latest.yml` + l'installeur à l'URL indiquée (à remplacer) ;
- **ou GitHub Releases** (`provider: github`, `owner`/`repo`).

À chaque release, `dist` génère l'installeur **et** `latest.yml` ; les deux doivent être téléversés au même endroit.

---

## 9. Signature de code & SmartScreen

| Cas | Comportement Windows |
|---|---|
| **Sans certificat** (état actuel du dépôt) | **SmartScreen** affiche « **Éditeur inconnu** » et bloque l'exécution. Contournement manuel : *Informations complémentaires → Exécuter quand même*. Les antivirus/EDR peuvent mettre l'`.exe` en quarantaine ; l'auto-update peut refuser un binaire non signé. |
| **Certificat OV** (Organization Validation) | Réduit l'avertissement SmartScreen (réputation qui se construit avec le volume). |
| **Certificat EV** (Extended Validation, token/HSM) | Confiance SmartScreen **immédiate**, sans période de réputation. |
| **Azure Trusted Signing** | Alternative cloud (signature gérée côté Azure, pas de token physique). |

Pour un logiciel manipulant des **données de santé**, la signature **Authenticode** (+ horodatage **RFC 3161**, algorithme **SHA-256**) est un **prérequis de déploiement**, pas une option. La configuration (`certificateFile` / `CSC_LINK` + `CSC_KEY_PASSWORD` en variables d'env, `signingHashAlgorithms`, `rfc3161TimeStampServer`, option token EV / Azure) est **déjà préparée et commentée** dans `electron-builder.yml → win`. **Ne jamais committer** le `.pfx` ni le mot de passe (utiliser les variables d'environnement, à privilégier en CI).

---

## 10. État de validation (as-built)

| Élément | État |
|---|---|
| Renderer = build web (`build:desktop`) servi via `app://cms-saris` | **Fait** (mode remote, build vérifié actuel). |
| Résolution URL serveur (env → config.json → défaut build → écran) | **Fait** (`config.ts`). |
| Schéma privilégié `app://cms-saris` (CORS/SSE) | **Fait** (`main.ts`). |
| Stockage sécurisé DPAPI (`safeStorage`, `secure.bin`) | **Fait** (`config.ts`, amorce preload). |
| Durcissement renderer (contextIsolation/sandbox/nodeIntegration off) | **Fait** (`main.ts`). |
| Installeur **NSIS** mode distant (assisté, par-utilisateur) | **Produit** (≈ 91 Mo, `release/CMS SARIS-Setup-1.0.0.exe`). |
| Auto-update electron-updater | **Implémenté** ; URL/provider à renseigner avant diffusion. |
| Moteur de synchro delta (mode local) | **Implémenté + validé en dev** (synchro auto au démarrage, « 542 reçus »). |
| **Empaquetage installeur AUTONOME** (mode local : API + engines natifs + `seed.db`) | **RESTE** : clés `asarUnpack`/`extraResources` commentées, à activer + générer `seed.db`. |
| **Bascule globale du soft-delete** | **RESTE** : aujourd'hui opt-in (`PrismaService.softDelete`). |
| **Test multi-postes concurrents** | **RESTE** : valider 2 postes ↔ 1 central avec conflits réels. |
| **Signature de code** | **À faire en production** : sans certificat, SmartScreen « Éditeur inconnu ». |

> En résumé : le **client de bureau en mode distant est livré et empaqueté** (installeur NSIS par-utilisateur, sans admin) ; le **mode local autonome est codé et son moteur de synchro validé en dev**, l'**empaquetage de l'installateur autonome** restant à finaliser sur la machine de build.

---

## 11. Récapitulatif des fichiers clés (preuves)

| Domaine | Chemin |
|---|---|
| Processus principal Electron | `apps/desktop/electron/main.ts` |
| Config / résolution URL / DPAPI | `apps/desktop/electron/config.ts` |
| Backend embarqué (fork, loopback) | `apps/desktop/electron/backend.ts` · `backend-entry.ts` |
| Init base SQLite locale (copie `seed.db`) | `apps/desktop/electron/db-init.ts` |
| Pont sécurisé (contextBridge) | `apps/desktop/electron/preload.ts` |
| Mise à jour automatique | `apps/desktop/electron/updater.ts` |
| Écran « Connexion au serveur » | `apps/desktop/electron/server-config.html` |
| Défaut figé au build | `apps/desktop/dist-electron/defaults.json` |
| Configuration packaging | `apps/desktop/electron-builder.yml` |
| Scripts npm (dist, clean…) | `apps/desktop/package.json` |
| Script NSIS custom (2-en-1 + nettoyage) | `apps/desktop/build/installer.nsh` |
| Copie du renderer | `apps/desktop/scripts/copy-renderer.mjs` |
| Génération assets installeur | `apps/desktop/scripts/gen-installer-assets.mjs` |
| Installeur produit (mode remote) | `apps/desktop/release/CMS SARIS-Setup-1.0.0.exe` |
| Documentation de référence | `apps/desktop/README.md` |
| Session côté frontend (web/desktop) | `apps/web/src/stores/session-storage.ts` |
