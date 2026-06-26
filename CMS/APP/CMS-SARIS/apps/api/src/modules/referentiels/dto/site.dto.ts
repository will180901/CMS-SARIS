import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateSiteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string

  @IsOptional()
  @IsString()
  @MaxLength(200)
  localisation?: string
}

// SÉCURITÉ : `statut` retiré — le toggle ACTIF/INACTIF passe par
// PATCH /sites/:id/statut gated par `referentiel.delete`, pas .update.
export class UpdateSiteDto extends PartialType(CreateSiteDto) {}
