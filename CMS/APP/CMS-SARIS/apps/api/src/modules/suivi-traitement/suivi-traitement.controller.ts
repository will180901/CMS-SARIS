/**
 * SuiviTraitementController — /suivi-traitement
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import {
  SuiviTraitementService,
  type PorteeSuivi,
} from './suivi-traitement.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  CreateSuiviTraitementDto,
  AddFicheSuiviDto,
  CloturerSuiviTraitementDto,
  AnnulerSuiviTraitementDto,
  SuiviTraitementQueryDto,
} from './dto/suivi-traitement.dto'

interface AuthedRequest {
  user?: { id?: string; roles?: string[] }
}

// Même règle que le dossier patient (patient.controller) : la supervision voit tout,
// l'infirmier hors supervision ne voit que le soin en cours.
const SUPERVISION_ROLES = ['ADMIN_SYSTEME', 'MEDECIN_CHEF']
function portee(req: AuthedRequest): PorteeSuivi {
  const roles = req.user?.roles ?? []
  const supervision = roles.some((r) => SUPERVISION_ROLES.includes(r))
  return {
    canViewLocked: supervision,
    restreindreHistorique: roles.includes('INFIRMIER') && !supervision,
  }
}

@Controller('suivi-traitement')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Audit('suivi_traitement', 'Suivi de traitement')
export class SuiviTraitementController {
  constructor(private readonly svc: SuiviTraitementService) {}

  @Get()
  @RequirePermissions('suivi_traitement.read')
  findAll(@Query() query: SuiviTraitementQueryDto, @Req() req: AuthedRequest) {
    return this.svc.findAll(query, portee(req))
  }

  @Get(':id')
  @RequirePermissions('suivi_traitement.read')
  findById(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.findById(id, portee(req))
  }

  @Post()
  @RequirePermissions('suivi_traitement.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateSuiviTraitementDto, @Req() req: AuthedRequest) {
    return this.svc.create(dto, req.user?.id)
  }

  @Post(':id/fiches')
  @RequirePermissions('suivi_traitement.update')
  @HttpCode(HttpStatus.CREATED)
  async addFiche(
    @Param('id') id: string,
    @Body() dto: AddFicheSuiviDto,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.addFiche(id, dto, req.user?.id ?? 'unknown')
  }

  @Patch(':id/fiches/:ficheId')
  @RequirePermissions('suivi_traitement.update')
  async updateFiche(
    @Param('id') id: string,
    @Param('ficheId') ficheId: string,
    @Body() dto: AddFicheSuiviDto,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.updateFiche(id, ficheId, dto)
  }

  @Patch(':id/cloturer')
  @RequirePermissions('suivi_traitement.close')
  async cloturer(
    @Param('id') id: string,
    @Body() dto: CloturerSuiviTraitementDto,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.cloturer(id, dto)
  }

  @Patch(':id/annuler')
  @RequirePermissions('suivi_traitement.cancel', 'suivi_traitement.update')
  async annuler(
    @Param('id') id: string,
    @Body() dto: AnnulerSuiviTraitementDto,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.annuler(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('suivi_traitement.delete')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.delete(id)
  }
}
