import {
  IsString, IsEmail, IsOptional, IsUUID, IsArray, IsIn,
  Length, Matches, ArrayMinSize, MaxLength,
} from 'class-validator'

// La politique de mot de passe (longueur, complexité) est désormais DYNAMIQUE :
// appliquée côté service via ParametresService.assertPasswordValid() à partir des
// paramètres système live. Les DTOs ne valident plus que la forme de base.

// ── Créer un utilisateur ──────────────────────────────────────────────────────

export class CreateUtilisateurDto {
  @IsString()
  @Length(3, 32)
  @Matches(/^[a-z][a-z0-9._-]*$/i, { message: 'Login : lettres, chiffres et . _ - uniquement' })
  login!: string

  @IsEmail()
  email!: string

  @IsString()
  @MaxLength(200)
  motDePasseInitial!: string

  @IsUUID()
  siteId!: string

  @IsOptional()
  @IsUUID()
  personnelMedicalId?: string | null

  // Identité de la fiche clinique créée EN MÊME TEMPS que le compte (modèle du
  // recueil : on gère des comptes, plus de répertoire de personnel séparé). Requis
  // pour un compte de rôle clinique (MEDECIN_CHEF / INFIRMIER) sans personnelMedicalId
  // existant — le backend crée alors la fiche PersonnelMedical et la lie au compte.
  @IsOptional()
  @IsString()
  @Length(2, 100)
  nom?: string

  @IsOptional()
  @IsString()
  @Length(2, 100)
  prenom?: string

  @IsOptional()
  @IsString()
  @Length(2, 50)
  matricule?: string

  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un rôle est requis' })
  @IsUUID('all', { each: true })
  roleIds!: string[]
}

// ── Modifier un utilisateur (sans mot de passe) ──────────────────────────────

export class UpdateUtilisateurDto {
  @IsOptional()
  @IsEmail()
  email?: string

  @IsOptional()
  @IsUUID()
  siteId?: string

  @IsOptional()
  @IsUUID()
  personnelMedicalId?: string | null
}

// ── Changer les rôles d'un utilisateur ───────────────────────────────────────

export class SetRolesDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Au moins un rôle est requis' })
  @IsUUID('all', { each: true })
  roleIds!: string[]
}

// ── Statut du compte ─────────────────────────────────────────────────────────

export class SetStatutDto {
  @IsIn(['ACTIF', 'DESACTIVE', 'BLOQUE'])
  statut!: 'ACTIF' | 'DESACTIVE' | 'BLOQUE'

  @IsOptional()
  @IsString()
  motif?: string
}

// ── Réinitialisation du mot de passe (admin) ─────────────────────────────────

export class ResetPasswordDto {
  @IsString()
  @MaxLength(200)
  nouveauMotDePasse!: string

  @IsOptional()
  forcerChangement?: boolean
}

// ── Filtres de liste ─────────────────────────────────────────────────────────

export class UtilisateurQueryDto {
  @IsOptional()
  @IsString()
  search?: string

  @IsOptional()
  @IsIn(['ACTIF', 'DESACTIVE', 'BLOQUE'])
  statut?: string

  @IsOptional()
  @IsUUID()
  siteId?: string

  @IsOptional()
  @IsUUID()
  roleId?: string
}
