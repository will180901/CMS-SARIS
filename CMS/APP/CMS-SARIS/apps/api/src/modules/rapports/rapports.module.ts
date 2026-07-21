import { Module } from '@nestjs/common'
import { SecurityModule } from '../security/security.module'
import { DashboardModule } from '../dashboard/dashboard.module'
import { RapportsController } from './rapports.controller'
import { RapportsService } from './rapports.service'

@Module({
  imports: [SecurityModule, DashboardModule],
  controllers: [RapportsController],
  providers: [RapportsService],
})
export class RapportsModule {}
