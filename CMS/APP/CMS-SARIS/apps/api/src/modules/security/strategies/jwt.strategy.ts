import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../prisma/prisma.service'
import { PermissionsResolverService } from '../permissions-resolver.service'
import type { JwtPayload, UserSession } from '@cms-saris/types'

/**
 * JwtStrategy — valide le Bearer token sur chaque requête protégée.
 *
 * Peuple request.user, ET vérifie que la SESSION associée (sid) est toujours
 * active en base → révocation IMMÉDIATE.
 *
 * ⚠️ Les PERMISSIONS ne viennent PLUS du payload du jeton : elles sont relues en
 * base à chaque requête (cache court côté résolveur). Sans cela, retirer un droit
 * n'avait aucun effet avant l'expiration du jeton — jusqu'à 8 h. Le jeton ne sert
 * plus que d'identité (qui suis-je) ; l'autorisation (que puis-je) vient de la base.
 *
 * Utilisé par JwtAuthGuard via @UseGuards(JwtAuthGuard).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsResolverService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    })
  }

  async validate(
    payload: JwtPayload,
  ): Promise<Omit<UserSession, 'token'> & { sid: string | null }> {
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
        where: { id: payload.sid },
        select: { revokedAt: true, expiresAt: true },
      })
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Session expirée ou révoquée')
      }
    }

    // Autorisation relue EN BASE (cache court) : un droit retiré est refusé dès le
    // prochain appel, sans attendre l'expiration du jeton ni une reconnexion.
    // Le payload ne sert plus que de repli hors-ligne (poste non encore synchronisé).
    const permissions = await this.permissions.resoudre(
      payload.sub,
      payload.permissions ?? [],
    )

    return {
      id: payload.sub,
      login: payload.sub, // Le login complet sera chargé depuis la DB si nécessaire
      siteId: payload.siteId,
      roles: payload.roles,
      permissions,
      personnelMedicalId: payload.personnelMedicalId ?? null,
      // Contexte d'AUTORISATION par requête (pas un payload de profil) : le JWT ne porte pas
      // la photo (évite de la faire voyager sur chaque requête / la rendre périmée). La vraie
      // valeur vient de login/refresh/auth-me — cf. security.service.ts.
      photoUrl: null,
      sid: payload.sid ?? null, // session courante (gestion des sessions)
    }
  }
}
