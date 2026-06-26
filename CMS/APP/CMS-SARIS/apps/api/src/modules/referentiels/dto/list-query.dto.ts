import { IsOptional, IsString, IsIn } from 'class-validator'

export class ListQueryDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['ACTIF', 'INACTIF', 'ACTIVE', 'INACTIVE'])
  statut?: string
}
