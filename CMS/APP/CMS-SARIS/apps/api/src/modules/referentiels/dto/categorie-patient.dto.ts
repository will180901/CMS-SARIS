import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'

export class CreateCategoriePatientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string
}

// SÉCURITÉ : `statut` retiré — toggle via /categories-patient/:id/statut (referentiel.delete).
//
// `code` volontairement ABSENT (contrairement aux autres référentiels) : c'est le
// SEUL code de référentiel sur lequel de la vraie logique métier est branchée
// (droits par catégorie via DroitCategoriePatient.categorieId, obligations de saisie
// CDI/ayant droit/sous-traitant dans PatientService.create) — le laisser modifiable
// romprait silencieusement ces règles. Seul `libelle` (le nom affiché) reste éditable ;
// `code` est fixé une fois pour toutes à la création.
export class UpdateCategoriePatientDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle?: string
}
