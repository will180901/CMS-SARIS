import { SetMetadata } from '@nestjs/common'
import type { PermissionCode } from '@cms-saris/types'

/**
 * @RequirePermissions(...permissions) — décorateur pour protéger un endpoint
 * avec une vérification de permissions granulaires.
 *
 * L'utilisateur doit posséder AU MOINS UNE des permissions listées.
 * Pour exiger TOUTES les permissions, utiliser @RequireAllPermissions.
 *
 * Usage :
 *   @RequirePermissions('consultation.create', 'consultation.update')
 *   @UseGuards(JwtAuthGuard, PermissionsGuard)
 *   @Post()
 *   create() { ... }
 */
export const REQUIRE_PERMISSIONS_KEY = 'require-permissions'
export const REQUIRE_PERMISSIONS_MODE_KEY = 'require-permissions-mode'

export const RequirePermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, { permissions, mode: 'ANY' as const })

export const RequireAllPermissions = (...permissions: PermissionCode[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_KEY, { permissions, mode: 'ALL' as const })
