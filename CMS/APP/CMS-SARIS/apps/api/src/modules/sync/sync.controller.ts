import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { SyncService } from './sync.service'
import { SyncClientService } from './sync-client.service'
import { SyncSupervisionService } from './sync-supervision.service'
import {
  SyncPullQueryDto,
  SyncPushDto,
  SyncHeartbeatDto,
  RenamePosteDto,
  ConfigurerPosteDto,
} from './sync.dto'

interface AuthedRequest {
  user?: { id?: string; siteId?: string }
}

function requireUser(req: AuthedRequest): { userId: string; siteId: string } {
  const userId = req.user?.id
  const siteId = req.user?.siteId
  if (!userId || !siteId) throw new UnauthorizedException('Session invalide')
  return { userId, siteId }
}

/**
 * Endpoints de synchronisation offline-first (serveur central).
 * Scope STRICT par site (résolu depuis le JWT, jamais depuis la requête).
 *
 * Plafond desserré (600/min, cf. @Throttle ci-dessous) : trafic machine-à-machine
 * authentifié, pas une surface exposée au public. Un poste desktop sonde le central
 * toutes les 4s par défaut (SYNC_PROBE_SEC) + heartbeat toutes les 30s
 * (SYNC_HEARTBEAT_SEC) — plusieurs postes d'un même site derrière la même IP
 * dépasseraient le plafond global 'default' (100/min) en fonctionnement NORMAL.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Throttle({ default: { limit: 600, ttl: 60_000 } })
@Controller('sync')
export class SyncController {
  constructor(
    private readonly svc: SyncService,
    private readonly client: SyncClientService,
    private readonly supervision: SyncSupervisionService,
  ) {}

  @Get('pull')
  @RequirePermissions('synchronisation.read')
  pull(@Req() req: AuthedRequest, @Query() q: SyncPullQueryDto) {
    const { siteId } = requireUser(req)
    return this.svc.pull(siteId, q.since, q.limit)
  }

  @Post('push')
  @RequirePermissions('synchronisation.execute')
  push(@Req() req: AuthedRequest, @Body() body: SyncPushDto) {
    const { userId, siteId } = requireUser(req)
    return this.svc.push(siteId, userId, body.posteLocalId, body.changes)
  }

  /**
   * Battement de vie périodique d'un poste (indépendant de toute donnée à pousser) : fait
   * apparaître le poste dès l'installation et rend le statut en ligne/hors ligne réellement vivant.
   */
  @Post('heartbeat')
  @RequirePermissions('synchronisation.execute')
  async heartbeat(@Req() req: AuthedRequest, @Body() body: SyncHeartbeatDto) {
    const { siteId } = requireUser(req)
    await this.supervision.heartbeat(siteId, body.posteLocalId, body.libelle)
    return { ok: true }
  }

  /**
   * Déclare le site d'un poste, à sa première installation.
   *
   * `synchronisation.read` ne restreint rien en pratique : le compte saisi à
   * l'installation DEVIENT le compte de synchronisation du poste, et il lui faut de
   * toute façon `synchronisation.execute` pour pousser/tirer ensuite. Autant garder ici
   * la permission la plus étroite — déplacer un poste d'un site à l'autre change le site
   * porté par tous ses actes, ce n'est pas un geste anodin.
   */
  @Post('poste')
  @RequirePermissions('synchronisation.read')
  configurerPoste(@Body() dto: ConfigurerPosteDto) {
    return this.supervision.configurerPoste(
      dto.posteLocalId,
      dto.siteId,
      dto.libelle,
    )
  }

  /** Le poste est-il déjà rattaché à un site ? `null` s'il n'est pas déclaré. */
  @Get('poste/:id')
  @RequirePermissions('synchronisation.read')
  lirePoste(@Param('id') id: string) {
    return this.supervision.lirePoste(id)
  }

  /** Renomme un poste (nom unique par site) — supervision admin.
   *
   *  Les trois routes de supervision ci-dessous ne filtrent plus sur le site de
   *  l'appelant : la liste couvre tout le parc, un poste qu'on y voit doit pouvoir
   *  être ouvert, renommé et retiré. Le filtre héritait du cloisonnement retiré et
   *  produisait un « Poste introuvable » sur une machine pourtant affichée. La
   *  protection reste la permission `synchronisation.execute`. */
  @Patch('supervision/postes/:id')
  @RequirePermissions('synchronisation.execute')
  renamePoste(@Param('id') id: string, @Body() dto: RenamePosteDto) {
    return this.supervision.renamePoste(id, dto.libelle)
  }

  /** Supervision (serveur central) : postes, activité récente, conflits — tout le parc. */
  @Get('supervision')
  @RequirePermissions('synchronisation.read')
  getSupervision() {
    // Plus de siteId : la supervision couvre tout le parc (cf. service).
    return this.supervision.getSupervision()
  }

  /** Détail d'un poste (modale) : identité + fenêtre de sa dernière session connectée. */
  @Get('supervision/postes/:id')
  @RequirePermissions('synchronisation.read')
  getPosteDetail(@Param('id') id: string) {
    return this.supervision.getPosteDetail(id)
  }

  /** Retire un poste de la liste de supervision (dismiss) — réapparaît à sa prochaine synchro. */
  @Delete('supervision/postes/:id')
  @RequirePermissions('synchronisation.execute')
  async masquerPoste(@Param('id') id: string) {
    await this.supervision.masquerPoste(id)
    return { ok: true }
  }

  @Get('status')
  @RequirePermissions('synchronisation.read')
  async status(@Req() req: AuthedRequest) {
    const { siteId } = requireUser(req)
    const [base, client] = await Promise.all([
      this.svc.status(siteId),
      this.client.clientStatus(),
    ])
    return { ...base, client }
  }

  /** Déclenche un cycle de synchronisation (mode local embarqué). */
  @Post('run')
  @RequirePermissions('synchronisation.execute')
  async run() {
    const result = await this.client.runCycle()
    return (
      result ?? {
        skipped: true,
        reason: 'mode local inactif ou serveur injoignable',
      }
    )
  }
}
