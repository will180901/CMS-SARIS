/**
 * SortiesCritiquesController — /evacuations
 */

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { SortiesCritiquesService } from './sorties-critiques.service'
import { JwtAuthGuard }            from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }        from '../security/guards/permissions.guard'
import { RequirePermissions }      from '../../common/decorators/require-permissions.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  CreateEvacuationDto, UpdateEvacuationDto, AddSuiviEvacuationDto,
  AnnulerEvacuationDto, EvacuationQueryDto,
} from './dto/evacuation.dto'

interface AuthedRequest { user?: { id?: string } }

// ── Évacuations ───────────────────────────────────────────────────────────────

@Controller('evacuations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Audit('evacuation', 'Évacuation')
export class EvacuationsController {
  constructor(private readonly svc: SortiesCritiquesService) {}

  @Get()
  @RequirePermissions('evacuation.read')
  findAll(@Query() query: EvacuationQueryDto) {
    return this.svc.findAllEvacuations(query)
  }

  @Get(':id')
  @RequirePermissions('evacuation.read')
  findById(@Param('id') id: string) {
    return this.svc.findEvacuationById(id)
  }

  @Post()
  @RequirePermissions('evacuation.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEvacuationDto, @Req() req: AuthedRequest) {
    return this.svc.createEvacuation(dto, req.user?.id)
  }

  @Patch(':id')
  @RequirePermissions('evacuation.update')
  update(@Param('id') id: string, @Body() dto: UpdateEvacuationDto) {
    return this.svc.updateEvacuation(id, dto)
  }

  @Post(':id/suivi')
  @RequirePermissions('evacuation.update')
  @HttpCode(HttpStatus.CREATED)
  addSuivi(@Param('id') id: string, @Body() dto: AddSuiviEvacuationDto, @Req() req: AuthedRequest) {
    return this.svc.addSuiviEvacuation(id, dto, req.user?.id ?? 'unknown')
  }

  @Patch(':id/annuler')
  @RequirePermissions('evacuation.cancel', 'evacuation.update')
  annuler(@Param('id') id: string, @Body() dto: AnnulerEvacuationDto) {
    return this.svc.annulerEvacuation(id, dto)
  }

  @Patch(':id/cloturer')
  @RequirePermissions('evacuation.close')
  cloturer(@Param('id') id: string) {
    return this.svc.cloturerEvacuation(id)
  }

  @Delete(':id')
  @RequirePermissions('evacuation.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.svc.deleteEvacuation(id)
  }
}
