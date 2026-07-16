/**
 * TriageController — Module 6 · Accueil & Triage CMS SARIS
 *
 * Protégé par JwtAuthGuard + PermissionsGuard (permission visite.* requise).
 * Acteurs : INFIRMIER et MÉDECIN-CHEF (accueil/triage). ADMIN_SYSTEME, en tant que
 * super-administrateur, possède aussi ces permissions (catalogue complet, voulu).
 */

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req,
  UseGuards, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common'
import { TriageService }      from './triage.service'
import { JwtAuthGuard }       from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }   from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh } from '../../common/decorators/live-refresh.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  CreateVisiteDto, UpdateStatutVisiteDto,
  UpdateSoignantVisiteDto, UpdateNotesVisiteDto,
  CreateConstanteVitaleDto, VisiteQueryDto,
} from './dto/visite.dto'

interface AuthedRequest {
  user?: { id?: string; siteId?: string; roles?: string[]; personnelMedicalId?: string | null }
}

const SUPERVISION_ROLES = ['ADMIN_SYSTEME', 'MEDECIN_CHEF']

// Confidentialité (recueil §5) : l'infirmier consultant l'historique complet d'un
// patient (onglet dossier) n'a accès qu'à la visite EN COURS, pas aux visites passées.
function isHistoriqueRestreint(req: AuthedRequest): boolean {
  const roles = req.user?.roles ?? []
  return roles.includes('INFIRMIER') && !roles.some(r => SUPERVISION_ROLES.includes(r))
}

function requireUser(req: AuthedRequest): { id: string; siteId: string } {
  const id     = req.user?.id
  const siteId = req.user?.siteId
  if (!id || !siteId) throw new UnauthorizedException('Session invalide')
  return { id, siteId }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('triage/visites')
@LiveRefresh('LIVE_TRIAGE')
@Audit('visite', 'Visite')
export class TriageController {
  constructor(private readonly triageService: TriageService) {}

  @Get()
  @RequirePermissions('visite.read')
  findAll(@Query() query: VisiteQueryDto, @Req() req: AuthedRequest) {
    requireUser(req)
    // Multi-site sans restriction : file de triage partagée entre les deux sites.
    // Phase C : l'historique (clôturées/annulées) est scopé à l'initiateur, sauf supervision.
    return this.triageService.findAll(query, {
      canReadAll:         (req.user?.roles ?? []).some(r => SUPERVISION_ROLES.includes(r)),
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
    })
  }

  @Post()
  @RequirePermissions('visite.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateVisiteDto, @Req() req: AuthedRequest) {
    const { id: acteurId, siteId } = requireUser(req)
    return this.triageService.create(dto, siteId, acteurId)
  }

  // Placé AVANT @Get(':id') pour que « patient » ne soit pas capturé comme :id.
  @Get('patient/:patientId')
  @RequirePermissions('visite.read')
  findByPatient(@Param('patientId') patientId: string, @Req() req: AuthedRequest) {
    requireUser(req)
    const canViewLocked = (req.user?.roles ?? []).some(r => SUPERVISION_ROLES.includes(r))
    return this.triageService.findByPatient(patientId, canViewLocked, isHistoriqueRestreint(req))
  }

  @Get(':id')
  @RequirePermissions('visite.read')
  findById(@Param('id') id: string, @Req() req: AuthedRequest) {
    requireUser(req)
    return this.triageService.findById(id, isHistoriqueRestreint(req))
  }

  @Delete(':id')
  @RequirePermissions('visite.delete')
  @HttpCode(HttpStatus.OK)
  deleteVisite(@Param('id') id: string, @Req() req: AuthedRequest) {
    requireUser(req)
    return this.triageService.deleteVisite(id)
  }

  @Patch(':id/statut')
  @RequirePermissions('visite.update', 'visite.cancel', 'visite.close')
  updateStatut(
    @Param('id') id: string,
    @Body() dto: UpdateStatutVisiteDto,
    @Req() req: AuthedRequest,
  ) {
    const { id: acteurId } = requireUser(req)
    return this.triageService.updateStatut(id, dto, acteurId)
  }

  @Patch(':id/soignant')
  @RequirePermissions('visite.assign_soignant')
  updateSoignant(
    @Param('id') id: string,
    @Body() dto: UpdateSoignantVisiteDto,
    @Req() req: AuthedRequest,
  ) {
    const { id: acteurId } = requireUser(req)
    return this.triageService.updateSoignant(id, dto, acteurId)
  }

  @Patch(':id/notes')
  @RequirePermissions('visite.update')
  updateNotes(
    @Param('id') id: string,
    @Body() dto: UpdateNotesVisiteDto,
    @Req() req: AuthedRequest,
  ) {
    const { id: acteurId } = requireUser(req)
    return this.triageService.updateNotes(id, dto, acteurId)
  }

  @Post(':id/constantes')
  @RequirePermissions('visite.update')
  @HttpCode(HttpStatus.CREATED)
  createConstantes(
    @Param('id') id: string,
    @Body() dto: CreateConstanteVitaleDto,
    @Req() req: AuthedRequest,
  ) {
    const { id: saisiePar } = requireUser(req)
    return this.triageService.createConstantes(id, dto, saisiePar)
  }
}
