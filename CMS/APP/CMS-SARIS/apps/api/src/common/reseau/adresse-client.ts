/**
 * Adresse du CLIENT derrière les relais réseau (Cloudflare, load balancer de Render…).
 *
 * POURQUOI. `X-Forwarded-For` est une LISTE que chaque relais allonge — mais Render ne retire
 * pas ce que le client y a déjà écrit. Avec `TRUST_PROXY=true`, Express prend le premier
 * élément : n'importe qui peut s'attribuer l'adresse de son choix, tromper le journal des
 * connexions ET contourner la limitation des tentatives de connexion (qui compte par adresse).
 *
 * LA BONNE SOURCE. Cloudflare écrit lui-même l'adresse du client dans `CF-Connecting-IP` et
 * ÉCRASE ce que l'appelant aurait envoyé : l'en-tête n'est pas falsifiable sur ce chemin.
 * `CLIENT_IP_HEADER=cf-connecting-ip` l'adopte comme `req.ip` pour toute l'application
 * (journal, sessions, limitation). Réglage VOLONTAIREMENT explicite : un en-tête n'est digne
 * de confiance que si le déploiement garantit qu'un relais l'écrit — sinon (hébergement sans
 * Cloudflare) l'appelant pourrait le forger lui-même, et on ne l'adopte pas.
 *
 * Sans `CLIENT_IP_HEADER`, rien ne change : Express décide d'après `TRUST_PROXY`.
 */
import { isIP } from 'node:net'
import { normalizeIp, isPrivate, resolveGeo } from '../geo/geo.util'

interface Requete {
  ip?: string
  headers: Record<string, string | string[] | undefined>
  socket?: { remoteAddress?: string }
  app?: { get(cle: string): unknown }
}

const premier = (v: string | string[] | undefined): string | null =>
  (Array.isArray(v) ? v[0] : v)?.trim() || null

/** Nom (en minuscules) de l'en-tête de confiance, ou null s'il n'est pas configuré. */
export function enteteAdresseClient(): string | null {
  return process.env['CLIENT_IP_HEADER']?.trim().toLowerCase() || null
}

/** Remplace `req.ip` par l'adresse portée par l'en-tête de confiance, si elle est valide. */
export function installerAdresseClient(app: {
  use: (mw: (req: Requete, res: unknown, next: () => void) => void) => unknown
}): void {
  const entete = enteteAdresseClient()
  if (!entete) return
  app.use((req, _res, next) => {
    const valeur = premier(req.headers[entete])
    if (valeur && isIP(valeur))
      // `req.ip` est un accesseur d'Express : on le masque pour CETTE requête.
      Object.defineProperty(req, 'ip', {
        value: valeur,
        configurable: true,
        enumerable: true,
        writable: true,
      })
    next()
  })
}

/** Adresse de réseau privé, de bouclage ou de partage d'adresses (CGNAT, 100.64.0.0/10). */
export function estAdresseInterne(ip: string): boolean {
  return isPrivate(ip) || /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)
}

export type VerdictReseau =
  /** Développement : l'adresse du poste lui-même, sans relais — normal. */
  | 'LOCAL'
  /** Adresse interne en production : le serveur ne voit pas celle du client. */
  | 'ADRESSE_INTERNE'
  /** Adresse prise dans X-Forwarded-For avec `TRUST_PROXY=true` : falsifiable. */
  | 'FALSIFIABLE'
  | 'OK'

/**
 * Ce que le serveur voit de CETTE requête — pour l'administrateur qui règle le déploiement :
 * l'adresse retenue, d'où elle vient, et les en-têtes reçus.
 */
export async function diagnosticReseau(req: Requete) {
  const entete = enteteAdresseClient()
  const valeurEntete = entete ? premier(req.headers[entete]) : null
  const xff = premier(req.headers['x-forwarded-for'])
  const trust = req.app?.get('trust proxy')
  const ip = normalizeIp(req.ip)
  const origine =
    entete && valeurEntete && isIP(valeurEntete)
      ? 'ENTETE'
      : trust && xff
        ? 'X_FORWARDED_FOR'
        : 'SOCKET'
  const interne = !ip || estAdresseInterne(ip)
  const production = process.env['NODE_ENV'] === 'production'
  let verdict: VerdictReseau
  if (interne)
    verdict =
      !production && (ip === '::1' || ip === '127.0.0.1')
        ? 'LOCAL'
        : 'ADRESSE_INTERNE'
  else if (origine === 'X_FORWARDED_FOR' && trust === true)
    verdict = 'FALSIFIABLE'
  else verdict = 'OK'
  return {
    ip,
    origine,
    verdict,
    adresseSocket: normalizeIp(req.socket?.remoteAddress),
    enteteConfigure: entete,
    valeurEntete,
    xForwardedFor: xff,
    cfConnectingIp: premier(req.headers['cf-connecting-ip']),
    trueClientIp: premier(req.headers['true-client-ip']),
    trustProxy: String(trust),
    localisation: await resolveGeo(ip),
  }
}
