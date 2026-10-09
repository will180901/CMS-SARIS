import { Module } from '@nestjs/common'
import { PatientController } from './patient.controller'
import { PatientService } from './patient.service'
import { PrismaModule } from '../../prisma/prisma.module'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [PatientController],
  providers: [PatientService],
  exports: [PatientService],
})
export class PatientModule {}
