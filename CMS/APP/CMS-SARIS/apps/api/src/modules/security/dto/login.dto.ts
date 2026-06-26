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
}
