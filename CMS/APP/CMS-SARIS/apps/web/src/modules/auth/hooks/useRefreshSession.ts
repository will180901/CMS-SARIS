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
import { api, ApiError } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import type { UserSession } from '@cms-saris/types'
import i18n from '@/i18n/config'

type Me = Omit<UserSession, 'token'>

interface RefreshResponse {
  accessToken:  string
  refreshToken: string
  user:         Me
}

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
export async function performTokenRefresh(queryClient?: QueryClient): Promise<Me> {
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
      const res = await api.post<RefreshResponse>('/auth/refresh', {
        refreshToken: state.refreshToken,
      })
      state.setSession(res.user, res.accessToken, res.refreshToken)
      result = res.user
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
