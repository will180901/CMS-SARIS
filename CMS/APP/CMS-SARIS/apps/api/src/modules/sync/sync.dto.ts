import { IsArray, IsISO8601, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'
import type { SyncEntityEnvelope } from '@cms-saris/types/sync'

export class SyncPullQueryDto {
  /** Curseur : ne renvoyer que les changements postérieurs à cet horodatage ISO. */
  @IsOptional()
  @IsISO8601()
  since?: string

  /** Taille de page (par modèle). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2000)
  limit?: number
}

export class SyncPushDto {
  @IsString()
  posteLocalId!: string

  /** Deltas locaux à appliquer (upserts + tombstones). */
  @IsArray()
  changes!: SyncEntityEnvelope[]
}

/** Battement périodique (poste local) : signale sa présence + son nom, indépendamment
 *  de toute donnée à pousser — c'est ce qui permet un statut en ligne/hors ligne réellement
 *  vivant, et l'apparition du poste dans la supervision dès l'installation. */
export class SyncHeartbeatDto {
  @IsString()
  posteLocalId!: string

  /** Nom du poste — utilisé UNIQUEMENT à la création (jamais d'écrasement d'un nom déjà connu,
   *  qu'il vienne du poste ou d'un renommage admin). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  libelle?: string
}

export class RenamePosteDto {
  @IsString()
  @IsNotEmpty({ message: 'Le nom du poste est requis' })
  @MaxLength(80)
  libelle!: string
}
