import { IsString, IsNotEmpty, IsOptional, IsBoolean, MaxLength } from 'class-validator'
import { Transform } from 'class-transformer'
import { PartialType } from '@nestjs/mapped-types'

export class CreatePathologieDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(30)
  code: string

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  libelle: string

  @IsOptional()
  // ⚠️ PAS de `@Type(() => Boolean)` : `Boolean("false") === true` → il INVERSAIT la valeur.
  // On ne mappe QUE les vrais booléens et les chaînes "true"/"false" ; tout autre type
  // reste tel quel → `@IsBoolean()` le rejette (400) au lieu d'une coercion silencieuse.
  @Transform(({ obj }) => {
    // Lire la valeur BRUTE (`obj.chronique`) et NON `value` : le ValidationPipe global a
    // `enableImplicitConversion` qui coerce `value` AVANT ce transform (Boolean("false")
    // === true). `obj` reste l'entrée JSON d'origine, donc on mappe correctement et on
    // laisse tout autre type tel quel pour que `@IsBoolean()` le rejette (400).
    const raw = (obj as { chronique?: unknown }).chronique
    return raw === true || raw === 'true'
      ? true
      : raw === false || raw === 'false'
        ? false
        : raw
  })
  @IsBoolean()
  chronique?: boolean
}

// SÉCURITÉ : `statut` retiré — toggle via /pathologies/:id/statut (referentiel.delete).
export class UpdatePathologieDto extends PartialType(CreatePathologieDto) {}
