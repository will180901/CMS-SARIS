import { Body, Controller, Get, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { SyncService } from './sync.service'
import { SyncClientService } from './sync-client.service'
import { SyncSupervisionService } from './sync-supervision.service'
import { SyncPullQueryDto, SyncPushDto } from './sync.dto'

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
    const { siteId } = requireUser(req)
    return this.svc.push(siteId, body.posteLocalId, body.changes)
  }

  /** Supervision (serveur central) : postes, activité récente, conflits — scope par site. */
  @Get('supervision')
  @RequirePermissions('synchronisation.read')
  getSupervision(@Req() req: AuthedRequest) {
    const { siteId } = requireUser(req)
    return this.supervision.getSupervision(siteId)
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
