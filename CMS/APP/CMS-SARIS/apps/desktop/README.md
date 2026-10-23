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

L'installeur est **sur-mesure** (NSIS, `installer/cms-saris.nsi`, voir « Installateur » plus bas) :
installation par utilisateur (sans admin), raccourcis, et une page dédiée quand CMS SARIS est
déjà installé. L'exécutable autonome est aussi disponible sans installation dans
`release/win-unpacked/CMS SARIS.exe`.

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

### Installateur et désinstallation

L'installateur ([`installer/cms-saris.nsi`](./installer/cms-saris.nsi)) :

- **Déjà installé ?** Une page propose *Mettre à jour* (par défaut, données conservées), *Réinstaller à
  neuf* ou *Désinstaller*, en montrant la version installée, la taille des données du poste et le
  **travail pas encore envoyé au serveur**. Mise à jour automatique et installation silencieuse
  mettent à jour sans rien demander et gardent toutes les données.
- **Ne perd rien sans sauvegarde.** Avant toute suppression de la base locale, une sauvegarde datée
  (`cms-saris-AAAAMMJJ-HHMMSS.db`, avec son journal) est rangée dans
  `%LOCALAPPDATA%\CMS SARIS Sauvegardes` — volontairement hors de `Documents`, que OneDrive peut
  synchroniser (ce sont des données de santé). Si la sauvegarde échoue, rien n'est supprimé. Une
  installation neuve qui trouve une sauvegarde propose de la reprendre.
- **Fermeture douce.** L'application ouverte est détectée par sa fenêtre interne `Chrome_MessageWindow`
  (titre = `%APPDATA%\CMS SARIS`) : Electron ne crée **pas** de mutex `cg.sariscongo.cms`, une
  détection par mutex ne se déclenche jamais. Le bouton « Fermer CMS SARIS pour moi » relance
  `CMS SARIS.exe --quitter` : l'instance en cours envoie son travail restant au serveur (25 s au
  plus) puis s'arrête (`quitterProprement`, `electron/main.ts`). Les versions d'avant la 1.11.0
  ignorent l'argument : l'installateur attend puis demande de fermer à la main.
- **Fichier d'état.** L'application écrit `%APPDATA%\CMS SARIS\etat-poste.ini` (travail non envoyé,
  relevé chaque minute et à la fermeture) ; c'est ce que l'installateur et le désinstallateur lisent.
  `GET /sync/en-attente` (loopback) le fournit à l'application.
- **Mise à jour propre.** Les anciens `resources\` et `locales\` sont retirés avant la copie (les
  fichiers disparus d'une version à l'autre ne traînent plus) ; `sqlite-migrations` est empaqueté (sans
  lui, un poste mis à jour n'appliquait aucune migration — manquait jusqu'à la 1.10.0).
  `build-installer.mjs` refuse de compiler si un élément de `resources\` n'est pas empaqueté.
- **Contrôles préalables.** Windows 10 ou plus et 64 bits (Electron 33 ne démarre pas autrement),
  place disque (`TAILLE_MB` mesurée au build : neuf = taille + 100 Mo ; mise à jour avec filet =
  taille + 300 Mo). Échec : code de sortie 8, rien d'installé.
- **Retour arrière automatique.** Une mise à jour ne supprime pas l'ancienne version : elle est
  **renommée** `CMS SARIS.ancien` (instantané), la nouvelle s'installe à sa place, puis la vérification
  ci-dessous la fait démarrer. Réussie → l'ancienne est supprimée. Ratée, ou installation interrompue
  (erreur de copie, annulation → `.onInstFailed`) → la nouvelle est supprimée et l'ancienne remise en
  place, avec sa version dans le registre (code 9 si la vérification a échoué). Un `.ancien` laissé par
  une coupure est remis en place au lancement suivant (`RecupererAncien`). Pas assez de place pour garder
  les deux versions, ou dossier personnalisé : mise à jour sans filet (confirmation demandée en
  interactif). ⚠️ NSIS garde son répertoire courant dans le dossier d'installation (`SetOutPath`) : il
  faut en sortir (`SetOutPath "$TEMP"`) avant de le supprimer, sinon le renommage échoue.
- **Écran de santé.** `installer/verifier-installation.cjs` (installé dans `resources\`) est lancé par
  l'installateur avec le moteur d'Electron en mode Node (`ELECTRON_RUN_AS_NODE`, posé le temps du contrôle
  seulement) : fichiers essentiels présents, service local démarré sur une copie de `seed.db`, puis sur une
  COPIE de la base réelle du poste (la mise à niveau est essayée sans toucher à la vraie), serveur central
  joignable (information seulement). Les lignes s'affichent dans le journal, la page attend un clic
  (`MUI_FINISHPAGE_NOAUTOCLOSE`). Compter ≈ 20 s (45 s à froid). Rapport détaillé en cas d'échec :
  `%TEMP%\cms-saris-verification.txt`. Codes de sortie : 5 application ouverte, 6 sauvegarde impossible,
  7 chemin trop long, 8 Windows ou place disque, 9 vérification ratée.
- **Désinstallation.** Les données du poste (base, configuration) sont **conservées par défaut** : une
  case les supprime (avec sauvegarde d'abord). En silencieux : `/PURGE` les supprime,
  `/SANSSAUVEGARDE` saute la sauvegarde (l'installateur l'a déjà faite).
- **Dossier choisi.** Il finit toujours par `CMS SARIS` : le désinstallateur supprime ce dossier en
  entier, il ne doit jamais pointer sur `Documents` ou la racine d'un disque. Sans le nom de
  l'application (installation d'une ancienne version), seuls les fichiers de l'application sont retirés.
- **Chemin trop long refusé.** NSIS 3.0.4.1 n'extrait pas, **sans le dire**, un fichier dont le chemin
  complet dépasse ~230 caractères (constaté : 352 fichiers perdus, dont des `.js` de `@nestjs`, dans un
  dossier d'essai profond — le service local ne démarrait plus). `build-installer.mjs` mesure le plus
  long chemin relatif de l'application (`-DMAXREL`), le `.nsi` en déduit `LIMITE_CHEMIN` et refuse un
  dossier trop profond (« Suivant » grisé ; en silencieux : code de sortie 7, rien d'installé). Le
  dossier par défaut (`%LOCALAPPDATA%\Programs\CMS SARIS`) est très en dessous.

### Déployer sur plusieurs postes

Pour installer une vingtaine de postes sans retaper l'adresse du serveur, le site et le nom de chacun :

1. Copier [`installer/deploiement.exemple.ini`](./installer/deploiement.exemple.ini), nommer la copie
   `deploiement.ini`, la remplir (`serveur=`, `site=` — le **code** du site —, `poste=`, où `{MACHINE}` devient
   le nom de l'ordinateur).
2. Poser `deploiement.ini` **à côté** de `CMS SARIS-Setup-x.y.z.exe` (clé USB, dossier partagé).
3. Sur chaque poste, double-clic sur l'installateur : au premier lancement, l'écran de configuration est déjà
   rempli (adresse du serveur, site pré-sélectionné « prévu par le déploiement », nom du poste).

Ou par script (installation silencieuse), les options l'emportent sur le fichier, clé par clé :

```powershell
& ".\CMS SARIS-Setup-1.11.2.exe" /S /SERVEUR=https://cms-saris.exemple.org /SITE=BZV-01 /POSTE=Accueil 1 /D=C:\CMS-SARIS
```

Les options sont séparées par « espace + / » (donc `/D=` en dernier) ; une valeur peut contenir des espaces, avec ou sans
guillemets. Une adresse qui ne commence pas par `http://` ou `https://` est ignorée (jamais devinée). Tout est écrit dans
`%APPDATA%\CMS SARIS\deploiement.ini`, lu par `electron/deploiement.ts` : de simples **valeurs par défaut** — dès que le poste
est configuré, `config.json` fait foi, et relancer l'installateur n'y change rien. Le site n'est jamais deviné : code
ou libellé **exact**, sinon l'écran demande de choisir.

⚠️ Ce qui reste à saisir sur CHAQUE poste : l'**identifiant et le mot de passe** d'un compte autorisé (et son code 2FA), car
le poste s'authentifie au serveur avec un vrai compte. Un code d'appairage (le technicien ne connaîtrait plus aucun mot de
passe) demande un nouveau point d'entrée sur le serveur : non fait.

🔒 L'adresse du serveur pré-remplie reste visible et modifiable à l'écran : la personne qui configure le poste doit la
vérifier avant de saisir ses identifiants (un `deploiement.ini` altéré pourrait pointer vers un faux serveur — gardez la clé
USB et le dossier partagé en lecture seule).

Tests : `pnpm --filter @cms-saris/desktop test` (lecture du fichier, recherche du site, décodage UTF-8 / Windows-1252 / UTF-16).

Options de l'installateur en mode silencieux (`/S`) : `/ACTION=neuf` (sauvegarde, supprime l'ancienne
installation et ses données, réinstalle), `/RESTAURER=1` (reprend la dernière sauvegarde si le poste n'a
pas de base locale), `/D=<dossier>` (dernier argument). Compiler pour un essai : `makensis -DRAPIDE …`
(zlib, une minute au lieu de six — jamais pour une version diffusée).

## Icône

Le logo vient des symboles officiels du web (`apps/web/public/symbole_saris_*.png`) :
`node scripts/gen-logo.mjs` produit `electron/setup-logo.png` (fonds clairs, aussi l'icône de l'application)
et `electron/setup-logo-sombre.png` (colonne et animation de l'installateur). `build-local.mjs` recopie
`build/icon.png` depuis `setup-logo.png` à **chaque** build.

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
# depuis la racine — enchaîne les DEUX étapes ci-dessous
pnpm --filter @cms-saris/desktop dist
```

Soit, en détail :

```bash
# depuis apps/desktop — build complet du client autonome (dossier non empaqueté)
node scripts/build-local.mjs --dir

# puis, l'installeur NSIS sur-mesure (affichage temps réel + double barre de progression) :
node installer/build-installer.mjs
```

⚠️ Ne PAS produire l'installeur avec `electron-builder` seul : il génère un assistant
générique, sans barres de progression ni panneau animé, et sous le MÊME nom de fichier —
il écraserait silencieusement l'installeur sur-mesure.

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
