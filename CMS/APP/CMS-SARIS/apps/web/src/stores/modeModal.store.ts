/**
 * modeModal.store — la fenêtre « Passer en mode Test / Revenir en production ».
 *
 * Deux endroits la déclenchent (l'interrupteur de l'en-tête et le bandeau orange) ; une seule
 * fenêtre existe, montée une fois dans le shell. Pas de persistance : une fenêtre de confirmation
 * ne doit jamais se rouvrir toute seule après un rechargement.
 */
import { create } from 'zustand'

interface ModeModalState {
  ouverte: boolean
  ouvrir: () => void
  fermer: () => void
}

export const useModeModalStore = create<ModeModalState>()((set) => ({
  ouverte: false,
  ouvrir: () => set({ ouverte: true }),
  fermer: () => set({ ouverte: false }),
}))
