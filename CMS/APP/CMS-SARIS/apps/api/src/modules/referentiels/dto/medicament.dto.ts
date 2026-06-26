import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

export class CreateMedicamentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  nomGenerique: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nomCommercial?: string

  @IsOptional()
  @IsString()
  @MaxLength(100)
  familleThera?: string
}

// SÉCURITÉ : `statut` retiré — toggle via /medicaments/:id/statut (referentiel.delete).
export class UpdateMedicamentDto extends PartialType(CreateMedicamentDto) {}
