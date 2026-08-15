import { IsString, IsNotEmpty } from 'class-validator'

/**
 * Confirmation du SITE DE TRAVAIL, juste après la connexion (web uniquement).
 *
 * Le refresh token identifie la session à faire tourner ; le site est celui que la
 * personne vient de confirmer. Il ne sera jamais écrit sur son compte : il ne vit que
 * le temps de cette session.
 */
export class ConfirmerSiteDto {
  @IsString()
  @IsNotEmpty({ message: 'Le refresh token est requis' })
  refreshToken: string

  @IsString()
  @IsNotEmpty({ message: 'Le site est requis' })
  siteId: string
}
