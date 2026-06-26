import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { ReferentielsService }       from './referentiels.service'
import { JwtAuthGuard }              from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }          from '../security/guards/permissions.guard'
import { RequirePermissions }        from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh }               from '../../common/decorators/live-refresh.decorator'
import { Audit }                      from '../../common/decorators/audit.decorator'
import { ListQueryDto }              from './dto/list-query.dto'
import { CreateSiteDto, UpdateSiteDto }                         from './dto/site.dto'
import { CreateMotifDto, UpdateMotifDto }                       from './dto/motif.dto'
import { CreatePathologieDto, UpdatePathologieDto }             from './dto/pathologie.dto'
import { CreateMedicamentDto, UpdateMedicamentDto }             from './dto/medicament.dto'
import { CreateCategoriePatientDto, UpdateCategoriePatientDto } from './dto/categorie-patient.dto'
import { CreateTypeExamenDto, UpdateTypeExamenDto }             from './dto/type-examen.dto'
import { CreateTypeConsultationDto, UpdateTypeConsultationDto } from './dto/type-consultation.dto'
import { ToggleStatutReferentielDto }                           from './dto/toggle-statut.dto'

/**
 * ReferentielsController — /referentiels
 *
 * Read   : referentiel.read (global — données de référence partagées)
 * Écriture GRANULAIRE par service : referentiel.<service>.<action>
 *   ex : referentiel.motif.create, referentiel.site.update, referentiel.examen.delete
 *   → on peut accorder la création de motifs SANS donner accès aux sites, etc.
 *
 * Pour chaque service, 3 actions distinctes :
 *   - create  : POST   /:type
 *   - update  : PATCH  /:type/:id        (champs métier, PAS le statut)
 *   - delete  : PATCH  /:type/:id/statut (activer/désactiver)
 *   Cette séparation EMPÊCHE un user ayant uniquement .update de désactiver
 *   un élément en envoyant {statut: INACTIF} dans le PATCH général.
 */
@Controller('referentiels')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_REFERENTIELS')
@Audit('referentiel', 'Référentiel')
export class ReferentielsController {
  constructor(private readonly svc: ReferentielsService) {}

  // ── Sites ─────────────────────────────────────────────────────────────────

  @Get('sites')
  @RequirePermissions('referentiel.read')
  getSites(@Query() query: ListQueryDto) {
    return this.svc.findAllSites(query)
  }

  @Get('sites/:id')
  @RequirePermissions('referentiel.read')
  getSite(@Param('id') id: string) {
    return this.svc.findSiteById(id)
  }

  @Post('sites')
  @RequirePermissions('referentiel.site.create')
  @HttpCode(HttpStatus.CREATED)
  createSite(@Body() dto: CreateSiteDto) {
    return this.svc.createSite(dto)
  }

  @Patch('sites/:id')
  @RequirePermissions('referentiel.site.update')
  updateSite(@Param('id') id: string, @Body() dto: UpdateSiteDto) {
    return this.svc.updateSite(id, dto)
  }

  @Patch('sites/:id/statut')
  @RequirePermissions('referentiel.site.delete')
  setStatutSite(@Param('id') id: string, @Body() dto: ToggleStatutReferentielDto) {
    return this.svc.setStatutSite(id, dto.statut)
  }

  @Delete('sites/:id')
  @RequirePermissions('referentiel.site.delete')
  deleteSite(@Param('id') id: string) {
    return this.svc.deleteSite(id)
  }

  // ── Motifs de consultation ────────────────────────────────────────────────

  @Get('motifs')
  @RequirePermissions('referentiel.read')
  getMotifs(@Query() query: ListQueryDto) {
    return this.svc.findAllMotifs(query)
  }

  @Post('motifs')
  @RequirePermissions('referentiel.motif.create')
  @HttpCode(HttpStatus.CREATED)
  createMotif(@Body() dto: CreateMotifDto) {
    return this.svc.createMotif(dto)
  }

  @Patch('motifs/:id')
  @RequirePermissions('referentiel.motif.update')
  updateMotif(@Param('id') id: string, @Body() dto: UpdateMotifDto) {
    return this.svc.updateMotif(id, dto)
  }

  @Patch('motifs/:id/statut')
  @RequirePermissions('referentiel.motif.delete')
  setStatutMotif(@Param('id') id: string, @Body() dto: ToggleStatutReferentielDto) {
    return this.svc.setStatutMotif(id, dto.statut)
  }

  @Delete('motifs/:id')
  @RequirePermissions('referentiel.motif.delete')
  deleteMotif(@Param('id') id: string) {
    return this.svc.deleteMotif(id)
  }

  // ── Pathologies ───────────────────────────────────────────────────────────

  @Get('pathologies')
  @RequirePermissions('referentiel.read')
  getPathologies(@Query() query: ListQueryDto) {
    return this.svc.findAllPathologies(query)
  }

  @Post('pathologies')
  @RequirePermissions('referentiel.pathologie.create')
  @HttpCode(HttpStatus.CREATED)
  createPathologie(@Body() dto: CreatePathologieDto) {
    return this.svc.createPathologie(dto)
  }

  @Patch('pathologies/:id')
  @RequirePermissions('referentiel.pathologie.update')
  updatePathologie(@Param('id') id: string, @Body() dto: UpdatePathologieDto) {
    return this.svc.updatePathologie(id, dto)
  }

  @Patch('pathologies/:id/statut')
  @RequirePermissions('referentiel.pathologie.delete')
  setStatutPathologie(@Param('id') id: string, @Body() dto: ToggleStatutReferentielDto) {
    return this.svc.setStatutPathologie(id, dto.statut)
  }

  @Delete('pathologies/:id')
  @RequirePermissions('referentiel.pathologie.delete')
  deletePathologie(@Param('id') id: string) {
    return this.svc.deletePathologie(id)
  }

  // ── Médicaments ───────────────────────────────────────────────────────────

  @Get('medicaments')
  @RequirePermissions('referentiel.read')
  getMedicaments(@Query() query: ListQueryDto) {
    return this.svc.findAllMedicaments(query)
  }

  @Post('medicaments')
  @RequirePermissions('referentiel.medicament.create')
  @HttpCode(HttpStatus.CREATED)
  createMedicament(@Body() dto: CreateMedicamentDto) {
    return this.svc.createMedicament(dto)
  }

  @Patch('medicaments/:id')
  @RequirePermissions('referentiel.medicament.update')
  updateMedicament(@Param('id') id: string, @Body() dto: UpdateMedicamentDto) {
    return this.svc.updateMedicament(id, dto)
  }

  @Patch('medicaments/:id/statut')
  @RequirePermissions('referentiel.medicament.delete')
  setStatutMedicament(@Param('id') id: string, @Body() dto: ToggleStatutReferentielDto) {
    return this.svc.setStatutMedicament(id, dto.statut)
  }

  @Delete('medicaments/:id')
  @RequirePermissions('referentiel.medicament.delete')
  deleteMedicament(@Param('id') id: string) {
    return this.svc.deleteMedicament(id)
  }

  // ── Catégories de patients ────────────────────────────────────────────────

  @Get('categories-patient')
  @RequirePermissions('referentiel.read')
  getCategoriesPatient(@Query() query: ListQueryDto) {
    return this.svc.findAllCategoriesPatient(query)
  }

  @Post('categories-patient')
  @RequirePermissions('referentiel.categorie.create')
  @HttpCode(HttpStatus.CREATED)
  createCategoriePatient(@Body() dto: CreateCategoriePatientDto) {
    return this.svc.createCategoriePatient(dto)
  }

  @Patch('categories-patient/:id')
  @RequirePermissions('referentiel.categorie.update')
  updateCategoriePatient(@Param('id') id: string, @Body() dto: UpdateCategoriePatientDto) {
    return this.svc.updateCategoriePatient(id, dto)
  }

  @Patch('categories-patient/:id/statut')
  @RequirePermissions('referentiel.categorie.delete')
  setStatutCategoriePatient(@Param('id') id: string, @Body() dto: ToggleStatutReferentielDto) {
    return this.svc.setStatutCategoriePatient(id, dto.statut)
  }

  @Delete('categories-patient/:id')
  @RequirePermissions('referentiel.categorie.delete')
  deleteCategoriePatient(@Param('id') id: string) {
    return this.svc.deleteCategoriePatient(id)
  }

  // ── Types d'examen ────────────────────────────────────────────────────────

  @Get('types-examen')
  @RequirePermissions('referentiel.read')
  getTypesExamen(@Query() query: ListQueryDto) {
    return this.svc.findAllTypesExamen(query)
  }

  @Post('types-examen')
  @RequirePermissions('referentiel.examen.create')
  @HttpCode(HttpStatus.CREATED)
  createTypeExamen(@Body() dto: CreateTypeExamenDto) {
    return this.svc.createTypeExamen(dto)
  }

  @Patch('types-examen/:id')
  @RequirePermissions('referentiel.examen.update')
  updateTypeExamen(@Param('id') id: string, @Body() dto: UpdateTypeExamenDto) {
    return this.svc.updateTypeExamen(id, dto)
  }

  @Patch('types-examen/:id/statut')
  @RequirePermissions('referentiel.examen.delete')
  setStatutTypeExamen(@Param('id') id: string, @Body() dto: ToggleStatutReferentielDto) {
    return this.svc.setStatutTypeExamen(id, dto.statut)
  }

  @Delete('types-examen/:id')
  @RequirePermissions('referentiel.examen.delete')
  deleteTypeExamen(@Param('id') id: string) {
    return this.svc.deleteTypeExamen(id)
  }

  // ── Types de consultation ─────────────────────────────────────────────────

  @Get('types-consultation')
  @RequirePermissions('referentiel.read')
  getTypesConsultation(@Query() query: ListQueryDto) {
    return this.svc.findAllTypesConsultation(query)
  }

  @Post('types-consultation')
  @RequirePermissions('referentiel.type_consultation.create')
  @HttpCode(HttpStatus.CREATED)
  createTypeConsultation(@Body() dto: CreateTypeConsultationDto) {
    return this.svc.createTypeConsultation(dto)
  }

  @Patch('types-consultation/:id')
  @RequirePermissions('referentiel.type_consultation.update')
  updateTypeConsultation(@Param('id') id: string, @Body() dto: UpdateTypeConsultationDto) {
    return this.svc.updateTypeConsultation(id, dto)
  }

  @Patch('types-consultation/:id/statut')
  @RequirePermissions('referentiel.type_consultation.delete')
  setStatutTypeConsultation(@Param('id') id: string, @Body() dto: ToggleStatutReferentielDto) {
    return this.svc.setStatutTypeConsultation(id, dto.statut)
  }

  @Delete('types-consultation/:id')
  @RequirePermissions('referentiel.type_consultation.delete')
  deleteTypeConsultation(@Param('id') id: string) {
    return this.svc.deleteTypeConsultation(id)
  }
}
