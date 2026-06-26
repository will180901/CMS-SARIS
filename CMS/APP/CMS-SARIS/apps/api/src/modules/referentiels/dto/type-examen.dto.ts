import { IsString, IsNotEmpty, IsIn, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateTypeExamenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string

  @IsIn(['BIOLOGIE', 'IMAGERIE', 'SPECIALISE'])
  domaine: string
}

// SÉCURITÉ : `statut` retiré — toggle via /types-examen/:id/statut (referentiel.delete).
export class UpdateTypeExamenDto extends PartialType(CreateTypeExamenDto) {}
