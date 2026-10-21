/**
 * brouillonsMessagerie.store — le texte à moitié écrit de chaque conversation, EN MÉMOIRE.
 *
 * On change de conversation, on revient : le brouillon est toujours là (comme dans WhatsApp).
 * Volontairement jamais écrit sur le disque (ni localStorage) : un brouillon peut contenir
 * une information de patient, il ne survit donc pas à la fermeture de la session.
 */
import { create } from 'zustand'
import { useSessionStore } from './session.store'

/** Une mention en cours d'écriture dans le brouillon (cf. MessageThread). */
export interface MentionBrouillon { start: number; end: number; id: string; nom: string }

interface Brouillon { texte: string; mentions: MentionBrouillon[] }

interface BrouillonsState {
  brouillons: Record<string, Brouillon>
  /** Mémorise le brouillon ; un texte vide l'efface. */
  ecrire: (conversationId: string, texte: string, mentions: MentionBrouillon[]) => void
  /** Vide tout (déconnexion). */
  tout: () => void
}

export const useBrouillonsMessagerie = create<BrouillonsState>()((set) => ({
  brouillons: {},
  ecrire: (conversationId, texte, mentions) =>
    set((s) => {
      const suivants = { ...s.brouillons }
      if (texte.trim()) suivants[conversationId] = { texte, mentions }
      else delete suivants[conversationId]
      return { brouillons: suivants }
    }),
  tout: () => set({ brouillons: {} }),
}))

// Déconnexion (ou session expirée) : les brouillons ne passent pas à l'utilisateur suivant.
useSessionStore.subscribe((etat, avant) => {
  if (avant.isAuthenticated && !etat.isAuthenticated) useBrouillonsMessagerie.getState().tout()
})
