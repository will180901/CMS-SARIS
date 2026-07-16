import {
  Controller, Get, Param, Query, UseGuards,
} from '@nestjs/common'
import { RapportsService } from './rapports.service'
import type { TypeRapport } from './rapports.service'
import { JwtAuthGuard }       from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }   from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'

@Controller('rapports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RapportsController {
  constructor(private readonly svc: RapportsService) {}

  /** Liste des rapports générés (hebdo/mensuel/annuel), du plus récent au plus ancien. */
  @Get()
  @RequirePermissions('consultation.read')
  list(@Query('type') type?: TypeRapport) {
    return this.svc.list(type)
  }

  /** Détail d'un rapport (contenu statistique complet de la période). */
  @Get(':id')
  @RequirePermissions('consultation.read')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id)
  }
}
