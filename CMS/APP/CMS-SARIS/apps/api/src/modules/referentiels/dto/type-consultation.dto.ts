import { IsString, IsNotEmpty, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateTypeConsultationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string
}

// SÉCURITÉ : `statut` retiré — toggle via /types-consultation/:id/statut (referentiel.type_consultation.delete).
export class UpdateTypeConsultationDto extends PartialType(CreateTypeConsultationDto) {}
