import { IsString, IsNotEmpty, IsOptional, MaxLength } from 'class-validator'

export class CreateSiteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  localisation?: string
}

// SÉCURITÉ : `statut` retiré — toggle via /sites/:id/statut (referentiel.site.delete).
//
// `code` volontairement ABSENT (comme CategoriePatient) : il détermine désormais le
// préfixe de numérotation des dossiers patients (PAT-<3 premières lettres>-xxxxx, cf.
// PatientService.generateNumeroPatient) — le laisser modifiable romprait silencieusement
// la correspondance avec les dossiers déjà numérotés sous ce préfixe. Seuls `libelle`
// et `localisation` restent éditables ; `code` est fixé une fois pour toutes à la création.
export class UpdateSiteDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  libelle?: string

  @IsOptional()
  @IsString()
  @MaxLength(150)
  localisation?: string
}
