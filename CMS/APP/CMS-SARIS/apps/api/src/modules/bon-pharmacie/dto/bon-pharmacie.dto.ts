import {
  IsUUID, IsString, IsOptional, IsArray, IsIn, IsNotEmpty,
  MaxLength, ArrayMinSize, ValidateNested,
} from 'class-validator'
import { Type } from 'class-transformer'

export class LigneBonPharmacieDto {
  @IsOptional() @IsUUID()
  medicamentId?: string | null

  @IsString() @IsNotEmpty() @MaxLength(200)
  libelle!: string

  @IsOptional() @IsString() @MaxLength(200)
  posologie?: string

  @IsOptional() @IsString() @MaxLength(100)
  quantite?: string
}

export class CreateBonPharmacieDto {
  @IsUUID()
  consultationId!: string

  @IsOptional() @IsString() @MaxLength(1000)
  observations?: string

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un médicament est requis' })
  @ValidateNested({ each: true })
  @Type(() => LigneBonPharmacieDto)
  lignes!: LigneBonPharmacieDto[]
}

export class DelivrerBonPharmacieDto {
  @IsOptional() @IsString() @MaxLength(100)
  delivrePar?: string
}

export class AnnulerBonPharmacieDto {
  @IsString() @IsNotEmpty({ message: 'Motif d\'annulation requis' }) @MaxLength(500)
  motifAnnulation!: string
}

export class BonPharmacieQueryDto {
  @IsOptional() @IsUUID()
  consultationId?: string

  @IsOptional() @IsUUID()
  patientId?: string

  @IsOptional() @IsIn(['EN_ATTENTE', 'DELIVRE', 'ANNULE', 'TOUS'])
  statut?: string
}
