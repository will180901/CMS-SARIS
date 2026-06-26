/**
 * BonExamenController — /bons-examen
 */

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { CurrentUser }          from '../../common/decorators/current-user.decorator'
import type { UserSession }     from '@cms-saris/types'
import { BonExamenService }     from './bon-examen.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh }          from '../../common/decorators/live-refresh.decorator'
import { Audit }                from '../../common/decorators/audit.decorator'
import {
  CreateBonExamenDto, UpdateBonExamenDto, ValiderBonExamenDto,
  AnnulerBonExamenDto, SaisirResultatDto, BonExamenQueryDto,
} from './dto/bon-examen.dto'

@Controller('bons-examen')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_BONS_EXAMEN')
@Audit('bon_examen', "Bon d'examen")
export class BonExamenController {
  constructor(private readonly svc: BonExamenService) {}

  @Get()
  @RequirePermissions('bon_examen.read')
  findAll(@Query() query: BonExamenQueryDto, @CurrentUser() user: UserSession) {
    return this.svc.findAll(query, user.siteId)
  }

  @Get(':id')
  @RequirePermissions('bon_examen.read')
  findById(@Param('id') id: string, @CurrentUser() user: UserSession) {
    return this.svc.findById(id, user.siteId)
  }

  @Post()
  @RequirePermissions('bon_examen.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBonExamenDto, @CurrentUser() user: UserSession) {
    return this.svc.create(dto, user.siteId, { roles: user.roles, personnelMedicalId: user.personnelMedicalId })
  }

  @Patch(':id')
  @RequirePermissions('bon_examen.create')
  update(@Param('id') id: string, @Body() dto: UpdateBonExamenDto, @CurrentUser() user: UserSession) {
    return this.svc.update(id, dto, user.siteId)
  }

  @Patch(':id/statut')
  @RequirePermissions('bon_examen.validate')
  validerOuAnnuler(@Param('id') id: string, @Body() dto: ValiderBonExamenDto, @CurrentUser() user: UserSession) {
    return this.svc.validerOuAnnuler(id, dto, user.siteId)
  }

  @Patch(':id/annuler')
  @RequirePermissions('bon_examen.cancel')
  annuler(@Param('id') id: string, @Body() dto: AnnulerBonExamenDto, @CurrentUser() user: UserSession) {
    return this.svc.annuler(id, dto.motifAnnulation, user.siteId)
  }

  @Delete(':id')
  @RequirePermissions('bon_examen.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: UserSession) {
    return this.svc.delete(id, user.siteId)
  }

  @Post(':id/resultats')
  @RequirePermissions('bon_examen.result')
  @HttpCode(HttpStatus.CREATED)
  saisirResultat(@Param('id') id: string, @Body() dto: SaisirResultatDto, @CurrentUser() user: UserSession) {
    return this.svc.saisirResultat(id, dto, user.id, user.siteId)
  }
}
