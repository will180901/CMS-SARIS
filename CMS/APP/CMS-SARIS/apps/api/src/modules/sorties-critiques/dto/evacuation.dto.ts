import {
  IsUUID, IsString, IsOptional, IsIn, IsNotEmpty, MaxLength,
} from 'class-validator'

export class CreateEvacuationDto {
  @IsUUID()
  consultationId!: string

  @IsIn(['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE'])
  niveauUrgence!: 'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE'

  @IsOptional()
  @IsUUID()
  motifId?: string

  @IsOptional()
  @IsUUID()
  etablissementId?: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  infosCliniques!: string
}

export class UpdateEvacuationDto {
  @IsOptional()
  @IsIn(['BASSE', 'MOYENNE', 'HAUTE', 'CRITIQUE'])
  niveauUrgence?: 'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE'

  @IsOptional()
  @IsUUID()
  etablissementId?: string

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  infosCliniques?: string
}

export class AddSuiviEvacuationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  notes!: string

  @IsIn(['EN_COURS', 'EN_TRANSPORT', 'ADMIS', 'CLOTURE'])
  statut!: 'EN_COURS' | 'EN_TRANSPORT' | 'ADMIS' | 'CLOTURE'
}

export class AnnulerEvacuationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  motifAnnulation!: string
}

export class EvacuationQueryDto {
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
