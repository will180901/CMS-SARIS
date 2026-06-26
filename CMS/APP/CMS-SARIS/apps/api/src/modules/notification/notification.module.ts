import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { SecurityModule } from '../security/security.module'
import { ParametresModule } from '../parametres/parametres.module'
import { NotificationService } from './notification.service'
import { PresenceService } from './presence.service'
import { NotificationPurgeCron } from './notification-purge.cron'
import { NotificationController } from './notification.controller'
import { LiveRefreshInterceptor } from '../../common/interceptors/live-refresh.interceptor'

/**
 * NotificationModule — système de notifications temps réel (cloche + SSE).
 * Exporte NotificationService pour que les modules métier émettent des
 * notifications sur leurs événements CRUD (visite, consultation, ordonnance…).
 * Importe SecurityModule pour JwtAuthGuard + JwtService (auth SSE).
 */
@Module({
  imports:     [SecurityModule, ParametresModule],
  controllers: [NotificationController],
  providers:   [
    NotificationService,
    PresenceService,
    NotificationPurgeCron,
    // Interceptor GLOBAL : rafraîchit en direct les listes des controllers annotés
    // @LiveRefresh(...) ; NO-OP partout ailleurs.
    { provide: APP_INTERCEPTOR, useClass: LiveRefreshInterceptor },
  ],
  exports:     [NotificationService, PresenceService],
})
export class NotificationModule {}
