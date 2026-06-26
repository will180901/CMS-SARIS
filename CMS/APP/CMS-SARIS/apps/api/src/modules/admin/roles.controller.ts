/**
 * RolesController — /admin/roles
 *
 * Liste, création, édition (matrice de permissions), suppression.
 * + endpoint séparé /admin/permissions pour le catalogue.
 */

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Req,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { RolesService }         from './roles.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto'

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private readonly svc: RolesService) {}

  // ── Catalogue des permissions disponibles ────────────────────────────────

  @Get('permissions')
  @RequirePermissions('role.read')
  findAllPermissions() {
    return this.svc.findAllPermissions()
  }

  // ── Rôles ────────────────────────────────────────────────────────────────

  @Get('roles')
  @RequirePermissions('role.read')
  findAll() {
    return this.svc.findAll()
  }

  @Get('roles/:id')
  @RequirePermissions('role.read')
  findById(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  /** Détenteurs du rôle (tous sites — gouvernance globale, cohérent avec nbUtilisateurs). */
  @Get('roles/:id/utilisateurs')
  @RequirePermissions('role.read')
  getUtilisateurs(@Param('id') id: string) {
    return this.svc.getUtilisateurs(id)
  }

  @Post('roles')
  @RequirePermissions('role.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateRoleDto, @Req() req: any) {
    return this.svc.create(dto, req.user?.id ?? null)
  }

  @Patch('roles/:id')
  @RequirePermissions('role.update')
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Req() req: any) {
    return this.svc.update(id, dto, req.user?.id ?? null)
  }

  @Delete('roles/:id')
  @RequirePermissions('role.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: any) {
    return this.svc.remove(id, req.user?.id ?? null)
  }
}
