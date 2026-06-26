import { Global, Module } from '@nestjs/common'
import { PrismaService } from './prisma.service'

/**
 * PrismaModule — module global qui expose PrismaService.
 *
 * @Global() : PrismaService est disponible dans tous les modules
 * sans avoir à ré-importer PrismaModule partout.
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
