import {
  IsArray,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
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

/**
 * Configuration d'un poste à sa première installation.
 *
 * C'est le seul endroit où un site est CHOISI. Partout ailleurs le site est subi :
 * un acte prend celui du poste qui le réalise. Une personne, elle, n'appartient à
 * aucun site — un infirmier travaille là où il se trouve ce jour-là.
 *
 * Le site doit exister : il se choisit parmi ceux déjà enregistrés dans
 * Référentiels → Sites, jamais créé au passage.
 */
export class ConfigurerPosteDto {
  @IsString()
  @IsNotEmpty()
  posteLocalId!: string

  @IsString()
  @IsNotEmpty({ message: 'Le site du poste est requis' })
  siteId!: string

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

/**
 * Filtres du journal d'activité. Tous facultatifs : sans aucun paramètre, l'écran
 * affiche simplement la première page de l'activité la plus récente.
 */
export class ActiviteQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number

  /** Restreindre à un poste précis. */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  posteId?: string

  /** Statut du cycle : REUSSIE, CONFLITS… */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  statut?: string

  /** Borne basse sur la date de début. */
  @IsOptional()
  @IsISO8601()
  depuis?: string
}
