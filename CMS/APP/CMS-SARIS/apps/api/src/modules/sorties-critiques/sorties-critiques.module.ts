import { Module } from '@nestjs/common'
import { SecurityModule }              from '../security/security.module'
import { NotificationModule }          from '../notification/notification.module'
import { SortiesCritiquesService }     from './sorties-critiques.service'
import { EvacuationsController } from './sorties-critiques.controller'

@Module({
  imports:     [SecurityModule, NotificationModule],
  controllers: [EvacuationsController],
  providers:   [SortiesCritiquesService],
  exports:     [SortiesCritiquesService],
})
export class SortiesCritiquesModule {}
