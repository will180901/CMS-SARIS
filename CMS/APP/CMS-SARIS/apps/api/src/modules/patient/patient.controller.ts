/**
 * PatientController — Module 4 · Dossier Patient CMS SARIS
 *
 * Protégé par JwtAuthGuard + PermissionsGuard (permissions granulaires).
 */

import {
  Controller, Get, Post, Patch, Delete, Body, Param, Query, Req,
  UseGuards, HttpCode, HttpStatus, UseInterceptors, UploadedFile, BadRequestException,
} from '@nestjs/common'
import { FileInterceptor }    from '@nestjs/platform-express'
import { memoryStorage }      from 'multer'
import { PatientService }     from './patient.service'
import { JwtAuthGuard }       from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }   from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  CreatePatientDto, UpdateIdentiteDto, UpsertModeVieDto,
  ChangerCategorieDto, ToggleStatutPatientDto, PatientQueryDto, FindSimilarPatientDto,
  VerrouPatientDto,
} from './dto/patient.dto'
import { CreateAllergieDto, UpdateAllergieDto }             from './dto/medical.dto'
import { CreateAntecedentDto, UpdateAntecedentDto }         from './dto/medical.dto'
import { CreateAlerteMedicaleDto, UpdateAlerteMedicaleDto } from './dto/medical.dto'
import { CreateRattachementADDto, UpdateRattachementADDto } from './dto/rattachement.dto'
import { CreateRattachementSTDto, UpdateRattachementSTDto } from './dto/rattachement.dto'

interface AuthedRequest {
  user?: { roles?: string[]; personnelMedicalId?: string | null; siteId?: string }
}

// Cloisonnement par médecin retiré (rôle MEDECIN supprimé, modèle à 2 rôles
// cliniques du recueil) : le médecin chef est la référence du CMS et accède à
// tous les dossiers du site. La fonction est conservée (toujours false) pour ne
// pas toucher la signature des services qui reçoivent `scope`.
function isRestrictedDoctor(_req: AuthedRequest): boolean {
  return false
}

// Supervision = peut voir un dossier VERROUILLÉ (médecin-chef / admin système).
const SUPERVISION_ROLES = ['ADMIN_SYSTEME', 'MEDECIN_CHEF']
function isSupervision(req: AuthedRequest): boolean {
  return (req.user?.roles ?? []).some(r => SUPERVISION_ROLES.includes(r))
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('patients')
@Audit('patient', 'Patient')
export class PatientController {
  constructor(private readonly patientService: PatientService) {}

  // ── Liste & Création ──────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('patient.read')
  findAll(@Query() query: PatientQueryDto) {
    return this.patientService.findAll(query)
  }

  @Post()
  @RequirePermissions('patient.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePatientDto, @Req() req: any) {
    return this.patientService.create(dto, req.user?.id)
  }

  /**
   * Rapprochement de doublons (triage intelligent). Dossier PARTAGÉ entre sites →
   * la déduplication cherche sur TOUS LES SITES, sinon on créerait un doublon d'un
   * patient déjà enregistré sur un autre site (intégrité du dossier unique).
   */
  @Get('similar')
  @RequirePermissions('patient.create', 'patient.read')
  findSimilar(@Query() query: FindSimilarPatientDto) {
    return this.patientService.findSimilar(query)
  }

  // ── Dossier ───────────────────────────────────────────────────────────────

  // Rapprochement par matricule employeur (inscription ayant droit). AVANT @Get(':id').
  @Get('by-matricule/:matricule')
  @RequirePermissions('patient.read')
  findByMatricule(@Param('matricule') matricule: string) {
    return this.patientService.findByMatricule(matricule)
  }

  @Get(':id')
  @RequirePermissions('patient.read')
  findById(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.patientService.findById(id, {
      restrictToOwn:      isRestrictedDoctor(req),
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
      canViewLocked:      isSupervision(req),
    })
  }

  // Ayants droit du travailleur CDI + leur activité récente (traçabilité dossier).
  @Get(':id/ayants-droits')
  @RequirePermissions('patient.read')
  ayantsDroits(@Param('id') id: string) {
    return this.patientService.findAyantsDroits(id)
  }

  /**
   * Historique des constantes vitales du patient (dossier → onglet Constantes).
   * Dossier CENTRALISÉ : l'historique suit le patient (tous sites) ; relation clinique
   * requise pour un médecin non-superviseur (scope dormant aujourd'hui).
   */
  @Get(':id/constantes')
  @RequirePermissions('patient.read')
  findConstantes(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.patientService.findConstantes(id, {
      restrictToOwn:      isRestrictedDoctor(req),
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
      canViewLocked:      isSupervision(req),
    })
  }

  /**
   * Alertes cliniques calculées (allergie↔médicament, constantes critiques, chronique sans suivi).
   * Calculées sur l'historique COMPLET du patient (tous sites — dossier centralisé) ;
   * relation clinique requise pour un médecin non-superviseur.
   */
  @Get(':id/alertes-cliniques')
  @RequirePermissions('consultation.read')
  findAlertesCliniques(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.patientService.findAlertesCliniques(id, {
      restrictToOwn:      isRestrictedDoctor(req),
      personnelMedicalId: req.user?.personnelMedicalId ?? null,
      canViewLocked:      isSupervision(req),
    })
  }

  @Patch(':id/identite')
  @RequirePermissions('patient.update')
  updateIdentite(@Param('id') id: string, @Body() dto: UpdateIdentiteDto) {
    return this.patientService.updateIdentite(id, dto)
  }

  @Patch(':id/mode-vie')
  @RequirePermissions('patient.update')
  upsertModeVie(@Param('id') id: string, @Body() dto: UpsertModeVieDto) {
    return this.patientService.upsertModeVie(id, dto)
  }

  @Post(':id/photo')
  @RequirePermissions('patient.update')
  @UseInterceptors(FileInterceptor('file', {
    // Stockage EN MÉMOIRE : la photo est encodée en Base64 et conservée dans la
    // base (colonne identite.photoUrl). Aucun fichier sur disque → tout voyage
    // avec le dump SQL (déploiement / sauvegarde triviaux).
    storage: memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo
    fileFilter: (_req, file, cb) => {
      if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true)
      else cb(new BadRequestException('Format invalide — image JPEG, PNG, WEBP ou GIF attendue'), false)
    },
  }))
  uploadPhoto(@Param('id') id: string, @UploadedFile() file?: Express.Multer.File) {
    if (!file) throw new BadRequestException('Aucun fichier reçu')
    return this.patientService.setPhoto(id, file.buffer)
  }

  @Patch(':id/categorie')
  @RequirePermissions('patient.change_category')
  changerCategorie(@Param('id') id: string, @Body() dto: ChangerCategorieDto, @Req() req: any) {
    return this.patientService.changerCategorie(id, dto, req.user?.id)
  }

  @Patch(':id/statut')
  @RequirePermissions('patient.archive')
  updateStatut(@Param('id') id: string, @Body() dto: ToggleStatutPatientDto) {
    return this.patientService.updateStatut(id, dto)
  }

  /** Verrouiller / déverrouiller l'accès au dossier (médecin-chef). */
  @Patch(':id/verrou')
  @RequirePermissions('patient.lock')
  setVerrou(@Param('id') id: string, @Body() dto: VerrouPatientDto, @Req() req: any) {
    return this.patientService.setVerrou(id, dto.verrouille, dto.motif ?? null, req.user?.id ?? null)
  }

  // ── Allergies ─────────────────────────────────────────────────────────────

  @Post(':id/allergies')
  @RequirePermissions('patient.update')
  createAllergie(@Param('id') id: string, @Body() dto: CreateAllergieDto) {
    return this.patientService.createAllergie(id, dto)
  }

  @Patch(':id/allergies/:aId')
  @RequirePermissions('patient.update')
  updateAllergie(
    @Param('id')  id:  string,
    @Param('aId') aId: string,
    @Body()       dto: UpdateAllergieDto,
  ) {
    return this.patientService.updateAllergie(id, aId, dto)
  }

  @Delete(':id/allergies/:aId')
  @RequirePermissions('patient.update')
  deleteAllergie(@Param('id') id: string, @Param('aId') aId: string) {
    return this.patientService.deleteAllergie(id, aId)
  }

  // ── Antécédents ───────────────────────────────────────────────────────────

  @Post(':id/antecedents')
  @RequirePermissions('patient.update')
  createAntecedent(@Param('id') id: string, @Body() dto: CreateAntecedentDto) {
    return this.patientService.createAntecedent(id, dto)
  }

  @Patch(':id/antecedents/:aId')
  @RequirePermissions('patient.update')
  updateAntecedent(
    @Param('id')  id:  string,
    @Param('aId') aId: string,
    @Body()       dto: UpdateAntecedentDto,
  ) {
    return this.patientService.updateAntecedent(id, aId, dto)
  }

  @Delete(':id/antecedents/:aId')
  @RequirePermissions('patient.update')
  deleteAntecedent(@Param('id') id: string, @Param('aId') aId: string) {
    return this.patientService.deleteAntecedent(id, aId)
  }

  // ── Alertes médicales ─────────────────────────────────────────────────────

  @Post(':id/alertes')
  @RequirePermissions('patient.update')
  createAlerte(@Param('id') id: string, @Body() dto: CreateAlerteMedicaleDto) {
    return this.patientService.createAlerte(id, dto)
  }

  @Patch(':id/alertes/:aId')
  @RequirePermissions('patient.update')
  updateAlerte(
    @Param('id')  id:  string,
    @Param('aId') aId: string,
    @Body()       dto: UpdateAlerteMedicaleDto,
  ) {
    return this.patientService.updateAlerte(id, aId, dto)
  }

  @Delete(':id/alertes/:aId')
  @RequirePermissions('patient.update')
  deleteAlerte(@Param('id') id: string, @Param('aId') aId: string) {
    return this.patientService.deleteAlerte(id, aId)
  }

  // ── Rattachements Ayant Droit CDI ─────────────────────────────────────────

  @Post(':id/rattachements-ad')
  @RequirePermissions('patient.rattachement.manage')
  createRattachementAD(@Param('id') id: string, @Body() dto: CreateRattachementADDto) {
    return this.patientService.createRattachementAD(id, dto)
  }

  @Patch(':id/rattachements-ad/:rId')
  @RequirePermissions('patient.rattachement.manage')
  updateRattachementAD(
    @Param('id')  id:  string,
    @Param('rId') rId: string,
    @Body()       dto: UpdateRattachementADDto,
  ) {
    return this.patientService.updateRattachementAD(id, rId, dto)
  }

  @Delete(':id/rattachements-ad/:rId')
  @RequirePermissions('patient.rattachement.manage')
  deleteRattachementAD(@Param('id') id: string, @Param('rId') rId: string) {
    return this.patientService.deleteRattachementAD(id, rId)
  }

  // ── Rattachements Sous-Traitant ───────────────────────────────────────────

  @Post(':id/rattachements-st')
  @RequirePermissions('patient.rattachement.manage')
  createRattachementST(@Param('id') id: string, @Body() dto: CreateRattachementSTDto) {
    return this.patientService.createRattachementST(id, dto)
  }

  @Patch(':id/rattachements-st/:rId')
  @RequirePermissions('patient.rattachement.manage')
  updateRattachementST(
    @Param('id')  id:  string,
    @Param('rId') rId: string,
    @Body()       dto: UpdateRattachementSTDto,
  ) {
    return this.patientService.updateRattachementST(id, rId, dto)
  }

  @Delete(':id/rattachements-st/:rId')
  @RequirePermissions('patient.rattachement.manage')
  deleteRattachementST(@Param('id') id: string, @Param('rId') rId: string) {
    return this.patientService.deleteRattachementST(id, rId)
  }

  // ── Suppression définitive du dossier ─────────────────────────────────────

  @Delete(':id')
  @RequirePermissions('patient.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.patientService.deletePatient(id)
  }
}
