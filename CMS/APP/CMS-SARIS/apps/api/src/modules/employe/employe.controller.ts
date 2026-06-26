/**
 * EmployeController — /employes (registre des employés SARIS).
 */
import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { EmployeService }       from './employe.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'
import { LiveRefresh }          from '../../common/decorators/live-refresh.decorator'
import { Audit }                from '../../common/decorators/audit.decorator'
import { CreateEmployeDto, UpdateEmployeDto, EmployeQueryDto } from './dto/employe.dto'

@Controller('employes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@LiveRefresh('LIVE_EMPLOYES')
@Audit('employe', 'Employé SARIS')
export class EmployeController {
  constructor(private readonly svc: EmployeService) {}

  @Get()
  @RequirePermissions('employe.read')
  findAll(@Query() query: EmployeQueryDto) {
    return this.svc.findAll(query)
  }

  // Reconnaissance dynamique à l'accueil — renvoie l'employé ou null (200, jamais 404).
  @Get('lookup/:matricule')
  @RequirePermissions('employe.read')
  lookup(@Param('matricule') matricule: string) {
    return this.svc.findByMatricule(matricule)
  }

  @Post()
  @RequirePermissions('employe.create')
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEmployeDto) {
    return this.svc.create(dto)
  }

  @Patch(':id')
  @RequirePermissions('employe.update')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeDto) {
    return this.svc.update(id, dto)
  }

  @Delete(':id')
  @RequirePermissions('employe.delete')
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string) {
    return this.svc.delete(id)
  }
}
