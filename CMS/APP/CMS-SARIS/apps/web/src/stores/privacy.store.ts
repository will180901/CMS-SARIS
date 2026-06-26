/**
 * privacy.store — « rideau de confidentialité » des zones de détail (triage, consultation).
 *
 * Quand il est actif, la zone de droite est floutée (verre poli + grain subtil) en
 * PERMANENCE et ne se révèle qu'au SURVOL — protège des regards indiscrets sur un poste
 * partagé. Préférence persistée par poste (localStorage). Bascule depuis le header.
 */
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

interface PrivacyState {
  curtain: boolean
  toggle: () => void
  set: (v: boolean) => void
}

export const usePrivacyStore = create<PrivacyState>()(
  persist(
    (set) => ({
      curtain: true,                                   // actif par défaut : flouté tant qu'on ne survole pas
      toggle: () => set((s) => ({ curtain: !s.curtain })),
      set:    (curtain) => set({ curtain }),
    }),
    {
      name: 'saris-privacy',
      storage: createJSONStorage(() => localStorage),
    },
  ),
)
