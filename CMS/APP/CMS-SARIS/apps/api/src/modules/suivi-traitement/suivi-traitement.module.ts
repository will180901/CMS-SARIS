import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { NotificationModule } from '../notification/notification.module'
import { SuiviTraitementService } from './suivi-traitement.service'
import { SuiviTraitementController } from './suivi-traitement.controller'

@Module({
  imports: [SecurityModule, NotificationModule],
  controllers: [SuiviTraitementController],
  providers: [SuiviTraitementService],
  exports: [SuiviTraitementService],
})
export class SuiviTraitementModule {}
