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
import { SuiviTraitementService } from './suivi-traitement.service'
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
  user?: { id?: string }
}

@Controller('suivi-traitement')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Audit('suivi_traitement', 'Suivi de traitement')
export class SuiviTraitementController {
  constructor(private readonly svc: SuiviTraitementService) {}

  @Get()
  @RequirePermissions('suivi_traitement.read')
  findAll(@Query() query: SuiviTraitementQueryDto) {
    return this.svc.findAll(query)
  }

  @Get(':id')
  @RequirePermissions('suivi_traitement.read')
  findById(@Param('id') id: string) {
    return this.svc.findById(id)
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
  addFiche(
    @Param('id') id: string,
    @Body() dto: AddFicheSuiviDto,
    @Req() req: AuthedRequest,
  ) {
    return this.svc.addFiche(id, dto, req.user?.id ?? 'unknown')
  }

  @Patch(':id/fiches/:ficheId')
  @RequirePermissions('suivi_traitement.update')
  updateFiche(
    @Param('id') id: string,
    @Param('ficheId') ficheId: string,
    @Body() dto: AddFicheSuiviDto,
  ) {
    return this.svc.updateFiche(id, ficheId, dto)
  }

  @Patch(':id/cloturer')
  @RequirePermissions('suivi_traitement.close')
  cloturer(@Param('id') id: string, @Body() dto: CloturerSuiviTraitementDto) {
    return this.svc.cloturer(id, dto)
  }

  @Patch(':id/annuler')
  @RequirePermissions('suivi_traitement.cancel', 'suivi_traitement.update')
  annuler(@Param('id') id: string, @Body() dto: AnnulerSuiviTraitementDto) {
    return this.svc.annuler(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('suivi_traitement.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.svc.delete(id)
  }
}
