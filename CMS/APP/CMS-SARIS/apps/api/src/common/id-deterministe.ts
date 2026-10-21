import { createHash } from 'node:crypto'

/**
 * Identifiant DÉTERMINISTE : md5 de « a|b|… » mis en forme 8-4-4-4-12.
 *
 * Le même pour tous ceux qui le calculent — il sert aux lignes que plusieurs postes peuvent
 * créer chacun de leur côté, hors ligne, pour le MÊME objet : la conversation directe entre
 * deux personnes, l'accusé de lecture d'un message par un lecteur. Avec des identifiants
 * aléatoires, la synchronisation verrait deux lignes en double (et la contrainte d'unicité en
 * refuserait une) ; avec celui-ci, elles fusionnent.
 *
 * ⚠️ La migration `20261021150000_messagerie_lecture_par_message` calcule les accusés de
 * lecture existants avec la MÊME formule (md5 de « message|lecteur ») : ne pas la changer.
 */
export function idDeterministe(...parties: string[]): string {
  const h = createHash('md5').update(parties.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`
}

/** Conversation directe entre deux personnes : la même, quel que soit celui qui l'ouvre. */
export function idConversationDirecte(a: string, b: string): string {
  const [x, y] = [a, b].sort()
  return idDeterministe('direct', x, y)
}

/** Accusé de lecture d'un message par un lecteur. */
export function idLecture(messageId: string, lecteurId: string): string {
  return idDeterministe(messageId, lecteurId)
}

/** Participation d'une personne à une conversation directe. */
export function idParticipationDirecte(conversationId: string, utilisateurId: string): string {
  return idDeterministe('participant', conversationId, utilisateurId)
}
