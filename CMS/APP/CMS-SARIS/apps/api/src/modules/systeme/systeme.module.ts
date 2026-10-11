import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { NotificationModule } from '../notification/notification.module'
import { SystemeController } from './systeme.controller'
import { ModeSystemeService } from './mode-systeme.service'

/**
 * SystemeModule — ce qui concerne le système dans son ensemble, et non un métier : pour l'instant,
 * son MODE (production / test). Le service est exporté : le serveur de synchronisation annonce le
 * mode aux postes dans la réponse de leur battement de vie.
 */
@Module({
  imports: [SecurityModule, NotificationModule],
  controllers: [SystemeController],
  providers: [ModeSystemeService],
  exports: [ModeSystemeService],
})
export class SystemeModule {}
