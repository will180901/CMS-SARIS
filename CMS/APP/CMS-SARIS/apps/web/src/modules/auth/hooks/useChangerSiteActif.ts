import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import type { UserSession } from '@cms-saris/types'

interface SiteActifResponse {
  accessToken:  string
  refreshToken: string
  user:         Omit<UserSession, 'token'>
}

/**
 * Bascule le site actif de la session (le personnel médical tourne entre Moutela et
 * Nkayi selon un planning de permutation). Réémet des tokens portant le nouveau site
 * — tout ce qui lit `siteId` (Triage, Consultations, Dashboard…) doit être rechargé.
 */
export function useChangerSiteActif() {
  const setSession = useSessionStore(s => s.setSession)
  const qc = useQueryClient()

  return useMutation<SiteActifResponse, ApiError, string>({
    mutationFn: (siteId) => api.post<SiteActifResponse>('/auth/site-actif', { siteId }),

    onSuccess: (data) => {
      setSession(data.user, data.accessToken, data.refreshToken)
      qc.invalidateQueries()
    },
  })
}
