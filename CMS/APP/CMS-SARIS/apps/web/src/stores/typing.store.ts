/**
 * typing.store — indicateur temps réel « en train d'écrire / d'enregistrer », en mémoire.
 *
 * Le flux SSE des notifications pousse des événements TYPING (texte) ou TYPING_AUDIO
 * (note vocale), éphémères, pour une conversation ; on mémorise un horodatage
 * d'EXPIRATION + le TYPE d'activité par conversation. Le fil affiche la bulle animée
 * (3 points pour le texte, micro + onde pour l'audio) tant que le TTL n'est pas dépassé.
 */
import { create } from 'zustand'

/**
 * Durée de vie d'un ping : la bulle s'efface ~1,4 s après le DERNIER ping reçu.
 * Couplé à un ping émis toutes les ~0,6 s pendant la frappe / l'enregistrement, la
 * bulle reste affichée en continu tant que l'activité dure et s'arrête « net » à l'arrêt.
 */
export const TYPING_TTL_MS = 1400

/** Type d'activité en cours dans la conversation. */
export type TypingKind = 'text' | 'audio'

interface TypingEntry {
  /** timestamp d'expiration (ms epoch) */
  until: number
  /** texte (« en train d'écrire ») ou audio (« en train d'enregistrer un message vocal ») */
  kind: TypingKind
}

interface TypingState {
  /** conversationId → activité en cours. */
  typing: Record<string, TypingEntry>
  /** Signale qu'un participant écrit / enregistre dans cette conversation (réarme le TTL). */
  ping: (conversationId: string, kind?: TypingKind) => void
}

export const useTypingStore = create<TypingState>()((set) => ({
  typing: {},
  ping: (conversationId, kind = 'text') =>
    set((s) => ({ typing: { ...s.typing, [conversationId]: { until: Date.now() + TYPING_TTL_MS, kind } } })),
}))

/** Activité en cours dans cette conversation (TTL non dépassé), ou null. */
export function activeTyping(typing: Record<string, TypingEntry>, conversationId: string): TypingEntry | null {
  const e = typing[conversationId]
  return e && e.until > Date.now() ? e : null
}
