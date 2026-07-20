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
import os from 'node:os'
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

/** Nom lisible du poste — par défaut le nom de la machine (hostname), modifiable (cf.
 *  écran de configuration). Persisté une fois, réutilisé aux lancements suivants. */
export function getPosteLibelle(): string {
  const cfg = readConfig()
  if (cfg.posteLibelle) return cfg.posteLibelle
  const hostname = os.hostname().trim().slice(0, 80) || 'Poste'
  writeConfig({ posteLibelle: hostname })
  return hostname
}

/** Renomme le poste localement (ex. modifié à l'écran de configuration). */
export function setPosteLibelle(libelle: string): void {
  const trimmed = libelle.trim().slice(0, 80)
  if (trimmed) writeConfig({ posteLibelle: trimmed })
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

export interface AuthResult {
  ok: boolean
  error?: string
  requireTotp?: boolean
  tempToken?: string
  /** Site déjà associé au COMPTE qui se connecte — pré-sélection suggérée, pas imposée
   *  (le site du poste est désormais choisi par l'opérateur à l'étape 2, cf. finalizeSyncSetup). */
  defaultSiteId?: string
}

export interface Site { id: string; code: string; libelle: string; localisation?: string | null }

export interface SetupResult { ok: boolean; error?: string }

/** Jetons obtenus après authentification, en attente du choix du site (étape 2 de l'écran de
 *  configuration). Gardés UNIQUEMENT en mémoire du processus principal — jamais renvoyés au
 *  renderer — jusqu'à finalizeSyncSetup(), qui les persiste (ou les jette si l'écran est annulé). */
let pendingAuth: { serverUrl: string; accessToken: string; refreshToken: string } | null = null

/**
 * Étape 1 — 1er lancement : authentifie au CENTRAL (login/mdp, ou code TOTP si 2FA).
 * Ne persiste RIEN sur disque : les jetons restent en mémoire (pendingAuth) le temps que
 * l'opérateur choisisse le site à l'étape 2 (cf. listPendingSites / finalizeSyncSetup).
 */
export async function authenticateSync(
  serverUrl: string,
  login: string,
  password: string,
  totpCode?: string,
  tempToken?: string,
): Promise<AuthResult> {
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
    if (!accessToken || !refreshToken) {
      return { ok: false, error: 'Réponse du serveur invalide (jeton manquant).' }
    }
    pendingAuth = { serverUrl: server, accessToken, refreshToken }
    return { ok: true, defaultSiteId: data.user?.siteId }
  } catch (e) {
    return { ok: false, error: 'Serveur injoignable : ' + (e as Error).message }
  }
}

/** Étape 2 — liste les sites du référentiel (lecture seule) avec le jeton obtenu à l'étape 1. */
export async function listPendingSites(): Promise<Site[]> {
  if (!pendingAuth) throw new Error('Authentification requise avant de lister les sites.')
  const r = await fetch(pendingAuth.serverUrl + '/referentiels/sites?pageSize=200', {
    headers: { Authorization: `Bearer ${pendingAuth.accessToken}` },
  })
  if (!r.ok) throw new Error(`Erreur serveur (HTTP ${r.status}).`)
  const data = (await r.json()) as Site[] | { items?: Site[]; data?: Site[] }
  return Array.isArray(data) ? data : (data.items ?? data.data ?? [])
}

/**
 * Étape 3 — l'opérateur a choisi le site DE CE POSTE (indépendant du site de son propre
 * compte) : persiste serverUrl + siteId + refreshToken (DPAPI) et écrit l'access token.
 */
export function finalizeSyncSetup(siteId: string, posteLibelle?: string): SetupResult {
  if (!pendingAuth) return { ok: false, error: 'Session d’authentification expirée — recommencez.' }
  if (!siteId) return { ok: false, error: 'Aucun site sélectionné.' }
  const { serverUrl, accessToken, refreshToken } = pendingAuth
  writeConfig({ mode: 'local', serverUrl, siteId })
  secureSet(REFRESH_KEY, refreshToken)
  fs.writeFileSync(syncTokenFilePath(), accessToken, 'utf8')
  getPosteLocalId()
  if (posteLibelle) setPosteLibelle(posteLibelle)
  else getPosteLibelle() // assure un nom par défaut (hostname) même si le champ a été laissé vide
  pendingAuth = null
  return { ok: true }
}

/** Abandon de l'écran de configuration avant finalisation (retour à l'étape 1, changement de compte…). */
export function discardPendingAuth(): void {
  pendingAuth = null
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
