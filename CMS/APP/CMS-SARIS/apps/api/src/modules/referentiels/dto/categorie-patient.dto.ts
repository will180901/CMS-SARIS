import { IsString, IsNotEmpty, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateCategoriePatientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string
}

// SÉCURITÉ : `statut` retiré — toggle via /categories-patient/:id/statut (referentiel.delete).
export class UpdateCategoriePatientDto extends PartialType(CreateCategoriePatientDto) {}
