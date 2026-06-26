/**
 * PresenceService — présence « en ligne » en mémoire.
 *
 * Un utilisateur est considéré EN LIGNE tant qu'au moins une connexion SSE
 * (flux de notifications) est ouverte. Sert aux accusés de réception (« remis »
 * quand le destinataire est/était connecté) et au statut « en ligne » des
 * conversations. La dernière présence est aussi persistée (Utilisateur.lastSeenAt).
 */
import { Injectable } from '@nestjs/common'

@Injectable()
export class PresenceService {
  private readonly counts = new Map<string, number>()
  /**
   * Conversation actuellement OUVERTE par chaque utilisateur, rafraîchie à chaque
   * ouverture/poll du fil (`listMessages`). TTL court : expire si l'onglet n'est
   * plus actif (le poll s'arrête). Sert à NE PAS faire sonner la cloche pour un
   * message d'une conversation déjà sous les yeux du destinataire.
   */
  private readonly viewing = new Map<string, { convId: string; at: number }>()
  private readonly VIEWING_TTL_MS = 45_000

  connect(userId: string): void {
    this.counts.set(userId, (this.counts.get(userId) ?? 0) + 1)
  }

  disconnect(userId: string): void {
    const n = (this.counts.get(userId) ?? 1) - 1
    if (n <= 0) { this.counts.delete(userId); this.viewing.delete(userId) }
    else this.counts.set(userId, n)
  }

  isOnline(userId: string): boolean {
    return (this.counts.get(userId) ?? 0) > 0
  }

  /** Mémorise la conversation que l'utilisateur regarde (heartbeat depuis `listMessages`). */
  setViewing(userId: string, convId: string): void {
    this.viewing.set(userId, { convId, at: Date.now() })
  }

  /** L'utilisateur regarde-t-il actuellement cette conversation ? (TTL court) */
  isViewing(userId: string, convId: string): boolean {
    const v = this.viewing.get(userId)
    return !!v && v.convId === convId && Date.now() - v.at < this.VIEWING_TTL_MS
  }
}
