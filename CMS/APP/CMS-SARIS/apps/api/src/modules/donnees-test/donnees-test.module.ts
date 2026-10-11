import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { SystemeModule } from '../systeme/systeme.module'
import { DonneesTestController } from './donnees-test.controller'
import { DonneesTestService } from './donnees-test.service'

/**
 * DonneesTestModule — fabriquer puis supprimer des mois d'activité fictive, en mode Test.
 * Ne dépend du reste que par le mode du système : les référentiels, les comptes et le personnel
 * sont LUS, jamais modifiés.
 */
@Module({
  imports: [SecurityModule, SystemeModule],
  controllers: [DonneesTestController],
  providers: [DonneesTestService],
})
export class DonneesTestModule {}
