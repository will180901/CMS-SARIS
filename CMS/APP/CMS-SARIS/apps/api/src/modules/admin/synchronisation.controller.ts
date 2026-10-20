import {
  Controller,
  Post,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { SynchronisationService } from './synchronisation.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'

@Controller('synchronisation')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SynchronisationController {
  constructor(private readonly svc: SynchronisationService) {}

  /** Ré-encrypte la messagerie vers la clé courante (nettoyage après rotation de clé). */
  @Post('messagerie/rechiffrer')
  @RequirePermissions('synchronisation.execute')
  @HttpCode(HttpStatus.OK)
  rechiffrerMessagerie(@Req() req: any) {
    return this.svc.reencrypterMessages(req.user?.id ?? null)
  }
}
