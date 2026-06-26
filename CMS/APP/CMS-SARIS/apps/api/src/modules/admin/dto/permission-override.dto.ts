import {
  IsArray, IsOptional, IsString, IsUUID, IsIn, ArrayMinSize, MaxLength,
} from 'class-validator'

// ── Remplacer l'ensemble des dérogations d'UN utilisateur (PUT idempotent) ────
// On envoie l'état complet souhaité : la liste des permissions accordées en plus
// (grants) et la liste des permissions retirées (revokes). L'API efface les
// dérogations existantes et recrée celles-ci.

export class SetPermissionOverridesDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  grants?: string[]

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  revokes?: string[]

  @IsOptional()
  @IsString()
  @MaxLength(280)
  motif?: string
}

// ── Appliquer UNE dérogation à PLUSIEURS utilisateurs (assignation groupée) ───
//   - GRANT  : accorde la permission à chaque utilisateur ciblé
//   - REVOKE : retire la permission à chaque utilisateur ciblé
//   - RESET  : supprime toute dérogation existante (retour au comportement du rôle)

export class BulkPermissionDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Sélectionnez au moins un utilisateur' })
  @IsUUID('all', { each: true })
  utilisateurIds!: string[]

  @IsString()
  code!: string

  @IsIn(['GRANT', 'REVOKE', 'RESET'])
  mode!: 'GRANT' | 'REVOKE' | 'RESET'

  @IsOptional()
  @IsString()
  @MaxLength(280)
  motif?: string
}
