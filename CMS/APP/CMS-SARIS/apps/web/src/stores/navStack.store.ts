/**
 * navStack.store — pile de navigation interne (flèches « Précédent / Suivant »).
 *
 * React Router n'expose PAS si l'on peut avancer/reculer dans l'historique. On
 * reflète donc l'historique applicatif dans ce petit store : chaque navigation est
 * enregistrée (cf. `useNavStackTracker`), et les flèches du header lisent
 * `index`/`stack` pour savoir si elles sont actives.
 *
 * Les flèches appellent `navigate(-1)` / `navigate(1)` → React Router émet un POP ;
 * la DIRECTION est déduite en comparant la nouvelle URL aux voisins de la pile.
 */
import { create } from 'zustand'

interface NavStackState {
  stack: string[]
  index: number
  push:    (path: string) => void
  replace: (path: string) => void
  pop:     (path: string) => void
}

export const useNavStackStore = create<NavStackState>()((set) => ({
  stack: [],
  index: -1,

  // Nouvelle navigation (clic sidebar, navigate(path)…) : tronque l'historique
  // « en avant » puis empile — exactement comme un navigateur.
  push: (path) => set((s) => {
    if (s.index >= 0 && s.stack[s.index] === path) return s            // même page → ignore
    const stack = s.stack.slice(0, s.index + 1)
    stack.push(path)
    return { stack, index: stack.length - 1 }
  }),

  // Redirection (Navigate replace, RootRedirect…) : remplace l'entrée courante.
  replace: (path) => set((s) => {
    if (s.index < 0) return { stack: [path], index: 0 }
    const stack = s.stack.slice()
    stack[s.index] = path
    return { stack, index: s.index }
  }),

  // Retour/avance (flèches ou boutons navigateur) : on glisse l'index vers le
  // voisin qui correspond à la nouvelle URL ; sinon POP « externe » → on rebâtit.
  pop: (path) => set((s) => {
    if (s.index > 0 && s.stack[s.index - 1] === path)            return { stack: s.stack, index: s.index - 1 }
    if (s.index < s.stack.length - 1 && s.stack[s.index + 1] === path) return { stack: s.stack, index: s.index + 1 }
    if (s.stack[s.index] === path) return s
    const stack = s.stack.slice(0, s.index + 1)
    stack.push(path)
    return { stack, index: stack.length - 1 }
  }),
}))
