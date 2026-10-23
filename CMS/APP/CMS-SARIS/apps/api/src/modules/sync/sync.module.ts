import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { SecurityModule } from '../security/security.module'
import { SystemeModule } from '../systeme/systeme.module'
import { NotificationModule } from '../notification/notification.module'
import { SyncController } from './sync.controller'
import { SyncReadyController } from './sync-ready.controller'
import { AppairageController, AppairagePosteController } from './appairage.controller'
import { AppairageService } from './appairage.service'
import { SyncService } from './sync.service'
import { SyncClientService } from './sync-client.service'
import { SyncSupervisionService } from './sync-supervision.service'
import { TombstonePurgeCron } from './tombstone-purge.cron'
import { PortierVidage } from './portier-vidage'
import { EcritureLocaleInterceptor } from './ecriture-locale.interceptor'

/**
 * SyncModule — moteur de synchronisation offline-first (serveur central).
 * PrismaService est fourni globalement (@Global PrismaModule). SecurityModule apporte
 * JwtAuthGuard + PermissionsGuard.
 */
@Module({
  imports: [SecurityModule, NotificationModule, SystemeModule],
  controllers: [
    SyncController,
    SyncReadyController,
    AppairageController,
    AppairagePosteController,
  ],
  providers: [
    SyncService,
    SyncClientService,
    SyncSupervisionService,
    AppairageService,
    TombstonePurgeCron,
    PortierVidage,
    // Poste de bureau : le travail écrit ici part vers le central dans les secondes qui suivent.
    { provide: APP_INTERCEPTOR, useClass: EcritureLocaleInterceptor },
  ],
  exports: [SyncService, SyncClientService, PortierVidage],
})
export class SyncModule {}
