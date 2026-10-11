import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Transform } from 'class-transformer'
import {
  Equals,
  IsBoolean,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { VidageService } from './vidage.service'

/** Ce que le contrôleur lit de la requête : l'utilisateur authentifié et l'adresse du client. */
interface RequeteAuthentifiee {
  user: { id: string }
  ip?: string
}

export class ViderDonneesDto {
  /** Le mot de passe de l'administrateur : redemandé à CHAQUE vidage. */
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MaxLength(200)
  motDePasse!: string

  /** La phrase recopiée (vérifiée par le service, qui connaît la bonne). */
  @IsString()
  @MaxLength(60)
  confirmation!: string

  /**
   * « Je sais que c'est irréversible. » Seul un vrai `true` vaut accord : la conversion implicite du
   * validateur transformerait sinon "false" (ou n'importe quel texte) en `true`.
   */
  @Transform(({ obj }: { obj: Record<string, unknown> }) => obj['irreversible'])
  @IsBoolean()
  @Equals(true, { message: 'L’accusé « irréversible » est obligatoire' })
  irreversible!: boolean

  /** « J'ai vérifié que la base peut être restaurée. » Même règle : seul un vrai `true`. */
  @Transform(
    ({ obj }: { obj: Record<string, unknown> }) => obj['restaurationVerifiee'],
  )
  @IsBoolean()
  @Equals(true, {
    message: 'L’accusé « restauration vérifiée » est obligatoire',
  })
  restaurationVerifiee!: boolean
}

/**
 * Vider toutes les données métier du centre — le geste de la mise en service.
 * Réservé au droit `systeme.vidage` (administrateur système), en mode Test seulement, mot de passe
 * redemandé : cf. VidageService pour toutes les protections.
 */
@Controller('systeme/vidage')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('systeme.vidage')
export class VidageController {
  constructor(private readonly service: VidageService) {}

  /** Ce qui partirait, les postes concernés, et pourquoi on ne peut pas vider si c'est le cas. */
  @Get()
  etat() {
    return this.service.etat()
  }

  /** Vide les données métier. Trois essais par minute : un mot de passe ne se devine pas à la chaîne. */
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  vider(@Req() req: RequeteAuthentifiee, @Body() dto: ViderDonneesDto) {
    return this.service.vider(dto, req.user.id, req.ip ?? null)
  }
}
