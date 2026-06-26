import {
  IsString, IsOptional, IsIn, IsUUID, IsDateString,
} from 'class-validator'

// Recueil §3.2 : la délégation autorise « réaliser une consultation et prescrire »
// (cas courants). Pas de granularité par médicament → `perimetre` est une simple
// note textuelle des conditions, pas un filtre appliqué à la prescription.
export class CreateDelegationDto {
  @IsUUID()
  medecinChefId: string

  @IsUUID()
  infirmierId: string

  @IsDateString()
  dateDebut: string

  @IsDateString()
  dateFin: string

  @IsOptional()
  @IsString()
  perimetre?: string
}

export class UpdateDelegationDto {
  @IsOptional()
  @IsUUID()
  medecinChefId?: string

  @IsOptional()
  @IsUUID()
  infirmierId?: string

  @IsOptional()
  @IsDateString()
  dateDebut?: string

  @IsOptional()
  @IsDateString()
  dateFin?: string

  @IsOptional()
  @IsString()
  perimetre?: string
}

export class ToggleDelegationStatutDto {
  @IsIn(['ACTIVE', 'INACTIVE'])
  statut: string
}
