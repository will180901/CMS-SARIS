import {
  IsArray,
  IsIn,
  IsISO8601,
  IsInt,
  IsNotEmpty,
  IsNumber,
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

  /**
   * Poste qui demande. Facultatif : les postes à jour le disent, pour que le serveur puisse
   * refuser un poste SUSPENDU aussi à la réception (un poste ancien ne le dit pas : seul ce
   * qu'il ENVOIE est alors refusé).
   */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  posteLocalId?: string
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

  /** Version de l'application du poste (supervision du parc). Absente des postes anciens. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  versionApp?: string

  /** Niveau des ordres du serveur que le poste comprend (suspension, resynchronisation).
   *  Absent des postes anciens : le serveur ne leur demande alors rien qu'ils ignoreraient. */
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  niveauControle?: number
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

  /**
   * Position du POSTE, relevée par le navigateur À L'INSTALLATION, avec l'accord
   * explicite de la personne qui installe. Facultative de bout en bout : un refus,
   * un navigateur sans capteur ou une machine en salle blanche n'empêchent jamais
   * de configurer le poste.
   */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number

  /** Marge annoncée par le navigateur, en mètres. */
  @IsOptional()
  @IsNumber()
  @Min(0)
  precisionM?: number
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

/**
 * Activité REGROUPÉE PAR POSTE : une ligne par machine, quel que soit le nombre d'échanges
 * qu'elle a eus. Le détail cycle par cycle d'un poste se lit avec `ActiviteQueryDto`
 * (filtre `posteId`).
 */
export class ActiviteParPosteQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize?: number

  /** Mots du nom du poste (tous doivent s'y retrouver, dans n'importe quel ordre). */
  @IsOptional()
  @IsString()
  @MaxLength(80)
  recherche?: string

  /** `CONFLITS` : ne garder que les postes ayant eu au moins un échange avec conflit ou refus. */
  @IsOptional()
  @IsIn(['CONFLITS'])
  statut?: 'CONFLITS'
}

/** Conflits et refus d'UN poste. */
export class ConflitsPosteQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number

  /**
   * `QUARANTAINE` : changements refusés par le serveur (la donnée du poste y est gardée) ;
   * `CONFLITS` : désaccords entre le poste et le serveur, tranchés automatiquement.
   */
  @IsOptional()
  @IsIn(['QUARANTAINE', 'CONFLITS'])
  type?: 'QUARANTAINE' | 'CONFLITS'
}

/**
 * Portée du vidage de l'historique :
 *  - `echanges` (défaut) : les échanges et les conflits tranchés automatiquement — la
 *    quarantaine est CONSERVÉE, car c'est la seule copie, côté serveur, de changements
 *    refusés ;
 *  - `tout` : y compris la quarantaine.
 */
export class PurgeActiviteQueryDto {
  @IsOptional()
  @IsIn(['echanges', 'tout'])
  portee?: 'echanges' | 'tout'
}

/** Suspension des échanges d'un poste : le motif est facultatif, il reste dans le journal d'audit. */
export class SuspendrePosteDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  motif?: string
}

/** Accusé d'une resynchronisation complète, envoyé par le POSTE une fois la reprise faite. */
export class ResyncTermineeDto {
  /** Date de la demande qu'il vient d'accomplir, telle que le serveur la lui a donnée. */
  @IsISO8601()
  demandeeAt!: string
}

/** Accusé d'un vidage des données métier, envoyé par le POSTE une fois sa copie locale vidée. */
export class VidageTermineDto {
  /** Date du vidage qu'il vient d'accomplir, telle que le serveur la lui a donnée. */
  @IsISO8601()
  demandeeAt!: string
}
