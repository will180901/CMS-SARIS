/**
 * BonPharmacieController — /bons-pharmacie
 */
import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { BonPharmacieService } from './bon-pharmacie.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh } from '../../common/decorators/live-refresh.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  DelivrerBonPharmacieDto,
  AnnulerBonPharmacieDto,
  BonPharmacieQueryDto,
} from './dto/bon-pharmacie.dto'

@Controller('bons-pharmacie')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_BONS_PHARMACIE')
@Audit('bon_pharmacie', 'Bon de pharmacie')
export class BonPharmacieController {
  constructor(private readonly svc: BonPharmacieService) {}

  @Get()
  @RequirePermissions('bon_pharmacie.read')
  findAll(@Query() query: BonPharmacieQueryDto) {
    return this.svc.findAll(query)
  }

  @Get(':id')
  @RequirePermissions('bon_pharmacie.read')
  findById(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  // Création directe retirée : un bon de pharmacie naît exclusivement de « Générer un bon »
  // sur une ordonnance PHARMACEUTIQUE validée (POST /consultations/:id/ordonnances/:ordId/generer-bon).

  @Patch(':id/delivrer')
  @RequirePermissions('bon_pharmacie.deliver')
  deliver(@Param('id') id: string, @Body() dto: DelivrerBonPharmacieDto) {
    return this.svc.deliver(id, dto.delivrePar ?? null)
  }

  @Patch(':id/annuler')
  @RequirePermissions('bon_pharmacie.cancel')
  annuler(@Param('id') id: string, @Body() dto: AnnulerBonPharmacieDto) {
    return this.svc.annuler(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('bon_pharmacie.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.svc.delete(id)
  }
}
