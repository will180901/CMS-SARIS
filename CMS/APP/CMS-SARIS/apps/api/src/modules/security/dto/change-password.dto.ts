import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator'

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty({ message: 'Le mot de passe actuel est requis' })
  motDePasseActuel: string

  @IsString()
  @MinLength(8, { message: 'Le nouveau mot de passe doit contenir au moins 8 caractères' })
  @MaxLength(200)
  nouveauMotDePasse: string
}
