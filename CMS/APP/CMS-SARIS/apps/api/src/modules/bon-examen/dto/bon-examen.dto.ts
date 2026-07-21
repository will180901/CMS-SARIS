import {
  IsUUID,
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
} from 'class-validator'

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

export class SaisirResultatDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  contenu!: string

  @IsOptional()
  @IsString()
  @MaxLength(500)
  laboratoire?: string

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  interpretation?: string
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
