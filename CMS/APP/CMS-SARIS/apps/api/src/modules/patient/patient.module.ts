import { Module, forwardRef } from '@nestjs/common'
import { PatientController } from './patient.controller'
import { PatientService }    from './patient.service'
import { PrismaModule }      from '../../prisma/prisma.module'
import { NotificationModule } from '../notification/notification.module'
import { EmployeModule }      from '../employe/employe.module'

@Module({
  // forwardRef : voir le commentaire symétrique dans EmployeModule.
  imports:     [PrismaModule, NotificationModule, forwardRef(() => EmployeModule)],
  controllers: [PatientController],
  providers:   [PatientService],
  exports:     [PatientService],
})
export class PatientModule {}
