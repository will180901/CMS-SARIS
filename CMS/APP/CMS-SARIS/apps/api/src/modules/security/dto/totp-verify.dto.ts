import { IsString, IsNotEmpty, Matches, IsOptional, MaxLength } from 'class-validator'

export class TotpVerifyDto {
  // Accepte soit un code TOTP à 6 chiffres, soit un code de secours « XXXX-XXXX »
  // (tiret optionnel, casse indifférente — normalisé côté service).
  @IsString()
  @Matches(/^(\d{6}|[A-Za-z0-9]{4}-?[A-Za-z0-9]{4})$/, {
    message: 'Entrez un code à 6 chiffres ou un code de secours (format XXXX-XXXX).',
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
}
