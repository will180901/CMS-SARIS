import { Module } from '@nestjs/common'
import { SecurityModule }      from '../security/security.module'
import { DashboardController } from './dashboard.controller'
import { DashboardService }    from './dashboard.service'

@Module({
  imports:     [SecurityModule],
  controllers: [DashboardController],
  providers:   [DashboardService],
})
export class DashboardModule {}
