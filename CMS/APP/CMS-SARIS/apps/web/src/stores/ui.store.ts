/**
 * ui.store — état d'interface transversal (non persistant).
 *
 * Aujourd'hui : ouverture du tiroir de navigation MOBILE (la sidebar devient un
 * drawer sous 768px ; le bouton hamburger du TopHeader et le drawer de la Sidebar
 * partagent cet état, étant des composants frères).
 */
import { create } from 'zustand'

interface UiState {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void
}

export const useUiStore = create<UiState>()((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (mobileNavOpen) => set({ mobileNavOpen }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),
}))
