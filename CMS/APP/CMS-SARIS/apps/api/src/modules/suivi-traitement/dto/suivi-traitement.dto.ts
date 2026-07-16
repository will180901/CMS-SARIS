import {
  IsUUID, IsString, IsOptional, IsIn, IsNotEmpty, IsNumber, IsInt, MaxLength, Min, Max,
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
  @IsOptional() @IsNumber() @Min(30)  @Max(45)  temperature?: number
  @IsOptional() @IsInt()    @Min(50)  @Max(300) tensionSystolique?: number
  @IsOptional() @IsInt()    @Min(30)  @Max(200) tensionDiastolique?: number
  @IsOptional() @IsInt()    @Min(20)  @Max(300) frequenceCardiaque?: number
  @IsOptional() @IsInt()    @Min(4)   @Max(80)  frequenceRespiratoire?: number
  @IsOptional() @IsInt()    @Min(50)  @Max(100) saturationO2?: number
  @IsOptional() @IsNumber() @Min(0.5) @Max(300) poids?: number

  @IsOptional() @IsString() @MaxLength(2000)
  noteEvolution?: string

  @IsOptional() @IsString() @MaxLength(1000)
  medicamentsAdministres?: string

  @IsOptional() @IsString() @MaxLength(1000)
  resultatExamen?: string
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
