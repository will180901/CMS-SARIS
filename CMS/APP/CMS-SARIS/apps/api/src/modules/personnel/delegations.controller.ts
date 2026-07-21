import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common'
import { PersonnelService } from './personnel.service'
import { JwtAuthGuard } from '../security/guards/jwt-auth.guard'
import { PermissionsGuard } from '../security/guards/permissions.guard'
import { RequirePermissions } from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh } from '../../common/decorators/live-refresh.decorator'
import { Audit } from '../../common/decorators/audit.decorator'
import {
  CreateDelegationDto,
  UpdateDelegationDto,
  ToggleDelegationStatutDto,
} from './dto/delegation.dto'

interface AuthedRequest {
  user?: { personnelMedicalId?: string | null }
}

/**
 * DelegationsController — /delegations
 */
@Controller('delegations')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_ACTEURS')
@Audit('delegation', 'Délégation')
export class DelegationsController {
  constructor(private readonly svc: PersonnelService) {}

  // Placé AVANT @Get(':id') pour que « mine » ne soit pas capturé comme :id (même piège que
  // consultation.controller.ts:patientDocuments). Sans @RequirePermissions : accès libre à
  // tout utilisateur authentifié pour consulter SA PROPRE situation.
  @Get('mine/active')
  mine(@Req() req: AuthedRequest) {
    return this.svc.findMyActiveDelegation(req.user?.personnelMedicalId ?? null)
  }

  @Get()
  @RequirePermissions('delegation.read')
  findAll() {
    return this.svc.findAllDelegations()
  }

  @Get(':id')
  @RequirePermissions('delegation.read')
  findOne(@Param('id') id: string) {
    return this.svc.findDelegationById(id)
  }

  @Post()
  @RequirePermissions('delegation.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateDelegationDto) {
    return this.svc.createDelegation(dto)
  }

  @Patch(':id')
  @RequirePermissions('delegation.update')
  update(@Param('id') id: string, @Body() dto: UpdateDelegationDto) {
    return this.svc.updateDelegation(id, dto)
  }

  @Patch(':id/statut')
  @RequirePermissions('delegation.revoke')
  toggleStatut(
    @Param('id') id: string,
    @Body() dto: ToggleDelegationStatutDto,
  ) {
    return this.svc.toggleDelegationStatut(id, dto.statut)
  }

  @Delete(':id')
  @RequirePermissions('delegation.delete')
  remove(@Param('id') id: string) {
    return this.svc.deleteDelegation(id)
  }
}
