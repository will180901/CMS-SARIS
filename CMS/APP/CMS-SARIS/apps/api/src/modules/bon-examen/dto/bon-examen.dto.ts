import {
  IsUUID, IsString, IsOptional, IsArray, IsIn, IsNotEmpty,
  MaxLength, ArrayMinSize,
} from 'class-validator'

export class CreateBonExamenDto {
  @IsUUID()
  consultationId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  indicationClinik!: string

  @IsOptional()
  @IsUUID()
  etablissementId?: string | null

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un examen est requis' })
  @IsUUID('all', { each: true })
  typesExamenIds!: string[]
}

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
  @IsNotEmpty({ message: 'Motif d\'annulation requis' })
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
