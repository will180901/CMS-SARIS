import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../prisma/prisma.service'
import type { JwtPayload, UserSession } from '@cms-saris/types'

/**
 * JwtStrategy — valide le Bearer token sur chaque requête protégée.
 *
 * Peuple request.user avec les données du token, ET vérifie que la SESSION
 * associée (sid) est toujours active en base → révocation IMMÉDIATE.
 *
 * Utilisé par JwtAuthGuard via @UseGuards(JwtAuthGuard).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(payload: JwtPayload): Promise<Omit<UserSession, 'token'> & { sid: string | null }> {
    if (!payload.sub || !payload.siteId || !payload.roles) {
      throw new UnauthorizedException('Token invalide')
    }

    // Révocation IMMÉDIATE : si le token porte un identifiant de session (sid),
    // on exige que la session soit toujours ACTIVE en base (non révoquée, non
    // expirée, existante). Ainsi « se déconnecter », « forcer la déconnexion »,
    // « désactiver » ou « supprimer » un compte coupe l'accès au PROCHAIN appel,
    // et non à l'expiration naturelle du jeton (jusqu'à 8 h plus tard).
    // (Les tokens sans sid — éventuels jetons de service — ne sont pas concernés.)
    //
    // ⚠️ EXCEPTION backend EMBARQUÉ (poste local, SQLite) : il NE possède PAS les sessions
    // du central (elles ne se synchronisent pas). Comme il n'écoute qu'en LOOPBACK (127.0.0.1)
    // et partage le `JWT_SECRET` du central, il FAIT CONFIANCE à la signature et SAUTE la vérif
    // de session → le token émis par le central est accepté en local (bascule en/hors-ligne
    // transparente, online-first/offline-fallback). La révocation immédiate reste assurée CÔTÉ
    // CENTRAL (en ligne) ; hors-ligne, le jeton expire naturellement (≤ JWT_EXPIRES_IN).
    const isEmbedded = process.env['DATABASE_PROVIDER'] === 'sqlite'
    if (payload.sid && !isEmbedded) {
      const session = await this.prisma.sessionUtilisateur.findUnique({
        where:  { id: payload.sid },
        select: { revokedAt: true, expiresAt: true },
      })
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Session expirée ou révoquée')
      }
    }

    return {
      id:                 payload.sub,
      login:              payload.sub, // Le login complet sera chargé depuis la DB si nécessaire
      siteId:             payload.siteId,
      roles:              payload.roles,
      permissions:        payload.permissions ?? [],
      personnelMedicalId: payload.personnelMedicalId ?? null,
      sid:                payload.sid ?? null,   // session courante (gestion des sessions)
    }
  }
}
