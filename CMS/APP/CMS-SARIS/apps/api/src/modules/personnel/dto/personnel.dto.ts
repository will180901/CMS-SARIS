import { IsString, IsNotEmpty, IsOptional, IsIn, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export const ROLES_PERSONNEL = [
  'MEDECIN',
  'INFIRMIER',
  'SAGE_FEMME',
  'TECHNICIEN_LAB',
  'ADMINISTRATIF',
] as const

export class CreatePersonnelDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  matricule: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom: string

  @IsIn(ROLES_PERSONNEL)
  role: string

  @IsOptional()
  @IsString()
  siteId?: string
}

// SÉCURITÉ : `statut` retiré — toggle ACTIF/INACTIF passe par
// PATCH /personnel/:id/statut gated par `personnel.delete`,
// pas par PATCH /personnel/:id qui ne demande que `personnel.update`.
export class UpdatePersonnelDto extends PartialType(CreatePersonnelDto) {}

export class ToggleStatutPersonnelDto {
  @IsNotEmpty()
  @IsIn(['ACTIF', 'INACTIF'])
  statut: 'ACTIF' | 'INACTIF'
}

export class PersonnelQueryDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(ROLES_PERSONNEL)
  role?: string

  @IsOptional()
  @IsString()
  siteId?: string

  @IsOptional()
  @IsIn(['ACTIF', 'INACTIF'])
  statut?: string
}
