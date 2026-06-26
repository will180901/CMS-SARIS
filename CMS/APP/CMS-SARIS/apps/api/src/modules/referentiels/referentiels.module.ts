import { Module } from '@nestjs/common'
import { ReferentielsController } from './referentiels.controller'
import { ReferentielsService }    from './referentiels.service'
import { SecurityModule }         from '../security/security.module'

@Module({
  imports:     [SecurityModule], // JwtAuthGuard + PermissionsGuard
  controllers: [ReferentielsController],
  providers:   [ReferentielsService],
  exports:     [ReferentielsService],
})
export class ReferentielsModule {}
