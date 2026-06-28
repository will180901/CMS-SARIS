/**
 * Processus principal Electron — CMS SARIS Desktop (client du serveur distant).
 *
 * Le frontend (apps/web, build « desktop ») est servi via un schéma applicatif
 * privilégié `app://cms-saris` : origine STABLE et autorisable côté CORS du serveur
 * (indispensable pour le flux SSE des notifications). Aucun serveur ni base de
 * données n'est embarqué — l'app dialogue en HTTPS avec l'API distante.
 */
import { app, BrowserWindow, Menu, dialog, ipcMain, nativeTheme, protocol, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import log from 'electron-log/main'
import { resolveApiUrl, resolveMode, resolveServerUrl, readConfig, writeConfig, secureGet, secureSet, secureDel, bakedSecrets } from './config'
import { initAutoUpdater, checkForUpdates, downloadUpdate, quitAndInstall } from './updater'
import { startBackend, findFreePort, stopBackend } from './backend'
import { ensureDb } from './db-init'
import {
  isSyncConfigured, setupSync, refreshAccessToken, startRefreshTimer, stopRefreshTimer,
  clearSync, getPosteLocalId, syncTokenFilePath,
} from './sync-auth'

const APP_SCHEME = 'app'
const APP_HOST = 'cms-saris' // origine : app://cms-saris
const SESSION_KEY = 'cms-saris-session' // doit correspondre à SESSION_PERSIST_KEY (frontend)
const RENDERER_DIR = path.join(__dirname, '..', 'app') // frontend copié ici au build
const DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] // dev : http://localhost:5173

// Nom d'application PROPRE → userData = %APPDATA%\CMS SARIS (sinon le `name` du package.json
// « @cms-saris/desktop » crée un dossier imbriqué `@cms-saris\desktop`). À définir AVANT tout
// accès à app.getPath('userData') (electron-log, config, backend).
app.setName('CMS SARIS')

log.initialize()
log.transports.file.level = 'info'

let mainWindow: BrowserWindow | null = null
/** URL d'API effective : serveur distant (mode remote) ou backend local 127.0.0.1 (mode local). */
let effectiveApiUrl: string | null = null
/** Mode local non configuré (1er lancement / session expirée) → écran de configuration. */
let needsLocalSetup = false
// Bascule « online-first » (mode local) : le renderer parle au CENTRAL en ligne / au backend
// LOCAL hors-ligne. `rendererApiUrl` = URL active poussée au renderer (≠ effectiveApiUrl = local).
let serverOnline = false
let rendererApiUrl: string | null = null
let connectivityTimer: ReturnType<typeof setInterval> | null = null

// Le schéma doit être déclaré AVANT app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
])

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.map': 'application/json',
  '.txt': 'text/plain',
}

/** Sert le frontend local sous app://cms-saris/… (avec repli SPA sur index.html). */
function registerAppProtocol(): void {
  protocol.handle(APP_SCHEME, async (request) => {
    const url = new URL(request.url)
    let rel = decodeURIComponent(url.pathname)
    if (!rel || rel === '/') rel = '/index.html'
    const filePath = path.normalize(path.join(RENDERER_DIR, rel))
    if (!filePath.startsWith(RENDERER_DIR)) {
      return new Response('Forbidden', { status: 403 })
    }
    try {
      const data = await fs.promises.readFile(filePath)
      const ext = path.extname(filePath).toLowerCase()
      return new Response(data, { headers: { 'Content-Type': MIME[ext] ?? 'application/octet-stream' } })
    } catch {
      // Route inconnue (SPA) → index.html
      const index = await fs.promises.readFile(path.join(RENDERER_DIR, 'index.html'))
      return new Response(index, { headers: { 'Content-Type': 'text/html' } })
    }
  })
}

/** Dimensionne la fenêtre : COMPACTE (taille du formulaire) pour les écrans de config,
 *  PLEINE pour l'application. */
function sizeWindow(kind: 'setup' | 'app'): void {
  if (!mainWindow) return
  if (kind === 'setup') {
    mainWindow.setResizable(false)
    mainWindow.setMaximizable(false)
    mainWindow.setMinimumSize(460, 600)
    mainWindow.setContentSize(460, 660)
    mainWindow.setBackgroundColor('#eef2f6')
    if (process.platform === 'win32') {
      mainWindow.setTitleBarOverlay({ color: '#eef2f6', symbolColor: '#54606e', height: 40 })
    }
  } else {
    mainWindow.setResizable(true)
    mainWindow.setMaximizable(true)
    mainWindow.setMinimumSize(1024, 680)
    mainWindow.setSize(1320, 860)
  }
  mainWindow.center()
}

function loadServerConfig(): void {
  if (!mainWindow) return
  sizeWindow('setup')
  void mainWindow.loadFile(path.join(__dirname, 'server-config.html'))
  mainWindow.show()
}

/** Écran de 1er lancement (mode local) : configuration du poste + login central. */
function loadSyncSetup(): void {
  if (!mainWindow) return
  sizeWindow('setup')
  void mainWindow.loadFile(path.join(__dirname, 'sync-setup.html'))
  mainWindow.show()
}

function loadApplication(): void {
  if (!mainWindow) return
  sizeWindow('app')
  if (DEV_SERVER_URL) void mainWindow.loadURL(DEV_SERVER_URL)
  else void mainWindow.loadURL(`${APP_SCHEME}://${APP_HOST}/index.html`)
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 680,
    backgroundColor: '#0D1117',
    title: 'CMS SARIS',
    show: false,
    // Barre de titre custom (façon WhatsApp) : pas de menu natif, mais on conserve les
    // boutons système (réduire / agrandir / fermer) via l'overlay, thématisé.
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0D1117', symbolColor: '#E6EDF3', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Durcissement securite (application medicale) :
      //  - contextIsolation: true  → le frontend ne partage AUCUN contexte JS avec le
      //    preload/Node ; seul le pont expose par contextBridge (preload.ts) est visible.
      //  - nodeIntegration: false  → aucun acces a `require`/Node depuis le renderer.
      //  - sandbox: true           → renderer dans un bac a sable OS (Chromium sandbox) ;
      //    le preload ne peut utiliser que les API IPC + un sous-ensemble Node (pas de fs/net).
      //  - webSecurity reste a sa valeur par defaut (true) : SOP/CORS appliques.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  })

  mainWindow.once('ready-to-show', () => mainWindow?.show())

  // Liens externes → navigateur par défaut (jamais dans la fenêtre de l'app).
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) void shell.openExternal(url)
    return { action: 'deny' }
  })
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const target = new URL(url)
    const here = `${APP_SCHEME}:`
    if (target.protocol !== here && !(DEV_SERVER_URL && url.startsWith(DEV_SERVER_URL))) {
      event.preventDefault()
      if (url.startsWith('http')) void shell.openExternal(url)
    }
  })

  // Raccourcis utiles (la barre de menu native est désactivée) : F12 = outils dev,
  // Ctrl+R = recharger.
  mainWindow.webContents.on('before-input-event', (_e, input) => {
    if (input.type !== 'keyDown') return
    const k = input.key.toLowerCase()
    if (k === 'f12') mainWindow?.webContents.toggleDevTools()
    else if (input.control && k === 'r') mainWindow?.webContents.reload()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Backend prêt → app ; mode local non configuré → écran de config ; sinon → connexion serveur.
  if (effectiveApiUrl) loadApplication()
  else if (needsLocalSetup) loadSyncSetup()
  else loadServerConfig()
}

let appMenu: Menu | null = null

/**
 * Menu de l'application présenté en POPUP (déclenché par le bouton « ⋮ » de la barre
 * de titre custom). Aucune barre de menu native — remplacée par la barre de titre custom.
 */
function buildAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    { label: 'Paramètres du serveur…', click: () => loadServerConfig() },
    { type: 'separator' },
    { role: 'reload', label: 'Recharger' },
    { role: 'togglefullscreen', label: 'Plein écran' },
    { role: 'toggleDevTools', label: 'Outils de développement' },
    { type: 'separator' },
    { label: 'Vérifier les mises à jour…', click: () => checkForUpdates() },
    {
      label: 'À propos',
      click: () =>
        void dialog.showMessageBox({
          type: 'info',
          title: 'À propos de CMS SARIS',
          message: 'CMS SARIS — Centre médical',
          detail: `Version ${app.getVersion()}\nClient de bureau Windows.\nServeur : ${resolveApiUrl() || '(non configuré)'}\n\nDéveloppé par Déo Cherel BOUWAYI MIKOUYA.\n© 2026 — SARIS-CONGO`,
        }),
    },
    { type: 'separator' },
    { role: 'quit', label: 'Quitter' },
  ]
  appMenu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(null) // pas de barre de menu native
}

function registerIpc(): void {
  // Lecture SYNCHRONE par le preload (avant le chargement du frontend).
  ipcMain.on('saris:config', (event) => {
    event.returnValue = {
      apiUrl: rendererApiUrl ?? effectiveApiUrl ?? resolveApiUrl(),
      appVersion: app.getVersion(),
      platform: process.platform,
      serverUrl: resolveServerUrl(),
    }
  })
  ipcMain.handle('saris:get-config', () => ({ apiUrl: resolveApiUrl(), appVersion: app.getVersion() }))
  ipcMain.handle('saris:set-api-url', (_e, url: string) => {
    writeConfig({ apiUrl: String(url ?? '') })
    app.relaunch()
    app.exit(0)
    return { ok: true }
  })
  // Configuration du poste (mode local, 1er lancement) : login au central. Si OK → démarre
  // le backend embarqué (qui lance la 1ère synchro) puis charge l'application.
  ipcMain.handle('saris:sync-setup', async (
    _e,
    params: { serverUrl: string; login: string; password: string; totpCode?: string; tempToken?: string },
  ) => {
    const res = await setupSync(params.serverUrl, params.login, params.password, params.totpCode, params.tempToken)
    // On répond TOUT DE SUITE (l'écran affiche la progression via saris:setup-status), puis
    // on démarre le backend local + on charge l'app — ou on signale l'erreur, sans bloquer.
    if (res.ok) setImmediate(() => { void completeLocalStartup() })
    return res
  })
  ipcMain.handle('saris:check-updates', () => checkForUpdates())
  ipcMain.handle('saris:update-download', () => downloadUpdate())
  ipcMain.handle('saris:update-install', () => quitAndInstall())
  // Ouvre une URL (page de téléchargement) dans le navigateur système.
  ipcMain.handle('saris:open-external', (_e, url: string) => {
    if (typeof url === 'string' && /^https?:\/\//i.test(url)) void shell.openExternal(url)
  })
  // Mise à jour pilotée par une ANNONCE admin : télécharge l'installeur (.exe) depuis
  // l'URL fournie, puis le lance et FERME l'app (l'installeur intelligent gère la mise à
  // niveau ; le délai de 2 s libère le mutex « app en cours d'exécution »).
  ipcMain.handle('saris:install-from-url', async (_e, url: string) => {
    try {
      if (typeof url !== 'string' || !/^https?:\/\//i.test(url)) return { ok: false, error: 'URL invalide' }
      const res = await fetch(url)
      if (!res.ok) return { ok: false, error: `Téléchargement échoué (HTTP ${res.status})` }
      const buf = Buffer.from(await res.arrayBuffer())
      const file = path.join(app.getPath('temp'), `CMS-SARIS-Setup-${Date.now()}.exe`)
      await fs.promises.writeFile(file, buf)
      // Lance l'installeur ~2 s APRÈS (le temps que l'app se ferme), détaché de l'app.
      // `ping` = délai fiable sans console (timeout échoue avec stdio:ignore) ; `start ""`
      // gère les espaces du chemin temp. shell:true → cmd.exe préserve les guillemets.
      spawn(`ping 127.0.0.1 -n 3 >nul & start "" "${file}"`, {
        shell: true, detached: true, stdio: 'ignore', windowsHide: true,
      }).unref()
      setTimeout(() => app.quit(), 400)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
  // Synchronise le thème NATIF (barre de titre Windows + menus + fond fenêtre) avec
  // le thème choisi dans l'application (clair / sombre / système).
  ipcMain.handle('saris:set-native-theme', (_e, theme: string) => {
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      nativeTheme.themeSource = theme
      const dark = theme === 'dark' || (theme === 'system' && nativeTheme.shouldUseDarkColors)
      mainWindow?.setBackgroundColor(dark ? '#0D1117' : '#F4F6F8')
      if (process.platform === 'win32') {
        mainWindow?.setTitleBarOverlay({
          color: dark ? '#0D1117' : '#F4F6F8',
          symbolColor: dark ? '#E6EDF3' : '#242B34',
          height: 40,
        })
      }
    }
  })
  // Chargement SYNCHRONE du blob de session chiffré (lu par le preload au démarrage).
  ipcMain.on('saris:session-load', (event) => {
    event.returnValue = secureGet(SESSION_KEY)
  })
  ipcMain.handle('saris:secure-get', (_e, key: string) => secureGet(key))
  ipcMain.handle('saris:secure-set', (_e, key: string, value: string) => secureSet(key, value))
  ipcMain.handle('saris:secure-del', (_e, key: string) => secureDel(key))
  // Ouvre le menu de l'app en popup (bouton « ⋮ » de la barre de titre custom).
  ipcMain.handle('saris:open-menu', () => {
    if (appMenu && mainWindow) appMenu.popup({ window: mainWindow })
  })
}

/**
 * Détermine l'URL d'API effective. En mode 'local', démarre le backend NestJS embarqué
 * sur SQLite (127.0.0.1) ; en mode 'remote' (défaut), utilise le serveur distant.
 */
async function initBackend(): Promise<void> {
  if (resolveMode() !== 'local') {
    effectiveApiUrl = resolveApiUrl()
    return
  }
  // Mode local : base SQLite + synchro depuis le serveur central (offline-first). PAS de
  // seed → la base se remplit par la synchro. 1er lancement / session expirée → config.
  if (!isSyncConfigured()) {
    needsLocalSetup = true
    return
  }
  // Configuré : on rafraîchit l'access token (best-effort) avant de démarrer le backend.
  const status = await refreshAccessToken()
  if (status === 'expired') {
    clearSync()
    needsLocalSetup = true // refresh rejeté → reconfiguration requise
    return
  }
  await startLocalBackend() // 'ok' (jeton frais) ou 'offline' (on conserve le jeton existant)
}

/** Démarre le backend NestJS + SQLite embarqués (mode local) et active la synchro + refresh. */
async function startLocalBackend(): Promise<void> {
  try {
    const userData = app.getPath('userData')
    const dbPath = path.join(userData, 'cms-saris.db')
    const resources = process.resourcesPath || path.join(__dirname, '..')
    ensureDb(dbPath, path.join(resources, 'seed.db')) // modèle SCHÉMA SEUL → base locale VIDE
    const port = await findFreePort()
    await startBackend({
      apiMainPath: path.join(resources, 'api', 'dist', 'main.js'),
      // Client Prisma SQLite généré, packagé séparément (extraResources → resources/sqlite-client).
      sqliteClientPath: path.join(resources, 'sqlite-client'),
      dbPath,
      port,
      serverUrl: resolveServerUrl(),
      siteId: readConfig().siteId,
      posteLocalId: getPosteLocalId(),
      syncTokenFile: syncTokenFilePath(),
      ...bakedSecrets(), // JWT_SECRET (requis) + TOTP/MESSAGE keys (alignées au central)
      logFile: path.join(userData, 'backend.log'),
    })
    effectiveApiUrl = `http://127.0.0.1:${port}`
    needsLocalSetup = false
    startRefreshTimer()
    log.info('[backend] embarqué démarré sur ' + effectiveApiUrl)
    await startConnectivityWatch() // décide central(en ligne)/local(hors-ligne) AVANT le renderer
  } catch (e) {
    log.error('[backend] échec du démarrage embarqué', e)
    effectiveApiUrl = null
    needsLocalSetup = true // échec → écran de configuration (et l'UI affiche l'erreur)
  }
}

// ── Bascule « online-first / offline-fallback » ─────────────────────────────────
// Le renderer parle au CENTRAL quand l'appareil est en ligne (messagerie + temps réel
// instantanés, comme le web) et au backend LOCAL SQLite quand il est hors-ligne. Le backend
// local tourne toujours et se synchronise en arrière-plan (prêt pour l'hors-ligne).

/** Le central est-il joignable ? (sonde /health, timeout court). */
async function probeCentralOnline(): Promise<boolean> {
  const url = (resolveServerUrl() || '').replace(/\/+$/, '')
  if (!url) return false
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 3000)
    const res = await fetch(`${url}/health`, { signal: ctrl.signal })
    clearTimeout(timer)
    return res.ok
  } catch {
    return false
  }
}

/** URL d'API que le renderer doit utiliser : central si en ligne, backend local sinon. */
function computeRendererUrl(): string {
  const central = (resolveServerUrl() || '').replace(/\/+$/, '')
  return serverOnline && central ? central : (effectiveApiUrl ?? central)
}

/** Pousse l'URL active au renderer (et la mémorise pour le prochain saris:config). */
function pushRendererUrl(): void {
  rendererApiUrl = computeRendererUrl()
  mainWindow?.webContents.send('saris:api-url', {
    url: rendererApiUrl,
    mode: serverOnline ? 'central' : 'local',
    online: serverOnline,
  })
  log.info(`[connectivité] renderer → ${serverOnline ? 'CENTRAL (en ligne)' : 'LOCAL (hors-ligne)'} : ${rendererApiUrl}`)
}

/** Sonde la connectivité en continu et bascule le renderer (central ⇄ local). */
async function startConnectivityWatch(): Promise<void> {
  // Sonde INITIALE → l'URL est correcte AVANT le chargement du renderer (login direct au central).
  serverOnline = await probeCentralOnline()
  rendererApiUrl = computeRendererUrl()
  if (connectivityTimer) clearInterval(connectivityTimer)
  // Hystérésis : on n'agit qu'après 2 sondes consécutives indiquant le MÊME nouvel état
  // (≈10 s) → évite le « flickering » (une sonde lente isolée) qui ferait basculer le backend
  // pour rien et provoquerait des reconnexions SSE / 401 intempestifs.
  let flips = 0
  connectivityTimer = setInterval(() => {
    void (async () => {
      const now = await probeCentralOnline()
      if (now === serverOnline) { flips = 0; return }
      if (++flips < 2) return
      flips = 0
      serverOnline = now
      if (now) {
        // RECONNEXION : laisser le backend embarqué POUSSER ses changements hors-ligne (~3 s)
        // avant de rendre la main au central (sinon on lirait des données pas encore remontées).
        setTimeout(() => pushRendererUrl(), 3000)
      } else {
        pushRendererUrl() // HORS-LIGNE → bascule IMMÉDIATE sur le backend local
      }
    })()
  }, 5000)
}

/** Envoie l'avancement à l'écran de configuration (après « Connecter »). */
function sendSetupStatus(step: 'backend' | 'done' | 'error', message: string): void {
  mainWindow?.webContents.send('saris:setup-status', { step, message })
}

/** Configuration réussie → démarre le backend local, ATTEND la 1ère synchro (ouverture
 *  fluide, pas d'écran de connexion « à vide »), puis ouvre l'application (ou signale l'échec). */
async function completeLocalStartup(): Promise<void> {
  sendSetupStatus('backend', 'Démarrage du service local…')
  await startLocalBackend()
  if (!effectiveApiUrl) {
    sendSetupStatus('error', 'Le service local n’a pas pu démarrer. Réessayez ; si le problème persiste, consultez les journaux.')
    return
  }
  if (serverOnline) {
    // EN LIGNE : on ouvre TOUT DE SUITE sur le CENTRAL (données déjà là, messagerie instantanée).
    // La 1ère synchro locale (pour le futur hors-ligne) se poursuit en arrière-plan.
    sendSetupStatus('done', 'Connecté — ouverture de l’application.')
    loadApplication()
  } else {
    // HORS-LIGNE : on attend que la base locale soit prête avant d'ouvrir (pas d'écran « à vide »).
    sendSetupStatus('backend', 'Synchronisation des données du site…')
    await waitForInitialSync(effectiveApiUrl, 90000)
    sendSetupStatus('done', 'Données prêtes — ouverture de l’application.')
    loadApplication()
  }
}

/** Sonde GET /sync/ready jusqu'à ce que la 1ère synchro soit faite (données du site en place)
 *  ou jusqu'au délai max. Au-delà, on ouvre quand même (la synchro continue en arrière-plan). */
async function waitForInitialSync(apiUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${apiUrl}/sync/ready`)
      if (res.ok && ((await res.json()) as { ready?: boolean }).ready) return
    } catch {
      /* backend pas encore prêt à répondre */
    }
    await new Promise((r) => setTimeout(r, 700))
  }
  log.warn('[setup] 1ère synchro non confirmée avant le délai — ouverture quand même')
}

// Une seule instance de l'application.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })

  app.whenReady().then(async () => {
    nativeTheme.themeSource = 'system' // suit l'OS jusqu'à ce que l'app synchronise son thème
    registerAppProtocol()
    registerIpc()
    buildAppMenu()
    await initBackend()
    createMainWindow()
    if (app.isPackaged) initAutoUpdater(() => mainWindow)

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
    })
  })

  app.on('before-quit', () => { stopRefreshTimer(); stopBackend() })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
