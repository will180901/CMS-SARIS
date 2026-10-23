import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { AppairageService } from './appairage.service'
import {
  AppairerPosteDto,
  CreerCodeAppairageDto,
  JetonPosteDto,
} from './appairage.dto'

interface Requete {
  user?: { id?: string }
  ip?: string
}

/**
 * Administration de l'appairage (page Synchronisation du site web) : préparer des codes, voir où ils en sont, les
 * annuler, couper l'accès d'un poste. Mêmes droits que le reste de la supervision.
 */
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller('sync/appairage')
export class AppairageController {
  constructor(private readonly appairage: AppairageService) {}

  @Get('codes')
  @RequirePermissions('synchronisation.read')
  lister() {
    return this.appairage.listerCodes()
  }

  /** Crée un code. La réponse porte le code EN CLAIR : c'est la seule fois qu'il est visible. */
  @Post('codes')
  @RequirePermissions('synchronisation.execute')
  creer(@Req() req: Requete, @Body() dto: CreerCodeAppairageDto) {
    return this.appairage.creerCode(dto, req.user?.id ?? null, req.ip ?? null)
  }

  @Delete('codes/:id')
  @RequirePermissions('synchronisation.execute')
  @HttpCode(HttpStatus.NO_CONTENT)
  async annuler(@Req() req: Requete, @Param('id') id: string): Promise<void> {
    await this.appairage.annulerCode(id, req.user?.id ?? null, req.ip ?? null)
  }

  /** Coupe l'accès d'un poste appairé (perte, vol, poste retiré du service). */
  @Delete('postes/:id')
  @RequirePermissions('synchronisation.execute')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoquer(@Req() req: Requete, @Param('id') id: string): Promise<void> {
    await this.appairage.revoquerAcces(id, req.user?.id ?? null, req.ip ?? null)
  }
}

/**
 * Côté POSTE — routes PUBLIQUES (le poste n'a encore aucun jeton) : elles sont donc limitées à la minute par origine,
 * en plus de la limite d'essais ratés du service.
 */
@Controller('sync/appairage')
export class AppairagePosteController {
  constructor(private readonly appairage: AppairageService) {}

  /** Le poste présente son code et reçoit son secret. */
  @Post()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  appairer(@Req() req: Requete, @Body() dto: AppairerPosteDto) {
    return this.appairage.appairer(dto, req.ip ?? 'inconnue')
  }

  /** Le poste échange son secret contre un jeton d'accès. */
  @Post('jeton')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  jeton(@Req() req: Requete, @Body() dto: JetonPosteDto) {
    return this.appairage.emettreJeton(dto, req.ip ?? 'inconnue')
  }
}
