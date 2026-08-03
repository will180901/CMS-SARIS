import { Module } from '@nestjs/common'
import { PersonnelController } from './personnel.controller'
import { DelegationsController } from './delegations.controller'
import { SousTraitantsController } from './sous-traitants.controller'
import { PersonnelService } from './personnel.service'
import { PrismaModule } from '../../prisma/prisma.module'
import { PatientModule } from '../patient/patient.module'

@Module({
  // PatientService sert ici à ouvrir le dossier d'un membre du personnel.
  // Dépendance simple : PatientModule ne dépend pas de ce module en retour.
  imports: [PrismaModule, PatientModule],
  controllers: [
    PersonnelController,
    DelegationsController,
    SousTraitantsController,
  ],
  providers: [PersonnelService],
  exports: [PersonnelService],
})
export class PersonnelModule {}
