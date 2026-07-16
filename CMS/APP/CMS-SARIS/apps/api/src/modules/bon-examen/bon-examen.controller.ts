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
  findAll(@Query() query: BonExamenQueryDto) {
    return this.svc.findAll(query)
  }

  @Get(':id')
  @RequirePermissions('bon_examen.read')
  findById(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  @Post()
  @RequirePermissions('bon_examen.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBonExamenDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('bon_examen.create')
  update(@Param('id') id: string, @Body() dto: UpdateBonExamenDto) {
    return this.svc.update(id, dto)
  }

  @Patch(':id/statut')
  @RequirePermissions('bon_examen.validate')
  validerOuAnnuler(@Param('id') id: string, @Body() dto: ValiderBonExamenDto) {
    return this.svc.validerOuAnnuler(id, dto)
  }

  @Patch(':id/annuler')
  @RequirePermissions('bon_examen.cancel')
  annuler(@Param('id') id: string, @Body() dto: AnnulerBonExamenDto) {
    return this.svc.annuler(id, dto.motifAnnulation)
  }

  @Delete(':id')
  @RequirePermissions('bon_examen.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.svc.delete(id)
  }

  @Post(':id/resultats')
  @RequirePermissions('bon_examen.result')
  @HttpCode(HttpStatus.CREATED)
  saisirResultat(@Param('id') id: string, @Body() dto: SaisirResultatDto, @CurrentUser() user: UserSession) {
    return this.svc.saisirResultat(id, dto, user.id)
  }
}
