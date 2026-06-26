import { SetMetadata } from '@nestjs/common'
import type { Role } from '@cms-saris/types'

/**
 * @Roles(...roles) — décorateur pour protéger un endpoint par rôle.
 *
 * Usage :
 *   @Roles('ADMIN_SYSTEME', 'MEDECIN_CHEF')
 *   @UseGuards(JwtAuthGuard, RolesGuard)
 *   @Get('utilisateurs')
 *   findAll() { ... }
 */
export const ROLES_KEY = 'roles'
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles)
