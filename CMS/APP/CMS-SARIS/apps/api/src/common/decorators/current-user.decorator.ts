import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { UserSession } from '@cms-saris/types'

/**
 * @CurrentUser() — injecte l'utilisateur authentifié dans un paramètre.
 *
 * Peuplé par JwtStrategy.validate() (module Sécurité).
 *
 * Usage :
 *   @Get('profil')
 *   getProfil(@CurrentUser() user: UserSession) {
 *     return user
 *   }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UserSession => {
    const request = ctx.switchToHttp().getRequest<{ user: UserSession }>()
    return request.user
  },
)
