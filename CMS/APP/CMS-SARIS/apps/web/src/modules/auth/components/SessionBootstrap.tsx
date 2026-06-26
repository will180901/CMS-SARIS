/**
 * SessionBootstrap — composant invisible monté une seule fois.
 *
 * Au démarrage de l'application, si une session existe (token persistent),
 * on appelle /auth/me pour re-synchroniser les permissions/rôles depuis
 * la BDD. Cela garantit que les changements faits par un admin pendant
 * que l'utilisateur était déconnecté sont pris en compte immédiatement.
 */

import { useMe } from '@/modules/auth/hooks/useRefreshSession'

export function SessionBootstrap() {
  // Le hook se déclenche automatiquement si l'utilisateur a une session.
  // Le résultat est appliqué dans le store par le hook lui-même.
  useMe()
  return null
}
