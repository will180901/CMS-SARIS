import {
  Controller, Get, Param, Query, Req, UseGuards, UnauthorizedException,
} from '@nestjs/common'
import { RapportsService } from './rapports.service'
import type { TypeRapport } from './rapports.service'
import { JwtAuthGuard }       from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }   from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'

interface AuthedRequest { user?: { siteId?: string } }

function requireSite(req: AuthedRequest): string {
  const siteId = req.user?.siteId
  if (!siteId) throw new UnauthorizedException('Session invalide')
  return siteId
}

@Controller('rapports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RapportsController {
  constructor(private readonly svc: RapportsService) {}

  /** Liste des rapports générés du site (hebdo/mensuel/annuel), du plus récent au plus ancien. */
  @Get()
  @RequirePermissions('consultation.read')
  list(@Req() req: AuthedRequest, @Query('type') type?: TypeRapport) {
    return this.svc.list(requireSite(req), type)
  }

  /** Détail d'un rapport (contenu statistique complet de la période). */
  @Get(':id')
  @RequirePermissions('consultation.read')
  findOne(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.findOne(id, requireSite(req))
  }
}
