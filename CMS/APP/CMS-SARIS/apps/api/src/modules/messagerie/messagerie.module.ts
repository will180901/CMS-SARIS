import { Module } from '@nestjs/common'
import { SecurityModule }     from '../security/security.module'
import { NotificationModule } from '../notification/notification.module'
import { MessagerieService }    from './messagerie.service'
import { MessagerieController } from './messagerie.controller'

/**
 * MessagerieModule — messagerie interne chiffrée entre agents.
 * - SecurityModule : JwtAuthGuard + PermissionsGuard (gating messagerie.*).
 * - NotificationModule : émet une notification ciblée à chaque message reçu.
 */
@Module({
  imports:     [SecurityModule, NotificationModule],
  controllers: [MessagerieController],
  providers:   [MessagerieService],
  exports:     [MessagerieService],
})
export class MessagerieModule {}
