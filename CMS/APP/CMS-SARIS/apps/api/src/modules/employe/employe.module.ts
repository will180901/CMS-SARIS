import { Module, forwardRef } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { PatientModule } from '../patient/patient.module'
import { EmployeController } from './employe.controller'
import { EmployeService } from './employe.service'

@Module({
  // forwardRef : dépendance circulaire assumée avec PatientModule — PatientService
  // utilise EmployeService (enregistrement dynamique) ET EmployeService utilise
  // PatientService (dossier auto-créé), chacun dans un sens différent du flux.
  imports: [SecurityModule, forwardRef(() => PatientModule)],
  controllers: [EmployeController],
  providers: [EmployeService],
  exports: [EmployeService], // utilisé par PatientService (enregistrement dynamique)
})
export class EmployeModule {}
