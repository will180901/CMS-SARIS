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
}
