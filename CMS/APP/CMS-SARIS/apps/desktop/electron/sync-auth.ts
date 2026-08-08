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
import { execSync } from 'node:child_process'
import { readConfig, writeConfig, secureGet, secureSet, secureDel } from './config'

const REFRESH_KEY = 'cms-saris-sync-refresh' // clé DPAPI du refresh token

/** Fichier de l'access token courant — lu par le backend embarqué (SERVER_SYNC_TOKEN_FILE). */
export function syncTokenFilePath(): string {
  return path.join(app.getPath('userData'), 'sync-token')
}

/**
 * Empreinte STABLE de la machine : le MachineGuid de Windows, pose a l'installation du
 * systeme et inchange par nos installations/desinstallations. Repli sur le nom reseau.
 */
function empreinteMachine(): string {
  try {
    const out = execSync(
      'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
      { encoding: 'utf8', windowsHide: true, timeout: 4000 },
    )
    const m = out.match(/MachineGuid\s+REG_SZ\s+([0-9a-fA-F-]{36})/)
    if (m) return m[1]
  } catch { /* pas Windows, ou cle inaccessible */ }
  return os.hostname().trim() || 'poste-inconnu'
}

/**
 * Identifiant du poste — DERIVE de la machine, donc reproductible.
 *
 * Il etait tire au hasard (`randomUUID`) et conserve dans `%APPDATA%`. Or une
 * desinstallation efface ce dossier : la reinstallation sur le MEME ordinateur tirait un
 * NOUVEL identifiant, et le serveur voyait apparaitre un poste de plus. Apres quelques
 * essais, la meme machine figurait plusieurs fois dans la supervision — impossible de
 * savoir laquelle est vivante, et les compteurs du parc devenaient faux.
 *
 * L'identifiant est desormais calcule a partir de l'empreinte de la machine : reinstaller
 * redonne le MEME identifiant, et le serveur met a jour la ligne existante au lieu d'en
 * creer une. On continue de l'ecrire dans la configuration — c'est un cache, plus une
 * source de verite.
 */
export function getPosteLocalId(): string {
  const cfg = readConfig()
  if (cfg.posteLocalId) return cfg.posteLocalId
  const h = crypto.createHash('sha256').update('cms-saris-poste:' + empreinteMachine()).digest('hex')
  // Mise en forme UUID (version 5, variante RFC 4122) — meme apparence qu'avant, pour
  // ne rien casser cote serveur ou en base.
  const id = `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`
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

/** L'adresse du serveur est-elle connue ? C'est la SEULE chose demandée à l'installation. */
export function serveurRenseigne(): boolean {
  return !!readConfig().serverUrl
}

/** Enregistre l'adresse du serveur central après l'avoir jointe. Seule étape d'installation. */
export async function enregistrerServeur(serverUrl: string): Promise<SetupResult> {
  const server = trimUrl(serverUrl)
  if (!/^https?:\/\//i.test(server)) {
    return { ok: false, error: 'L’adresse doit commencer par http:// ou https://' }
  }
  try {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 8000)
    const res = await fetch(server + '/health/ping', { signal: ctrl.signal })
    clearTimeout(timer)
    if (!res.ok) return { ok: false, error: `Le serveur a répondu ${res.status}. Vérifiez l’adresse.` }
  } catch {
    return { ok: false, error: 'Serveur injoignable à cette adresse. Vérifiez le réseau et l’adresse.' }
  }
  // `mode: 'local'` dès maintenant : ce poste EST un poste autonome. Il n'a simplement
  // pas encore de jetons — il travaillera donc contre le central en attendant.
  writeConfig({ mode: 'local', serverUrl: server })
  return { ok: true }
}

/**
 * Provisionne le poste À PARTIR DE LA PREMIÈRE CONNEXION d'un utilisateur.
 *
 * L'installation ne demande plus que l'adresse du serveur : plus de login administrateur
 * à confier au technicien qui déploie vingt machines. Ce sont les jetons du PREMIER
 * utilisateur qui se connecte qui donnent au poste son identité de synchronisation, et
 * c'est SON site qui devient celui du poste.
 *
 * Sans conséquence si ça échoue : le poste continue de fonctionner contre le central,
 * simplement sans mode hors-ligne, et l'on retentera à la connexion suivante.
 */
export async function provisionnerPoste(
  accessToken: string,
  refreshToken: string,
  siteId: string,
): Promise<SetupResult> {
  const serverUrl = readConfig().serverUrl
  if (!serverUrl) return { ok: false, error: 'Adresse du serveur inconnue.' }
  if (!siteId) return { ok: false, error: 'Le compte connecté n’est rattaché à aucun site.' }

  writeConfig({ mode: 'local', serverUrl, siteId })
  secureSet(REFRESH_KEY, refreshToken)
  fs.writeFileSync(syncTokenFilePath(), accessToken, 'utf8')
  getPosteLibelle() // fixe le nom par défaut (nom de la machine) s'il n'existe pas encore

  const declare = await declarerPoste(serverUrl, accessToken, getPosteLocalId(), siteId, getPosteLibelle())
  if (declare.fatal) return { ok: false, error: declare.error }
  if (declare.ok) writeConfig({ posteDeclare: true })
  return { ok: true }
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
  // Pas de `?pageSize=` : l'endpoint refuse toute propriété inconnue (400) — il renvoie
  // déjà tous les sites. Vérifié en direct : `?pageSize=200` → « property pageSize should
  // not exist », et l'écran restait bloqué sur « Impossible de charger les sites ».
  const r = await fetch(pendingAuth.serverUrl + '/referentiels/sites', {
    headers: { Authorization: `Bearer ${pendingAuth.accessToken}` },
  })
  if (!r.ok) throw new Error(`Erreur serveur (HTTP ${r.status}).`)
  const data = (await r.json()) as Site[] | { items?: Site[]; data?: Site[] }
  return Array.isArray(data) ? data : (data.items ?? data.data ?? [])
}

/**
 * Étape 3 — l'opérateur a choisi le site DE CE POSTE (indépendant du site de son propre
 * compte) : persiste serverUrl + siteId + refreshToken (DPAPI), écrit l'access token, et
 * DÉCLARE le poste au serveur central.
 *
 * La déclaration au serveur n'est pas un détail : sans elle, le site choisi ici ne vivrait
 * que dans ce poste. Le serveur, lui, ignorerait où il se trouve et rattacherait chaque acte
 * au site du COMPTE qui le saisit — un soignant de passage ferait porter ses triages à son
 * site d'origine. C'est `POST /sync/poste` qui rend le site réellement porté par la machine.
 *
 * Échec réseau toléré : la configuration locale reste valable et le poste sera redéclaré au
 * prochain lancement (cf. declarerPosteAuServeur). Bloquer ici laisserait un poste installé
 * mais inutilisable pour une coupure passagère.
 */
export async function finalizeSyncSetup(siteId: string, posteLibelle?: string): Promise<SetupResult> {
  if (!pendingAuth) return { ok: false, error: 'Session d’authentification expirée — recommencez.' }
  if (!siteId) return { ok: false, error: 'Aucun site sélectionné.' }
  const { serverUrl, accessToken, refreshToken } = pendingAuth
  writeConfig({ mode: 'local', serverUrl, siteId })
  secureSet(REFRESH_KEY, refreshToken)
  fs.writeFileSync(syncTokenFilePath(), accessToken, 'utf8')
  const posteLocalId = getPosteLocalId()
  if (posteLibelle) setPosteLibelle(posteLibelle)
  else getPosteLibelle() // assure un nom par défaut (hostname) même si le champ a été laissé vide

  const declare = await declarerPoste(serverUrl, accessToken, posteLocalId, siteId, getPosteLibelle())
  pendingAuth = null
  // Seule une erreur DE FOND arrête l'installation (site inexistant, compte non autorisé) :
  // l'opérateur doit reprendre sa saisie. Une coupure réseau, elle, laisse l'installation
  // valide — le poste se redéclarera au prochain lancement.
  if (declare.fatal) return { ok: false, error: declare.error }
  if (declare.ok) writeConfig({ posteDeclare: true })
  return { ok: true }
}

/** Appel brut de `POST /sync/poste` — partagé par la finalisation et le rattrapage au démarrage. */
async function declarerPoste(
  serverUrl: string,
  accessToken: string,
  posteLocalId: string,
  siteId: string,
  libelle?: string,
): Promise<{ ok: boolean; error?: string; fatal?: boolean }> {
  try {
    const r = await fetch(trimUrl(serverUrl) + '/sync/poste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ posteLocalId, siteId, libelle }),
    })
    if (r.status === 404)
      return { ok: false, fatal: true, error: 'Site introuvable sur le serveur — reprenez la sélection.' }
    if (r.status === 400)
      return { ok: false, fatal: true, error: 'Site invalide — reprenez la sélection.' }
    if (r.status === 403)
      return { ok: false, fatal: true, error: 'Compte non autorisé à configurer un poste.' }
    if (!r.ok) return { ok: false, error: `Erreur serveur (HTTP ${r.status}).` }

    // LE SERVEUR FAIT FOI pour le nom et le site du poste.
    //
    // Un administrateur peut renommer un poste ou le rattacher à un autre site depuis la
    // page Synchronisation. Jusqu'ici la machine n'en savait rien : elle gardait le nom
    // écrit à l'installation, et le bloc « Ce poste » affichait « Bureau Accueil » alors
    // que la supervision affichait « Salle de soins 2 ». Deux vérités pour un même poste.
    //
    // La réponse contient l'état réel : on l'adopte. Best-effort — une réponse illisible
    // ne doit pas faire échouer une déclaration qui a réussi côté serveur.
    try {
      const poste = (await r.json()) as { libelle?: string; siteId?: string }
      if (poste?.libelle) setPosteLibelle(poste.libelle)
      if (poste?.siteId) writeConfig({ siteId: poste.siteId })
    } catch { /* corps absent ou illisible : sans conséquence */ }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Serveur injoignable : ' + (e as Error).message }
  }
}

/**
 * Rattrapage au démarrage : redéclare le poste si la déclaration initiale a échoué (poste
 * installé hors ligne) ou si le poste a été installé avant l'existence de `POST /sync/poste`.
 * Silencieux et sans conséquence s'il est déjà déclaré.
 */
export async function declarerPosteAuServeur(): Promise<void> {
  const cfg = readConfig()
  if (cfg.posteDeclare) return
  if (!cfg.serverUrl || !cfg.siteId) return
  let accessToken: string
  try {
    accessToken = fs.readFileSync(syncTokenFilePath(), 'utf8').trim()
  } catch {
    return
  }
  if (!accessToken) return
  const res = await declarerPoste(cfg.serverUrl, accessToken, getPosteLocalId(), cfg.siteId, getPosteLibelle())
  if (res.ok) writeConfig({ posteDeclare: true })
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
