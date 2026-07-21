import {
  IsUUID,
  IsString,
  IsOptional,
  IsIn,
  IsNotEmpty,
  MaxLength,
} from 'class-validator'

// Note : la création d'un bon de pharmacie ne se fait plus directement (POST retiré) — un
// bon naît exclusivement de « Générer un bon » sur une ordonnance PHARMACEUTIQUE validée
// (voir ConsultationService.genererBonDepuisOrdonnance), pour garantir sa traçabilité.

export class DelivrerBonPharmacieDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  delivrePar?: string
}

export class AnnulerBonPharmacieDto {
  @IsString()
  @IsNotEmpty({ message: "Motif d'annulation requis" })
  @MaxLength(500)
  motifAnnulation!: string
}

export class BonPharmacieQueryDto {
  @IsOptional()
  @IsUUID()
  consultationId?: string

  @IsOptional()
  @IsUUID()
  patientId?: string

  @IsOptional()
  @IsIn(['EN_ATTENTE', 'DELIVRE', 'ANNULE', 'TOUS'])
  statut?: string
}
