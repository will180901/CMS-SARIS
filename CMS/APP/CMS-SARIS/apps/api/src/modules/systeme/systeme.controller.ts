import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { IsIn, IsNotEmpty, IsString, MaxLength } from 'class-validator'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { ModeSystemeService } from './mode-systeme.service'
import type { ModeSysteme } from './mode-systeme'

/** Ce que ce contrôleur lit de la requête : l'utilisateur authentifié et l'adresse du client. */
interface RequeteAuthentifiee {
  user: { id: string }
  ip?: string
}

export class ChangerModeDto {
  @IsIn(['PRODUCTION', 'TEST'])
  mode!: ModeSysteme

  /** Le mot de passe de l'administrateur : redemandé à CHAQUE changement. */
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MaxLength(200)
  motDePasse!: string
}

@Controller('systeme')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SystemeController {
  constructor(private readonly mode: ModeSystemeService) {}

  /**
   * Le mode du système. Aucun droit particulier : tout utilisateur connecté le voit, puisque
   * c'est ce qui fait apparaître le bandeau « MODE TEST » chez tout le monde.
   */
  @Get('mode')
  lire() {
    return this.mode.lire()
  }

  /**
   * Change le mode. Réservé au droit `systeme.mode` (administrateur système) ET au mot de passe
   * redemandé. Cinq essais par minute : un mot de passe ne se devine pas à la chaîne, même avec
   * une session ouverte.
   */
  @Put('mode')
  @RequirePermissions('systeme.mode')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  changer(@Req() req: RequeteAuthentifiee, @Body() dto: ChangerModeDto) {
    return this.mode.changer(
      dto.mode,
      dto.motDePasse,
      req.user.id,
      req.ip ?? null,
    )
  }
}
