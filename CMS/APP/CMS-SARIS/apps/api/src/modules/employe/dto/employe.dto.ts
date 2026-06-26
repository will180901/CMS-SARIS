import { IsString, IsNotEmpty, IsOptional, IsIn, IsDateString, MaxLength } from 'class-validator'
import { PartialType } from '@nestjs/mapped-types'

const CATEGORIES = ['ASSURE_CDI', 'ASSURE_CDD'] as const

export class CreateEmployeDto {
  @IsString() @IsNotEmpty() @MaxLength(50)  matricule!: string
  @IsString() @IsNotEmpty() @MaxLength(100) nom!: string
  @IsString() @IsNotEmpty() @MaxLength(100) prenom!: string
  @IsOptional() @IsDateString()             dateNaissance?: string
  @IsOptional() @IsIn(['M', 'F'])           sexe?: string
  @IsOptional() @IsString() @MaxLength(100) fonction?: string
  @IsOptional() @IsString() @MaxLength(100) sectionPaie?: string
  @IsOptional() @IsString() @MaxLength(100) service?: string
  @IsOptional() @IsString() @MaxLength(100) departement?: string
  @IsIn(CATEGORIES)                         categorie!: string
}

export class UpdateEmployeDto extends PartialType(CreateEmployeDto) {
  @IsOptional() @IsIn(['ACTIF', 'INACTIF']) statut?: string
}

export class EmployeQueryDto {
  @IsOptional() @IsString()                            search?: string
  @IsOptional() @IsIn([...CATEGORIES, 'TOUS'])         categorie?: string
  @IsOptional() @IsIn(['ACTIF', 'INACTIF', 'TOUS'])    statut?: string
}
