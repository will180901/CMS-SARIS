/**
 * ConsultationController — Module 7 · Consultation & Actes Prescrits — CMS SARIS
 *
 * Toutes les routes sont protégées par JwtAuthGuard + PermissionsGuard.
 * Les permissions granulaires sont définies dans @cms-saris/types/permissions.
 *
 * Note : ADMIN_SYSTEME n'a PAS de permissions cliniques (gouvernance pure).
 */

import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req,
  UseGuards, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common'
import { ConsultationService } from './consultation.service'
import { JwtAuthGuard }        from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }    from '../security/guards/permissions.guard'
import { RequirePermissions }  from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh } from '../../common/decorators/live-refresh.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  CreateConsultationDto, UpdateExamenCliniqueDto, AddDiagnosticDto,
  UpdateConclusionDto, CloturerConsultationDto, AnnulerConsultationDto,
  CreateOrdonnanceDto, AddLigneOrdonnanceDto, ConsultationQueryDto,
  SetTypeConsultationDto, UpdateReposDto,
} from './dto/consultation.dto'

interface AuthedRequest {
  user?: { id?: string; siteId?: string; roles?: string[]; personnelMedicalId?: string | null }
}

// Rôles « supervision » : voient TOUTES les consultations du site. Les autres
// médecins ne voient que les consultations qui leur sont assignées.
const SUPERVISION_ROLES = ['ADMIN_SYSTEME', 'MEDECIN_CHEF']

function requireUser(req: AuthedRequest): { id: string; siteId: string } {
  const id     = req.user?.id
  const siteId = req.user?.siteId
  if (!id || !siteId) throw new UnauthorizedException('Session invalide')
  return { id, siteId }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('consultations')
@LiveRefresh('LIVE_CONSULTATION', { siteScoped: true })
@Audit('consultation', 'Consultation')
export class ConsultationController {
  constructor(private readonly consultationService: ConsultationService) {}

  // ── Liste ─────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('consultation.read')
  findAll(@Query() query: ConsultationQueryDto, @Req() req: AuthedRequest) {
    const { siteId } = requireUser(req)
    const canReadAll = (req.user?.roles ?? []).some(r => SUPERVISION_ROLES.includes(r))
    return this.consultationService.findAll(siteId, query, {
      canReadAll,
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
    })
  }

  // ── Créer ─────────────────────────────────────────────────────────────────

  @Post()
  @RequirePermissions('consultation.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateConsultationDto, @Req() req: AuthedRequest) {
    const { id: acteurUserId, siteId } = requireUser(req)
    return this.consultationService.create(dto, acteurUserId, siteId)
  }

  // ── Documents générés d'un patient (dossier) ───────────────────────────────
  // Placé AVANT @Get(':id') pour que « patient » ne soit pas capturé comme :id.
  @Get('patient/:patientId/documents')
  @RequirePermissions('consultation.read')
  patientDocuments(@Param('patientId') patientId: string, @Req() req: AuthedRequest) {
    requireUser(req)
    // Dossier CENTRALISÉ : tous les documents du patient, tous sites confondus
    // (continuité de soins) ; le site de chaque acte est indiqué dans la réponse.
    // Verrou (médecin-chef) : seul la supervision voit les documents d'un dossier verrouillé.
    return this.consultationService.findPatientDocuments(patientId, {
      restrictToOwn: false,
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
      canViewLocked: (req.user?.roles ?? []).some(r => SUPERVISION_ROLES.includes(r)),
    })
  }

  // ── Détail ────────────────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('consultation.read')
  findById(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { siteId } = requireUser(req)
    const canReadAll = (req.user?.roles ?? []).some(r => SUPERVISION_ROLES.includes(r))
    return this.consultationService.findById(id, siteId, {
      canReadAll,
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
    })
  }

  // ── Examen clinique ───────────────────────────────────────────────────────

  @Patch(':id/examen')
  @RequirePermissions('consultation.examen')
  updateExamen(@Param('id') id: string, @Body() dto: UpdateExamenCliniqueDto, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.updateExamen(id, dto, userId, siteId)
  }

  // ── Conclusion ────────────────────────────────────────────────────────────

  @Patch(':id/conclusion')
  @RequirePermissions('consultation.update')
  updateConclusion(@Param('id') id: string, @Body() dto: UpdateConclusionDto, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.updateConclusion(id, dto, userId, siteId)
  }

  // ── Type de consultation ──────────────────────────────────────────────────

  @Patch(':id/type')
  @RequirePermissions('consultation.update')
  setType(@Param('id') id: string, @Body() dto: SetTypeConsultationDto, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.setType(id, dto.typeConsultationId ?? null, userId, siteId)
  }

  // ── Repos maladie ─────────────────────────────────────────────────────────

  @Patch(':id/repos')
  @RequirePermissions('consultation.update')
  setRepos(@Param('id') id: string, @Body() dto: UpdateReposDto, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.setRepos(id, dto, userId, siteId)
  }

  // ── Diagnostics ───────────────────────────────────────────────────────────

  @Post(':id/diagnostics')
  @RequirePermissions('consultation.diagnose')
  @HttpCode(HttpStatus.CREATED)
  addDiagnostic(@Param('id') id: string, @Body() dto: AddDiagnosticDto, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.addDiagnostic(id, dto, userId, siteId)
  }

  @Delete(':id/diagnostics/:diagId')
  @RequirePermissions('consultation.diagnose')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeDiagnostic(@Param('id') id: string, @Param('diagId') diagId: string, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.removeDiagnostic(id, diagId, userId, siteId)
  }

  // ── Clôturer / Annuler ────────────────────────────────────────────────────

  @Patch(':id/cloturer')
  @RequirePermissions('consultation.close')
  cloturer(@Param('id') id: string, @Body() dto: CloturerConsultationDto, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.cloturer(id, dto, userId, siteId)
  }

  @Patch(':id/annuler')
  @RequirePermissions('consultation.cancel')
  annuler(@Param('id') id: string, @Body() dto: AnnulerConsultationDto, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.annuler(id, dto, userId, siteId)
  }

  @Delete(':id')
  @RequirePermissions('consultation.delete')
  @HttpCode(HttpStatus.OK)
  deleteConsultation(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { siteId } = requireUser(req)
    return this.consultationService.delete(id, siteId)
  }

  // ── Verrou souple : prise en charge de la consultation ─────────────────────
  @Post(':id/prise-en-charge')
  @RequirePermissions('consultation.update')
  @HttpCode(HttpStatus.OK)
  prendreEnCharge(@Param('id') id: string, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.prendreEnCharge(id, userId, siteId)
  }

  // ── Ordonnances ───────────────────────────────────────────────────────────

  @Post(':id/ordonnances')
  @RequirePermissions('ordonnance.create')
  @HttpCode(HttpStatus.CREATED)
  createOrdonnance(
    @Param('id') id: string,
    @Body() dto: CreateOrdonnanceDto,
    @Req() req: AuthedRequest,
  ) {
    const { id: prescripteurId, siteId } = requireUser(req)
    const scope = { roles: req.user?.roles ?? [], personnelMedicalId: req.user?.personnelMedicalId ?? null }
    return this.consultationService.createOrdonnance(id, prescripteurId, dto, siteId, scope)
  }

  @Post(':id/ordonnances/:ordId/lignes')
  @RequirePermissions('ordonnance.create')
  @HttpCode(HttpStatus.CREATED)
  addLigne(
    @Param('id') id: string,
    @Param('ordId') ordId: string,
    @Body() dto: AddLigneOrdonnanceDto,
    @Req() req: AuthedRequest,
  ) {
    const { id: userId, siteId } = requireUser(req)
    const scope = { roles: req.user?.roles ?? [], personnelMedicalId: req.user?.personnelMedicalId ?? null }
    return this.consultationService.addLigneOrdonnance(id, ordId, dto, userId, siteId, scope, !!dto.acknowledgeWarnings)
  }

  @Delete(':id/ordonnances/:ordId/lignes/:ligneId')
  @RequirePermissions('ordonnance.create')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeLigne(
    @Param('id') id: string,
    @Param('ordId') ordId: string,
    @Param('ligneId') ligneId: string,
    @Req() req: AuthedRequest,
  ) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.removeLigneOrdonnance(id, ordId, ligneId, userId, siteId)
  }

  @Patch(':id/ordonnances/:ordId/valider')
  @RequirePermissions('ordonnance.validate')
  validerOrdonnance(@Param('id') id: string, @Param('ordId') ordId: string, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.validerOrdonnance(id, ordId, userId, siteId)
  }

  @Patch(':id/ordonnances/:ordId/annuler')
  @RequirePermissions('ordonnance.cancel')
  annulerOrdonnance(@Param('id') id: string, @Param('ordId') ordId: string, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.annulerOrdonnance(id, ordId, userId, siteId)
  }

  @Delete(':id/ordonnances/:ordId')
  @RequirePermissions('ordonnance.create')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteOrdonnance(@Param('id') id: string, @Param('ordId') ordId: string, @Req() req: AuthedRequest) {
    const { id: userId, siteId } = requireUser(req)
    return this.consultationService.deleteOrdonnance(id, ordId, userId, siteId)
  }
}
