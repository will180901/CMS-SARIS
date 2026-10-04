import { Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  ValidateNested,
  IsDateString,
  IsUUID,
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsInt,
  MaxLength,
  Min,
  Max,
} from 'class-validator'

export class CreateSuiviTraitementDto {
  @IsUUID()
  consultationId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motif!: string
}

// Mêmes plages réalistes que CreateConstanteVitaleDto (apps/api/src/modules/triage/dto/visite.dto.ts).
export class AddFicheSuiviDto {
  @IsOptional() @IsNumber() @Min(30) @Max(45) temperature?: number
  @IsOptional() @IsInt() @Min(50) @Max(300) tensionSystolique?: number
  @IsOptional() @IsInt() @Min(30) @Max(200) tensionDiastolique?: number
  @IsOptional() @IsInt() @Min(20) @Max(300) frequenceCardiaque?: number
  @IsOptional() @IsInt() @Min(4) @Max(80) frequenceRespiratoire?: number
  @IsOptional() @IsInt() @Min(50) @Max(100) saturationO2?: number
  @IsOptional() @IsNumber() @Min(0.5) @Max(300) poids?: number

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  noteEvolution?: string

  /** Ancien texte libre — n'est plus saisi (remplacé par `administrations`), gardé pour
   *  les postes pas encore mis à jour et pour relire les fiches anciennes. */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  medicamentsAdministres?: string

  /** Traitements prescrits administrés lors de ce relevé (case cochée = administré). */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => AdministrationLigneDto)
  administrations?: AdministrationLigneDto[]

  // Plus de « résultat d'examen » en texte libre : un résultat ne se saisit que sur
  // l'examen prescrit (bon d'examen). Les anciennes valeurs restent lisibles.
}

export class AdministrationLigneDto {
  @IsUUID()
  ligneOrdonnanceId!: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  dose?: string
}

/** Une administration notée seule (hors relevé). */
export class AdministrerDto extends AdministrationLigneDto {
  @IsOptional()
  @IsDateString()
  administreLe?: string

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observation?: string
}

/** Arrêt d'un traitement avant sa fin prévue. */
export class ArreterTraitementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  motifArret!: string
}

export class CloturerSuiviTraitementDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  motifCloture?: string
}

export class AnnulerSuiviTraitementDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motifAnnulation!: string
}

export class SuiviTraitementQueryDto {
  @IsOptional()
  @IsUUID()
  consultationId?: string

  @IsOptional()
  @IsUUID()
  patientId?: string

  @IsOptional()
  @IsIn(['EN_COURS', 'CLOTURE', 'ANNULE', 'TOUS'])
  statut?: string
}

/** Date à laquelle revoir le patient (null = aucune). */
export class ProchainControleDto {
  @IsOptional()
  @IsDateString()
  prochainControle?: string | null
}
