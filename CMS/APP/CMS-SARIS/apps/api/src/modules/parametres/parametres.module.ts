import { Module } from '@nestjs/common'
import { PrismaModule } from '../../prisma/prisma.module'
import { ParametresService } from './parametres.service'

/**
 * ParametresModule — fournit ParametresService (lecture/écriture des paramètres
 * système + politique de mot de passe). N'a AUCUNE dépendance vers SecurityModule,
 * ce qui permet à SecurityModule de l'importer sans cycle.
 */
@Module({
  imports:   [PrismaModule],
  providers: [ParametresService],
  exports:   [ParametresService],
})
export class ParametresModule {}
