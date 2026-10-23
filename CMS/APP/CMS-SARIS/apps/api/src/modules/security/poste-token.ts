/**
 * Jeton d'un poste de bureau appairé : ce que le serveur lui accorde.
 *
 * Contrairement à une session de personne, un poste n'a ni rôle ni compte : il tient son identité de son SECRET
 * (cf. PosteLocal.secretHash) et n'a que les deux droits dont la synchronisation a besoin. Retirer l'accès d'un poste
 * (ou le remplacer par un nouvel appairage) coupe son jeton au prochain appel, sans attendre son expiration.
 */
import type { PermissionCode } from '@cms-saris/types'
import type { JwtPayload } from '@cms-saris/types'

/** Les seuls droits d'un poste : lire (pull, sonnette) et écrire (push, battement de vie). */
export const PERMISSIONS_POSTE: PermissionCode[] = [
  'synchronisation.read',
  'synchronisation.execute',
]

/** Durée de vie d'un jeton de poste ; le poste le renouvelle bien avant (toutes les 15 minutes). */
export const DUREE_JETON_POSTE = '8h'

/** Préfixe de l'identité d'un poste (`poste:<posteLocalId>`) : jamais un identifiant d'utilisateur. */
export const PREFIXE_POSTE = 'poste:'

/** Génération du secret d'un poste, portée par son jeton : un nouvel appairage la change, donc invalide les anciens jetons. */
export function generationSecret(secretHash: string): string {
  return secretHash.slice(0, 16)
}

export function estJetonPoste(payload: Pick<JwtPayload, 'typ'>): boolean {
  return payload.typ === 'poste'
}
