import {
  Controller, Get, Query, UseGuards,
} from '@nestjs/common'
import { AuditService }         from './audit.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'

@Controller('admin/audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private readonly svc: AuditService) {}

  @Get('actions')
  @RequirePermissions('audit.read')
  audit(
    @Query('module')        module?:        string,
    @Query('action')        action?:        string,
    @Query('utilisateurId') utilisateurId?: string,
    @Query('entiteType')    entiteType?:    string,
    @Query('entiteId')      entiteId?:      string,
    @Query('dateMin')       dateMin?:       string,
    @Query('dateMax')       dateMax?:       string,
    @Query('limit')         limit?:         string,
  ) {
    return this.svc.findAudit({
      module, action, utilisateurId, entiteType, entiteId,
      dateMin, dateMax, limit: limit && Number.isFinite(Number(limit)) ? Number(limit) : undefined,
    })
  }

  @Get('authentifications')
  @RequirePermissions('audit.read')
  auth(
    @Query('utilisateurId') utilisateurId?: string,
    @Query('resultat')      resultat?:      string,
    @Query('dateMin')       dateMin?:       string,
    @Query('dateMax')       dateMax?:       string,
    @Query('limit')         limit?:         string,
  ) {
    return this.svc.findAuth({
      utilisateurId, resultat, dateMin, dateMax,
      limit: limit && Number.isFinite(Number(limit)) ? Number(limit) : undefined,
    })
  }
}
