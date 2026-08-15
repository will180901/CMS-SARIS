import {
  Controller, Get, Delete, Query, Req, UseGuards, HttpCode, HttpStatus,
  BadRequestException,
} from '@nestjs/common'
import { AuditService, type PortailPurge } from './audit.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get('actions')
  @RequirePermissions('audit.read')
  audit(
    @Query('module') module?: string,
    @Query('action') action?: string,
    @Query('utilisateurId') utilisateurId?: string,
    @Query('entiteType') entiteType?: string,
    @Query('entiteId') entiteId?: string,
    @Query('dateMin') dateMin?: string,
    @Query('dateMax') dateMax?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAudit({
      module,
      action,
      utilisateurId,
      entiteType,
      entiteId,
      dateMin,
      dateMax,
      limit:
        limit && Number.isFinite(Number(limit)) ? Number(limit) : undefined,
    })
  }

  @Get('authentifications')
  @RequirePermissions('audit.read')
  auth(
    @Query('utilisateurId') utilisateurId?: string,
    @Query('resultat') resultat?: string,
    @Query('dateMin') dateMin?: string,
    @Query('dateMax') dateMax?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.findAuth({
      utilisateurId,
      resultat,
      dateMin,
      dateMax,
      limit:
        limit && Number.isFinite(Number(limit)) ? Number(limit) : undefined,
    })
  }

  /**
   * Vide les journaux. Sous `audit.purge` et NON `audit.read` : consulter des traces
   * et les effacer ne sont pas le même pouvoir. La purge se journalise elle-même,
   * de sorte qu'il reste toujours trace de qui a effacé quoi, et quand.
   */
  @Delete()
  @RequirePermissions('audit.purge')
  @HttpCode(HttpStatus.OK)
  purger(@Req() req: any, @Query('portee') portee?: string) {
    const p = (portee ?? 'tout') as PortailPurge
    if (p !== 'actions' && p !== 'authentifications' && p !== 'tout') {
      throw new BadRequestException('Portée de purge inconnue')
    }
    return this.svc.purger(p, req.user?.id ?? null)
  }
}
