import {
  IsOptional,
  IsIn,
  IsNumber,
  ValidateIf,
  IsEmail,
  IsNotEmpty,
  IsString,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  Matches,
} from 'class-validator'

// ── Préférences personnelles ──────────────────────────────────────────────────

export class UpdatePreferencesDto {
  @IsOptional()
  @IsIn(['clair', 'sombre', 'auto'])
  theme?: string

  @IsOptional()
  @IsIn(['confort', 'compact'])
  densite?: string

  @IsOptional()
  @IsIn(['fr', 'en'])
  langue?: string

  @IsOptional()
  @IsString()
  @MaxLength(60)
  pageAccueil?: string

  @IsOptional()
  @IsInt()
  @Min(10)
  @Max(100)
  lignesParPage?: number

  @IsOptional()
  @IsBoolean()
  notifEmail?: boolean
}

// ── Position de l'appareil (relevée par le navigateur à la connexion) ─────────

export const STATUTS_POSITION = ['OK', 'REFUSEE', 'INDISPONIBLE'] as const
export type StatutPosition = (typeof STATUTS_POSITION)[number]

export class PositionAppareilDto {
  @IsIn(STATUTS_POSITION)
  statut!: StatutPosition

  // Coordonnées exigées seulement quand la position a bien été relevée.
  @ValidateIf((o: PositionAppareilDto) => o.statut === 'OK')
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number

  @ValidateIf((o: PositionAppareilDto) => o.statut === 'OK')
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number

  /** Marge d'erreur annoncée par le navigateur, en mètres. */
  @ValidateIf((o: PositionAppareilDto) => o.statut === 'OK')
  @IsNumber()
  @Min(0)
  @Max(1_000_000)
  precisionM?: number
}

// ── Mon profil ────────────────────────────────────────────────────────────────
// Ce que chacun change lui-même. Identifiant, rôles, matricule et site restent du
// ressort de l'administrateur.

export class UpdateMonProfilDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  nom?: string

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  prenom?: string

  @IsOptional()
  @IsEmail({}, { message: 'Adresse e-mail invalide' })
  @MaxLength(200)
  email?: string
}

// ── 2FA (TOTP) ────────────────────────────────────────────────────────────────

export class TotpCodeDto {
  @IsString()
  @Matches(/^\d{6}$/, {
    message: 'Le code doit contenir exactement 6 chiffres.',
  })
  code!: string
}
