import {
  IsUUID,
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
  MinLength,
  IsBoolean,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  ValidateNested,
  IsDateString,
} from 'class-validator'
import { Type } from 'class-transformer'

// Note : la création d'un bon d'examen ne se fait plus directement (POST retiré) — un bon
// naît exclusivement de « Générer un bon » sur une ordonnance PRESCRIPTION_EXAMEN validée
// (voir ConsultationService.genererBonDepuisOrdonnance), pour garantir sa traçabilité.

export class UpdateBonExamenDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  indicationClinik?: string

  @IsOptional()
  @IsUUID()
  etablissementId?: string | null
}

export class ValiderBonExamenDto {
  @IsIn(['VALIDE', 'ANNULE'])
  statut!: 'VALIDE' | 'ANNULE'

  @IsOptional()
  @IsString()
  @MaxLength(500)
  motifAnnulation?: string
}

export class AnnulerBonExamenDto {
  @IsString()
  @IsNotEmpty({ message: "Motif d'annulation requis" })
  @MaxLength(500)
  motifAnnulation!: string
}

/** Résultat d'UN examen prescrit (une ligne du bon). */
export class ResultatLigneDto {
  @IsUUID()
  ligneExamenId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  contenu!: string

  @IsOptional()
  @IsBoolean()
  anormal?: boolean
}

/**
 * Saisie de résultats. Forme normale : `resultats` (un par examen prescrit, saisie
 * partielle permise). Forme ancienne conservée : `contenu` seul = résultat global du bon.
 * Laboratoire, date de réalisation et interprétation valent pour toute la saisie.
 */
export class SaisirResultatDto {
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => ResultatLigneDto)
  resultats?: ResultatLigneDto[]

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  contenu?: string

  @IsOptional()
  @IsDateString()
  dateRealisation?: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  laboratoire?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  interpretation?: string
}

/** Correction d'un résultat : un nouveau résultat remplace l'ancien (gardé, REMPLACE). */
export class CorrigerResultatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  contenu!: string

  @IsOptional()
  @IsBoolean()
  anormal?: boolean

  @IsOptional()
  @IsString()
  @MaxLength(500)
  laboratoire?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  interpretation?: string

  @IsOptional()
  @IsDateString()
  dateRealisation?: string

  @IsString()
  @MinLength(3)
  @MaxLength(500)
  motifCorrection!: string
}

export class BonExamenQueryDto {
  @IsOptional()
  @IsUUID()
  consultationId?: string

  @IsOptional()
  @IsUUID()
  patientId?: string

  @IsOptional()
  @IsIn(['EN_ATTENTE', 'VALIDE', 'ANNULE', 'TOUS'])
  statut?: string
}
