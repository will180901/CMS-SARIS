import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import type { LoginDto, TotpVerifyDto, UserSession } from '@cms-saris/types'

// ── Types de réponse backend ──────────────────────────────────────────────────

export type LoginResponse =
  | { requireTotp: true;  tempToken: string }
  | {
      requireTotp:  false
      accessToken:  string
      refreshToken: string
      user:         Omit<UserSession, 'token'>
    }

export type TotpVerifyResponse = {
  accessToken:  string
  refreshToken: string
  user:         Omit<UserSession, 'token'>
}

// ── Hook : mutation login ─────────────────────────────────────────────────────

export function useLoginMutation() {
  const setSession = useSessionStore(s => s.setSession)

  return useMutation<LoginResponse, ApiError, LoginDto>({
    mutationFn: (dto) => api.post<LoginResponse>('/auth/login', dto),

    onSuccess: (data) => {
      // Si TOTP non requis → session directement créée
      if (!data.requireTotp) {
        setSession(data.user, data.accessToken, data.refreshToken)
      }
      // Si TOTP requis → le composant récupère tempToken via data
    },
  })
}

// ── Hook : mutation vérification TOTP ────────────────────────────────────────

export function useTotpVerifyMutation() {
  const setSession = useSessionStore(s => s.setSession)

  return useMutation<TotpVerifyResponse, ApiError, TotpVerifyDto>({
    mutationFn: (dto) => api.post<TotpVerifyResponse>('/auth/totp/verify', dto),

    onSuccess: (data) => {
      setSession(data.user, data.accessToken, data.refreshToken)
    },
  })
}
