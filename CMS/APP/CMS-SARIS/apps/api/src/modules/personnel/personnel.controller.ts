import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { PersonnelService }     from './personnel.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh }          from '../../common/decorators/live-refresh.decorator'
import { Audit }                from '../../common/decorators/audit.decorator'
import { CreatePersonnelDto, UpdatePersonnelDto, PersonnelQueryDto, ToggleStatutPersonnelDto } from './dto/personnel.dto'

/**
 * PersonnelController — /personnel
 */
@Controller('personnel')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_ACTEURS')
@Audit('personnel', 'Personnel')
export class PersonnelController {
  constructor(private readonly svc: PersonnelService) {}

  @Get()
  @RequirePermissions('personnel.read')
  findAll(@Query() query: PersonnelQueryDto) {
    return this.svc.findAll(query)
  }

  // Soignants sélectionnables = personnel rattaché à un COMPTE utilisateur actif de
  // rôle clinique (MEDECIN_CHEF / INFIRMIER). Source du picker de triage : on ne
  // propose que des personnes qui se connectent au système (recueil — pas de
  // répertoire de personnel séparé). Gardé par `visite.read` (tout le triage y accède).
  // ⚠ Doit précéder `@Get(':id')` sinon 'soignants' serait capté comme un id.
  @Get('soignants')
  @RequirePermissions('visite.read')
  findSoignants() {
    return this.svc.findSoignants()
  }

  @Get(':id')
  @RequirePermissions('personnel.read')
  findOne(@Param('id') id: string) {
    return this.svc.findById(id)
  }

  @Post()
  @RequirePermissions('personnel.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePersonnelDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('personnel.update')
  update(@Param('id') id: string, @Body() dto: UpdatePersonnelDto) {
    return this.svc.update(id, dto)
  }

  // SÉCURITÉ : endpoint dédié pour activer/désactiver un agent.
  // Gated par `personnel.delete` — inaccessible aux utilisateurs ayant seulement
  // `personnel.update` (qui peuvent éditer les champs métier mais pas désactiver).
  @Patch(':id/statut')
  @RequirePermissions('personnel.delete')
  setStatut(@Param('id') id: string, @Body() dto: ToggleStatutPersonnelDto) {
    return this.svc.setStatut(id, dto.statut)
  }

  @Delete(':id')
  @RequirePermissions('personnel.delete')
  remove(@Param('id') id: string) {
    return this.svc.deletePersonnel(id)
  }
}
