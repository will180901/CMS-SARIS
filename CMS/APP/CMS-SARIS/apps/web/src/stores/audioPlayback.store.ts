/**
 * audioPlayback.store — lecture EXCLUSIVE des notes vocales / fichiers audio de
 * la messagerie (une seule en lecture à la fois, façon WhatsApp : en démarrer une
 * met automatiquement en pause celle qui jouait) + enchaînement automatique des
 * messages audio consécutifs (cf. `MessageThread.handleAudioEnded`).
 *
 * Clé = id de la PIÈCE jointe (pas du message), pour rester correct même dans le
 * cas rare d'un message portant plusieurs pièces audio.
 */
import { create } from 'zustand'

interface AudioPlaybackState {
  /** Id de la pièce jointe actuellement en lecture, ou null. */
  playingId: string | null
  /** Id de pièce dont la lecture doit démarrer automatiquement ; consommé une fois lancé. */
  autoPlayId: string | null
  play: (pieceId: string) => void
  /** Libère l'exclusivité — no-op si `pieceId` n'est plus le lecteur actif (évite une course). */
  stop: (pieceId?: string) => void
  requestAutoPlay: (pieceId: string) => void
  consumeAutoPlay: () => void
}

export const useAudioPlaybackStore = create<AudioPlaybackState>()((set) => ({
  playingId: null,
  autoPlayId: null,
  play: (pieceId) => set({ playingId: pieceId }),
  stop: (pieceId) => set((s) => (pieceId && s.playingId !== pieceId ? s : { playingId: null })),
  requestAutoPlay: (pieceId) => set({ autoPlayId: pieceId }),
  consumeAutoPlay: () => set({ autoPlayId: null }),
}))
