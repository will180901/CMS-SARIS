import { IsString, IsNotEmpty, MaxLength, IsOptional } from 'class-validator'

export class LoginDto {
  @IsString()
  @IsNotEmpty({ message: "L'identifiant est requis" })
  @MaxLength(100)
  login: string

  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe est requis' })
  @MaxLength(200)
  password: string

  /** Identifiant du POSTE (backend embarqué desktop). Rempli UNIQUEMENT par la session de
   *  SYNCHRO d'un poste → cette session est EXEMPTÉE de la « session unique ». Absent (web /
   *  login app du desktop) = session interactive soumise à la session unique. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  posteLocalId?: string

  /**
   * Identifiant STABLE de l'appareil, généré et conservé par le client.
   *
   * Sert uniquement à reconnaître une reconnexion depuis le MÊME poste (application
   * relancée, page rechargée) : dans ce cas l'avertissement de double connexion serait
   * du bruit, et un avertissement qu'on clique sans lire ne protège plus personne.
   *
   * Ce n'est PAS un secret et il ne donne aucun droit : le mot de passe reste seul juge.
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  appareilId?: string
}
