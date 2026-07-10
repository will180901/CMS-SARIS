import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator'
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

  // Triage allégé (recueil §3.5) : consultations spécialisées (ophtalmo/ORL/stomato)
  // — le triage ne collecte que statut + identité, sans anamnèse ni examen complet.
  @IsOptional()
  @IsBoolean()
  triageAllege?: boolean
}

// SÉCURITÉ : `statut` retiré — toggle via /motifs/:id/statut (referentiel.delete).
export class UpdateMotifDto extends PartialType(CreateMotifDto) {}
