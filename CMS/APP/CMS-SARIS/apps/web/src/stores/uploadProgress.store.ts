import { create } from 'zustand'

/** Progression (0-100) des uploads en cours, par identifiant choisi par l'appelant
 *  (ex. l'id temporaire du message optimiste en messagerie). Générique, réutilisable
 *  au-delà de la messagerie (photo de profil, photo patient, ...). */
interface UploadProgressState {
  progress: Record<string, number>
  setProgress: (id: string, pct: number) => void
  clear: (id: string) => void
}

export const useUploadProgressStore = create<UploadProgressState>((set) => ({
  progress: {},
  setProgress: (id, pct) => set((s) => ({ progress: { ...s.progress, [id]: pct } })),
  clear: (id) => set((s) => {
    const next = { ...s.progress }
    delete next[id]
    return { progress: next }
  }),
}))
