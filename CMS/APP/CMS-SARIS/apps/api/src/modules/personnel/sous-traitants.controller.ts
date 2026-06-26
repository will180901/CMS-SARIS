import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { PersonnelService }     from './personnel.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh }          from '../../common/decorators/live-refresh.decorator'
import { Audit }                from '../../common/decorators/audit.decorator'
import {
  CreateSousTraitantDto, UpdateSousTraitantDto, SousTraitantQueryDto,
  ToggleStatutSousTraitantDto,
} from './dto/sous-traitant.dto'

/**
 * SousTraitantsController — /sous-traitants
 */
@Controller('sous-traitants')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_ACTEURS')
@Audit('sous_traitant', 'Sous-traitant')
export class SousTraitantsController {
  constructor(private readonly svc: PersonnelService) {}

  @Get()
  @RequirePermissions('sous_traitant.read')
  findAll(@Query() query: SousTraitantQueryDto) {
    return this.svc.findAllSousTraitants(query)
  }

  @Get(':id')
  @RequirePermissions('sous_traitant.read')
  findOne(@Param('id') id: string) {
    return this.svc.findSousTraitantById(id)
  }

  @Post()
  @RequirePermissions('sous_traitant.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSousTraitantDto) {
    return this.svc.createSousTraitant(dto)
  }

  @Patch(':id')
  @RequirePermissions('sous_traitant.update')
  update(@Param('id') id: string, @Body() dto: UpdateSousTraitantDto) {
    return this.svc.updateSousTraitant(id, dto)
  }

  // SÉCURITÉ : toggle ACTIVE/INACTIVE gated par `sous_traitant.delete`.
  @Patch(':id/statut')
  @RequirePermissions('sous_traitant.delete')
  setStatut(@Param('id') id: string, @Body() dto: ToggleStatutSousTraitantDto) {
    return this.svc.setStatutSousTraitant(id, dto.statut)
  }

  @Delete(':id')
  @RequirePermissions('sous_traitant.delete')
  remove(@Param('id') id: string) {
    return this.svc.deleteSousTraitant(id)
  }
}
