import { IsString, IsNotEmpty, IsOptional, MaxLength, IsBoolean } from 'class-validator'

export class CreateCategoriePatientDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string

  /** Prise en charge des médicaments (bon de pharmacie). Défaut : non. */
  @IsOptional() @IsBoolean() couvreMedicament?: boolean
  /** Prise en charge des examens (bon d'examen). Défaut : non. */
  @IsOptional() @IsBoolean() couvreExamen?: boolean
}

/** Droits configurables d'une catégorie (consultation et premiers soins : toujours dus). */
export class UpdateDroitsCategorieDto {
  @IsBoolean() couvreMedicament: boolean
  @IsBoolean() couvreExamen: boolean
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
