/**
 * UtilisateursController — /admin/utilisateurs
 *
 * Toutes les routes nécessitent JwtAuthGuard + PermissionsGuard.
 * Granularité : utilisateur.{read,create,update,delete,reset_password,assign_role}
 */

import {
  Controller, Get, Post, Patch, Put, Delete, Body, Param, Query, Req,
  UseGuards, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common'
import { UtilisateursService }  from './utilisateurs.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'
import {
  CreateUtilisateurDto, UpdateUtilisateurDto,
  SetRolesDto, SetStatutDto, ResetPasswordDto, UtilisateurQueryDto,
} from './dto/utilisateur.dto'
import { SetPermissionOverridesDto, BulkPermissionDto } from './dto/permission-override.dto'

interface AuthedRequest { user?: { id?: string; siteId?: string } }

/** siteId du JWT — cloisonnement multi-site, jamais depuis les query params. */
function requireSite(req: AuthedRequest): string {
  const siteId = req.user?.siteId
  if (!siteId) throw new UnauthorizedException('Session invalide')
  return siteId
}

@Controller('admin/utilisateurs')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UtilisateursController {
  constructor(private readonly svc: UtilisateursService) {}

  @Get()
  @RequirePermissions('utilisateur.read')
  findAll(@Query() query: UtilisateurQueryDto, @Req() req: AuthedRequest) {
    return this.svc.findAll(query, requireSite(req))
  }

  @Get(':id')
  @RequirePermissions('utilisateur.read')
  findById(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.findById(id, requireSite(req))
  }

  @Post()
  @RequirePermissions('utilisateur.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateUtilisateurDto, @Req() req: AuthedRequest) {
    return this.svc.create(dto, req.user?.id ?? null, requireSite(req))
  }

  @Patch(':id')
  @RequirePermissions('utilisateur.update')
  update(@Param('id') id: string, @Body() dto: UpdateUtilisateurDto, @Req() req: AuthedRequest) {
    return this.svc.update(id, dto, req.user?.id ?? null, requireSite(req))
  }

  @Delete(':id')
  @RequirePermissions('utilisateur.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.delete(id, req.user?.id ?? null, requireSite(req))
  }

  @Patch(':id/roles')
  @RequirePermissions('utilisateur.assign_role')
  setRoles(@Param('id') id: string, @Body() dto: SetRolesDto, @Req() req: AuthedRequest) {
    return this.svc.setRoles(id, dto, req.user?.id ?? null, requireSite(req))
  }

  @Patch(':id/statut')
  @RequirePermissions('utilisateur.update')
  setStatut(@Param('id') id: string, @Body() dto: SetStatutDto, @Req() req: AuthedRequest) {
    return this.svc.setStatut(id, dto, req.user?.id ?? null, requireSite(req))
  }

  @Post(':id/reset-password')
  @RequirePermissions('utilisateur.reset_password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto, @Req() req: AuthedRequest) {
    return this.svc.resetPassword(id, dto, req.user?.id ?? null, requireSite(req))
  }

  // ── Récupération de compte (admin) ────────────────────────────────────────

  /** Retire la 2FA d'un utilisateur ayant perdu son téléphone. */
  @Post(':id/totp/reset')
  @RequirePermissions('utilisateur.reset_password')
  @HttpCode(HttpStatus.OK)
  resetTotp(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.resetTotp(id, req.user?.id ?? null, requireSite(req))
  }

  /** Régénère les codes de secours (renvoyés une seule fois). */
  @Post(':id/backup-codes')
  @RequirePermissions('utilisateur.reset_password')
  @HttpCode(HttpStatus.OK)
  regenerateBackupCodes(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.regenerateBackupCodes(id, req.user?.id ?? null, requireSite(req))
  }

  /** Force la déconnexion : révoque toutes les sessions actives. */
  @Post(':id/sessions/revoke')
  @RequirePermissions('utilisateur.reset_password')
  @HttpCode(HttpStatus.OK)
  revokeSessions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.revokeAllSessions(id, req.user?.id ?? null, requireSite(req))
  }

  // ── Dérogations de permissions (GRANT / REVOKE par utilisateur) ───────────

  /** Application groupée d'une dérogation à plusieurs utilisateurs */
  @Post('permissions/bulk')
  @RequirePermissions('utilisateur.manage_permissions')
  @HttpCode(HttpStatus.OK)
  bulkPermissions(@Body() dto: BulkPermissionDto, @Req() req: AuthedRequest) {
    return this.svc.bulkSetPermission(dto, req.user?.id ?? null, requireSite(req))
  }

  /** Ventilation des permissions effectives d'un utilisateur */
  @Get(':id/permissions')
  @RequirePermissions('utilisateur.read', 'utilisateur.manage_permissions')
  getPermissions(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.getPermissions(id, requireSite(req))
  }

  /** Remplace l'ensemble des dérogations d'un utilisateur */
  @Put(':id/permissions')
  @RequirePermissions('utilisateur.manage_permissions')
  setPermissions(@Param('id') id: string, @Body() dto: SetPermissionOverridesDto, @Req() req: AuthedRequest) {
    return this.svc.setPermissions(id, dto, req.user?.id ?? null, requireSite(req))
  }
}
