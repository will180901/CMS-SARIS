import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserSession } from '@cms-saris/types'
import { sessionPersistStorage, SESSION_PERSIST_KEY } from './session-storage'

type SessionUser = Omit<UserSession, 'token'>

interface SessionState {
  user:            SessionUser | null
  token:           string | null
  refreshToken:    string | null
  isAuthenticated: boolean

  /** Hydratation (lecture du stockage persistant) TERMINÉE ? Tant que false, l'app affiche
   *  un écran de chargement neutre (évite le FLASH de l'écran de connexion au démarrage). */
  _hasHydrated: boolean
  setHasHydrated: (v: boolean) => void

  /** Re-synchronisation au démarrage nécessaire ? VRAI uniquement après un RECHARGEMENT de page
   *  avec session persistée (les permissions ont pu changer hors-ligne). FAUX après un login
   *  frais (tokens déjà à jour) — évite un /auth/refresh redondant qui, en course avec les
   *  premières requêtes, révoque la session et provoque le FLASH dashboard→login. */
  needsBootstrapRefresh: boolean
  setNeedsBootstrapRefresh: (v: boolean) => void

  /** Appelé après login réussi (ou verify TOTP) */
  setSession: (user: SessionUser, token: string, refreshToken: string) => void

  /** Appelé au logout ou expiration du token */
  clearSession: () => void

  /** Appelé lors du refresh du token JWT (rotation access + refresh) */
  updateTokens: (accessToken: string, refreshToken: string) => void

  /**
   * Met à jour uniquement l'objet `user` (sans toucher aux tokens).
   * Utilisé pour synchroniser les permissions/rôles après modification.
   */
  setUser: (user: SessionUser) => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user:            null,
      token:           null,
      refreshToken:    null,
      isAuthenticated: false,
      _hasHydrated:    false,
      needsBootstrapRefresh: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setNeedsBootstrapRefresh: (v) => set({ needsBootstrapRefresh: v }),

      // Login / refresh : tokens frais → pas de re-sync bootstrap à déclencher.
      setSession: (user, token, refreshToken) =>
        set({ user, token, refreshToken, isAuthenticated: true, needsBootstrapRefresh: false }),

      clearSession: () =>
        set({ user: null, token: null, refreshToken: null, isAuthenticated: false }),

      updateTokens: (accessToken, refreshToken) => set({ token: accessToken, refreshToken }),

      setUser: (user) => set({ user }),
    }),
    {
      name: SESSION_PERSIST_KEY,
      // Web : sessionStorage (éphémère, règle sécurité JWT). Desktop (Electron) :
      // coffre DPAPI chiffré (le refresh token n'est plus en clair). Voir
      // ./session-storage.ts.
      storage: createJSONStorage(() => sessionPersistStorage),
      // Ne PAS persister le flag d'hydratation (toujours recalculé au démarrage).
      partialize: (s) => ({ user: s.user, token: s.token, refreshToken: s.refreshToken, isAuthenticated: s.isAuthenticated }),
      // Hydratation terminée → on lève le flag (App peut décider login vs shell sans flash).
      // Si une session était persistée (= RECHARGEMENT de page), on demande la re-sync bootstrap
      // (permissions à jour). Après un login frais, ce chemin n'est pas emprunté → pas de re-sync.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        if (state?.isAuthenticated) state.setNeedsBootstrapRefresh(true)
      },
    },
  ),
)
