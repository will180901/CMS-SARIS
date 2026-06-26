import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { NotificationModule } from '../notification/notification.module'
import { SyncController } from './sync.controller'
import { SyncReadyController } from './sync-ready.controller'
import { SyncService } from './sync.service'
import { SyncClientService } from './sync-client.service'
import { SyncSupervisionService } from './sync-supervision.service'
import { TombstonePurgeCron } from './tombstone-purge.cron'

/**
 * SyncModule — moteur de synchronisation offline-first (serveur central).
 * PrismaService est fourni globalement (@Global PrismaModule). SecurityModule apporte
 * JwtAuthGuard + PermissionsGuard.
 */
@Module({
  imports: [SecurityModule, NotificationModule],
  controllers: [SyncController, SyncReadyController],
  providers: [SyncService, SyncClientService, SyncSupervisionService, TombstonePurgeCron],
  exports: [SyncService, SyncClientService],
})
export class SyncModule {}
