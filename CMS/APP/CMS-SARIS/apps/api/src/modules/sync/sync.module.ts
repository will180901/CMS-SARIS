import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { SystemeModule } from '../systeme/systeme.module'
import { NotificationModule } from '../notification/notification.module'
import { SyncController } from './sync.controller'
import { SyncReadyController } from './sync-ready.controller'
import { SyncService } from './sync.service'
import { SyncClientService } from './sync-client.service'
import { SyncSupervisionService } from './sync-supervision.service'
import { TombstonePurgeCron } from './tombstone-purge.cron'
import { PortierVidage } from './portier-vidage'

/**
 * SyncModule — moteur de synchronisation offline-first (serveur central).
 * PrismaService est fourni globalement (@Global PrismaModule). SecurityModule apporte
 * JwtAuthGuard + PermissionsGuard.
 */
@Module({
  imports: [SecurityModule, NotificationModule, SystemeModule],
  controllers: [SyncController, SyncReadyController],
  providers: [
    SyncService,
    SyncClientService,
    SyncSupervisionService,
    TombstonePurgeCron,
    PortierVidage,
  ],
  exports: [SyncService, SyncClientService, PortierVidage],
})
export class SyncModule {}
