import { Module } from '@nestjs/common'
import { NotificationModule } from '../notification/notification.module'
import { SecurityModule } from '../security/security.module'
import { SyncModule } from '../sync/sync.module'
import { SystemeModule } from '../systeme/systeme.module'
import { DonneesTestController } from './donnees-test.controller'
import { DonneesTestService } from './donnees-test.service'
import { VidageController } from './vidage.controller'
import { VidageService } from './vidage.service'

/**
 * DonneesTestModule — fabriquer puis supprimer des mois d'activité fictive, en mode Test ; et vider
 * d'un geste toutes les données métier du centre à la mise en service.
 * Ne dépend du reste que par le mode du système (et, pour le vidage, par le portier des envois des
 * postes) : les référentiels, les comptes et le personnel sont LUS, jamais modifiés.
 */
@Module({
  imports: [SecurityModule, SystemeModule, SyncModule, NotificationModule],
  controllers: [DonneesTestController, VidageController],
  providers: [DonneesTestService, VidageService],
})
export class DonneesTestModule {}
