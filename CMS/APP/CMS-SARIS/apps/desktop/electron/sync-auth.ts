/**
 * Authentification de SYNCHRONISATION (mode local offline-first).
 *
 * Au 1er lancement, la base SQLite locale est VIDE : aucun login local possible. Ce module
 * gère l'amorçage : on s'authentifie contre le serveur CENTRAL → on stocke le refresh token
 * (chiffré DPAPI) → on écrit l'access token dans un fichier que le backend embarqué relit à
 * chaque cycle de synchro (SERVER_SYNC_TOKEN_FILE). Un timer renouvelle l'access token
 * (rotation du refresh) AVANT son expiration, SANS redémarrer le backend.
 *
 * Sécurité : seul le refresh token (longue durée) est chiffré via DPAPI ; l'access token
 * (courte durée, ~8 h) est un fichier en clair dans userData — acceptable car le backend
 * embarqué est en loopback (127.0.0.1) et ne sert que ce poste.
 */
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { readConfig, writeConfig, secureGet, secureSet, secureDel } from './config'

const REFRESH_KEY = 'cms-saris-sync-refresh' // clé DPAPI du refresh token

/** Fichier de l'access token courant — lu par le backend embarqué (SERVER_SYNC_TOKEN_FILE). */
export function syncTokenFilePath(): string {
  return path.join(app.getPath('userData'), 'sync-token')
}

/** Identifiant STABLE du poste local — généré une seule fois, persistant. */
export function getPosteLocalId(): string {
  const cfg = readConfig()
  if (cfg.posteLocalId) return cfg.posteLocalId
  const id = crypto.randomUUID()
  writeConfig({ posteLocalId: id })
  return id
}

/** Le poste est-il configuré (serveur central + site + refresh token présents) ? */
export function isSyncConfigured(): boolean {
  const cfg = readConfig()
  return !!(cfg.serverUrl && cfg.siteId) && !!secureGet(REFRESH_KEY)
}

const trimUrl = (u: string): string => u.trim().replace(/\/+$/, '')

interface AuthResponse {
  accessToken?: string
  refreshToken?: string
  user?: { siteId?: string }
  requireTotp?: boolean
  tempToken?: string
}

export interface SetupResult { ok: boolean; error?: string; requireTotp?: boolean; tempToken?: string }

/**
 * 1er lancement : authentifie au CENTRAL (login/mdp, ou code TOTP si 2FA). En cas de succès,
 * persiste serverUrl + siteId + refreshToken (DPAPI) et écrit l'access token.
 */
export async function setupSync(
  serverUrl: string,
  login: string,
  password: string,
  totpCode?: string,
  tempToken?: string,
): Promise<SetupResult> {
  const server = trimUrl(serverUrl)
  if (!/^https?:\/\//i.test(server)) return { ok: false, error: 'L’adresse doit commencer par http:// ou https://' }
  try {
    let data: AuthResponse
    if (tempToken && totpCode) {
      const r = await fetch(server + '/auth/totp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: totpCode, tempToken, posteLocalId: getPosteLocalId() }),
      })
      if (r.status === 401) return { ok: false, error: 'Code de vérification invalide.' }
      if (!r.ok) return { ok: false, error: `Erreur serveur (HTTP ${r.status}).` }
      data = (await r.json()) as AuthResponse
    } else {
      const r = await fetch(server + '/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        // posteLocalId → session de SYNCHRO du poste : EXEMPTÉE de la « session unique ».
        body: JSON.stringify({ login, password, posteLocalId: getPosteLocalId() }),
      })
      if (r.status === 401) return { ok: false, error: 'Identifiant ou mot de passe incorrect.' }
      if (!r.ok) return { ok: false, error: `Erreur serveur (HTTP ${r.status}).` }
      data = (await r.json()) as AuthResponse
      if (data.requireTotp) return { ok: false, requireTotp: true, tempToken: data.tempToken }
    }
    const { accessToken, refreshToken } = data
    const siteId = data.user?.siteId
    if (!accessToken || !refreshToken || !siteId) {
      return { ok: false, error: 'Réponse du serveur invalide (jeton ou site manquant).' }
    }
    writeConfig({ mode: 'local', serverUrl: server, siteId })
    secureSet(REFRESH_KEY, refreshToken)
    fs.writeFileSync(syncTokenFilePath(), accessToken, 'utf8')
    getPosteLocalId()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Serveur injoignable : ' + (e as Error).message }
  }
}

let refreshing = false

/**
 * Renouvelle l'access token via le refresh token (rotation) et réécrit le token-fichier.
 * 'ok' = jeton rafraîchi ; 'offline' = serveur injoignable (on garde le jeton courant) ;
 * 'expired' = refresh rejeté (401/403) → re-configuration requise.
 */
export async function refreshAccessToken(): Promise<'ok' | 'offline' | 'expired'> {
  if (refreshing) return 'ok'
  const cfg = readConfig()
  const refresh = secureGet(REFRESH_KEY)
  if (!cfg.serverUrl || !refresh) return 'expired'
  refreshing = true
  try {
    const r = await fetch(trimUrl(cfg.serverUrl) + '/auth/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    })
    if (r.status === 401 || r.status === 403) return 'expired'
    if (!r.ok) return 'offline'
    const data = (await r.json()) as AuthResponse
    if (!data.accessToken) return 'offline'
    if (data.refreshToken) secureSet(REFRESH_KEY, data.refreshToken) // rotation : on garde le nouveau
    fs.writeFileSync(syncTokenFilePath(), data.accessToken, 'utf8')
    return 'ok'
  } catch {
    return 'offline'
  } finally {
    refreshing = false
  }
}

let timer: NodeJS.Timeout | null = null

/** Renouvelle périodiquement l'access token (avant l'expiration ~8 h) + récupère après hors-ligne. */
export function startRefreshTimer(): void {
  if (timer) clearInterval(timer)
  timer = setInterval(() => { void refreshAccessToken() }, 15 * 60 * 1000)
  if (typeof timer.unref === 'function') timer.unref()
}

export function stopRefreshTimer(): void {
  if (timer) { clearInterval(timer); timer = null }
}

/** Déconnecte la synchro (re-configuration) — conserve serverUrl pour pré-remplir l'écran. */
export function clearSync(): void {
  secureDel(REFRESH_KEY)
  writeConfig({ siteId: undefined })
  try { fs.rmSync(syncTokenFilePath(), { force: true }) } catch { /* noop */ }
}
