/**
 * Géolocalisation IP — ville + coordonnées approximatives.
 *
 * CE QUE C'EST, ET CE QUE ÇA N'EST PAS. Une adresse IP ne contient aucune position :
 * elle est simplement rattachée, dans des bases tenues par des tiers, au point de
 * présence de l'opérateur qui l'a attribuée. On obtient donc la VILLE de sortie du
 * réseau, avec un point central approximatif — jamais une position GPS. Sur un
 * mobile ou une liaison satellitaire, ce point peut désigner une autre ville, voire
 * un autre pays. Aucun fournisseur, gratuit ou payant, ne fait mieux à partir d'une
 * IP seule ; seul le navigateur, avec l'accord explicite de l'utilisateur, donne une
 * vraie position GPS.
 *
 * Stratégie (précision d'abord, repli hors-ligne ensuite) :
 *   1. Service externe ip-api.com (précis : ville + lat/lon + fuseau, en français).
 *   2. Repli HORS-LIGNE geoip-lite (base embarquée) si le service externe échoue
 *      (hors-ligne, quota atteint…). Toujours disponible, même sans Internet.
 *
 * RÈGLE ABSOLUE : sans IP client exploitable, on ne localise RIEN. On ne demande
 * jamais au service « où suis-je ? » — la réponse serait la position du SERVEUR, et
 * on l'afficherait comme étant celle de l'utilisateur. C'est ce qui se produisait :
 * les déconnexions, journalisées sans adresse, s'affichaient à Francfort, siège de
 * l'hébergeur, pour un utilisateur assis à Brazzaville. Un journal d'audit qui
 * invente des lieux est pire qu'un journal qui avoue ne pas savoir.
 *
 * Résultats mis en cache PAR IP (TTL 1 h) → pas de sur-sollicitation de l'API
 * lors de l'affichage répété des sessions / du journal d'authentification.
 *
 * La localisation est dérivée à la LECTURE depuis l'IP stockée — aucune colonne
 * dédiée ni migration.
 */
import geoip from 'geoip-lite'

export interface GeoLocalisation {
  ip: string | null
  ville: string | null
  region: string | null
  pays: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  /** Libellé compact prêt à afficher (« Ville, Pays »). */
  label: string
  /** Origine de la donnée : service externe, base hors-ligne, ou indéterminée. */
  source: 'externe' | 'local' | 'inconnue'
}

const regionNames = (() => {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' })
  } catch {
    return null
  }
})()

function countryName(code?: string | null): string | null {
  if (!code) return null
  try {
    return regionNames?.of(code) ?? code
  } catch {
    return code
  }
}

function normalizeIp(ip?: string | null): string | null {
  if (!ip) return null
  let v = ip.trim()
  if (v.startsWith('::ffff:')) v = v.slice(7)
  return v || null
}

function isPrivate(ip: string): boolean {
  return (
    ip === '::1' ||
    ip === '127.0.0.1' ||
    ip === '0.0.0.0' ||
    ip.startsWith('10.') ||
    ip.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    ip.startsWith('169.254.') ||
    ip.startsWith('fc') ||
    ip.startsWith('fd') ||
    ip.startsWith('fe80')
  )
}

function buildLabel(ville: string | null, pays: string | null): string {
  if (ville && pays) return `${ville}, ${pays}`
  return ville || pays || 'Localisation inconnue'
}

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v
  return typeof n === 'number' && !Number.isNaN(n) ? n : null
}

/** Aucune localisation exploitable. Le libellé distingue les deux causes : une IP
 *  de réseau privé (le poste est sur place) d'une trace sans adresse du tout. */
const INCONNUE = (ip: string | null): GeoLocalisation => ({
  ip,
  ville: null,
  region: null,
  pays: null,
  latitude: null,
  longitude: null,
  timezone: null,
  label: ip ? 'Réseau local' : 'Localisation indisponible',
  source: 'inconnue',
})

// ── Cache par IP ──────────────────────────────────────────────────────────────
// Clé spéciale '__machine__' = IP publique de la machine (cas privé/loopback).

interface CacheEntry {
  geo: GeoLocalisation
  expiresAt: number
}
const cache = new Map<string, CacheEntry>()
const inFlight = new Map<string, Promise<GeoLocalisation>>()
const TTL_MS = 60 * 60 * 1000 // 1 h

// ── Service externe ip-api.com (précis, français) ─────────────────────────────

async function fetchIpApi(ipOrEmpty: string): Promise<GeoLocalisation | null> {
  const fields =
    'status,country,countryCode,regionName,city,lat,lon,timezone,query'
  const url = `http://ip-api.com/json/${ipOrEmpty}?fields=${fields}&lang=fr`
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 3000)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) return null
    const d: any = await res.json()
    if (!d || d.status !== 'success') return null
    const ville = d.city || null
    // Nom de pays dérivé du CODE et non du libellé du service : ip-api dit
    // « République du Congo » là où le repli hors-ligne dit « Congo », et la même
    // ville s'affichait sous deux pays différents d'une ligne à l'autre du journal.
    const pays = countryName(d.countryCode) ?? d.country ?? null
    return {
      ip: d.query ?? null,
      ville,
      region: d.regionName || null,
      pays,
      latitude: num(d.lat),
      longitude: num(d.lon),
      timezone: d.timezone || null,
      label: buildLabel(ville, pays),
      source: 'externe',
    }
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

// ── Repli hors-ligne geoip-lite ───────────────────────────────────────────────

function fromLite(ip: string): GeoLocalisation | null {
  const g = geoip.lookup(ip)
  if (!g) return null
  const ville = g.city || null
  const pays = countryName(g.country)
  const [lat, lon] = g.ll ?? [null, null]
  return {
    ip,
    ville,
    region: g.region || null,
    pays,
    latitude: typeof lat === 'number' ? lat : null,
    longitude: typeof lon === 'number' ? lon : null,
    timezone: g.timezone || null,
    label: buildLabel(ville, pays),
    source: 'local',
  }
}

// ── Orchestration avec cache + dédup des appels concurrents ───────────────────

async function resolveCached(
  cacheKey: string,
  compute: () => Promise<GeoLocalisation>,
): Promise<GeoLocalisation> {
  const now = Date.now()
  const hit = cache.get(cacheKey)
  if (hit && hit.expiresAt > now) return hit.geo
  const pending = inFlight.get(cacheKey)
  if (pending) return pending

  const p = (async () => {
    const geo = await compute()
    // On ne met en cache que les résultats EXPLOITABLES (évite de figer un échec).
    if (geo.source !== 'inconnue')
      cache.set(cacheKey, { geo, expiresAt: Date.now() + TTL_MS })
    return geo
  })()
  inFlight.set(cacheKey, p)
  try {
    return await p
  } finally {
    inFlight.delete(cacheKey)
  }
}

/**
 * Résout la localisation approximative d'une IP CLIENT.
 *
 * Une IP publique est résolue via ip-api, avec repli hors-ligne geoip-lite. Toute
 * autre situation — IP absente, loopback, réseau privé — renvoie « inconnue » : voir
 * la règle absolue en tête de fichier.
 *
 * Exception réservée au POSTE DE DÉVELOPPEMENT (`GEO_IP_LOCALE=1`, jamais en
 * production) : là, et seulement là, on accepte de résoudre l'IP publique de la
 * machine, faute de quoi tout est « Réseau local » sur un portable de dev.
 */
export async function resolveGeo(
  rawIp?: string | null,
): Promise<GeoLocalisation> {
  const ip = normalizeIp(rawIp)

  // Cas IP publique connue — le seul qui parle vraiment du client.
  if (ip && !isPrivate(ip)) {
    return resolveCached(ip, async () => {
      const ext = await fetchIpApi(ip)
      if (ext) return ext
      return fromLite(ip) ?? INCONNUE(ip)
    })
  }

  const devLocal =
    process.env['GEO_IP_LOCALE'] === '1' &&
    process.env['NODE_ENV'] !== 'production'
  if (!devLocal) return INCONNUE(ip)

  // Poste de développement uniquement : l'IP publique de la machine EST celle du
  // développeur, puisque le serveur tourne sur son poste.
  return resolveCached('__machine__', async () => {
    const ext = await fetchIpApi('') // ip-api détecte l'IP publique de l'appelant
    if (ext) return ext
    const pub = await fetchPublicIp()
    if (pub) {
      const g = fromLite(pub)
      if (g) return g
    }
    return INCONNUE(ip)
  })
}

/** Récupère l'IP publique de la machine via un service « echo IP » fiable. */
async function fetchPublicIp(): Promise<string | null> {
  for (const url of [
    'https://api.ipify.org',
    'https://icanhazip.com',
    'https://checkip.amazonaws.com',
  ]) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), 2500)
    try {
      const res = await fetch(url, { signal: ctrl.signal })
      if (res.ok) {
        const ip = (await res.text()).trim()
        if (ip) return ip
      }
    } catch {
      /* fournisseur suivant */
    } finally {
      clearTimeout(timer)
    }
  }
  return null
}
