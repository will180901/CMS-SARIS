/**
 * NotificationController — feed de notifications + flux temps réel (SSE).
 *
 * REST : protégé par JwtAuthGuard (Bearer). Chaque utilisateur ne voit QUE les
 * notifications qui le concernent (individuelles + diffusions autorisées par
 * son site et ses permissions).
 *
 * SSE (/notifications/stream) : EventSource ne pouvant pas envoyer d'en-tête
 * Authorization, le token JWT est passé en query (?token=) et vérifié ici.
 */
import {
  Controller, Get, Patch, Post, Delete, Param, Query, Req, Sse, Body,
  UseGuards, HttpCode, HttpStatus, UnauthorizedException,
} from '@nestjs/common'
import { JwtService } from '@nestjs/jwt'
import { finalize, type Observable } from 'rxjs'
import type { MessageEvent } from '@nestjs/common'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { PrismaService } from '../../prisma/prisma.service'
import { NotificationService, type NotifAudience, type NiveauNotif } from './notification.service'
import { BatchIdsDto } from '../../common/dto/batch-ids.dto'
import { CreateAnnonceDto } from './dto/annonce.dto'
import { PresenceService } from './presence.service'

interface AuthedRequest {
  user?: { id?: string; siteId?: string; permissions?: string[] }
}

function audienceFromReq(req: AuthedRequest): NotifAudience {
  const u = req.user
  if (!u?.id || !u?.siteId) throw new UnauthorizedException('Session invalide')
  return { userId: u.id, siteId: u.siteId, permissions: u.permissions ?? [] }
}

@Controller('notifications')
export class NotificationController {
  constructor(
    private readonly notif:    NotificationService,
    private readonly jwt:      JwtService,
    private readonly presence: PresenceService,
    private readonly prisma:   PrismaService,
  ) {}

  private touchLastSeen(userId: string): void {
    this.prisma.utilisateur.update({ where: { id: userId }, data: { lastSeenAt: new Date() } }).catch(() => { /* best-effort */ })
  }

  /**
   * À la connexion d'un utilisateur, prévient les autres participants de ses
   * conversations → leurs messages passent « remis » (✓✓ gris) instantanément.
   */
  private notifyCoParticipants(userId: string): void {
    this.prisma.conversationParticipant.findMany({ where: { utilisateurId: userId }, select: { conversationId: true } })
      .then(parts => parts.length
        ? this.prisma.conversationParticipant.findMany({
            where:  { conversationId: { in: parts.map(p => p.conversationId) }, utilisateurId: { not: userId } },
            select: { utilisateurId: true },
          })
        : [])
      .then(others => { for (const o of others) this.notif.pushLive(o.utilisateurId, 'MESSAGE_STATUS') })
      .catch(() => { /* best-effort */ })
  }

  // ── Flux temps réel (SSE) ─────────────────────────────────────────────────────
  // Doit rester AVANT les routes paramétrées et n'utilise PAS JwtAuthGuard
  // (auth via token en query, car EventSource ne supporte pas les en-têtes).
  @Sse('stream')
  stream(@Query('token') token?: string): Observable<MessageEvent> {
    if (!token) throw new UnauthorizedException('Token requis')
    let payload: any
    try {
      payload = this.jwt.verify(token)
    } catch {
      throw new UnauthorizedException('Token invalide')
    }
    if (!payload?.sub || !payload?.siteId) throw new UnauthorizedException('Token invalide')
    const audience: NotifAudience = {
      userId:      payload.sub,
      siteId:      payload.siteId,
      permissions: payload.permissions ?? [],
    }
    // Présence : en ligne tant que ce flux SSE est ouvert.
    this.presence.connect(audience.userId)
    this.touchLastSeen(audience.userId)
    this.notifyCoParticipants(audience.userId)
    return this.notif.streamFor(audience).pipe(
      finalize(() => { this.presence.disconnect(audience.userId); this.touchLastSeen(audience.userId) }),
    )
  }

  // ── Feed (REST) ────────────────────────────────────────────────────────────

  @Get()
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.read')
  list(@Req() req: AuthedRequest, @Query('limit') limit?: string) {
    return this.notif.list(audienceFromReq(req), limit ? Number(limit) : 40)
  }

  @Get('unread-count')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.read')
  async unreadCount(@Req() req: AuthedRequest) {
    return { count: await this.notif.unreadCount(audienceFromReq(req)) }
  }

  @Patch(':id/read')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.update')
  markRead(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.notif.markRead(id, audienceFromReq(req).userId)
  }

  @Post('read-all')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.update')
  markAllRead(@Req() req: AuthedRequest) {
    return this.notif.markAllRead(audienceFromReq(req))
  }

  /** Émettre une ANNONCE diffusée (admin système). destinataireId=null → visible par
   *  tout le site (ou tous les sites si portee=TOUS), l'auteur excepté. */
  @Post('annonce')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.create')
  async annonce(@Body() dto: CreateAnnonceDto, @Req() req: AuthedRequest) {
    const a = audienceFromReq(req)
    // Annonce de mise à jour : un lien de téléchargement la transforme en notification
    // « MISE_A_JOUR » (le front affiche un bouton d'installation). Niveau par défaut = AVERTISSEMENT.
    const isUpdate = !!dto.lienTelechargement
    const n = await this.notif.emit({
      type:               'ANNONCE',
      niveau:             (dto.niveau as NiveauNotif | undefined) ?? (isUpdate ? 'AVERTISSEMENT' : 'INFO'),
      titre:              dto.titre,
      message:            dto.message,
      destinataireId:     null,
      siteId:             dto.portee === 'TOUS' ? null : a.siteId,
      requiredPermission: null,
      entiteType:         isUpdate ? 'MISE_A_JOUR' : undefined,
      lien:               isUpdate ? dto.lienTelechargement : undefined,
      entiteId:           isUpdate ? (dto.version ?? null) : undefined,
      createdById:        a.userId,
    })
    return { ok: !!n, id: n?.id ?? null }
  }

  /** « Supprimer pour moi » en lot (au survol / multi-sélection). Tout utilisateur, ses propres notifications. */
  @Post('dismiss-many')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.read')
  @HttpCode(HttpStatus.OK)
  dismissMany(@Body() body: BatchIdsDto, @Req() req: AuthedRequest) {
    return this.notif.dismissManyForUser(body.ids, audienceFromReq(req).userId)
  }

  /** « Tout supprimer pour moi ». */
  @Post('dismiss-all')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.read')
  @HttpCode(HttpStatus.OK)
  dismissAll(@Req() req: AuthedRequest) {
    return this.notif.dismissAllForUser(audienceFromReq(req))
  }

  /** « Supprimer pour moi » une notification (au survol). */
  @Post(':id/dismiss')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.read')
  @HttpCode(HttpStatus.OK)
  dismiss(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.notif.dismissForUser(id, audienceFromReq(req).userId)
  }

  /** Suppression définitive (réservé admin système via notification.delete). */
  @Delete(':id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @RequirePermissions('notification.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.notif.remove(id)
  }
}
