/**
 * SortiesCritiquesController — /evacuations
 */

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req,
  UseGuards, HttpCode, HttpStatus, UnauthorizedException,
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

interface AuthedRequest { user?: { id?: string; siteId?: string } }
function requireSite(req: AuthedRequest): string {
  const siteId = req.user?.siteId
  if (!siteId) throw new UnauthorizedException('Session invalide')
  return siteId
}

// ── Évacuations ───────────────────────────────────────────────────────────────

@Controller('evacuations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Audit('evacuation', 'Évacuation')
export class EvacuationsController {
  constructor(private readonly svc: SortiesCritiquesService) {}

  @Get()
  @RequirePermissions('evacuation.read')
  findAll(@Query() query: EvacuationQueryDto, @Req() req: AuthedRequest) {
    return this.svc.findAllEvacuations(query, requireSite(req))
  }

  @Get(':id')
  @RequirePermissions('evacuation.read')
  findById(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.findEvacuationById(id, requireSite(req))
  }

  @Post()
  @RequirePermissions('evacuation.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEvacuationDto, @Req() req: AuthedRequest) {
    return this.svc.createEvacuation(dto, requireSite(req), req.user?.id)
  }

  @Patch(':id')
  @RequirePermissions('evacuation.update')
  update(@Param('id') id: string, @Body() dto: UpdateEvacuationDto, @Req() req: AuthedRequest) {
    return this.svc.updateEvacuation(id, dto, requireSite(req))
  }

  @Post(':id/suivi')
  @RequirePermissions('evacuation.update')
  @HttpCode(HttpStatus.CREATED)
  addSuivi(@Param('id') id: string, @Body() dto: AddSuiviEvacuationDto, @Req() req: AuthedRequest) {
    return this.svc.addSuiviEvacuation(id, dto, req.user?.id ?? 'unknown', requireSite(req))
  }

  @Patch(':id/annuler')
  @RequirePermissions('evacuation.cancel', 'evacuation.update')
  annuler(@Param('id') id: string, @Body() dto: AnnulerEvacuationDto, @Req() req: AuthedRequest) {
    return this.svc.annulerEvacuation(id, dto, requireSite(req))
  }

  @Patch(':id/cloturer')
  @RequirePermissions('evacuation.close')
  cloturer(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.cloturerEvacuation(id, requireSite(req))
  }

  @Delete(':id')
  @RequirePermissions('evacuation.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.deleteEvacuation(id, requireSite(req))
  }
}
