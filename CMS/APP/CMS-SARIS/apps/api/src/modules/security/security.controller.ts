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
import { Throttle, ThrottlerGuard } from '@nestjs/throttler'
import { SecurityService }   from './security.service'
import { JwtAuthGuard }      from './guards/jwt-auth.guard'
import { CurrentUser }       from '../../common/decorators/current-user.decorator'
import { LoginDto }          from './dto/login.dto'
import { TotpVerifyDto }     from './dto/totp-verify.dto'
import { RefreshDto }        from './dto/refresh.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import type { UserSession }  from '@cms-saris/types'

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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // anti brute-force : 10 tentatives/min/IP
  login(
    @Body() dto:                    LoginDto,
    @Ip()   ip:                     string,
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
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // anti brute-force du code TOTP
  verifyTotp(
    @Body() dto:                    TotpVerifyDto,
    @Ip()   ip:                     string,
    @Headers('user-agent') userAgent: string,
  ) {
    return this.securityService.verifyTotp(dto, ip, userAgent)
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
  @UseGuards(ThrottlerGuard)
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
   * Révoque toutes les sessions actives de l'utilisateur.
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
