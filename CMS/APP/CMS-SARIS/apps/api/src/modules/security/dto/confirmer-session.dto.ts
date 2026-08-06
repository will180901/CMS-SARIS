import { IsIn, IsNotEmpty, IsString } from 'class-validator'

/**
 * Deuxième temps de la connexion quand une session est déjà ouverte AILLEURS.
 *
 * Le mot de passe (et le code TOTP le cas échéant) ont déjà été validés : `tempToken`
 * en fait foi. Rien n'est donc redemandé ici — on ne fait que trancher ce qu'il advient
 * de l'autre session.
 */
export class ConfirmerSessionDto {
  @IsString()
  @IsNotEmpty({ message: 'Le token temporaire est requis' })
  tempToken: string

  /**
   * `REMPLACER` — « c'était moi » : on ferme l'autre session et on ouvre celle-ci.
   * `SIGNALER`  — « ce n'est pas moi » : on ne connecte PAS. On ferme TOUTES les
   *               sessions applicatives, on trace un événement de sécurité et on
   *               alerte les administrateurs. Entrer dans un compte que l'on croit
   *               compromis serait la mauvaise réaction : il faut le refermer.
   */
  @IsIn(['REMPLACER', 'SIGNALER'])
  action: 'REMPLACER' | 'SIGNALER'
}
