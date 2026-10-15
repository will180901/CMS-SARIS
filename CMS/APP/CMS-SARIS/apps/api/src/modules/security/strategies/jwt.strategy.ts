import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../../../prisma/prisma.service'
import { PermissionsResolverService } from '../permissions-resolver.service'
import { MotDePasseTemporaireService } from '../mot-de-passe-temporaire.service'
import {
  CODE_MOT_DE_PASSE_TEMPORAIRE,
  routePermiseAvecMotDePasseTemporaire,
} from '../mot-de-passe-temporaire'
import { PAS_ACTIVITE_MS } from '../connexions.util'
import type { Request } from 'express'
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
 * Un compte qui porte encore un mot de passe TEMPORAIRE (posé par l'administrateur) ne peut rien
 * faire d'autre que le remplacer ou se déconnecter : toute autre requête est refusée (403
 * `MOT_DE_PASSE_TEMPORAIRE`). Seule exception : la session de SYNCHRONISATION d'un poste de bureau,
 * qui n'est pas une personne devant un écran (cf. `validate`).
 *
 * Utilisé par JwtAuthGuard via @UseGuards(JwtAuthGuard).
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly permissions: PermissionsResolverService,
    private readonly motDePasseTemporaire: MotDePasseTemporaireService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
      // La route appelée est nécessaire pour savoir si un mot de passe temporaire la permet.
      passReqToCallback: true,
    })
  }

  async validate(
    req: Request,
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
    // Session de SYNCHRONISATION d'un poste de bureau : un programme, pas une personne.
    let sessionDePoste = false
    if (payload.sid && !isEmbedded) {
      const session = await this.prisma.sessionUtilisateur.findUnique({
        where: { id: payload.sid },
        select: {
          revokedAt: true,
          expiresAt: true,
          derniereActiviteAt: true,
          posteLocalId: true,
        },
      })
      if (!session || session.revokedAt || session.expiresAt <= new Date()) {
        throw new UnauthorizedException('Session expirée ou révoquée')
      }
      sessionDePoste = !!session.posteLocalId
      // SIGNE DE VIE : sans lui, la « dernière activité » ne bougeait qu'au renouvellement du
      // jeton (8 h par défaut) — impossible de savoir combien de temps a duré une connexion.
      // Au plus une écriture par session et par tranche de 5 minutes, sans attendre.
      if (
        !session.derniereActiviteAt ||
        Date.now() - session.derniereActiviteAt.getTime() > PAS_ACTIVITE_MS
      ) {
        void this.prisma.sessionUtilisateur
          .update({
            where: { id: payload.sid },
            data: { derniereActiviteAt: new Date() },
          })
          .catch(() => undefined)
      }
    }

    // Mot de passe TEMPORAIRE : tant qu'il n'est pas remplacé, rien d'autre n'est permis. Ce
    // contrôle est fait ICI (et pas seulement par l'écran) : sans lui, quelqu'un qui connaît le
    // mot de passe posé par l'administrateur pourrait s'en servir indéfiniment en n'utilisant
    // jamais l'interface. L'appel qui remplace le mot de passe, lui, passe.
    if (
      !sessionDePoste &&
      !routePermiseAvecMotDePasseTemporaire(
        req.method,
        req.originalUrl ?? req.url,
      ) &&
      (await this.motDePasseTemporaire.doitChanger(payload.sub))
    ) {
      throw new ForbiddenException({
        code: CODE_MOT_DE_PASSE_TEMPORAIRE,
        message:
          'Vous devez d’abord choisir votre propre mot de passe : le mot de passe temporaire ne permet rien d’autre.',
      })
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
