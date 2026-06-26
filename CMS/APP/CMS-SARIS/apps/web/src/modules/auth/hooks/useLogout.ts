import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'

export function useLogout() {
  const clearSession = useSessionStore(s => s.clearSession)

  return useMutation<void, ApiError, void>({
    mutationFn: () => api.post<void>('/auth/logout', {}),
    onSettled: () => {
      // Nettoyer la session locale dans tous les cas (même si le réseau échoue)
      clearSession()
    },
  })
}
