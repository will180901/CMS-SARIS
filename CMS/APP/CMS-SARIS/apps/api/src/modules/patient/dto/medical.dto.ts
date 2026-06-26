import { IsString, IsNotEmpty, IsOptional, IsIn, IsBoolean, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

// ── Allergies ─────────────────────────────────────────────────────────────────

const GRAVITES_ALLERGIE = ['SEVERE', 'MODERE', 'FAIBLE'] as const

export class CreateAllergieDto {
  @IsString() @IsNotEmpty() @MaxLength(200) substance: string
  @IsIn(GRAVITES_ALLERGIE)                  gravite:   string
  @IsOptional() @IsBoolean()                confirme?: boolean
}

export class UpdateAllergieDto extends PartialType(CreateAllergieDto) {
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) statut?: string
}

// ── Antécédents ───────────────────────────────────────────────────────────────

const TYPES_ANTECEDENT = ['MEDICAL', 'CHIRURGICAL', 'FAMILIAL', 'GYNECO_OBSTETRICAL', 'AUTRE'] as const

export class CreateAntecedentDto {
  @IsIn(TYPES_ANTECEDENT)                     type:        string
  @IsString() @IsNotEmpty() @MaxLength(500)   description: string
}

export class UpdateAntecedentDto extends PartialType(CreateAntecedentDto) {
  @IsOptional() @IsIn(['ACTIF', 'RESOLU']) statut?: string
}

// ── Alertes médicales ─────────────────────────────────────────────────────────

const TYPES_ALERTE   = ['ALLERGIE', 'PATHOLOGIE_CHRONIQUE', 'CONTRE_INDICATION', 'SURVEILLANCE', 'AUTRE'] as const
const GRAVITES_ALERTE = ['CRITIQUE', 'IMPORTANT', 'INFO'] as const

export class CreateAlerteMedicaleDto {
  @IsIn(TYPES_ALERTE)                         type:    string
  @IsString() @IsNotEmpty() @MaxLength(500)   message: string
  @IsIn(GRAVITES_ALERTE)                      gravite: string
}

export class UpdateAlerteMedicaleDto extends PartialType(CreateAlerteMedicaleDto) {
  @IsOptional() @IsIn(['ACTIVE', 'INACTIVE']) statut?: string
}
