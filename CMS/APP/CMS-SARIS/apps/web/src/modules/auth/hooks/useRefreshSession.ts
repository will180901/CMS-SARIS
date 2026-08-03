/**
 * useRefreshSession — re-synchronise le user actuel + le JWT avec la BDD.
 *
 * CRITIQUE : utilise /auth/refresh (et pas /auth/me) pour obtenir un NOUVEAU JWT
 * signé avec les permissions à jour. Sans ça, le frontend et le backend seraient
 * désynchronisés (UI affiche les nouvelles permissions, mais les requêtes
 * backend continuent d'utiliser le vieux JWT et tombent en 403).
 *
 * Utile après :
 *   - modification de ses propres rôles depuis /admin/utilisateurs
 *   - modification des permissions d'un rôle qu'il possède depuis /admin/roles
 *   - rechargement de page (bootstrap)
 */

import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { api, ApiError, tryRefreshToken } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import { purgerCachePermissionsPerdues } from '@/lib/cache-permissions'
import type { UserSession } from '@cms-saris/types'
import i18n from '@/i18n/config'

type Me = Omit<UserSession, 'token'>

export const ME_KEY = ['auth', 'me'] as const

/**
 * Refresh complet : nouveau JWT + nouveau refresh token + mise à jour du user.
 * Toutes les requêtes suivantes utilisent automatiquement le nouveau JWT
 * car api.ts lit le token depuis le store à chaque appel.
 *
 * En cas d'échec du refresh (refresh token expiré/révoqué), on retombe sur
 * /auth/me pour mettre à jour au moins l'UI (le user devra se reconnecter
 * manuellement pour avoir un JWT valide).
 *
 * @param queryClient (optionnel) — si fourni, invalide toutes les queries pour
 *   que les hooks `enabled: has(...)` se relancent avec les nouvelles permissions
 */
/**
 * Renouvellement de session.
 *
 * Le verrou d'anti-concurrence vit dans `lib/api.ts` (`tryRefreshToken`) et il est le
 * SEUL : le jeton de rafraîchissement étant à usage unique, deux appels simultanés se
 * marchent dessus — le premier consomme le jeton, le second reçoit un 401 qui détruit
 * la session. Cette fonction ne fait donc plus son propre appel à /auth/refresh ; elle
 * délègue, puis ajoute ce qui la concerne : l'invalidation des requêtes React Query
 * quand les permissions ont changé.
 *
 * Bénéfice secondaire : en passant par `fetch` direct plutôt que par `api.post`, on
 * évite qu'un 401 sur l'appel de renouvellement déclenche… un renouvellement imbriqué.
 */
export function performTokenRefresh(queryClient?: QueryClient): Promise<Me> {
  return executerRenouvellement(queryClient)
}

async function executerRenouvellement(queryClient?: QueryClient): Promise<Me> {
  const state = useSessionStore.getState()
  // La re-sync bootstrap est consommée : ne pas la re-déclencher (un seul passage).
  state.setNeedsBootstrapRefresh(false)
  const prevPermissions = state.user?.permissions ?? []

  let result: Me
  if (!state.refreshToken) {
    result = await api.get<Me>('/auth/me')
    state.setUser(result)
  } else {
    try {
      // Mutualisé : un renouvellement déjà en vol est partagé au lieu d'être doublé.
      await tryRefreshToken()
      // tryRefreshToken a mis le store à jour (user + jetons) de façon atomique.
      result = useSessionStore.getState().user as Me
    } catch {
      // Fallback : au moins UI à jour (mais JWT obsolète → reconnexion nécessaire)
      result = await api.get<Me>('/auth/me')
      state.setUser(result)
    }
  }

  // Si les permissions ont changé, invalider toutes les queries pour que les
  // hooks `enabled: has(...)` se déclenchent avec les nouvelles permissions.
  if (queryClient) {
    const newPermissions = result.permissions ?? []
    const changed =
      prevPermissions.length !== newPermissions.length ||
      prevPermissions.some(p => !newPermissions.includes(p)) ||
      newPermissions.some(p => !prevPermissions.includes(p))
    if (changed) {
      // D'abord EFFACER ce qui n'est plus lisible : invalidateQueries se contente de
      // marquer périmé et de relancer les requêtes actives — un hook devenu
      // `enabled: false` ne relance rien, donc ses données survivraient dans le cache.
      purgerCachePermissionsPerdues(queryClient, prevPermissions, newPermissions)
      queryClient.invalidateQueries()
    }
  }

  return result
}

/** Hook query : déclenché au démarrage de l'app pour re-synchroniser tout. */
export function useMe(enabled = true) {
  const sessionId      = useSessionStore(s => s.user?.id)
  const needsBootstrap = useSessionStore(s => s.needsBootstrapRefresh)
  const qc = useQueryClient()

  return useQuery({
    queryKey:  ME_KEY,
    queryFn:   () => performTokenRefresh(qc),
    // Uniquement au RECHARGEMENT de page (session hydratée). Après un login frais,
    // needsBootstrapRefresh=false → pas de /auth/refresh redondant (évite le flash).
    enabled:   enabled && !!sessionId && needsBootstrap,
    staleTime: 60_000,
  })
}

/** Hook mutation : déclenche explicitement un refresh + toast confirmation. */
export function useRefreshSession() {
  const qc = useQueryClient()
  return useMutation<Me, ApiError, void>({
    mutationFn: () => performTokenRefresh(qc),
    onSuccess:  (me) => {
      toast.success(i18n.t('auth.toastPermissionsRefreshed', { count: me.permissions?.length ?? 0 }))
    },
    onError: (err) => {
      toast.error(err?.serverMessage ?? i18n.t('auth.toastSessionError'))
    },
  })
}
