import {
  Controller, Get, Post, Param, Req, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { SynchronisationService } from './synchronisation.service'
import { JwtAuthGuard }           from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }       from '../security/guards/permissions.guard'
import { RequirePermissions }     from '../../common/decorators/require-permissions.decorator'

@Controller('synchronisation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SynchronisationController {
  constructor(private readonly svc: SynchronisationService) {}

  @Get('status')
  @RequirePermissions('synchronisation.read')
  status() {
    return this.svc.getStatus()
  }

  @Get('sauvegardes')
  @RequirePermissions('synchronisation.read')
  sauvegardes() {
    return this.svc.findSauvegardes()
  }

  @Post('sauvegardes/manuelle')
  @RequirePermissions('synchronisation.execute')
  @HttpCode(HttpStatus.OK)
  declencher(@Req() req: any) {
    return this.svc.declencherSauvegarde(req.user?.id ?? null, 'MANUELLE')
  }

  @Post('sauvegardes/:id/restaurer')
  @RequirePermissions('synchronisation.restore')
  @HttpCode(HttpStatus.OK)
  restaurer(@Param('id') id: string, @Req() req: any) {
    return this.svc.restaurerSauvegarde(id, req.user?.id ?? null)
  }

  /** Ré-encrypte la messagerie vers la clé courante (nettoyage après rotation de clé). */
  @Post('messagerie/rechiffrer')
  @RequirePermissions('synchronisation.execute')
  @HttpCode(HttpStatus.OK)
  rechiffrerMessagerie(@Req() req: any) {
    return this.svc.reencrypterMessages(req.user?.id ?? null)
  }
}
