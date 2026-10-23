import { IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator'

/** Un administrateur prépare un code pour un site. */
export class CreerCodeAppairageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  siteId!: string

  /** Nombre de postes que le code peut appairer : 1 = usage unique, davantage = déploiement par lot. */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  usagesMax?: number

  /** Durée de validité, en heures (24 par défaut, 7 jours au plus). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  validiteHeures?: number

  @IsOptional()
  @IsString()
  @MaxLength(120)
  note?: string
}

/** Un poste présente son code, une fois, pour s'enregistrer. */
export class AppairerPosteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  code!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  posteLocalId!: string

  @IsOptional()
  @IsString()
  @MaxLength(80)
  libelle?: string

  @IsOptional()
  @IsString()
  @MaxLength(40)
  versionApp?: string
}

/** Un poste appairé échange son secret contre un jeton d'accès (à renouveler régulièrement). */
export class JetonPosteDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  posteLocalId!: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  secret!: string
}
