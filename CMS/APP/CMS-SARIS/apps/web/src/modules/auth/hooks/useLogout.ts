import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import { oublierIdentifiants } from '@/lib/localAuth'

export function useLogout() {
  const clearSession = useSessionStore(s => s.clearSession)

  return useMutation<void, ApiError, void>({
    mutationFn: () => api.post<void>('/auth/logout', {}),
    onSettled: () => {
      // Nettoyer la session locale dans tous les cas (même si le réseau échoue)
      clearSession()
      // Et les identifiants gardés EN MÉMOIRE pour la retentative d'authentification
      // locale (client de bureau) : ils ne survivent jamais à la déconnexion.
      oublierIdentifiants()
    },
  })
}
