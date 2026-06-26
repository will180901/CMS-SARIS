import { Module }           from '@nestjs/common'
import { TriageController } from './triage.controller'
import { TriageService }    from './triage.service'
import { PrismaModule }     from '../../prisma/prisma.module'
import { NotificationModule } from '../notification/notification.module'

@Module({
  imports:     [PrismaModule, NotificationModule],
  controllers: [TriageController],
  providers:   [TriageService],
  exports:     [TriageService],
})
export class TriageModule {}
