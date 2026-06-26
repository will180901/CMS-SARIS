import {
  Controller, Get, Patch, Post, Body, Param, Req,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { IsString, MaxLength } from 'class-validator'
import { ParametresService }    from '../parametres/parametres.service'
import { JwtAuthGuard }         from '../security/guards/jwt-auth.guard'
import { PermissionsGuard }     from '../security/guards/permissions.guard'
import { RequirePermissions }   from '../../common/decorators/require-permissions.decorator'

export class UpdateParametreDto {
  @IsString()
  @MaxLength(200) // aligné sur la validation du service (texte ≤ 200)
  valeur!: string
}

@Controller('admin/parametres')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ParametresController {
  constructor(private readonly svc: ParametresService) {}

  @Get()
  @RequirePermissions('parametre.read')
  findAll() {
    return this.svc.findAll()
  }

  @Patch(':cle')
  @RequirePermissions('parametre.update')
  update(@Param('cle') cle: string, @Body() dto: UpdateParametreDto, @Req() req: any) {
    return this.svc.update(cle, dto.valeur, req.user?.id ?? null)
  }

  @Post(':cle/reset')
  @RequirePermissions('parametre.update')
  @HttpCode(HttpStatus.OK)
  reset(@Param('cle') cle: string, @Req() req: any) {
    return this.svc.reset(cle, req.user?.id ?? null)
  }
}
