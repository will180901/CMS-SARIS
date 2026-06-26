import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import type { Request, Response } from 'express'

/**
 * GlobalExceptionFilter — intercepte toutes les exceptions non gérées.
 *
 * Renvoie toujours la même structure JSON :
 * {
 *   statusCode : number
 *   timestamp  : string (ISO)
 *   path       : string
 *   message    : string | string[]
 * }
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx      = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request  = ctx.getRequest<Request>()

    let status: number
    let message: string | string[]

    // 1) Erreurs Prisma connues (duck-typing du code "P####") → statut HTTP propre.
    //    Sans ça, une violation de contrainte — ex. @unique encore occupé par un
    //    tombstone soft-delete lors d'une re-création — repartirait en 500 opaque
    //    au lieu d'un 409 lisible.
    const prismaCode = this.prismaErrorCode(exception)
    if (prismaCode) {
      switch (prismaCode) {
        case 'P2002': {
          const cible = this.uniqueTarget(exception)
          status  = HttpStatus.CONFLICT
          message = cible ? `Valeur déjà utilisée (${cible})` : 'Valeur déjà utilisée'
          break
        }
        case 'P2025':
          status  = HttpStatus.NOT_FOUND
          message = 'Ressource introuvable'
          break
        case 'P2003':
        case 'P2014':
          status  = HttpStatus.CONFLICT
          message = 'Opération impossible : cette donnée est référencée par d’autres enregistrements'
          break
        default:
          status  = HttpStatus.BAD_REQUEST
          message = 'Requête invalide (contrainte de base de données)'
      }
    } else if (exception instanceof HttpException) {
      status = exception.getStatus()
      const rawMessage = exception.getResponse()
      message =
        typeof rawMessage === 'string'
          ? rawMessage
          : typeof rawMessage === 'object' && rawMessage !== null && 'message' in rawMessage
            ? (rawMessage as { message: string | string[] }).message
            : String(rawMessage)
    } else {
      status  = HttpStatus.INTERNAL_SERVER_ERROR
      message = 'Erreur interne du serveur'
    }

    // Logger les erreurs 5xx côté serveur
    if (status >= 500) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      )
    }

    response.status(status).json({
      statusCode: status,
      timestamp:  new Date().toISOString(),
      path:       request.url,
      message,
    })
  }

  /** Code d'erreur Prisma connu (format P####), par duck-typing — sans importer @prisma/client. */
  private prismaErrorCode(e: unknown): string | null {
    if (e && typeof e === 'object' && 'code' in e) {
      const code = (e as { code?: unknown }).code
      if (typeof code === 'string' && /^P\d{4}$/.test(code)) return code
    }
    return null
  }

  /** Champ(s) en collision d'un P2002 (meta.target), pour un message lisible. */
  private uniqueTarget(e: unknown): string | null {
    const target = (e as { meta?: { target?: unknown } })?.meta?.target
    if (Array.isArray(target)) return target.join(', ')
    if (typeof target === 'string') return target
    return null
  }
}
