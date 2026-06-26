import { Module }                  from '@nestjs/common'
import { ConsultationController }  from './consultation.controller'
import { ConsultationService }     from './consultation.service'
import { PrismaModule }            from '../../prisma/prisma.module'
import { NotificationModule }      from '../notification/notification.module'

@Module({
  imports:     [PrismaModule, NotificationModule],
  controllers: [ConsultationController],
  providers:   [ConsultationService],
  exports:     [ConsultationService],
})
export class ConsultationModule {}
