import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import { useSessionStore } from '@/stores/session.store'
import { obtenirJetonLocal, memoriserPourRetentative } from '@/lib/localAuth'
import type {
  LoginDto, TotpVerifyDto, UserSession, SessionConcurrente, ConfirmerSessionDto,
} from '@cms-saris/types'
import { getAppareilId } from '@/lib/appareil'

// ── Types de réponse backend ──────────────────────────────────────────────────

/** Session ouverte AILLEURS : rien n'est créé tant que l'utilisateur n'a pas tranché. */
export type SessionActiveResponse = {
  sessionActive: true
  tempToken:     string
  session:       SessionConcurrente
}

export type SessionTokens = {
  accessToken:  string
  refreshToken: string
  user:         Omit<UserSession, 'token'>
}

export type LoginResponse =
  | { requireTotp: true;  tempToken: string }
  | SessionActiveResponse
  | ({ requireTotp: false } & SessionTokens)

export type TotpVerifyResponse = SessionActiveResponse | SessionTokens

/** `sessionActive` absent des réponses normales : discriminant sûr. */
export function estSessionActive(
  r: LoginResponse | TotpVerifyResponse,
): r is SessionActiveResponse {
  return 'sessionActive' in r && r.sessionActive === true
}

// ── Hook : mutation login ─────────────────────────────────────────────────────

export function useLoginMutation() {
  const setSession = useSessionStore(s => s.setSession)

  return useMutation<LoginResponse, ApiError, LoginDto>({
    // `appareilId` ajouté ici et pas au niveau du formulaire : aucun appelant ne peut
    // l'oublier, et il n'a aucune raison d'être saisi ou vu par l'utilisateur.
    mutationFn: (dto) =>
      api.post<LoginResponse>('/auth/login', {
        ...dto,
        // `appareilId` porte à lui seul la règle de session unique, y compris sur le
        // backend embarqué : la détection exclut les sessions du MÊME appareil, si bien
        // qu'une application relancée retrouve la sienne au lieu de la croire concurrente.
        //
        // Ne PAS exempter ici avec `posteLocalId` : la règle resterait vraie entre postes
        // (le poste B voit, une fois la synchro passée, la session ouverte sur le poste A)
        // et l'exemption la ferait disparaître partout sur le client de bureau.
        appareilId: getAppareilId(),
      }),

    onSuccess: (data, dto) => {
      // Deux cas laissent la main au composant : TOTP à saisir, ou session concurrente
      // à trancher. Dans les deux, aucune session n'existe encore.
      if (estSessionActive(data) || data.requireTotp) return
      setSession(data.user, data.accessToken, data.refreshToken)
      // Client de bureau en mode local : on s'authentifie AUSSI auprès du backend
      // embarqué. Sans ce second jeton, la bascule hors-ligne envoie au backend local
      // un jeton signé par le central, qu'il rejette — l'application boucle puis
      // déconnecte. Non bloquant : si le poste vient d'être installé et que les comptes
      // ne sont pas encore synchronisés, on réessaiera (cf. assurerJetonLocal).
      memoriserPourRetentative(dto.login, dto.password)
      void obtenirJetonLocal(dto.login, dto.password)
    },
  })
}

// ── Hook : mutation vérification TOTP ────────────────────────────────────────

export function useTotpVerifyMutation() {
  const setSession = useSessionStore(s => s.setSession)

  return useMutation<TotpVerifyResponse, ApiError, TotpVerifyDto>({
    mutationFn: (dto) =>
      api.post<TotpVerifyResponse>('/auth/totp/verify', { ...dto, appareilId: getAppareilId() }),

    onSuccess: (data) => {
      if (estSessionActive(data)) return
      setSession(data.user, data.accessToken, data.refreshToken)
    },
  })
}

// ── Hook : décision face à une session concurrente ───────────────────────────

/** Réponse de `SIGNALER` : aucun jeton — on ne connecte pas un compte cru compromis. */
export type ConfirmerSessionResponse = { signale: true } | SessionTokens

export function useConfirmerSessionMutation() {
  const setSession = useSessionStore(s => s.setSession)

  return useMutation<ConfirmerSessionResponse, ApiError, ConfirmerSessionDto>({
    mutationFn: (dto) =>
      api.post<ConfirmerSessionResponse>('/auth/session/confirmer', dto),

    onSuccess: (data) => {
      if ('signale' in data) return
      setSession(data.user, data.accessToken, data.refreshToken)
    },
  })
}
