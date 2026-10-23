import { ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { AuthGuard } from '@nestjs/passport'
import { AUTORISER_POSTE_KEY } from '../../../common/decorators/autoriser-poste.decorator'

/**
 * JwtAuthGuard — protège une route avec le JWT Bearer.
 *
 * Usage : @UseGuards(JwtAuthGuard)
 * Peuple request.user via JwtStrategy.validate().
 *
 * Un jeton de POSTE appairé (`estPoste`) n'est admis que sur les routes marquées `@AutoriserPoste()` : partout ailleurs
 * il est refusé (403), même si la route ne demande aucune permission particulière.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super()
  }

  handleRequest<TUser = unknown>(
    err: unknown,
    user: TUser,
    info: unknown,
    context: ExecutionContext,
    status?: unknown,
  ): TUser {
    const utilisateur = super.handleRequest(err, user, info, context, status as never)
    if ((utilisateur as { estPoste?: boolean } | null)?.estPoste) {
      const autorise = this.reflector.getAllAndOverride<boolean | undefined>(
        AUTORISER_POSTE_KEY,
        [context.getHandler(), context.getClass()],
      )
      if (!autorise) {
        throw new ForbiddenException(
          'Le jeton d’un poste ne donne accès qu’à la synchronisation.',
        )
      }
    }
    return utilisateur
  }
}
