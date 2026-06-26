import { useSessionStore } from '@/stores/session.store'
import { toast } from '@workspace/ui/components/sonner'
import { enqueueMutation } from './sync'
import i18n from '@/i18n/config'

// L'URL de l'API est résolue à l'EXÉCUTION : en client de bureau (Electron), elle vient
// de la configuration locale injectée par le preload (`__SARIS_CONFIG__`, modifiable dans
// l'app) ; sinon de la variable de build `VITE_API_URL` ; sinon localhost (dev).
export let BASE_URL =
  (typeof window !== 'undefined' && window.__SARIS_CONFIG__?.apiUrl) ||
  import.meta.env['VITE_API_URL'] ||
  'http://localhost:3000'

/**
 * Bascule l'URL de l'API À CHAUD (client de bureau « online-first »). Le process principal
 * pousse le CENTRAL quand l'appareil est en ligne (messagerie/temps réel instantanés) et le
 * backend LOCAL SQLite quand il est hors-ligne. `export let` = liaison vive : tous les `fetch`
 * (qui lisent BASE_URL au moment de l'appel) utilisent la nouvelle valeur immédiatement.
 */
export function setApiBaseUrl(url: string): void {
  const clean = (url || '').replace(/\/+$/, '')
  if (clean) BASE_URL = clean
}

// ── Classe d'erreur enrichie ──────────────────────────────────────────────────

export class ApiError extends Error {
  readonly status: number
  readonly body:   unknown

  constructor(status: number, body: unknown, message: string) {
    super(message)
    this.name   = 'ApiError'
    this.status = status
    this.body   = body
  }

  get isUnauthorized(): boolean { return this.status === 401 }
  get isForbidden():    boolean { return this.status === 403 }
  get isNotFound():     boolean { return this.status === 404 }

  get serverMessage(): string {
    if (typeof this.body === 'object' && this.body !== null && 'message' in this.body) {
      const m = (this.body as { message: unknown }).message
      return Array.isArray(m) ? m.join(', ') : String(m)
    }
    return this.message
  }
}

/**
 * Erreur émise quand une écriture est mise en file d'attente hors-ligne plutôt
 * qu'envoyée. Les helpers de toast doivent l'ignorer (l'utilisateur a déjà reçu
 * un toast d'information « enregistré hors-ligne »).
 */
export class OfflineQueuedError extends ApiError {
  readonly queued = true
  constructor() {
    super(0, {}, 'Action enregistrée hors-ligne')
    this.name = 'OfflineQueuedError'
  }
}

/** True si l'erreur correspond à une mutation mise en file d'attente hors-ligne. */
export function isOfflineQueued(err: unknown): boolean {
  return err instanceof ApiError && (err as { queued?: boolean }).queued === true
}

// ── Auto-refresh (singleton pour éviter plusieurs appels simultanés) ──────────

let refreshingPromise: Promise<void> | null = null

/**
 * Lit le `exp` (epoch secondes) d'un JWT sans vérifier la signature (déjà
 * validée côté serveur). Renvoie null si le token est absent/malformé.
 * Décodage base64url manuel — aucune dépendance.
 */
export function jwtExpiresAt(token: string | null | undefined): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const payloadB64 = parts[1]!.replace(/-/g, '+').replace(/_/g, '/')
    const padded = payloadB64.padEnd(payloadB64.length + ((4 - (payloadB64.length % 4)) % 4), '=')
    const json = atob(padded)
    const payload = JSON.parse(json) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp : null
  } catch {
    return null
  }
}

/**
 * True si le token est expiré ou expire dans moins de `skewSeconds`.
 * Si l'expiration est indéterminable, renvoie false (on laissera le 401 du
 * rejeu déclencher le refresh réactif).
 */
export function isTokenExpiringSoon(token: string | null | undefined, skewSeconds = 60): boolean {
  const exp = jwtExpiresAt(token)
  if (exp === null) return false
  return Date.now() / 1000 >= exp - skewSeconds
}

export async function tryRefreshToken(): Promise<void> {
  if (refreshingPromise) return refreshingPromise

  refreshingPromise = (async () => {
    const { refreshToken, setSession, clearSession } = useSessionStore.getState()

    if (!refreshToken) {
      clearSession()
      throw new ApiError(401, {}, 'Session expirée')
    }

    try {
      const res = await fetch(`${BASE_URL}/auth/refresh`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ refreshToken }),
      })

      if (!res.ok) throw new Error('refresh failed')

      // CRITIQUE : /auth/refresh retourne aussi `user` avec les permissions à jour.
      // On utilise setSession() pour mettre à jour user + tokens atomiquement,
      // sinon le store frontend reste figé avec les anciennes permissions alors
      // que le JWT a été régénéré.
      const data = await res.json() as {
        accessToken:  string
        refreshToken: string
        user:         Parameters<typeof setSession>[0]
      }
      setSession(data.user, data.accessToken, data.refreshToken)
    } catch {
      clearSession()
      throw new ApiError(401, {}, 'Session expirée, veuillez vous reconnecter')
    }
  })()

  try {
    await refreshingPromise
  } finally {
    refreshingPromise = null
  }
}

// ── Fonction de requête centrale ──────────────────────────────────────────────

/** Verbes qui modifient l'état (candidats à la mise en file d'attente hors-ligne). */
const WRITE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/**
 * Une écriture peut-elle être mise en file d'attente hors-ligne ?
 * On exclut l'authentification (login/refresh n'ont aucun sens en différé) et
 * les uploads FormData (non rejouables tels quels).
 */
function canQueueOffline(method: string, path: string, isForm: boolean): boolean {
  if (!WRITE_METHODS.has(method)) return false
  if (isForm) return false
  if (path.startsWith('/auth')) return false
  if (path.startsWith('/notifications')) return false   // lectures/accusés non critiques
  return true
}

/**
 * Rejoue une requête mémorisée hors-ligne, SANS la remettre en file d'attente
 * (utilisé par le moteur de synchronisation). Renvoie le statut HTTP.
 */
export async function replayRequest(method: string, path: string, body: unknown): Promise<number> {
  const token = useSessionStore.getState().token
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return res.status
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const token = useSessionStore.getState().token

  // Pour un FormData (upload de fichier), on NE fixe PAS Content-Type : le
  // navigateur ajoute lui-même le boundary multipart correct.
  const isForm = options.body instanceof FormData
  const headers: Record<string, string> = {
    ...(isForm ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string> | undefined),
  }

  if (token) headers['Authorization'] = `Bearer ${token}`

  const method = (options.method ?? 'GET').toUpperCase()
  const queueable = canQueueOffline(method, path, isForm)
  const bodyForQueue = (): unknown => {
    if (options.body === undefined || isForm) return undefined
    try { return typeof options.body === 'string' ? JSON.parse(options.body) : options.body }
    catch { return undefined }
  }

  // Hors-ligne avéré (navigateur) → on met directement en file d'attente sans
  // tenter le réseau, pour une UX immédiate.
  if (queueable && typeof navigator !== 'undefined' && !navigator.onLine) {
    await enqueueMutation(method, path, bodyForQueue())
    toast.info(i18n.t('common.offlineQueued'))
    throw new OfflineQueuedError()
  }

  let response: Response
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  } catch (networkErr) {
    // Échec réseau (serveur injoignable) sur une écriture → file d'attente.
    if (queueable) {
      await enqueueMutation(method, path, bodyForQueue())
      toast.info(i18n.t('common.offlineQueued'))
      throw new OfflineQueuedError()
    }
    throw networkErr
  }

  // 204 No Content — pas de body
  if (response.status === 204) return undefined as T

  // 401 → tentative de refresh SEULEMENT si on avait déjà un token
  // (évite de déclencher le refresh sur un login avec mauvais mot de passe)
  if (response.status === 401 && !isRetry) {
    const state = useSessionStore.getState()
    if (state.token) {
      await tryRefreshToken()          // vide la session si le refresh échoue
      return request<T>(path, options, true)
    }
    // 401 sans token alors que la session est marquée active = état incohérent
    // (token expiré/perdu). On nettoie pour déclencher la redirection /login.
    if (state.isAuthenticated) state.clearSession()
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    throw new ApiError(response.status, body, `HTTP ${response.status} — ${path}`)
  }

  return response.json() as Promise<T>
}

// ── Sérialisation query params ────────────────────────────────────────────────

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  if (!params) return path
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&')
  return qs ? `${path}?${qs}` : path
}

// ── Interface publique ────────────────────────────────────────────────────────

export const api = {
  get:    <T>(path: string, params?: Record<string, string | number | boolean | undefined | null>) =>
            request<T>(buildUrl(path, params)),
  post:   <T>(path: string, body: unknown)   => request<T>(path, { method: 'POST',   body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown)   => request<T>(path, { method: 'PUT',    body: JSON.stringify(body) }),
  patch:  <T>(path: string, body?: unknown)  => request<T>(path, { method: 'PATCH',  body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string)                  => request<T>(path, { method: 'DELETE' }),
  upload: <T>(path: string, form: FormData)  => request<T>(path, { method: 'POST', body: form }),
}
