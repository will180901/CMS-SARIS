import { IsArray, IsISO8601, IsInt, IsOptional, IsString, Max, Min } from 'class-validator'
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
