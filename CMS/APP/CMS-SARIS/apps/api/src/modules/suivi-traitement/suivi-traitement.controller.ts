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
import { RequirePermissions, RequireAllPermissions } from '../../common/decorators/require-permissions.decorator'
import { assertPeutPrescrire } from '../../common/prescription'
import { PrismaService } from '../../prisma/prisma.service'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  CreateSuiviTraitementDto,
  AddFicheSuiviDto,
  CloturerSuiviTraitementDto,
  AnnulerSuiviTraitementDto,
  SuiviTraitementQueryDto,
  ProchainControleDto,
  AdministrerDto,
  ArreterTraitementDto,
} from './dto/suivi-traitement.dto'

interface AuthedRequest {
  user?: { id?: string; roles?: string[]; permissions?: string[]; personnelMedicalId?: string | null }
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
  constructor(
    private readonly svc: SuiviTraitementService,
    private readonly prisma: PrismaService,
  ) {}

  @Get()
  @RequirePermissions('suivi_traitement.read')
  findAll(@Query() query: SuiviTraitementQueryDto, @Req() req: AuthedRequest) {
    return this.svc.findAll(query, portee(req))
  }

  /** L'épisode en entier (séances, traitements, examens et résultats, fiches). */
  @Get(':id/episode')
  @RequirePermissions('suivi_traitement.read')
  findEpisode(@Param('id') id: string, @Req() req: AuthedRequest) {
    const masquer = !(req.user?.permissions ?? []).includes('patient.confidentiel.read')
    return this.svc.findEpisode(id, portee(req), masquer)
  }

  @Patch(':id/prochain-controle')
  @RequirePermissions('suivi_traitement.update')
  async setProchainControle(
    @Param('id') id: string,
    @Body() dto: ProchainControleDto,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.setProchainControle(id, dto)
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

  /** Arrêter un traitement : décision de prescripteur (même droit que prescrire). */
  @Patch(':id/traitements/:ligneId/arret')
  @RequireAllPermissions('suivi_traitement.update', 'ordonnance.create')
  async arreterTraitement(
    @Param('id') id: string,
    @Param('ligneId') ligneId: string,
    @Body() dto: ArreterTraitementDto,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    await assertPeutPrescrire(this.prisma, {
      roles: req.user?.roles ?? [],
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
    })
    return this.svc.arreterTraitement(id, ligneId, dto, req.user?.id ?? 'unknown')
  }

  /** Noter une administration (prise, injection…) d'un traitement prescrit. */
  @Post(':id/administrations')
  @RequirePermissions('suivi_traitement.update')
  @HttpCode(HttpStatus.CREATED)
  async administrer(
    @Param('id') id: string,
    @Body() dto: AdministrerDto,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.administrer(id, dto, req.user?.id ?? 'unknown')
  }

  @Delete(':id/administrations/:administrationId')
  @RequirePermissions('suivi_traitement.update')
  async retirerAdministration(
    @Param('id') id: string,
    @Param('administrationId') administrationId: string,
    @Req() req: AuthedRequest,
  ) {
    await this.svc.assertModifiable(id, portee(req))
    return this.svc.retirerAdministration(id, administrationId, req.user?.id ?? 'unknown')
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
