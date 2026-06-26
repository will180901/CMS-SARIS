/**
 * AuditInterceptor — journalise les MUTATIONS dans journal_audit.
 *
 * Persiste UNE entrée par mutation (POST/PATCH/PUT/DELETE) sur un controller/route
 * annoté `@Audit('module', 'EntiteType')` : auteur, action, module, entité, IP,
 * statut (SUCCES / ERREUR). Best-effort : n'altère jamais la requête métier.
 *
 * Règle R-SEC-018 : seul cet interceptor (et les écritures explicites des services
 * d'administration) écrit dans journal_audit ; jamais via une route d'écriture.
 * Global (APP_INTERCEPTOR) mais NO-OP si la route n'est pas annotée ou non mutante.
 */
import { Injectable, Logger, type NestInterceptor, type ExecutionContext, type CallHandler } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { tap, catchError, throwError, type Observable } from 'rxjs'
import { PrismaService } from '../../prisma/prisma.service'
import { AUDIT_KEY, type AuditMeta } from '../decorators/audit.decorator'

const ACTION_BY_METHOD: Record<string, string> = { POST: 'CREATE', PUT: 'UPDATE', PATCH: 'UPDATE', DELETE: 'DELETE' }

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name)

  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const meta = this.reflector.getAllAndOverride<AuditMeta | undefined>(AUDIT_KEY, [
      context.getHandler(), context.getClass(),
    ])
    if (!meta) return next.handle()

    const req = context.switchToHttp().getRequest<{
      method?: string; params?: Record<string, string>; ip?: string
      user?: { id?: string }
    }>()
    const action = req?.method ? ACTION_BY_METHOD[req.method] : undefined
    if (!action) return next.handle() // GET et autres → pas d'audit

    const utilisateurId = req.user?.id ?? null
    const entiteId = req.params?.['id'] ?? null
    const ipAdresse = req.ip ?? null

    const write = (statut: 'SUCCES' | 'ERREUR') => {
      this.prisma.journalAudit.create({
        data: { utilisateurId, action, module: meta.module, entiteType: meta.entiteType ?? null, entiteId, ipAdresse, statut },
      }).catch(e => this.logger.warn(`audit non écrit (ignoré) : ${(e as Error).message}`))
    }

    return next.handle().pipe(
      tap(() => write('SUCCES')),
      catchError(err => { write('ERREUR'); return throwError(() => err) }),
    )
  }
}
