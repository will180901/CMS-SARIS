import { IsString, IsNotEmpty, MaxLength, IsOptional, IsIn } from 'class-validator'

/** Annonce admin diffusée (notification.create — ADMIN_SYSTEME). */
export class CreateAnnonceDto {
  @IsString()
  @IsNotEmpty({ message: 'Le titre est requis' })
  @MaxLength(120)
  titre!: string

  @IsString()
  @IsNotEmpty({ message: 'Le message est requis' })
  @MaxLength(1000)
  message!: string

  @IsOptional()
  @IsIn(['INFO', 'SUCCES', 'AVERTISSEMENT', 'CRITIQUE'])
  niveau?: string

  /** SITE = site de l'admin ; TOUS = tous les sites (système global). */
  @IsOptional()
  @IsIn(['SITE', 'TOUS'])
  portee?: string

  /** Annonce de MISE À JOUR : URL de téléchargement du nouvel installeur (.exe).
   *  Présent → la notification devient une « mise à jour » avec bouton d'installation. */
  @IsOptional()
  @IsString()
  @MaxLength(500)
  lienTelechargement?: string

  /** Version associée à la mise à jour (ex. « 1.4.1 »), affichée à l'utilisateur. */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  version?: string
}
