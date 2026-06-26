import { IsString, IsNotEmpty } from 'class-validator'

export class RefreshDto {
  @IsString()
  @IsNotEmpty({ message: 'Le refresh token est requis' })
  refreshToken: string
}
