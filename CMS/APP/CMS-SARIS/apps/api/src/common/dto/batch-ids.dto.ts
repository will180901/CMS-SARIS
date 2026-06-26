import { IsArray, ArrayMaxSize, IsUUID } from 'class-validator'

/**
 * DTO partagé pour les opérations EN LOT sur des identifiants (suppression /
 * masquage multiple…). Valide que `ids` est bien un tableau d'UUID et borne la
 * taille du lot (garde-fou anti-DoS), au lieu d'accepter un `{ ids?: string[] }`
 * inline non validé par la ValidationPipe globale.
 */
export class BatchIdsDto {
  @IsArray()
  @ArrayMaxSize(500)
  @IsUUID('all', { each: true })
  ids!: string[]
}
