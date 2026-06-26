import { IsString, IsNotEmpty, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateMotifDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string
}

// SÉCURITÉ : `statut` retiré — toggle via /motifs/:id/statut (referentiel.delete).
export class UpdateMotifDto extends PartialType(CreateMotifDto) {}
