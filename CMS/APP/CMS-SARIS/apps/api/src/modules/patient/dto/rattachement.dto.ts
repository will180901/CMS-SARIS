import { IsString, IsNotEmpty, IsOptional, IsIn, IsDateString, IsUUID, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

// ── Rattachement Ayant Droit CDI ──────────────────────────────────────────────

const LIENS_PARENTE = ['CONJOINT', 'ENFANT', 'PARENT', 'AUTRE'] as const

export class CreateRattachementADDto {
  @IsString() @IsNotEmpty() @MaxLength(36) cdiId:    string   // patient ID de l'assuré CDI
  @IsIn(LIENS_PARENTE)                     typeLien: string
  @IsDateString()                          dateDebut: string
  @IsOptional() @IsDateString()            dateFin?:  string
}

export class UpdateRattachementADDto extends PartialType(CreateRattachementADDto) {
  @IsOptional() @IsIn(['ACTIF', 'INACTIF']) statut?: string
}

// ── Rattachement Sous-Traitant ────────────────────────────────────────────────

export class CreateRattachementSTDto {
  @IsUUID()                     societeId:  string
  @IsDateString()               dateDebut:  string
  @IsOptional() @IsDateString() dateFin?:   string
}

export class UpdateRattachementSTDto extends PartialType(CreateRattachementSTDto) {
  @IsOptional() @IsIn(['ACTIF', 'INACTIF']) statut?: string
}
