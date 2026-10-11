/**
 * MARQUE des données de test : ce qui permet de retrouver, EXACTEMENT, ce que le générateur a
 * fabriqué — et rien d'autre — le jour où l'on veut le retirer.
 *
 * La marque est dans l'IDENTIFIANT de chaque ligne fabriquée : un UUID bien formé (version 4,
 * variante conforme — les routes et les DTO de l'application valident des UUID, un identifiant d'une
 * autre forme y serait refusé) dont les 15 premiers caractères sont toujours les mêmes.
 *
 *     7e57da7a-7e57-4xxx-yxxx-xxxxxxxxxxxx        (« 7e57 » : test en hexadécimal)
 *
 * Pourquoi dans l'identifiant et pas dans une colonne ou une table à part :
 *  - aucune des tables cliniques n'a à changer (pas de migration, pas de colonne de plus à
 *    synchroniser vers les postes) ;
 *  - la marque suit la ligne partout où elle va : sauvegarde, restauration, poste de bureau ;
 *  - elle ne se perd pas et ne peut pas se désynchroniser d'un registre.
 *
 * Une ligne vraie ne peut pas porter cette marque : un UUID v4 aléatoire commence ainsi avec une
 * probabilité de 2^-48 (≈ 1 chance sur 281 000 milliards), les 4 chiffres de version/variante
 * mis à part.
 */
import { randomBytes } from 'node:crypto'

/** Début commun à TOUS les identifiants fabriqués par le générateur (15 caractères). */
export const MARQUE_ID = '7e57da7a-7e57-4'

/** Un identifiant neuf, marqué. Aléa cryptographique : deux lots ne se heurtent jamais. */
export function nouvelIdTest(): string {
  const h = randomBytes(10).toString('hex') // 20 chiffres hexadécimaux
  const variante = '89ab'[parseInt(h[3], 16) % 4]
  // 7e57da7a-7e57-4 + 3 chiffres, puis variante + 3 chiffres, puis 12 chiffres
  return `${MARQUE_ID}${h.slice(0, 3)}-${variante}${h.slice(4, 7)}-${h.slice(8, 20)}`
}

/** Cet identifiant a-t-il été fabriqué par le générateur ? */
export function estIdTest(id: string | null | undefined): boolean {
  return !!id && id.startsWith(MARQUE_ID)
}

/** Filtre Prisma « l'identifiant porte la marque ». */
export const FILTRE_MARQUE = { startsWith: MARQUE_ID } as const
