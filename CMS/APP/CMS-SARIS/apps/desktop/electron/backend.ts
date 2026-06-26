/**
 * Orchestration du backend NestJS EMBARQUÉ (mode local offline-first).
 * Démarre l'API compilée dans un process Node forké, pointant sur la base SQLite locale,
 * sur 127.0.0.1:<port libre>. Le frontend (app://cms-saris) tape ensuite sur cette API
 * locale. Un client de synchro (dans l'API) réconcilie avec le serveur central.
 *
 * ⚠️ Validation runtime requise : chemin de l'API compilée (SARIS_API_MAIN), engines
 * Prisma SQLite packagés (asarUnpack), démarrage du fork. Code typé ; à valider au build.
 */
import { fork, type ChildProcess } from 'node:child_process'
import { createServer } from 'node:net'
import fs from 'node:fs'
import path from 'node:path'

let proc: ChildProcess | null = null

/** Trouve un port TCP libre sur la boucle locale. */
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer()
    srv.unref()
    srv.on('error', reject)
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      srv.close(() => resolve(port))
    })
  })
}

export interface BackendOptions {
  /** Chemin du main.js compilé de l'API (expose bootstrap). */
  apiMainPath: string
  /**
   * Chemin du client Prisma SQLite généré (dossier). REQUIS : `PrismaService` lève une
   * erreur en mode SQLite si `SQLITE_CLIENT_PATH` est absent. Packagé via extraResources.
   */
  sqliteClientPath: string
  /** Fichier SQLite local. */
  dbPath: string
  port: number
  /** Serveur central pour la synchro (mode local). */
  serverUrl?: string
  siteId?: string
  posteLocalId?: string
  syncToken?: string
  /** Fichier contenant l'access token de synchro (relu à chaque cycle → refresh sans
   *  redémarrer le backend). Prioritaire sur `syncToken`. */
  syncTokenFile?: string
  /** Secrets requis par l'API (figés au build, cf. config.bakedSecrets). ⚠️ Sans
   *  `jwtSecret` le backend CRASHE au démarrage ; `totpEncKey`/`messageEncKey` doivent
   *  correspondre au central pour déchiffrer les données chiffrées synchronisées. */
  jwtSecret?: string
  jwtExpiresIn?: string
  jwtRefreshExpiresIn?: string
  totpEncKey?: string
  messageEncKey?: string
  logFile?: string
}

/**
 * Adresse d'ecoute du backend embarque : TOUJOURS la boucle locale (127.0.0.1).
 * SECURITE (donnees medicales) : on n'expose JAMAIS l'API sur 0.0.0.0 ni sur l'IP
 * du LAN. Le backend local ne sert QUE le poste hote (frontend app://cms-saris du
 * meme PC). Toute valeur HOST heritee de process.env est ignoree et neutralisee
 * ci-dessous, pour qu'un reglage externe accidentel ne puisse pas ouvrir l'API au reseau.
 */
const LOOPBACK_HOST = '127.0.0.1'

/** Démarre le backend embarqué et attend qu'il réponde sur /health. */
export async function startBackend(opts: BackendOptions): Promise<void> {
  const entry = path.join(__dirname, 'backend-entry.js')
  // On part de process.env mais on RETIRE tout HOST herite, puis on force la loopback :
  // garantit qu'aucun HOST=0.0.0.0 venu de l'environnement ne fuite vers le fork.
  const { HOST: _ignoredHost, ...parentEnv } = process.env
  void _ignoredHost
  const env: NodeJS.ProcessEnv = {
    ...parentEnv,
    NODE_ENV: 'production',
    DATABASE_PROVIDER: 'sqlite',
    // connection_limit=1 : SQLite ne supporte pas l'écriture concurrente — un pool > 1
    // provoque des « database is locked ». Une seule connexion = écritures sérialisées.
    DATABASE_URL: `file:${opts.dbPath}?connection_limit=1`,
    // Chemin du client Prisma SQLite généré (exigé par PrismaService en mode sqlite).
    SQLITE_CLIENT_PATH: opts.sqliteClientPath,
    PORT: String(opts.port),
    HOST: LOOPBACK_HOST,
    SARIS_API_MAIN: opts.apiMainPath,
    SERVER_URL: opts.serverUrl ?? '',
    SITE_ID: opts.siteId ?? '',
    POSTE_LOCAL_ID: opts.posteLocalId ?? '',
    SERVER_SYNC_TOKEN: opts.syncToken ?? '',
    SERVER_SYNC_TOKEN_FILE: opts.syncTokenFile ?? '',
    // Secrets figés au build (sinon le backend crashe : JWT_SECRET introuvable).
    ...(opts.jwtSecret ? { JWT_SECRET: opts.jwtSecret } : {}),
    ...(opts.jwtExpiresIn ? { JWT_EXPIRES_IN: opts.jwtExpiresIn } : {}),
    ...(opts.jwtRefreshExpiresIn ? { JWT_REFRESH_EXPIRES_IN: opts.jwtRefreshExpiresIn } : {}),
    ...(opts.totpEncKey ? { TOTP_ENC_KEY: opts.totpEncKey } : {}),
    ...(opts.messageEncKey ? { MESSAGE_ENC_KEY: opts.messageEncKey } : {}),
  }
  proc = fork(entry, [], {
    env,
    // Electron 33 embarque Node 20 : `require()` d'un module ESM-only (ex. `@scure/base`
    // tiré par otplib) échoue sinon (ERR_REQUIRE_ESM). Le flag (dispo dès Node 20.17,
    // activé par défaut en Node 22.12+) autorise le backend compilé CJS à charger ces
    // dépendances ESM. Vérifié : l'API démarre sur SQLite sous le Node d'Electron.
    execArgv: ['--experimental-require-module'],
    silent: !!opts.logFile,
  })
  if (opts.logFile && proc.stdout && proc.stderr) {
    const out = fs.createWriteStream(opts.logFile, { flags: 'a' })
    proc.stdout.pipe(out)
    proc.stderr.pipe(out)
  }
  // 60 s : le 1er démarrage (chargement geoip + connexion SQLite) peut être lent sur un
  // poste modeste. Au-delà, on considère l'échec (l'UI affiche une erreur, pas un blocage).
  await waitForHealth(`http://127.0.0.1:${opts.port}/health`, 60000)
}

/** Attend que /health réponde (poll). */
export async function waitForHealth(url: string, timeoutMs = 30000, intervalMs = 300): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const ctrl = new AbortController()
      const t = setTimeout(() => ctrl.abort(), 2000)
      const res = await fetch(url, { signal: ctrl.signal })
      clearTimeout(t)
      if (res.ok) return
    } catch {
      /* pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
  throw new Error(`Backend local : /health indisponible après ${timeoutMs} ms`)
}

/** Arrête le backend embarqué (à la fermeture de l'app). */
export function stopBackend(): void {
  if (proc) {
    try {
      proc.kill('SIGTERM')
    } catch {
      /* noop */
    }
    proc = null
  }
}
