import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { UserSession } from '@cms-saris/types'
import { sessionPersistStorage, SESSION_PERSIST_KEY } from './session-storage'
import { basculerJetons, type Interlocuteur, type Jetons } from '@/lib/interlocuteur'
import { desktopBridge } from '@/lib/desktop'

type SessionUser = Omit<UserSession, 'token'>

interface SessionState {
  user:            SessionUser | null
  token:           string | null
  refreshToken:    string | null
  /**
   * Client de bureau : à quel serveur appartient le jeu de jetons ACTIF (`token`, `refreshToken`) — le central
   * ou le service local de la machine. `null` : navigateur web (un seul serveur). cf. lib/interlocuteur.ts.
   */
  interlocuteur:   Interlocuteur | null
  /** Le jeu de jetons de l'AUTRE serveur, quand on a pu l'obtenir (il attend, prêt pour la bascule). */
  autresJetons:    Partial<Record<Interlocuteur, Jetons>>
  /** Le site de travail a-t-il ete confirme pour CETTE session ? Faux a chaque nouvelle
   *  connexion sur le web ; toujours vrai sur le client de bureau, ou le site vient du
   *  poste et ne se choisit pas. */
  siteConfirme:    boolean
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

  /**
   * Appelé après login réussi (ou verify TOTP), et à chaque renouvellement. `interlocuteur` n'est donné qu'à la
   * connexion (client de bureau) : un renouvellement concerne le même serveur, il le laisse tel quel.
   */
  setSession: (user: SessionUser, token: string, refreshToken: string, interlocuteur?: Interlocuteur) => void
  setSiteConfirme: (v: boolean) => void
  /**
   * Session héritée d'une version où l'écran ne parlait qu'au service local : son jeu de jetons est celui du
   * service local. Sans cela, le premier appel au central présenterait un jeton qu'il refuse, et la personne
   * serait déconnectée à la mise à jour. N'a d'effet que si l'on ne sait pas encore à quel serveur il appartient.
   */
  heriterInterlocuteur: (interlocuteur: Interlocuteur) => void
  /** Garde le jeu de jetons de l'AUTRE serveur (client de bureau). */
  memoriserAutresJetons: (interlocuteur: Interlocuteur, jetons: Jetons) => void
  /**
   * Fait du jeu de l'autre serveur le jeu ACTIF (le jeu actuel passe de côté). `false` si l'on n'a pas ce jeu :
   * rien ne change. L'appelant change l'adresse de l'API dans le même mouvement (cf. connectivity.store).
   */
  basculerVers: (interlocuteur: Interlocuteur) => boolean

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
      interlocuteur:   null,
      autresJetons:    {},
      siteConfirme:    false,
      isAuthenticated: false,
      _hasHydrated:    false,
      needsBootstrapRefresh: false,

      setHasHydrated: (v) => set({ _hasHydrated: v }),
      setNeedsBootstrapRefresh: (v) => set({ needsBootstrapRefresh: v }),

      // Login / refresh : tokens frais → pas de re-sync bootstrap à déclencher.
      // `siteConfirme` n'est PAS remis a false ici : setSession sert aussi bien a la
      // connexion qu'a la rotation des jetons, et le remettre a false ferait resurgir la
      // question du site a chaque renouvellement. C'est `clearSession` qui le remet a zero,
      // donc a la deconnexion — exactement la duree d'une session.
      setSession: (user, token, refreshToken, interlocuteur) =>
        set((s) => ({
          user, token, refreshToken, isAuthenticated: true, needsBootstrapRefresh: false,
          // Une NOUVELLE connexion (interlocuteur donné) repart d'un jeu propre : l'ancien jeu de l'autre serveur
          // appartenait à une session précédente. Un renouvellement ne change rien à cela.
          ...(interlocuteur ? { interlocuteur, autresJetons: {} } : { interlocuteur: s.interlocuteur }),
        })),

      heriterInterlocuteur: (interlocuteur) =>
        set((s) => (s.interlocuteur ? s : { interlocuteur })),

      memoriserAutresJetons: (interlocuteur, jetons) =>
        set((s) => (s.interlocuteur === interlocuteur ? s : { autresJetons: { ...s.autresJetons, [interlocuteur]: jetons } })),

      basculerVers: (interlocuteur) => {
        const s = useSessionStore.getState()
        const suite = basculerJetons(
          { interlocuteur: s.interlocuteur, token: s.token, refreshToken: s.refreshToken, autres: s.autresJetons },
          interlocuteur,
        )
        if (!suite) return false
        set({ interlocuteur: suite.interlocuteur, token: suite.token, refreshToken: suite.refreshToken, autresJetons: suite.autres })
        return true
      },

      setSiteConfirme: (v) => set({ siteConfirme: v }),


      clearSession: () =>
        set({ user: null, token: null, refreshToken: null, interlocuteur: null, autresJetons: {}, siteConfirme: false, isAuthenticated: false }),

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
      partialize: (s) => ({
        user: s.user, token: s.token, refreshToken: s.refreshToken, interlocuteur: s.interlocuteur,
        autresJetons: s.autresJetons, siteConfirme: s.siteConfirme, isAuthenticated: s.isAuthenticated,
      }),
      // Hydratation terminée → on lève le flag (App peut décider login vs shell sans flash).
      // Si une session était persistée (= RECHARGEMENT de page), on demande la re-sync bootstrap
      // (permissions à jour). Après un login frais, ce chemin n'est pas emprunté → pas de re-sync.
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true)
        if (state?.isAuthenticated) state.setNeedsBootstrapRefresh(true)
        // Client de bureau : une session sans serveur d'attache date de la version qui ne parlait qu'au service local.
        if (state?.isAuthenticated && !state.interlocuteur && desktopBridge()?.localApiUrl) state.heriterInterlocuteur('local')
      },
    },
  ),
)
