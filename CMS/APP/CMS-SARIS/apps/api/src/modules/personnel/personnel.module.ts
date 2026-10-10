import { Module } from '@nestjs/common'
import { PersonnelController } from './personnel.controller'
import { DelegationsController } from './delegations.controller'
import { SousTraitantsController } from './sous-traitants.controller'
import { PersonnelService } from './personnel.service'
import { PrismaModule } from '../../prisma/prisma.module'

@Module({
  // Le dossier patient d'un membre du personnel ne s'ouvre pas ici mais à l'accueil
  // (PatientService.ouvrirDossierPersonnel), à son premier passage.
  imports: [PrismaModule],
  controllers: [
    PersonnelController,
    DelegationsController,
    SousTraitantsController,
  ],
  providers: [PersonnelService],
  exports: [PersonnelService],
})
export class PersonnelModule {}
