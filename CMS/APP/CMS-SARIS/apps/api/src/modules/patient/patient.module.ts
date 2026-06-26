import { Module }            from '@nestjs/common'
import { PatientController } from './patient.controller'
import { PatientService }    from './patient.service'
import { PrismaModule }      from '../../prisma/prisma.module'
import { NotificationModule } from '../notification/notification.module'
import { EmployeModule }      from '../employe/employe.module'

@Module({
  imports:     [PrismaModule, NotificationModule, EmployeModule],
  controllers: [PatientController],
  providers:   [PatientService],
  exports:     [PatientService],
})
export class PatientModule {}
