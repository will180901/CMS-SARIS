import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateSousTraitantDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nom: string
}

// SÉCURITÉ : `statut` retiré — toggle ACTIVE/INACTIVE passe par
// PATCH /sous-traitants/:id/statut gated par `sous_traitant.delete`.
export class UpdateSousTraitantDto extends PartialType(CreateSousTraitantDto) {}

export class ToggleStatutSousTraitantDto {
  @IsNotEmpty()
  @IsIn(['ACTIVE', 'INACTIVE'])
  statut: 'ACTIVE' | 'INACTIVE'
}

export class SousTraitantQueryDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE'])
  statut?: string
}
