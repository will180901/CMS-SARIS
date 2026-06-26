/**
 * BonPharmacieController — /bons-pharmacie
 */
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { CurrentUser }          from '../../common/decorators/current-user.decorator'
import type { UserSession }     from '@cms-saris/types'
import { BonPharmacieService }  from './bon-pharmacie.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh }          from '../../common/decorators/live-refresh.decorator'
import { Audit }                from '../../common/decorators/audit.decorator'
import {
  CreateBonPharmacieDto, DelivrerBonPharmacieDto, AnnulerBonPharmacieDto, BonPharmacieQueryDto,
} from './dto/bon-pharmacie.dto'

@Controller('bons-pharmacie')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_BONS_PHARMACIE')
@Audit('bon_pharmacie', 'Bon de pharmacie')
export class BonPharmacieController {
  constructor(private readonly svc: BonPharmacieService) {}

  @Get()
  @RequirePermissions('bon_pharmacie.read')
  findAll(@Query() query: BonPharmacieQueryDto, @CurrentUser() user: UserSession) {
    return this.svc.findAll(query, user.siteId)
  }

  @Get(':id')
  @RequirePermissions('bon_pharmacie.read')
  findById(@Param('id') id: string, @CurrentUser() user: UserSession) {
    return this.svc.findById(id, user.siteId)
  }

  @Post()
  @RequirePermissions('bon_pharmacie.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateBonPharmacieDto, @CurrentUser() user: UserSession) {
    return this.svc.create(
      dto, user.siteId,
      { roles: user.roles, personnelMedicalId: user.personnelMedicalId },
      user.personnelMedicalId ?? user.id,
    )
  }

  @Patch(':id/delivrer')
  @RequirePermissions('bon_pharmacie.deliver')
  deliver(@Param('id') id: string, @Body() dto: DelivrerBonPharmacieDto, @CurrentUser() user: UserSession) {
    return this.svc.deliver(id, user.siteId, dto.delivrePar ?? null)
  }

  @Patch(':id/annuler')
  @RequirePermissions('bon_pharmacie.cancel')
  annuler(@Param('id') id: string, @Body() dto: AnnulerBonPharmacieDto, @CurrentUser() user: UserSession) {
    return this.svc.annuler(id, dto, user.siteId)
  }

  @Delete(':id')
  @RequirePermissions('bon_pharmacie.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: UserSession) {
    return this.svc.delete(id, user.siteId)
  }
}
