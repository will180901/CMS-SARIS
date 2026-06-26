/**
 * MessagerieController — messagerie interne chiffrée entre agents.
 *
 * REST protégé par JwtAuthGuard + PermissionsGuard (permissions messagerie.*).
 * Contenu et pièces jointes transitent chiffrés en base ; déchiffrés seulement
 * pour les participants autorisés.
 */
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, Req,
  UseGuards, UseInterceptors, UploadedFiles,
  HttpCode, HttpStatus, UnauthorizedException, BadRequestException,
} from '@nestjs/common'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Throttle } from '@nestjs/throttler'
import { memoryStorage } from 'multer'
import { MessagerieService, type UploadedPiece } from './messagerie.service'
import { JwtAuthGuard }       from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }   from '../security/guards/permissions.guard'
import { UserThrottlerGuard } from '../security/guards/user-throttler.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { StartConversationDto, CreateGroupDto, SendMessageDto, UpdateMessageDto, ReactDto } from './dto/messagerie.dto'
import { BatchIdsDto } from '../../common/dto/batch-ids.dto'

interface AuthedRequest { user?: { id?: string; siteId?: string } }

function requireUser(req: AuthedRequest): { userId: string; siteId: string } {
  const userId = req.user?.id
  const siteId = req.user?.siteId
  if (!userId || !siteId) throw new UnauthorizedException('Session invalide')
  return { userId, siteId }
}

// Pièces jointes : stockage EN MÉMOIRE → chiffrées puis conservées en base
// (aucun fichier sur disque, tout voyage avec le dump SQL). 10 fichiers, 16 Mo chacun.
// Types autorisés : images, vidéos, audio, PDF/Office/texte. Les règles fines
// (durée vidéo ≤ 2 min, compression image…) sont appliquées côté client.
const ALLOWED_MIME = /^(image\/(jpeg|png|webp|gif)|video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|application\/pdf|text\/(plain|csv)|application\/(msword|vnd\.openxmlformats-officedocument\.[a-z.]+|vnd\.ms-excel))$/
const ATTACHMENT_OPTS = {
  storage: memoryStorage(),
  limits:  { fileSize: 16 * 1024 * 1024, files: 10 },
  fileFilter: (_req: unknown, file: Express.Multer.File, cb: (e: Error | null, ok: boolean) => void) => {
    if (ALLOWED_MIME.test(file.mimetype)) cb(null, true)
    else cb(new BadRequestException(`Type de fichier non autorisé : ${file.mimetype}`), false)
  },
}

/**
 * Nettoie le nom de fichier reçu (anti path-traversal / XSS / contrôle) :
 * on retire tout chemin, les caractères de contrôle et `<>:"/\|?*`, et on borne
 * à 200 caractères. Renvoie un nom sûr (jamais vide).
 */
function sanitizeFilename(name: string): string {
  const base = (name ?? '').split(/[\\/]/).pop() ?? ''
  // eslint-disable-next-line no-control-regex
  const clean = base.replace(/[\x00-\x1f<>:"/\\|?*]/g, '').replace(/\s+/g, ' ').trim().slice(0, 200)
  return clean || 'fichier'
}

/**
 * Défense en profondeur : rejette un fichier dont les octets de tête trahissent
 * un EXÉCUTABLE / SCRIPT (peu importe le MIME déclaré) → bloque le spoofing
 * « .exe déguisé en .pdf ». Ne fait pas de validation positive (les médias
 * légitimes restent acceptés).
 */
function assertSafeBinary(buf: Buffer | undefined, nom: string): void {
  if (!buf || buf.length < 4) return
  const b = buf
  const sig = (a: number[]) => a.every((v, i) => b[i] === v)
  const dangerous =
    sig([0x4d, 0x5a]) ||                         // MZ — exécutable Windows (PE/DOS)
    sig([0x7f, 0x45, 0x4c, 0x46]) ||             // ELF — exécutable Linux
    sig([0xfe, 0xed, 0xfa, 0xce]) || sig([0xfe, 0xed, 0xfa, 0xcf]) || // Mach-O (macOS)
    sig([0xcf, 0xfa, 0xed, 0xfe]) ||             // Mach-O little-endian
    sig([0x23, 0x21])                            // #! — script shell
  if (dangerous) throw new BadRequestException(`Fichier exécutable non autorisé : ${nom}`)
}

@Controller('messagerie')
// JwtAuthGuard d'abord (résout req.user), puis Permissions, puis throttle PAR UTILISATEUR.
@UseGuards(JwtAuthGuard, PermissionsGuard, UserThrottlerGuard)
// Plafond généreux par défaut (lectures fréquentes) ; les écritures sont resserrées par endpoint.
@Throttle({ default: { limit: 150, ttl: 60_000 } })
export class MessagerieController {
  constructor(private readonly svc: MessagerieService) {}

  /** Liste des agents contactables (même site). */
  @Get('contacts')
  @RequirePermissions('messagerie.read')
  contacts(@Req() req: AuthedRequest) {
    const { userId, siteId } = requireUser(req)
    return this.svc.listContacts(userId, siteId)
  }

  /** Liste de mes conversations (avec aperçu + non-lus). */
  @Get('conversations')
  @RequirePermissions('messagerie.read')
  conversations(@Req() req: AuthedRequest) {
    return this.svc.listConversations(requireUser(req).userId)
  }

  /** Compteur global de messages non lus. */
  @Get('unread-count')
  @RequirePermissions('messagerie.read')
  async unread(@Req() req: AuthedRequest) {
    return { count: await this.svc.totalUnread(requireUser(req).userId) }
  }

  /** Démarre (ou retrouve) une conversation directe avec un agent. */
  @Post('conversations')
  @RequirePermissions('messagerie.create')
  @HttpCode(HttpStatus.OK)
  start(@Body() dto: StartConversationDto, @Req() req: AuthedRequest) {
    const { userId, siteId } = requireUser(req)
    return this.svc.getOrCreateDirect(userId, dto.destinataireId, siteId)
  }

  /** Crée une conversation de groupe. */
  @Post('groupes')
  @RequirePermissions('messagerie.create')
  @HttpCode(HttpStatus.CREATED)
  createGroup(@Body() dto: CreateGroupDto, @Req() req: AuthedRequest) {
    const { userId, siteId } = requireUser(req)
    return this.svc.createGroup(userId, dto.titre, dto.participantIds, siteId)
  }

  /** Quitter une conversation. */
  @Post('conversations/:id/quitter')
  @RequirePermissions('messagerie.read')
  @HttpCode(HttpStatus.OK)
  leave(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.leaveConversation(id, requireUser(req).userId)
  }

  /**
   * Signale une activité de saisie : diffusé en temps réel aux AUTRES participants
   * (éphémère). `kind=audio` → « en train d'enregistrer un message vocal », sinon
   * « en train d'écrire ».
   */
  @Post('conversations/:id/typing')
  @RequirePermissions('messagerie.create')
  @Throttle({ default: { limit: 240, ttl: 60_000 } })
  @HttpCode(HttpStatus.NO_CONTENT)
  typing(@Param('id') id: string, @Query('kind') kind: string | undefined, @Req() req: AuthedRequest) {
    return this.svc.notifyTyping(id, requireUser(req).userId, kind === 'audio' ? 'audio' : 'text')
  }

  /** Messages d'une conversation (déchiffrés, paginés) + marque comme lue. */
  @Get('conversations/:id/messages')
  @RequirePermissions('messagerie.read')
  messages(@Param('id') id: string, @Query('before') before: string | undefined, @Req() req: AuthedRequest) {
    return this.svc.listMessages(id, requireUser(req).userId, before)
  }

  /** Envoi d'un message (texte et/ou pièces jointes) dans une conversation. */
  @Post('conversations/:id/messages')
  @RequirePermissions('messagerie.create')
  @Throttle({ default: { limit: 40, ttl: 60_000 } }) // anti-flood : 40 envois/min/utilisateur
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FilesInterceptor('fichiers', 10, ATTACHMENT_OPTS))
  send(
    @Param('id') id: string,
    @Body() dto: SendMessageDto,
    @UploadedFiles() files: Express.Multer.File[] | undefined,
    @Req() req: AuthedRequest,
  ) {
    const pieces: UploadedPiece[] = (files ?? []).map(f => {
      const nomFichier = sanitizeFilename(f.originalname)
      assertSafeBinary(f.buffer, nomFichier)
      return { nomFichier, mimeType: f.mimetype, taille: f.size, buffer: f.buffer }
    })
    return this.svc.sendMessage(id, requireUser(req).userId, dto.contenu ?? '', pieces, dto.replyToId)
  }

  /** Télécharge une pièce jointe (déchiffrée) — participant autorisé uniquement. */
  @Get('pieces-jointes/:id')
  @RequirePermissions('messagerie.read')
  piece(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.getPieceJointe(id, requireUser(req).userId)
  }

  /** Détails d'un message (statut par destinataire : remis / lu / en ligne). */
  @Get('messages/:id/details')
  @RequirePermissions('messagerie.read')
  details(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.getMessageDetails(id, requireUser(req).userId)
  }

  /** Ajoute/retire une réaction emoji sur un message. */
  @Post('messages/:id/reactions')
  @RequirePermissions('messagerie.create')
  @HttpCode(HttpStatus.OK)
  react(@Param('id') id: string, @Body() dto: ReactDto, @Req() req: AuthedRequest) {
    return this.svc.toggleReaction(id, requireUser(req).userId, dto.emoji)
  }

  /** Modification d'un message (le sien uniquement). */
  @Patch('messages/:id')
  @RequirePermissions('messagerie.update')
  update(@Param('id') id: string, @Body() dto: UpdateMessageDto, @Req() req: AuthedRequest) {
    return this.svc.updateMessage(id, requireUser(req).userId, dto.contenu)
  }

  /** Supprimer pour TOUT LE MONDE (le sien, ≤ 15 min). */
  @Delete('messages/:id')
  @RequirePermissions('messagerie.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.deleteMessage(id, requireUser(req).userId)
  }

  /** Supprimer POUR MOI (n'importe quel message, masqué pour soi). */
  @Post('messages/:id/masquer')
  @RequirePermissions('messagerie.delete')
  @HttpCode(HttpStatus.OK)
  hide(@Param('id') id: string, @Req() req: AuthedRequest) {
    return this.svc.hideForMe(id, requireUser(req).userId)
  }

  /** Suppression MULTIPLE « pour moi » (masque plusieurs messages). */
  @Post('messages/batch-masquer')
  @RequirePermissions('messagerie.delete')
  @HttpCode(HttpStatus.OK)
  batchHide(@Body() body: BatchIdsDto, @Req() req: AuthedRequest) {
    return this.svc.batchHideForMe(body.ids, requireUser(req).userId)
  }

  /** Suppression MULTIPLE « pour tout le monde » (les siens, ≤ 15 min). */
  @Post('messages/batch-delete')
  @RequirePermissions('messagerie.delete')
  @HttpCode(HttpStatus.OK)
  batchDelete(@Body() body: BatchIdsDto, @Req() req: AuthedRequest) {
    return this.svc.batchDelete(body.ids, requireUser(req).userId)
  }
}
