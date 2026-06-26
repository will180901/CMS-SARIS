/**
 * MeController — /me : gestion de SON propre compte (utilisateur connecté).
 *
 * Aucune permission requise (hors authentification) : self-service.
 *   - /me/preferences         GET / PUT
 *   - /me/sessions            GET ; /me/sessions/:id DELETE ; /me/sessions/revoke-others POST
 *   - /me/totp                GET (statut) ; setup / activate / disable POST
 */

import {
  Controller, Get, Put, Post, Delete, Body, Param, Req,
  UseGuards, HttpCode, HttpStatus,
} from '@nestjs/common'
import { MeService } from './me.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { UpdatePreferencesDto, TotpCodeDto } from './dto/me.dto'

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly svc: MeService) {}

  // ── Préférences ───────────────────────────────────────────────────────────
  @Get('preferences')
  getPreferences(@Req() req: any) {
    return this.svc.getPreferences(req.user.id)
  }

  @Put('preferences')
  updatePreferences(@Body() dto: UpdatePreferencesDto, @Req() req: any) {
    return this.svc.updatePreferences(req.user.id, dto)
  }

  // ── Conditions d'utilisation ──────────────────────────────────────────────
  @Post('cgu/accepter')
  @HttpCode(HttpStatus.OK)
  accepterCgu(@Req() req: any) {
    return this.svc.accepterCgu(req.user.id)
  }

  // ── Sessions ──────────────────────────────────────────────────────────────
  @Get('sessions')
  listSessions(@Req() req: any) {
    return this.svc.listSessions(req.user.id, req.user.sid ?? null)
  }

  @Post('sessions/revoke-others')
  @HttpCode(HttpStatus.OK)
  revokeOthers(@Req() req: any) {
    return this.svc.revokeOtherSessions(req.user.id, req.user.sid ?? null)
  }

  @Delete('sessions/:id')
  revokeSession(@Param('id') id: string, @Req() req: any) {
    return this.svc.revokeSession(req.user.id, id, req.user.sid ?? null)
  }

  // ── 2FA (TOTP) ────────────────────────────────────────────────────────────
  @Get('totp')
  totpStatus(@Req() req: any) {
    return this.svc.totpStatus(req.user.id)
  }

  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  totpSetup(@Req() req: any) {
    return this.svc.totpSetup(req.user.id)
  }

  @Post('totp/activate')
  @HttpCode(HttpStatus.OK)
  totpActivate(@Body() dto: TotpCodeDto, @Req() req: any) {
    return this.svc.totpActivate(req.user.id, dto.code)
  }

  @Post('totp/disable')
  @HttpCode(HttpStatus.OK)
  totpDisable(@Body() dto: TotpCodeDto, @Req() req: any) {
    return this.svc.totpDisable(req.user.id, dto.code)
  }
}
