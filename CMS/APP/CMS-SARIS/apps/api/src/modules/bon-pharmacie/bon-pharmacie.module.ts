import { Module } from '@nestjs/common'
import { SecurityModule }         from '../security/security.module'
import { BonPharmacieController }  from './bon-pharmacie.controller'
import { BonPharmacieService }     from './bon-pharmacie.service'

@Module({
  imports:     [SecurityModule],
  controllers: [BonPharmacieController],
  providers:   [BonPharmacieService],
  exports:     [BonPharmacieService],
})
export class BonPharmacieModule {}
