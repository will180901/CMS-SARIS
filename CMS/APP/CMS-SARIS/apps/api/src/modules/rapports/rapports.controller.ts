import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common'
import { RapportsService } from './rapports.service'
import type { TypeRapport } from './rapports.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'

@Controller('rapports')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RapportsController {
  constructor(private readonly svc: RapportsService) {}

  /** Liste des rapports générés (hebdo/mensuel/annuel), du plus récent au plus ancien. */
  @Get()
  @RequirePermissions('rapport.read')
  list(@Query('type') type?: TypeRapport) {
    return this.svc.list(type)
  }

  /**
   * Génère un rapport MAINTENANT sur une période choisie.
   *
   * Protégé par `rapport.export` : produire un bilan est une action de pilotage, pas une
   * simple lecture. On ne crée pas de permission dédiée — le catalogue vit dans le code ET
   * en base, et en ajouter une sans la synchroniser priverait silencieusement les rôles de
   * l'accès correspondant.
   */
  @Post('generer')
  @RequirePermissions('rapport.export')
  generer(
    @Body() body: { type: TypeRapport; debut: string; fin: string },
  ) {
    return this.svc.genererMaintenant(body.type, body.debut, body.fin)
  }

  /** Détail d'un rapport (contenu statistique complet de la période). */
  @Get(':id')
  @RequirePermissions('rapport.read')
  findOne(@Param('id') id: string) {
    return this.svc.findOne(id)
  }
}
