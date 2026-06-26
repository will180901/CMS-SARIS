import { Module } from '@nestjs/common'
import { SecurityModule }     from '../security/security.module'
import { EmployeController }   from './employe.controller'
import { EmployeService }      from './employe.service'

@Module({
  imports:     [SecurityModule],
  controllers: [EmployeController],
  providers:   [EmployeService],
  exports:     [EmployeService],   // utilisé par PatientService (enregistrement dynamique)
})
export class EmployeModule {}
