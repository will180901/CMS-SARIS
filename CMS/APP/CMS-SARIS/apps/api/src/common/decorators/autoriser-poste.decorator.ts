import { SetMetadata } from '@nestjs/common'

/**
 * @AutoriserPoste() — la route accepte le jeton d'un POSTE DE BUREAU appairé (cf. CodeAppairage).
 *
 * Un jeton de poste n'est pas celui d'une personne : il ne sert qu'à la synchronisation. `JwtAuthGuard` le REFUSE
 * partout, sauf sur les routes marquées ainsi — c'est une liste blanche, pas une liste noire : une route ajoutée
 * demain ne lui est jamais ouverte par oubli.
 */
export const AUTORISER_POSTE_KEY = 'autoriser-poste'
export const AutoriserPoste = () => SetMetadata(AUTORISER_POSTE_KEY, true)
