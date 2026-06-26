/**
 * LiveRefreshInterceptor — diffuse un événement TEMPS RÉEL SILENCIEUX après
 * chaque mutation réussie (POST/PATCH/PUT/DELETE) sur un controller annoté
 * `@LiveRefresh('LIVE_*')`. Permet aux listes de TOUS les clients (référentiels,
 * acteurs, bons d'examen…) de se rafraîchir instantanément, sans cloche ni son.
 *
 * Global (APP_INTERCEPTOR) mais NO-OP si la route n'est pas annotée ou n'est pas
 * mutante → zéro impact ailleurs.
 */
import { Injectable, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { tap, type Observable } from 'rxjs'
import { LIVE_REFRESH_KEY, type LiveRefreshMeta } from '../decorators/live-refresh.decorator'
import { NotificationService } from '../../modules/notification/notification.service'

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

@Injectable()
export class LiveRefreshInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly notif: NotificationService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<LiveRefreshMeta | undefined>(LIVE_REFRESH_KEY, [
      context.getHandler(), context.getClass(),
    ])
    if (!meta) return next.handle()

    const req = context.switchToHttp().getRequest<{ method?: string; user?: { siteId?: string } }>()
    if (!req?.method || !MUTATING.has(req.method)) return next.handle()

    // Cloisonnement : un événement « siteScoped » n'est diffusé qu'aux clients du
    // même site (évite une tempête de refetch cross-site sur les données locales).
    const opts = meta.siteScoped && req.user?.siteId ? { siteId: req.user.siteId } : undefined

    // Diffusion APRÈS succès uniquement (les erreurs ne déclenchent pas tap.next).
    return next.handle().pipe(tap(() => this.notif.broadcastLive(meta.type, opts)))
  }
}
