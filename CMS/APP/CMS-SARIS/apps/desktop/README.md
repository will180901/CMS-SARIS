# CMS SARIS — Client de bureau (Windows)

Application de bureau **Electron** qui embarque le frontend (`apps/web`, build
`--mode desktop`), en deux modes :

- **`remote` (par défaut)** : client léger, dialogue avec l'**API distante** (NestJS) en
  HTTPS — pas de serveur ni de base embarqués.
- **`local` (offline-first)** : embarque en plus une copie compilée de l'**API NestJS et
  une base SQLite locale** (process forké, `127.0.0.1` uniquement — jamais exposé au
  réseau), avec synchronisation vers le serveur central. Voir « Mode local » plus bas.

- Frontend servi via un schéma applicatif privilégié **`app://cms-saris`** (origine
  stable, autorisée en CORS côté serveur — indispensable au flux SSE des notifications).
- URL du serveur **configurable** (environnement → `config.json` → écran de connexion).
- **Mise à jour automatique** (electron-updater).
- Conventions Windows : installation par utilisateur, raccourcis, désinstalleur,
  données en `%APPDATA%`, secrets chiffrés **DPAPI**.

## Prérequis (poste de build)

- Node 20+ et **pnpm** (déjà utilisés par le monorepo). Rien d'autre : Electron se
  build avec Node seul (pas de Rust ni de compilateur C++).
- `pnpm install` à la racine du monorepo (installe Electron + electron-builder).

## Build de l'installeur

```bash
# depuis la racine du monorepo
pnpm install

# produit l'installeur Windows (.exe NSIS) dans apps/desktop/release/
pnpm --filter @cms-saris/desktop dist
```

Étapes enchaînées par `dist` : build du frontend en mode desktop
(`vite build --mode desktop`) → compilation du code Electron → copie du frontend dans
`app/` → packaging NSIS. Résultat : `apps/desktop/release/CMS SARIS-Setup-<version>.exe`.

Autres commandes :

```bash
pnpm --filter @cms-saris/desktop start          # lance l'app (après un build)
pnpm --filter @cms-saris/desktop dist:unpacked   # dossier non empaqueté (debug)
pnpm --filter @cms-saris/desktop clean           # nettoie dist-electron/ app/ release/
```

L'installeur est **assisté** (`oneClick: false`, NSIS 2-en-1 : détecte une install existante et
propose Réinstaller/Désinstaller, sinon installe) : quelques clics → installation par
utilisateur (sans admin) → raccourcis → lancement automatique. L'exécutable autonome est aussi
disponible sans installation dans `release/win-unpacked/CMS SARIS.exe`.

### Dépannage build

- **`Cannot create symbolic link … winCodeSign … darwin … .dylib` (« le client ne dispose pas
  d'un privilège nécessaire »)** : electron-builder n'arrive pas à extraire `winCodeSign` car la
  création de liens symboliques (fichiers macOS inutiles sur Windows) requiert un privilège.
  Solutions, au choix :
  1. **Activer le Mode développeur Windows** (Paramètres → Confidentialité et sécurité → Pour les
     développeurs), ou lancer le terminal **en administrateur**, puis relancer `dist` ; **ou**
  2. **Pré-extraire le cache sans les symlinks** (sans admin) — une seule fois :
     ```powershell
     $cache = "$env:LOCALAPPDATA\electron-builder\Cache\winCodeSign"
     $sz = "<repo>\node_modules\.pnpm\7zip-bin@5.2.0\node_modules\7zip-bin\win\x64\7za.exe"
     & $sz x "$cache\*.7z" "-o$cache\winCodeSign-2.6.0" -xr!darwin -xr!linux -y
     ```
     puis relancer `electron-builder --win` (le cache est ensuite réutilisé).

## URL du serveur distant

Résolue à l'exécution, par ordre de priorité :

1. **Variable d'environnement** `SARIS_API_URL` (déploiement piloté / GPO).
2. **`config.json`** — `%APPDATA%\CMS SARIS\config.json` (réglée via l'écran de connexion
   ou le menu *Fichier → Paramètres du serveur…*).
3. **Défaut figé au build** — variable `SARIS_DEFAULT_API_URL` au moment du `dist`
   (optionnel). Si rien n'est résolu, l'app ouvre l'écran **« Connexion au serveur »**
   au premier lancement.

Figer un défaut au build :

```bash
# PowerShell
$env:SARIS_DEFAULT_API_URL = "https://api.saris.exemple.cg"
pnpm --filter @cms-saris/desktop dist
```

> **⚠️ Sécurité — exiger HTTPS en production.** `SARIS_DEFAULT_API_URL` (et toute URL
> configurée) **DOIT être une URL `https://` de production**. Une URL en `http://`
> (y compris `http://localhost:3000`) fait transiter les **jetons d'authentification,
> le refresh token et les données patient EN CLAIR** sur le réseau — interception
> triviale (sniffing, proxy, Wi-Fi). `http://localhost` n'est tolérable **qu'en
> développement local** sur le poste lui-même. Ne **jamais** figer une URL `http://`
> non-loopback dans un build distribué. Côté serveur, exiger HTTPS avec certificat
> valide : `fetch`/`EventSource` (SSE des notifications) échouent sinon.

## À préparer côté serveur distant

- **CORS** : autoriser l'origine du client de bureau. Elle est déjà ajoutée
  automatiquement par l'API (`app://cms-saris`). Pour plusieurs origines web, utiliser
  `CORS_ORIGINS="https://app.exemple.cg,https://autre.exemple"` (sinon `FRONTEND_URL`).
- **HTTPS** avec certificat valide (sinon `fetch`/`EventSource` échouent).
- `TRUST_PROXY` réglé derrière le reverse-proxy.

## Mise à jour automatique (GitHub Releases)

Le canal est **déjà configuré** sur **GitHub Releases** (`publish: provider github`,
dépôt `will180901/CMS-SARIS`) dans [`electron-builder.yml`](./electron-builder.yml)
et `electron-builder.yml`.

**Expérience utilisateur (façon grandes apps).** Au démarrage, l'app vérifie
silencieusement la dernière release. Si une version plus récente existe, une **bulle
apparaît au-dessus du menu utilisateur** (dans la sidebar) :

1. *« Mise à jour disponible vX.Y.Z »* + bouton **Mettre à jour** → télécharge (avec %).
2. Une fois téléchargée → bouton **Redémarrer** → installe et relance l'app.

Implémentation : `electron/updater.ts` (events electron-updater → IPC `saris:update-status`),
`electron/preload.ts` (`window.saris.updates`), et côté web `hooks/useAppUpdates.ts` +
`components/layout/UpdateBubble.tsx`. Ne s'active qu'en build **packagé** (pas en dev).

**Publier une mise à jour.** Bumper la version (`apps/desktop/package.json`), builder
(`pnpm --filter @cms-saris/desktop dist` pour le mode distant, ou
`node apps/desktop/scripts/build-local.mjs` pour le mode local), puis créer une
**Release GitHub** et y téléverser l'installeur `.exe` **+ le `latest.yml`** générés dans
`release/`. Les clients installés détectent alors la nouvelle version au prochain démarrage.

> ⚠️ **Signature requise pour l'auto-update en production** : electron-updater peut refuser
> d'appliquer une mise à jour non signée. Configurer la signature (section ci-dessous) avant
> de diffuser des releases auto-installables.

## Signature de code (INDISPENSABLE en production médicale)

**Pourquoi c'est indispensable, pas « recommandé »** : sans signature **Authenticode**,
- **Windows SmartScreen** affiche « Éditeur inconnu » et bloque l'exécution (l'utilisateur
  doit forcer manuellement) ;
- les **antivirus / EDR** peuvent mettre l'`.exe` en quarantaine (faux positif sur binaire
  inconnu) — inacceptable sur un poste clinique ;
- l'**auto-update** electron-updater peut refuser d'appliquer une mise à jour non signée.

Pour un logiciel manipulant des **données de santé**, la signature (+ horodatage) est un
prérequis de déploiement, pas une option.

### Quoi obtenir

- **Certificat OV** (Organization Validation) : le moins cher, réduit l'avertissement
  SmartScreen (réputation qui se construit avec le volume de téléchargements).
- **Certificat EV** (Extended Validation, sur token matériel/HSM) : confiance SmartScreen
  **immédiate**, sans période de réputation. Recommandé pour une diffusion large.
- **Azure Trusted Signing** (ex-Azure Code Signing) : alternative cloud (signature gérée
  côté Azure, pas de token physique à manipuler en CI).

Dans **tous** les cas : **horodatage RFC 3161** obligatoire (`rfc3161TimeStampServer`),
sinon la signature devient invalide à l'expiration du certificat. Algorithme **SHA-256**.

### Comment configurer

La configuration est **déjà préparée et commentée** dans
[`electron-builder.yml`](./electron-builder.yml) (section `win`) : `certificateFile`,
`CSC_LINK` / `CSC_KEY_PASSWORD` (variables d'env, à privilégier en CI — **aucun secret
dans le dépôt**), `signingHashAlgorithms`, `rfc3161TimeStampServer`, et l'option token
EV / Azure. Décommentez l'option correspondant à votre certificat.

> Ne committez **jamais** le `.pfx` ni le mot de passe. Utilisez les variables
> d'environnement `CSC_LINK` (chemin ou base64 du `.pfx`) et `CSC_KEY_PASSWORD`.

## Conventions & emplacements (Windows)

| Élément | Emplacement |
|---|---|
| Installation (par utilisateur, sans admin) | `%LOCALAPPDATA%\Programs\CMS SARIS` |
| Configuration | `%APPDATA%\CMS SARIS\config.json` |
| Secrets chiffrés (DPAPI) | `%APPDATA%\CMS SARIS\secure.bin` |
| Base SQLite locale (mode local) | `%APPDATA%\CMS SARIS\cms-saris.db` (+ `-wal`/`-shm`) |
| Journaux | `%APPDATA%\CMS SARIS\logs`, `%APPDATA%\CMS SARIS\backend.log` |
| Raccourcis | Menu Démarrer + Bureau |
| Désinstallation | « Applications et fonctionnalités » Windows |

### Désinstallation propre

Le désinstalleur ([`build/installer.nsh`](./build/installer.nsh)) :

- **refuse de s'exécuter si l'application tourne** (vérif. du mutex Electron
  `cg.sariscongo.cms`) — évite de corrompre la base SQLite (verrous WAL) ou de laisser
  des fichiers verrouillés ; l'installeur applique le même garde-fou ;
- supprime, en plus de `deleteAppDataOnUninstall`, la **base SQLite locale et ses
  annexes** (`cms-saris.db`, `-wal`, `-shm`, `-journal`), `backend.log`, le dossier
  `logs\`, puis `%APPDATA%\CMS SARIS` et `%LOCALAPPDATA%\CMS SARIS` complets — **aucune
  trace** après désinstallation.

> Note **multi-profils** : l'installeur est `perMachine: false` (par-utilisateur), donc
> le nettoyage cible le profil courant, ce qui suffit. Si l'on bascule un jour sur
> `perMachine: true`, le nettoyage des données par-utilisateur de **chaque** compte
> Windows devra énumérer les profils (voir commentaire dans `installer.nsh`).

## Icône

`build/icon.png` (512×512). Remplacer par le logo définitif si besoin (≥ 256×256).

## Stockage sécurisé des jetons (actif en desktop)

La session (dont le **refresh token**) est stockée :

- **Web** : `sessionStorage` (éphémère, effacée à la fermeture — règle de sécurité JWT).
- **Desktop** : coffre **DPAPI** (`%APPDATA%\CMS SARIS\secure.bin`), chiffré au repos et
  lié au compte Windows. La session **survit donc au redémarrage** (« rester connecté »
  sécurisé) — le jeton n'est jamais en clair. Implémentation :
  [`apps/web/src/stores/session-storage.ts`](../web/src/stores/session-storage.ts) ; le
  blob est amorcé synchroniquement par le preload (`window.__SARIS_SESSION__`) pour éviter
  tout flash de déconnexion au lancement.

## Mode local offline-first (backend embarqué + SQLite) — packaging

Par défaut l'app est en **mode `remote`** (client du serveur distant, section précédente).
Le **mode `local`** (offline-first) embarque en plus une **copie compilée de `apps/api`**
(NestJS) et une base **SQLite** locale dans un process forké, qui n'écoute que sur
`127.0.0.1` (jamais exposé au réseau du poste) — implémentation :
`electron/{backend,backend-entry,db-init}.ts`, `config.ts` (mode/serverUrl), `main.ts`
(`initBackend`, bascule connecté/autonome par sonde `/health/ping`), API `/sync/*` + client
de synchro + cron de purge.

**Le packaging est entièrement automatisé** (pas de manipulation manuelle de
`electron-builder.yml`) via un pipeline dédié, distinct du build « remote » de la section
précédente :

```bash
# depuis apps/desktop — build complet du client autonome (dossier non empaqueté)
node scripts/build-local.mjs --dir

# puis, l'installeur NSIS sur-mesure (affichage temps réel + double barre de progression) :
node installer/build-installer.mjs
```

`scripts/build-local.mjs` enchaîne : build du renderer (`vite build --mode desktop`) →
compilation Electron → **build de `apps/api`** (`pnpm --filter api build`) → génération du
client Prisma SQLite + **`build/seed.db`** (base SQLite pré-migrée, schéma seul, aucune
donnée — copiée par `electron/db-init.ts` vers `%APPDATA%\CMS SARIS\cms-saris.db` au 1er
lancement) → déploiement de l'API compilée (avec ses dépendances à plat) dans
`build/api-runtime/` → écriture de `dist-electron/defaults.json` (mode `local` + secrets
lus depuis `apps/api/.env`) → `electron-builder --win`
(config **séparée** de `electron-builder.yml`, avec ses propres `extraResources`
`build/api-runtime → api`, `build/sqlite-client → sqlite-client`, `build/seed.db → seed.db`).
Le mode distant par défaut n'est jamais affecté : ce pipeline ne touche à aucun fichier
utilisé par `pnpm --filter @cms-saris/desktop dist`.

`installer/build-installer.mjs` prend ensuite le relais pour produire l'installeur final
signé (`release/CMS SARIS-Setup-<version>.exe` + `latest.yml`) à partir du
`win-unpacked` généré ci-dessus — voir [`installer/cms-saris.nsi`](./installer/cms-saris.nsi).

⚠️ Pipeline vérifié statiquement (chemins, noms de fichiers, options electron-builder
cohérents de bout en bout) ; à valider par un build réel sur la machine cible (engines
Prisma SQLite après `asarUnpack`, démarrage effectif du fork via `backend-entry.js`, 1er
lancement avec copie de `seed.db`).
