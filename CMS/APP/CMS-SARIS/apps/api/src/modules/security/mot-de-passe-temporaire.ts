/**
 * Mot de passe TEMPORAIRE : le générer, et dire ce qu'un compte qui en porte un a le droit de faire.
 *
 * Deux règles, volontairement séparées de tout accès à la base pour être testées sans elle :
 *  - un administrateur ne CHOISIT jamais le mot de passe de quelqu'un : le système en fabrique un au
 *    hasard, l'affiche une seule fois, et la personne doit le remplacer par le sien — ainsi personne
 *    d'autre ne connaît le mot de passe qu'elle utilise ;
 *  - tant que ce mot de passe n'est pas remplacé, le compte ne peut RIEN faire d'autre que le
 *    remplacer (ou se déconnecter).
 */
import { randomInt } from 'node:crypto'

/** La politique de mot de passe en vigueur (réglages système), telle que `ParametresService` la rend. */
export interface PolitiqueMotDePasse {
  longueurMin: number
  exigerMajuscule: boolean
  exigerMinuscule: boolean
  exigerChiffre: boolean
  exigerSpecial: boolean
}

/** Sans les caractères qui se confondent à la lecture (I/l/1, O/0) : le mot de passe se recopie à la main. */
const MAJUSCULES = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const MINUSCULES = 'abcdefghijkmnpqrstuvwxyz'
const CHIFFRES = '23456789'
const TOUS = MAJUSCULES + MINUSCULES + CHIFFRES

/** Quatre caractères par groupe, groupes séparés par un tiret (« Xk7m-Qp3d-Wn9t ») : plus facile à dicter. */
const TAILLE_GROUPE = 4
const GROUPES_MIN = 3
/** Au-delà, le mot de passe dépasserait la limite acceptée par l'API (200) sans rien apporter. */
const LONGUEUR_MAX = 64

/**
 * Fabrique un mot de passe temporaire qui satisfait TOUJOURS la politique en vigueur : au moins une
 * majuscule, une minuscule et un chiffre, un tiret (caractère spécial), et la longueur minimale
 * demandée. Le hasard vient de `crypto.randomInt` (jamais de `Math.random`).
 *
 * `entier(n)` est un entier uniforme dans [0, n) — injectable pour les tests.
 */
export function genererMotDePasseTemporaire(
  politique: Pick<PolitiqueMotDePasse, 'longueurMin'>,
  entier: (n: number) => number = (n) => randomInt(n),
): string {
  const voulu = Math.min(Math.max(politique.longueurMin || 0, 0), LONGUEUR_MAX)
  // Plus petit nombre de groupes dont la longueur (tirets compris) atteint le minimum.
  let groupes = GROUPES_MIN
  while (groupes * TAILLE_GROUPE + (groupes - 1) < voulu) groupes++
  const nb = groupes * TAILLE_GROUPE

  const choisir = (alphabet: string) => alphabet.charAt(entier(alphabet.length))
  const signes: string[] = Array.from({ length: nb }, () => choisir(TOUS))
  // Une majuscule, une minuscule et un chiffre, à des places DISTINCTES tirées au hasard (mélange
  // partiel : trois tirages sans remise, qui se terminent quel que soit le générateur).
  const places = Array.from({ length: nb }, (_, i) => i)
  for (let i = 0; i < 3; i++) {
    const j = i + entier(nb - i)
    const tmp = places[i]
    places[i] = places[j]!
    places[j] = tmp
  }
  signes[places[0]] = choisir(MAJUSCULES)
  signes[places[1]] = choisir(MINUSCULES)
  signes[places[2]] = choisir(CHIFFRES)

  const morceaux: string[] = []
  for (let i = 0; i < nb; i += TAILLE_GROUPE)
    morceaux.push(signes.slice(i, i + TAILLE_GROUPE).join(''))
  return morceaux.join('-')
}

/**
 * Un mot de passe satisfait-il la politique ? (Même règle que `ParametresService.assertPasswordValid`,
 * en fonction pure — sert aux tests du générateur.)
 */
export function respectePolitique(
  mdp: string,
  p: PolitiqueMotDePasse,
): boolean {
  return (
    mdp.length >= p.longueurMin &&
    (!p.exigerMajuscule || /[A-Z]/.test(mdp)) &&
    (!p.exigerMinuscule || /[a-z]/.test(mdp)) &&
    (!p.exigerChiffre || /\d/.test(mdp)) &&
    (!p.exigerSpecial || /[^A-Za-z0-9]/.test(mdp))
  )
}

/**
 * Ce qu'un compte à mot de passe temporaire peut encore appeler : remplacer son mot de passe, lire
 * son propre état de session (c'est ce qui lui dit pourquoi), se déconnecter. Tout le reste est refusé.
 */
const ROUTES_PERMISES = new Set([
  'POST /auth/change-password',
  'POST /auth/logout',
  'GET /auth/me',
])

export function routePermiseAvecMotDePasseTemporaire(
  methode: string,
  url: string,
): boolean {
  const chemin = (url.split('?')[0] ?? '').replace(/\/+$/, '').toLowerCase()
  return ROUTES_PERMISES.has(`${methode.toUpperCase()} ${chemin}`)
}

/** Le refus (HTTP 403) renvoyé à un compte qui doit d'abord choisir son mot de passe. */
export const CODE_MOT_DE_PASSE_TEMPORAIRE = 'MOT_DE_PASSE_TEMPORAIRE'
