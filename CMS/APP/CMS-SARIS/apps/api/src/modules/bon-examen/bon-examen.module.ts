import { Module } from '@nestjs/common'
import { SecurityModule }       from '../security/security.module'
import { BonExamenController }  from './bon-examen.controller'
import { BonExamenService }     from './bon-examen.service'

@Module({
  imports:     [SecurityModule],
  controllers: [BonExamenController],
  providers:   [BonExamenService],
  exports:     [BonExamenService],
})
export class BonExamenModule {}
