import { IsString, IsArray, Length, Matches, ArrayMinSize } from 'class-validator'

export class CreateRoleDto {
  @IsString()
  @Length(3, 32)
  @Matches(/^[A-Z][A-Z0-9_]*$/, { message: 'Code : UPPER_CASE_SNAKE uniquement' })
  code!: string

  @IsString()
  @Length(2, 100)
  libelle!: string

  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  permissions!: string[]   // codes de permissions
}

export class UpdateRoleDto {
  @IsString()
  @Length(2, 100)
  libelle!: string

  @IsArray()
  @ArrayMinSize(0)
  @IsString({ each: true })
  permissions!: string[]
}
