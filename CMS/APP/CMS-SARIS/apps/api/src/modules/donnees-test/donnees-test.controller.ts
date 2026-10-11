import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { Type } from 'class-transformer'
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { DonneesTestService } from './donnees-test.service'

/** Ce que le contrôleur lit de la requête : l'utilisateur authentifié et l'adresse du client. */
interface RequeteAuthentifiee {
  user: { id: string }
  ip?: string
}

export class DemarrerGenerationDto {
  /** Durée de la période d'activité, en mois (la veille est le dernier jour). */
  @IsInt()
  @Min(1)
  @Max(12)
  mois!: number

  /** Visites par jour d'ouverture, tous sites confondus (moyenne). */
  @IsInt()
  @Min(1)
  @Max(300)
  visitesParJour!: number

  /** Pour rejouer exactement la même population ; sinon tirée au hasard. */
  @IsOptional()
  @IsString()
  @MaxLength(60)
  graine?: string
}

export class PrevisionsQueryDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  mois!: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(300)
  visitesParJour!: number
}

/**
 * Données de test : fabriquer plusieurs mois d'activité fictive, puis les supprimer.
 * Réservé au droit `systeme.donnees_test` (administrateur système), en mode Test seulement.
 */
@Controller('systeme/donnees-test')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('systeme.donnees_test')
export class DonneesTestController {
  constructor(private readonly service: DonneesTestService) {}

  /** État : mode, génération en cours ou dernière, données présentes, taille de la base, équipe. */
  @Get()
  etat() {
    return this.service.etat()
  }

  /** Ce que produirait une génération, sans rien écrire. */
  @Get('previsions')
  previsions(@Query() q: PrevisionsQueryDto) {
    return this.service.previsions(q.mois, q.visitesParJour)
  }

  @Post('generation')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  demarrer(
    @Req() req: RequeteAuthentifiee,
    @Body() dto: DemarrerGenerationDto,
  ) {
    return this.service.demarrer(dto, req.user.id, req.ip ?? null)
  }

  /** Reprend la dernière génération interrompue, arrêtée ou tombée en panne. */
  @Post('generation/reprise')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  reprendre(@Req() req: RequeteAuthentifiee) {
    return this.service.reprendre(req.user.id, req.ip ?? null)
  }

  /** Arrête la génération en cours après la journée en cours. */
  @Post('generation/arret')
  @HttpCode(200)
  arreter(@Req() req: RequeteAuthentifiee) {
    return this.service.arreter(req.user.id, req.ip ?? null)
  }

  /** Supprime toutes les données de test. */
  @Delete()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  supprimer(@Req() req: RequeteAuthentifiee) {
    return this.service.supprimer(req.user.id, req.ip ?? null)
  }
}
