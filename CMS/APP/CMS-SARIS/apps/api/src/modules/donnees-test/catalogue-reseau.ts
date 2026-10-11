/**
 * Adresses IP plausibles pour un centre du Congo : celles que le serveur voit réellement quand un
 * agent se connecte depuis le centre ou depuis chez lui.
 *
 * Les plages ci-dessous sont des plages IPv4 attribuées au Congo-Brazzaville dans la base de
 * géolocalisation hors ligne du serveur (geoip-lite) : l'écran du journal les situe donc bien à
 * Brazzaville, Pointe-Noire, Dolisie… et non à l'autre bout du monde.
 */
import type { Alea } from './alea'

/** [premier, dernier, ville connue de la base ou null]. */
const PLAGES: readonly (readonly [
  string,
  string,
  'Brazzaville' | 'Pointe-Noire' | 'Dolisie' | null,
])[] = [
  ['5.62.61.100', '5.62.61.103', 'Brazzaville'],
  ['5.62.63.76', '5.62.63.79', 'Brazzaville'],
  ['45.42.225.1', '45.42.225.254', 'Pointe-Noire'],
  ['169.255.72.1', '169.255.75.254', 'Dolisie'],
  ['41.75.64.1', '41.75.79.254', null],
  ['41.190.72.1', '41.190.75.254', null],
  ['41.223.88.1', '41.223.91.254', null],
  ['102.129.64.1', '102.129.95.254', null],
  ['102.141.1.1', '102.141.63.254', null],
  ['154.73.116.1', '154.73.117.254', null],
  ['197.214.128.1', '197.214.255.254', null],
  ['197.149.136.1', '197.149.139.254', null],
]

function enNombre(ip: string): number {
  const [a, b, c, d] = ip.split('.').map(Number) as [
    number,
    number,
    number,
    number,
  ]
  return ((a << 24) | (b << 16) | (c << 8) | d) >>> 0
}
function enTexte(n: number): string {
  return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(
    '.',
  )
}

function dans(alea: Alea, plage: (typeof PLAGES)[number]): string {
  const [debut, fin] = [enNombre(plage[0]), enNombre(plage[1])]
  return enTexte(alea.entier(debut, fin))
}

/** Une adresse d'un opérateur congolais quelconque (domicile, mobile). */
export function ipCongolaise(alea: Alea): string {
  return dans(alea, alea.choisir(PLAGES))
}

/**
 * Les adresses publiques du centre : une ou deux par site, dans les plages d'une ville où la base
 * de géolocalisation sait situer l'adresse (Brazzaville pour Moutela, Dolisie — la ville de la base
 * la plus proche — pour Nkayi), sinon n'importe quelle plage congolaise.
 */
export function ipsDuSite(alea: Alea, codeSite: string): string[] {
  const prefixe = codeSite.slice(0, 3).toUpperCase()
  const ville =
    prefixe === 'MOU' ? 'Brazzaville' : prefixe === 'NKA' ? 'Dolisie' : null
  const candidates = PLAGES.filter((p) => (ville ? p[2] === ville : true))
  const n = alea.entier(1, 2)
  const ips = new Set<string>()
  while (ips.size < n) ips.add(dans(alea, alea.choisir(candidates)))
  return [...ips]
}
