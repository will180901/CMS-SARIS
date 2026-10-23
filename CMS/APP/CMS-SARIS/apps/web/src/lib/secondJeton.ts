/**
 * Le jeton de L'AUTRE serveur — client de bureau seulement.
 *
 * Connecté, l'écran parle au serveur central ; sans réseau, au service local de la machine. Les deux sont des
 * autorités distinctes : chacune refuse les jetons de l'autre (cf. lib/interlocuteur.ts). On ne peut pas partager
 * le secret du central — il finirait dans chaque installateur, extractible, et permettrait de forger des jetons
 * pour la production. L'application s'authentifie donc AUSSI auprès de l'autre serveur, en silence, au seul
 * moment où elle a les identifiants en main : la connexion. La table des utilisateurs étant synchronisée, les
 * mêmes identifiants valent des deux côtés.
 *
 * Un échec ici ne bloque JAMAIS la connexion : l'application travaille avec le serveur dont elle a le jeton, et
 * retente quand la bascule est demandée (cf. `assurerJetons`).
 */
import { desktopBridge, urlDuServeur } from './desktop'
import { getAppareilId } from './appareil'
import { useSessionStore } from '@/stores/session.store'
import type { Interlocuteur } from './interlocuteur'

interface Identifiants {
  login: string
  password: string
  /** Dernier code de double authentification saisi (valable ~30 s) : il sert une seconde fois, à l'autre serveur. */
  codeTotp?: string
}

/**
 * Les identifiants, EN MÉMOIRE seulement le temps de la session — jamais sur disque, jamais dans le stockage de
 * l'application. Effacés à la déconnexion (et dès qu'une connexion échoue).
 */
let identifiants: Identifiants | null = null

export function memoriserIdentifiants(login: string, password: string): void {
  if (desktopBridge()?.localApiUrl) identifiants = { login, password }
}

export function memoriserCodeTotp(code: string): void {
  if (identifiants) identifiants = { ...identifiants, codeTotp: code }
}

export function oublierIdentifiants(): void {
  identifiants = null
}

interface ReponseConnexion {
  accessToken?: string
  refreshToken?: string
  requireTotp?: boolean
  sessionActive?: boolean
  tempToken?: string
}

async function post(base: string, chemin: string, corps: object): Promise<ReponseConnexion | null> {
  try {
    const res = await fetch(`${base}${chemin}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps),
    })
    return res.ok ? ((await res.json()) as ReponseConnexion) : null
  } catch {
    return null // serveur injoignable (réseau coupé, service local pas prêt) : on réessaiera
  }
}

/**
 * S'authentifie auprès de `qui` avec les identifiants gardés en mémoire, et garde le jeu de jetons obtenu.
 *
 * Le MÊME `appareilId` que la connexion principale : la règle de session unique exclut les sessions du même
 * appareil, si bien que cette seconde connexion n'est jamais prise pour une session concurrente.
 * Ne se décide pas en silence : une session ouverte AILLEURS à trancher, ou un code de double authentification
 * qu'on n'a plus — on laisse tomber, l'application reste sur le serveur dont elle a le jeton.
 */
export async function obtenirJetons(qui: Interlocuteur): Promise<boolean> {
  const base = urlDuServeur(qui)
  if (!base || !identifiants) return false
  const { login, password, codeTotp } = identifiants
  const appareilId = getAppareilId()
  const machineId = desktopBridge()?.posteLocalId
  let data = await post(base, '/auth/login', { login, password, appareilId, machineId })
  if (data?.requireTotp && data.tempToken && codeTotp) {
    data = await post(base, '/auth/totp/verify', { code: codeTotp, tempToken: data.tempToken, appareilId, machineId })
  }
  if (!data || data.sessionActive || data.requireTotp) return false
  if (!data.accessToken || !data.refreshToken) return false
  useSessionStore.getState().memoriserAutresJetons(qui, { token: data.accessToken, refreshToken: data.refreshToken })
  return true
}

/** Garantit, si c'est possible, qu'on a le jeu de jetons de `qui` : déjà actif, déjà gardé, ou à obtenir. */
export async function assurerJetons(qui: Interlocuteur): Promise<boolean> {
  const s = useSessionStore.getState()
  if (s.interlocuteur === qui || s.autresJetons[qui]) return true
  return obtenirJetons(qui)
}

/**
 * À la déconnexion : ferme aussi la session ouverte chez l'AUTRE serveur (au mieux : s'il est injoignable, sa
 * session expirera d'elle-même — le jeton de renouvellement, lui, disparaît avec la session de l'application).
 */
export async function fermerLAutreSession(): Promise<void> {
  const s = useSessionStore.getState()
  if (!s.interlocuteur) return
  const autre: Interlocuteur = s.interlocuteur === 'central' ? 'local' : 'central'
  const jetons = s.autresJetons[autre]
  const base = urlDuServeur(autre)
  if (!jetons || !base) return
  try {
    await fetch(`${base}/auth/logout`, { method: 'POST', headers: { Authorization: `Bearer ${jetons.token}` } })
  } catch {
    /* injoignable : rien à faire */
  }
}
