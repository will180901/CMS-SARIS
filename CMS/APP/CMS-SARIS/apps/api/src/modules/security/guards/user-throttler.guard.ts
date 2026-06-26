/**
 * UserThrottlerGuard — rate-limiting PAR UTILISATEUR (et non par IP).
 *
 * Derrière un proxy/NAT, plusieurs agents partagent la même IP : un throttling
 * par IP les pénaliserait mutuellement. On clé donc sur l'id utilisateur (issu du
 * JWT, déjà résolu par JwtAuthGuard placé AVANT ce guard), avec repli sur l'IP
 * pour les requêtes non authentifiées.
 */
import { Injectable, type ExecutionContext } from '@nestjs/common'
import { ThrottlerGuard } from '@nestjs/throttler'

@Injectable()
export class UserThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined
    if (user?.id) return `u:${user.id}`
    const ip = (req.ip as string) || 'anon'
    return `ip:${ip}`
  }

  /** Clé de stockage stable même sans décorateur nommé. */
  protected generateKey(context: ExecutionContext, suffix: string, name: string): string {
    return super.generateKey(context, suffix, name || 'msg')
  }
}
