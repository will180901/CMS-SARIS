/**
 * BonExamenController — /bons-examen
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
  UseGuards,
  HttpCode,
  HttpStatus,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common'
import { FileInterceptor } from '@nestjs/platform-express'
import { memoryStorage } from 'multer'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import type { UserSession } from '@cms-saris/types'
import { BonExamenService } from './bon-examen.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh } from '../../common/decorators/live-refresh.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  UpdateBonExamenDto,
  ValiderBonExamenDto,
  AnnulerBonExamenDto,
  SaisirResultatDto,
  CorrigerResultatDto,
  BonExamenQueryDto,
} from './dto/bon-examen.dto'

/** Compte rendu du laboratoire : photo ou PDF, 8 Mo au plus. */
const COMPTE_RENDU_TYPES = /^(application\/pdf|image\/(jpeg|png|webp))$/

@Controller('bons-examen')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_BONS_EXAMEN')
@Audit('bon_examen', "Bon d'examen")
export class BonExamenController {
  constructor(private readonly svc: BonExamenService) {}

  @Get()
  @RequirePermissions('bon_examen.read')
  findAll(@Query() query: BonExamenQueryDto) {
    return this.svc.findAll(query)
  }

  @Get(':id')
  @RequirePermissions('bon_examen.read')
  findById(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  // Création directe retirée : un bon d'examen naît exclusivement de « Générer un bon »
  // sur une ordonnance PRESCRIPTION_EXAMEN validée (POST /consultations/:id/ordonnances/:ordId/generer-bon).

  @Patch(':id')
  @RequirePermissions('bon_examen.update')
  update(@Param('id') id: string, @Body() dto: UpdateBonExamenDto) {
    return this.svc.update(id, dto)
  }

  @Patch(':id/statut')
  @RequirePermissions('bon_examen.validate')
  validerOuAnnuler(@Param('id') id: string, @Body() dto: ValiderBonExamenDto) {
    return this.svc.validerOuAnnuler(id, dto)
  }

  @Patch(':id/annuler')
  @RequirePermissions('bon_examen.cancel')
  annuler(@Param('id') id: string, @Body() dto: AnnulerBonExamenDto) {
    return this.svc.annuler(id, dto.motifAnnulation)
  }

  @Delete(':id')
  @RequirePermissions('bon_examen.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.svc.delete(id)
  }

  @Post(':id/resultats')
  @RequirePermissions('bon_examen.result')
  @HttpCode(HttpStatus.CREATED)
  saisirResultat(
    @Param('id') id: string,
    @Body() dto: SaisirResultatDto,
    @CurrentUser() user: UserSession,
  ) {
    return this.svc.saisirResultat(id, dto, user.id)
  }

  @Patch(':id/resultats/:resultatId')
  @RequirePermissions('bon_examen.result')
  corrigerResultat(
    @Param('id') id: string,
    @Param('resultatId') resultatId: string,
    @Body() dto: CorrigerResultatDto,
    @CurrentUser() user: UserSession,
  ) {
    return this.svc.corrigerResultat(id, resultatId, dto, user.id)
  }

  @Post(':id/pieces-jointes')
  @RequirePermissions('bon_examen.result')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 8 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (COMPTE_RENDU_TYPES.test(file.mimetype)) cb(null, true)
        else cb(new BadRequestException('Joignez une photo (JPEG, PNG, WebP) ou un PDF'), false)
      },
    }),
  )
  ajouterPieceJointe(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: UserSession,
  ) {
    if (!file) throw new BadRequestException('Aucun fichier reçu')
    return this.svc.ajouterPieceJointe(id, file, user.id)
  }

  @Get(':id/pieces-jointes/:pieceId')
  @RequirePermissions('bon_examen.read')
  lirePieceJointe(@Param('id') id: string, @Param('pieceId') pieceId: string) {
    return this.svc.lirePieceJointe(id, pieceId)
  }

  @Delete(':id/pieces-jointes/:pieceId')
  @RequirePermissions('bon_examen.result')
  @HttpCode(HttpStatus.OK)
  supprimerPieceJointe(@Param('id') id: string, @Param('pieceId') pieceId: string) {
    return this.svc.supprimerPieceJointe(id, pieceId)
  }
}
