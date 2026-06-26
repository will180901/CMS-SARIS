/**
 * PermissionsGuard — vérifie que l'utilisateur connecté possède les permissions
 * granulaires requises pour accéder à la ressource.
 *
 * Doit être utilisé APRÈS JwtAuthGuard (request.user doit être peuplé).
 *
 * Usage :
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 *   @RequirePermissions('consultation.create')
 *   @Post()
 *   create() { ... }
 *
 * Si aucun @RequirePermissions n'est posé, l'accès est libre (JWT suffit).
 */

import {
  Injectable, CanActivate, ExecutionContext, ForbiddenException,
} from '@nestjs/common'
import { Reflector } from '@nestjs/core'
import {
  REQUIRE_PERMISSIONS_KEY,
} from '../../../common/decorators/require-permissions.decorator'
import type { PermissionCode, UserSession } from '@cms-saris/types'

interface PermissionMeta {
  permissions: PermissionCode[]
  mode:        'ANY' | 'ALL'
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const meta = this.reflector.getAllAndOverride<PermissionMeta>(
      REQUIRE_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    )

    // Aucune permission requise → accès libre (JWT suffit)
    if (!meta || !meta.permissions || meta.permissions.length === 0) return true

    const request = context.switchToHttp().getRequest<{ user: UserSession }>()
    const user    = request.user
    if (!user) throw new ForbiddenException('Authentification requise')

    const userPerms = new Set(user.permissions ?? [])

    const ok = meta.mode === 'ALL'
      ? meta.permissions.every(p => userPerms.has(p))
      : meta.permissions.some(p => userPerms.has(p))

    if (!ok) {
      throw new ForbiddenException(
        `Permissions insuffisantes (requis : ${meta.permissions.join(meta.mode === 'ALL' ? ' ET ' : ' OU ')})`,
      )
    }

    return true
  }
}
