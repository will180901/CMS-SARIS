import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsIn,
  IsDateString,
  MaxLength,
} from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export const ROLES_PERSONNEL = [
  'MEDECIN',
  'INFIRMIER',
  'SAGE_FEMME',
  'TECHNICIEN_LAB',
  'ADMINISTRATIF',
] as const

export const CONTRATS_PERSONNEL = ['CDI', 'CDD'] as const

/** Service d'un membre du personnel quand rien d'autre n'est précisé : le centre lui-même. */
export const SERVICE_PAR_DEFAUT = 'Centre Médico-Sanitaire'

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

  // ── Données d'employé de la SARIS (reprises dans son dossier patient) ──────
  @IsOptional()
  @IsDateString()
  dateNaissance?: string | null

  @IsOptional()
  @IsIn(['M', 'F'])
  sexe?: string | null

  @IsOptional()
  @IsIn(CONTRATS_PERSONNEL)
  typeContrat?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  sectionPaie?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  service?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  departement?: string
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
  @IsIn(['ACTIF', 'INACTIF'])
  statut?: string
}
