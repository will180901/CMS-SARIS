/**
 * viewState.store — mémoire d'état d'interface PAR PAGE.
 *
 * Problème résolu : quand on quitte une page, son état local React (sélection,
 * filtres, recherche, onglet actif, largeur de panneau…) est démonté donc PERDU.
 * Au retour, tout repart à zéro. Ce store conserve cet état pour qu'on retrouve
 * exactement où on en était.
 *
 * Forme : `pages[pageKey][stateKey] = valeur`. On y accède via le hook
 * `usePersistedState(pageKey, key, initial)` (drop-in de `useState`).
 *
 * Persistance : `sessionStorage` → survit à la navigation ET au rafraîchissement
 * de l'onglet, mais repart propre dans une session/onglet neuf (sensé pour un
 * poste partagé : on ne garde pas le contexte d'hier). Ne JAMAIS y mettre d'état
 * de modale/brouillon (qui doit se réinitialiser) — cf. usePersistedState.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface ViewState {
  pages: Record<string, Record<string, unknown>>
  set: (pageKey: string, key: string, value: unknown) => void
  /** Repart propre pour une page (utile si on veut un bouton « réinitialiser les filtres »). */
  clearPage: (pageKey: string) => void
}

export const useViewStateStore = create<ViewState>()(
  persist(
    (set) => ({
      pages: {},
      set: (pageKey, key, value) =>
        set((s) => ({
          pages: { ...s.pages, [pageKey]: { ...s.pages[pageKey], [key]: value } },
        })),
      clearPage: (pageKey) =>
        set((s) => {
          const pages = { ...s.pages }
          delete pages[pageKey]
          return { pages }
        }),
    }),
    {
      name: 'saris-viewstate',
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
)
