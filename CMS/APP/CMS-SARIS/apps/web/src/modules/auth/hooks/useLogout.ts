import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import { fermerLAutreSession, oublierIdentifiants } from '@/lib/secondJeton'

export function useLogout() {
  const clearSession = useSessionStore(s => s.clearSession)

  return useMutation<void, ApiError, void>({
    mutationFn: () => {
      // Client de bureau : la session ouverte chez l'AUTRE serveur se ferme aussi (au mieux).
      void fermerLAutreSession()
      return api.post<void>('/auth/logout', {})
    },
    onSettled: () => {
      // Nettoyer la session locale dans tous les cas (même si le réseau échoue)
      clearSession()
      // Les identifiants gardés EN MÉMOIRE pour la seconde authentification ne survivent jamais à la déconnexion.
      oublierIdentifiants()
    },
  })
}
