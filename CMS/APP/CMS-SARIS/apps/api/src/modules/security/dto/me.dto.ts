import {
  IsOptional, IsIn, IsString, IsBoolean, IsInt, Min, Max, MaxLength, Matches,
} from 'class-validator'

// ── Préférences personnelles ──────────────────────────────────────────────────

export class UpdatePreferencesDto {
  @IsOptional() @IsIn(['clair', 'sombre', 'auto'])
  theme?: string

  @IsOptional() @IsIn(['confort', 'compact'])
  densite?: string

  @IsOptional() @IsIn(['fr', 'en'])
  langue?: string

  @IsOptional() @IsString() @MaxLength(60)
  pageAccueil?: string

  @IsOptional() @IsInt() @Min(10) @Max(100)
  lignesParPage?: number

  @IsOptional() @IsBoolean()
  notifEmail?: boolean
}

// ── 2FA (TOTP) ────────────────────────────────────────────────────────────────

export class TotpCodeDto {
  @IsString() @Matches(/^\d{6}$/, { message: 'Le code doit contenir exactement 6 chiffres.' })
  code!: string
}
