/**
 * Les appareils avec lesquels le personnel se connecte : un ordinateur au centre (Chrome, Edge ou
 * Firefox sous Windows), et pour certains un téléphone Android de marque courante en Afrique
 * centrale. Les versions des navigateurs sont celles de l'année : un navigateur ancien ne ressemble
 * à rien de ce qu'on voit dans un journal.
 */
import type { Alea } from './alea'

const MOBILES: readonly string[] = [
  'TECNO KG7n',
  'TECNO CK6n',
  'Infinix X6525',
  'Infinix X669',
  'SAMSUNG SM-A135F',
  'SAMSUNG SM-A236B',
  'itel A662L',
  'Redmi Note 11',
]

/** Le navigateur d'un ordinateur du centre, tel que le serveur le lit dans l'en-tête de la requête. */
export function userAgentOrdinateur(alea: Alea): string {
  const famille = alea.pondere([
    ['CHROME', 62],
    ['EDGE', 24],
    ['FIREFOX', 14],
  ] as const)
  if (famille === 'FIREFOX') {
    const v = alea.entier(128, 143)
    return `Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:${v}.0) Gecko/20100101 Firefox/${v}.0`
  }
  const v = alea.entier(128, 141)
  const base = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Safari/537.36`
  return famille === 'EDGE' ? `${base} Edg/${v}.0.0.0` : base
}

/** Le navigateur d'un téléphone Android. */
export function userAgentTelephone(alea: Alea): string {
  const android = alea.entier(11, 14)
  const v = alea.entier(128, 141)
  return `Mozilla/5.0 (Linux; Android ${android}; ${alea.choisir(MOBILES)}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${v}.0.0.0 Mobile Safari/537.36`
}

/** Un identifiant d'appareil comme en génère le client (UUID), tiré d'un flux reproductible. */
export function identifiantAppareil(alea: Alea): string {
  const h = (n: number) =>
    Array.from({ length: n }, () => alea.entier(0, 15).toString(16)).join('')
  return `${h(8)}-${h(4)}-4${h(3)}-${'89ab'[alea.entier(0, 3)]}${h(3)}-${h(12)}`
}

/** Un « hash » de jeton de rafraîchissement : de la forme de ceux de bcrypt, sans rien qui se vérifie. */
export function fauxHashJeton(alea: Alea): string {
  const alphabet =
    './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let s = '$2b$10$'
  for (let i = 0; i < 53; i++)
    s += alphabet[alea.entier(0, alphabet.length - 1)]
  return s
}
