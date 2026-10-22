/**
 * EcritureLocaleInterceptor — sur un POSTE DE BUREAU, annonce au moteur de synchronisation qu'une
 * requête qui modifie quelque chose vient de réussir, pour que le travail parte vers le central dans
 * les secondes qui suivent au lieu d'attendre le filet de sécurité (5 minutes).
 *
 * Global (APP_INTERCEPTOR) mais sans effet hors poste de bureau (`enabled` faux sur le central) et
 * pour toute requête qui ne modifie rien (GET…). On s'accroche à la REQUÊTE plutôt qu'à l'accès à la
 * base : certains chemins d'écriture passent par un client brut qu'aucun crochet de l'ORM ne voit, et
 * les écritures de la synchronisation elle-même (réception) ne doivent pas se renvoyer en boucle.
 * Une requête qui n'écrit rien (présence, « en train d'écrire »…) ne coûte qu'une lecture locale :
 * le moteur vérifie qu'il y a quelque chose à envoyer avant de déranger le serveur.
 */
import {
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common'
import { tap, type Observable } from 'rxjs'
import { SyncClientService } from './sync-client.service'

const METHODES_ECRITURE = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

/** La synchronisation ne se déclenche pas elle-même (/sync/now, /sync/run, /sync/pull…). */
const SYNCHRONISATION = /^\/sync(\/|\?|$)/

@Injectable()
export class EcritureLocaleInterceptor implements NestInterceptor {
  constructor(private readonly client: SyncClientService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (!this.client.enabled) return next.handle()
    const req = context
      .switchToHttp()
      .getRequest<{ method?: string; originalUrl?: string; url?: string }>()
    if (!req?.method || !METHODES_ECRITURE.has(req.method)) return next.handle()
    if (SYNCHRONISATION.test(req.originalUrl ?? req.url ?? ''))
      return next.handle()
    return next.handle().pipe(tap(() => this.client.notifierEcritureLocale()))
  }
}
