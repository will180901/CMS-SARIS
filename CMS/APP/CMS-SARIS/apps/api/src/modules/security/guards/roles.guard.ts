import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import { ROLES_KEY } from '../../../common/decorators/roles.decorator'
import type { Role, UserSession } from '@cms-saris/types'

/**
 * RolesGuard — vérifie que l'utilisateur connecté possède au moins un
 * des rôles déclarés via @Roles(...).
 *
 * Doit être utilisé APRÈS JwtAuthGuard (request.user doit être peuplé).
 * Usage : @UseGuards(JwtAuthGuard, RolesGuard)
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ])

    // Aucun rôle requis → accès libre (route publique ou protection par JWT seul)
    if (!requiredRoles || requiredRoles.length === 0) {
      return true
    }

    const request = context.switchToHttp().getRequest<{ user: UserSession }>()
    const user    = request.user

    if (!user) {
      throw new ForbiddenException('Accès interdit')
    }

    const hasRole = requiredRoles.some(role => user.roles.includes(role))

    if (!hasRole) {
      throw new ForbiddenException('Droits insuffisants pour accéder à cette ressource')
    }

    return true
  }
}
