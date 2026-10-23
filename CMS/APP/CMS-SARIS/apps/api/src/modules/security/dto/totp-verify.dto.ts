import {
  IsString,
  IsNotEmpty,
  Matches,
  IsOptional,
  MaxLength,
} from 'class-validator'

export class TotpVerifyDto {
  // Accepte soit un code TOTP à 6 chiffres, soit un code de secours « XXXX-XXXX »
  // (tiret optionnel, casse indifférente — normalisé côté service).
  @IsString()
  @Matches(/^(\d{6}|[A-Za-z0-9]{4}-?[A-Za-z0-9]{4})$/, {
    message:
      'Entrez un code à 6 chiffres ou un code de secours (format XXXX-XXXX).',
  })
  code: string

  @IsString()
  @IsNotEmpty({ message: 'Le token temporaire est requis' })
  tempToken: string

  /** Cf. LoginDto : rempli par la session de synchro d'un poste → exemptée de la session unique. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  posteLocalId?: string

  /** Cf. LoginDto : identifiant stable de l'appareil (reconnexion depuis le même poste). */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  appareilId?: string

  /**
   * Identifiant de la MACHINE où la personne est assise (client de bureau) — pour que le site de travail soit
   * celui de la machine et non celui de son compte, comme pour toute session faite depuis ce poste.
   *
   * À ne pas confondre avec `posteLocalId` : celui-ci MARQUE la session comme une session de synchronisation
   * (exemptée de la session unique et du mot de passe temporaire). Celui-là ne sert qu'à choisir le site : la
   * session reste une session de PERSONNE, avec toutes ses règles.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  machineId?: string
}
