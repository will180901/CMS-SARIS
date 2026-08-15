import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Ip,
  Headers,
  UseGuards,
} from '@nestjs/common'
import { Throttle } from '@nestjs/throttler'
import { SecurityService } from './security.service'
import { JwtAuthGuard } from './guards/jwt-auth.guard'
import { CurrentUser } from '../../common/decorators/current-user.decorator'
import { LoginDto } from './dto/login.dto'
import { TotpVerifyDto } from './dto/totp-verify.dto'
import { RefreshDto } from './dto/refresh.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ConfirmerSessionDto } from './dto/confirmer-session.dto'
import { ConfirmerSiteDto } from './dto/confirmer-site.dto'
import type { UserSession } from '@cms-saris/types'

/**
 * SecurityController — endpoints d'authentification publics.
 *
 * Routes :
 *   POST /auth/login        → login/password → JWT final ou tempToken TOTP
 *   POST /auth/totp/verify  → code TOTP + tempToken → JWT final
 */
@Controller('auth')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  /**
   * POST /auth/login
   *
   * Corps : { login: string, password: string }
   *
   * Réponse si TOTP désactivé :
   *   { requireTotp: false, accessToken, refreshToken, user }
   *
   * Réponse si TOTP activé :
   *   { requireTotp: true, tempToken }  ← à passer à /auth/totp/verify
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // anti brute-force : 10 tentatives/min/IP (ThrottlerGuard global, cf. app.module.ts)
  login(
    @Body() dto: LoginDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.securityService.login(dto, ip, userAgent)
  }

  /**
   * POST /auth/totp/verify
   *
   * Corps : { code: string (6 chiffres), tempToken: string }
   *
   * Réponse :
   *   { accessToken, refreshToken, user }
   */
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // anti brute-force du code TOTP (ThrottlerGuard global, cf. app.module.ts)
  verifyTotp(
    @Body() dto: TotpVerifyDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.securityService.verifyTotp(dto, ip, userAgent)
  }

  /**
   * POST /auth/session/confirmer
   *
   * 2e temps de la connexion quand une session tourne déjà sur un AUTRE appareil.
   * Le mot de passe (et le code TOTP le cas échéant) sont déjà validés : `tempToken`
   * en fait foi et vaut 5 minutes.
   *
   * Corps : { tempToken, action: 'REMPLACER' | 'SIGNALER' }
   * Réponse : { accessToken, refreshToken, user }  |  { signale: true }
   */
  @Post('session/confirmer')
  @HttpCode(HttpStatus.OK)
  // Même plafond que le TOTP : le token est court, mais on ne laisse pas marteler
  // l'endpoint qui ferme des sessions.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  confirmerSession(
    @Body() dto: ConfirmerSessionDto,
    @Ip() ip: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.securityService.confirmerSession(dto, ip, userAgent)
  }

  /**
   * POST /auth/site/confirmer
   *
   * Corps : { refreshToken: string, siteId: string }
   *
   * Confirme le SITE DE TRAVAIL de la session, juste après la connexion (web). Le site
   * n'est jamais écrit sur le compte : il ne vit que le temps de la session, porté par
   * les jetons. Réponse identique à /auth/refresh (jetons + utilisateur).
   *
   * Non protégé par JwtAuthGuard, comme /auth/refresh : c'est le refresh token qui fait
   * foi, et le jeton d'accès peut déjà être en cours de remplacement à cet instant.
   */
  @Post('site/confirmer')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  confirmerSite(@Body() dto: ConfirmerSiteDto) {
    return this.securityService.confirmerSite(dto)
  }

  /**
   * POST /auth/refresh
   *
   * Corps : { refreshToken: string }
   *
   * Réponse :
   *   { accessToken, refreshToken, user }
   *
   * Rotation : l'ancien refresh token est révoqué, un nouveau est émis.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  refresh(@Body() dto: RefreshDto) {
    return this.securityService.refresh(dto)
  }

  /**
   * POST /auth/change-password  🔒 JWT requis
   *
   * Corps : { motDePasseActuel: string, nouveauMotDePasse: string }
   *
   * Réponse : 204 No Content
   */
  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(
    @CurrentUser() user: UserSession,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.securityService.changePassword(user.id, dto)
  }

  /**
   * POST /auth/logout  🔒 JWT requis
   *
   * Révoque les sessions APP actives de l'utilisateur (une éventuelle session de
   * synchro d'un poste local est préservée — cf. SecurityService.logout).
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@CurrentUser() user: UserSession) {
    return this.securityService.logout(user.id)
  }

  /**
   * GET /auth/me  🔒 JWT requis
   *
   * Retourne le profil courant (données fraîches DB).
   * Utile après refresh de page.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: UserSession) {
    return this.securityService.getCurrentUser(user.id)
  }
}
