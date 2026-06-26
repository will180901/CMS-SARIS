/**
 * Configuration locale & stockage sécurisé du client de bureau.
 *
 * Conventions Windows :
 *  - config.json   → %APPDATA%\CMS SARIS\config.json   (URL du serveur, préférences)
 *  - secure.bin    → %APPDATA%\CMS SARIS\secure.bin     (secrets chiffrés DPAPI)
 *
 * Résolution de l'URL du serveur distant (par priorité) :
 *  1. variable d'environnement  SARIS_API_URL        (déploiement piloté / GPO)
 *  2. config.json  -> apiUrl                          (réglée dans l'app)
 *  3. valeur par défaut  SARIS_DEFAULT_API_URL        (figée au build, sinon vide)
 * Si rien n'est résolu, l'application ouvre l'écran « Connexion au serveur ».
 */
import { app, safeStorage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

interface SarisConfig {
  apiUrl?: string
  /** 'remote' (défaut) = client du serveur distant ; 'local' = backend embarqué + SQLite. */
  mode?: 'local' | 'remote'
  /** Serveur central pour la synchro en mode local. */
  serverUrl?: string
  /** Site du poste (mode local) — fixé au 1er login central (depuis le JWT). */
  siteId?: string
  /** Identifiant STABLE du poste local — généré au 1er lancement, persistant. */
  posteLocalId?: string
}

function configPath(): string {
  return path.join(app.getPath('userData'), 'config.json')
}

function trimUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

export function readConfig(): SarisConfig {
  try {
    return JSON.parse(fs.readFileSync(configPath(), 'utf8')) as SarisConfig
  } catch {
    return {}
  }
}

export function writeConfig(patch: Partial<SarisConfig>): void {
  const next = { ...readConfig(), ...patch }
  fs.mkdirSync(path.dirname(configPath()), { recursive: true })
  fs.writeFileSync(configPath(), JSON.stringify(next, null, 2), 'utf8')
}

/**
 * URL par défaut figée au BUILD (optionnel) : écrite dans `dist-electron/defaults.json`
 * par le script de build à partir de la variable `SARIS_DEFAULT_API_URL`. Permet de
 * livrer un exécutable qui se connecte directement (ex. http://localhost:3000 en test,
 * ou l'hébergeur en production) — sans écran de configuration. Laisser vide pour forcer
 * la saisie au 1er lancement.
 */
interface BakedDefaults {
  apiUrl?: string
  mode?: 'local' | 'remote'
  serverUrl?: string
  // Secrets du backend EMBARQUÉ (mode local), figés au build depuis le .env du central.
  // ⚠️ Sans `jwtSecret`, le backend embarqué CRASHE au démarrage. `totpEncKey` et
  // `messageEncKey` DOIVENT correspondre au central pour déchiffrer les données chiffrées
  // synchronisées (secrets 2FA, messages).
  jwtSecret?: string
  jwtExpiresIn?: string
  jwtRefreshExpiresIn?: string
  totpEncKey?: string
  messageEncKey?: string
}

/** Défauts FIGÉS AU BUILD (dist-electron/defaults.json) : URL serveur, mode, secrets backend. */
function bakedDefaults(): BakedDefaults {
  try {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'defaults.json'), 'utf8')) as BakedDefaults
  } catch {
    return {}
  }
}

/** Secrets figés au build, à fournir au backend EMBARQUÉ (mode local). */
export function bakedSecrets(): Pick<
  BakedDefaults, 'jwtSecret' | 'jwtExpiresIn' | 'jwtRefreshExpiresIn' | 'totpEncKey' | 'messageEncKey'
> {
  const d = bakedDefaults()
  return {
    jwtSecret: d.jwtSecret,
    jwtExpiresIn: d.jwtExpiresIn,
    jwtRefreshExpiresIn: d.jwtRefreshExpiresIn,
    totpEncKey: d.totpEncKey,
    messageEncKey: d.messageEncKey,
  }
}

const DEFAULT_API_URL = (process.env['SARIS_DEFAULT_API_URL'] ?? bakedDefaults().apiUrl ?? '').trim()

export function resolveApiUrl(): string {
  const fromEnv = (process.env['SARIS_API_URL'] ?? '').trim()
  if (fromEnv) return trimUrl(fromEnv)
  const fromCfg = (readConfig().apiUrl ?? '').trim()
  if (fromCfg) return trimUrl(fromCfg)
  return DEFAULT_API_URL ? trimUrl(DEFAULT_API_URL) : ''
}

/**
 * Mode de fonctionnement : 'remote' (défaut, client du serveur distant) ou 'local'
 * (backend NestJS + SQLite embarqués). Priorité : env SARIS_MODE > config.json > défaut
 * figé au build (l'installeur "local" bake `mode: 'local'` → backend embarqué d'emblée).
 */
export function resolveMode(): 'local' | 'remote' {
  const env = (process.env['SARIS_MODE'] ?? '').trim().toLowerCase()
  if (env === 'local' || env === 'remote') return env
  const cfg = readConfig().mode
  if (cfg === 'local' || cfg === 'remote') return cfg
  return bakedDefaults().mode === 'local' ? 'local' : 'remote'
}

/** URL du serveur central (pour la synchro en mode local). */
export function resolveServerUrl(): string {
  const fromEnv = (process.env['SERVER_URL'] ?? '').trim()
  if (fromEnv) return trimUrl(fromEnv)
  const fromCfg = (readConfig().serverUrl ?? '').trim()
  if (fromCfg) return trimUrl(fromCfg)
  return trimUrl(bakedDefaults().serverUrl ?? '')
}

// ── Stockage sécurisé (DPAPI via Electron safeStorage) ──────────────────────────
// Permet de chiffrer au repos les jetons (refresh token) côté poste, plutôt que de
// les laisser en clair. Le frontend y accède via le pont `window.saris.secure`.

function securePath(): string {
  return path.join(app.getPath('userData'), 'secure.bin')
}

function readSecureStore(): Record<string, string> {
  try {
    if (!safeStorage.isEncryptionAvailable()) return {}
    const raw = fs.readFileSync(securePath())
    return JSON.parse(safeStorage.decryptString(raw)) as Record<string, string>
  } catch {
    return {}
  }
}

function writeSecureStore(data: Record<string, string>): void {
  if (!safeStorage.isEncryptionAvailable()) return
  fs.mkdirSync(path.dirname(securePath()), { recursive: true })
  fs.writeFileSync(securePath(), safeStorage.encryptString(JSON.stringify(data)))
}

export function secureGet(key: string): string | null {
  return readSecureStore()[key] ?? null
}

export function secureSet(key: string, value: string): void {
  const store = readSecureStore()
  store[key] = value
  writeSecureStore(store)
}

export function secureDel(key: string): void {
  const store = readSecureStore()
  delete store[key]
  writeSecureStore(store)
}
