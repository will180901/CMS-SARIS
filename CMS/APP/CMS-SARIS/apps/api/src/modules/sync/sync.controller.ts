import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { SyncService } from './sync.service'
import { SyncClientService } from './sync-client.service'
import { SyncSupervisionService } from './sync-supervision.service'
import { SyncPullQueryDto, SyncPushDto, SyncHeartbeatDto, RenamePosteDto } from './sync.dto'

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
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
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

  /** Renomme un poste (nom unique par site) — supervision admin. */
  @Patch('supervision/postes/:id')
  @RequirePermissions('synchronisation.execute')
  renamePoste(@Req() req: AuthedRequest, @Param('id') id: string, @Body() dto: RenamePosteDto) {
    const { siteId } = requireUser(req)
    return this.supervision.renamePoste(siteId, id, dto.libelle)
  }

  /** Supervision (serveur central) : postes, activité récente, conflits — scope par site. */
  @Get('supervision')
  @RequirePermissions('synchronisation.read')
  getSupervision(@Req() req: AuthedRequest) {
    const { siteId } = requireUser(req)
    return this.supervision.getSupervision(siteId)
  }

  /** Détail d'un poste (modale) : identité + fenêtre de sa dernière session connectée. */
  @Get('supervision/postes/:id')
  @RequirePermissions('synchronisation.read')
  getPosteDetail(@Req() req: AuthedRequest, @Param('id') id: string) {
    const { siteId } = requireUser(req)
    return this.supervision.getPosteDetail(siteId, id)
  }

  /** Retire un poste de la liste de supervision (dismiss) — réapparaît à sa prochaine synchro. */
  @Delete('supervision/postes/:id')
  @RequirePermissions('synchronisation.execute')
  async masquerPoste(@Req() req: AuthedRequest, @Param('id') id: string) {
    const { siteId } = requireUser(req)
    await this.supervision.masquerPoste(siteId, id)
    return { ok: true }
  }

  @Get('status')
  @RequirePermissions('synchronisation.read')
  async status(@Req() req: AuthedRequest) {
    const { siteId } = requireUser(req)
    const [base, client] = await Promise.all([this.svc.status(siteId), this.client.clientStatus()])
    return { ...base, client }
  }

  /** Déclenche un cycle de synchronisation (mode local embarqué). */
  @Post('run')
  @RequirePermissions('synchronisation.execute')
  async run() {
    const result = await this.client.runCycle()
    return result ?? { skipped: true, reason: 'mode local inactif ou serveur injoignable' }
  }
}
