import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { NotificationService } from '../notification/notification.service'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcrypt'
import { verifySync } from 'otplib'
import { PrismaService } from '../../prisma/prisma.service'
import { decryptSecret } from '../../common/crypto/totp-secret'
import { resolveGeo } from '../../common/geo/geo.util'
import { ParametresService } from '../parametres/parametres.service'
import { ConfirmerSiteDto } from './dto/confirmer-site.dto'
import type {
  Role,
  JwtPayload,
  UserSession,
  PermissionCode,
} from '@cms-saris/types'
import { LoginDto } from './dto/login.dto'
import { TotpVerifyDto } from './dto/totp-verify.dto'
import { RefreshDto } from './dto/refresh.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { ConfirmerSessionDto } from './dto/confirmer-session.dto'

// ── Types internes ────────────────────────────────────────────────────────────

interface TempTokenPayload {
  sub: string
  siteId: string
  roles: Role[]
  /** `totp` = double authentification en attente ; `session` = double connexion à trancher. */
  step: 'totp' | 'session'
  /** Repris tel quel au 2e temps : le poste et l'appareil ne se redéduisent pas. */
  posteLocalId?: string | null
  appareilId?: string | null
  iat: number
  exp: number
}

/** Session déjà ouverte ailleurs, telle que présentée à l'utilisateur qui se connecte. */
export interface SessionConcurrente {
  /** Depuis quand elle est ouverte. */
  ouverteA: Date
  /** Dernier signe de vie — `null` pour les sessions ouvertes avant le suivi d'activité. */
  derniereActiviteA: Date | null
  /** Brut : c'est le client qui sait le mettre en forme (parseUserAgent). */
  userAgent: string | null
  /** Ville/pays déduits de l'IP, ou `null` si indéterminable. */
  lieu: string | null
}

/**
 * Charge les permissions EFFECTIVES d'un utilisateur.
 *
 * Formule : permissions effectives = (permissions des rôles ∪ GRANTs) − REVOKEs
 *   1. Union des permissions de tous ses rôles (déduplication)
 *   2. On ajoute les dérogations individuelles GRANT (droits accordés en plus)
 *   3. On retire les dérogations individuelles REVOKE (droits retirés)
 *      → le REVOKE est appliqué EN DERNIER, il l'emporte donc toujours.
 *
 * C'est l'unique point d'assemblage des permissions injectées dans le JWT.
 */
async function chargerPermissions(
  prisma: PrismaService,
  utilisateurId: string,
): Promise<PermissionCode[]> {
  const [roles, overrides] = await Promise.all([
    prisma.utilisateurRole.findMany({
      where: { utilisateurId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    }),
    prisma.utilisateurPermission.findMany({
      where: { utilisateurId },
      include: { permission: true },
    }),
  ])

  const codes = new Set<string>()
  // 1. Permissions héritées des rôles
  for (const ur of roles) {
    for (const rp of ur.role.permissions) {
      codes.add(rp.permission.code)
    }
  }
  // 2. GRANTs individuels (ajout)
  for (const o of overrides) {
    if (o.mode === 'GRANT') codes.add(o.permission.code)
  }
  // 3. REVOKEs individuels (retrait — prioritaire sur tout le reste)
  for (const o of overrides) {
    if (o.mode === 'REVOKE') codes.delete(o.permission.code)
  }

  return [...codes] as PermissionCode[]
}

type LoginResult =
  | { requireTotp: true; tempToken: string }
  /** Une session tourne déjà sur un AUTRE appareil : rien n'est créé tant que
   *  l'utilisateur n'a pas tranché (cf. confirmerSession). */
  | { sessionActive: true; tempToken: string; session: SessionConcurrente }
  | {
      requireTotp: false
      accessToken: string
      refreshToken: string
      user: Omit<UserSession, 'token'>
    }

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SecurityService {
  private readonly logger = new Logger(SecurityService.name)
  private readonly REFRESH_TOKEN_TTL = 7 * 24 * 60 * 60 // 7 j en secondes
  private readonly TEMP_TOKEN_TTL = 5 * 60 // 5 min en secondes

  /**
   * Calcule la durée du prochain blocage selon l'escalade dynamique.
   * Formule : 1er blocage = paramètre `auth.duree_blocage_minutes`, puis ×4.
   */
  private prochainBlocage(blocageMinutesCourant: number, init: number): number {
    if (blocageMinutesCourant === 0) return init
    return blocageMinutesCourant + blocageMinutesCourant * 3 // ×4
  }

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly params: ParametresService,
    // Résolu à l'exécution (évite la dépendance circulaire SecurityModule ⇄ NotificationModule).
    private readonly moduleRef: ModuleRef,
  ) {}

  // ── POST /auth/login ──────────────────────────────────────────────────────

  async login(
    dto: LoginDto,
    ipAdresse?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    // 1. Chercher l'utilisateur (avec ses rôles et sa config TOTP)
    const user = await this.prisma.utilisateur.findUnique({
      where: { login: dto.login },
      include: {
        roles: { include: { role: true } },
        configTotp: true,
      },
    })

    // Login inconnu OU compte soft-supprimé (tombstone) → réponse générique : un compte
    // supprimé ne doit plus pouvoir s'authentifier, et on évite l'énumération d'utilisateurs.
    if (!user || user.deletedAt) {
      await this.journaliser(
        user?.id ?? null,
        dto.login,
        'ECHEC_LOGIN_INCONNU',
        ipAdresse,
        userAgent,
      )
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect')
    }

    // 2. Compte désactivé par l'administrateur
    if (user.statut === 'DESACTIVE') {
      await this.journaliser(
        user.id,
        dto.login,
        'ECHEC_COMPTE_DESACTIVE',
        ipAdresse,
        userAgent,
      )
      throw new UnauthorizedException(
        'Compte désactivé. Contactez votre administrateur',
      )
    }

    // 3. Compte bloqué (trop de tentatives)
    if (user.statut === 'BLOQUE') {
      if (user.blocageJusquA && user.blocageJusquA > new Date()) {
        const minutes = Math.ceil(
          (user.blocageJusquA.getTime() - Date.now()) / 60_000,
        )
        await this.journaliser(
          user.id,
          dto.login,
          'ECHEC_COMPTE_BLOQUE',
          ipAdresse,
          userAgent,
        )
        throw new UnauthorizedException(
          `Compte temporairement bloqué. Réessayez dans ${minutes} minute(s)`,
        )
      }
      // Blocage expiré → réinitialiser (on conserve blocageMinutes pour l'escalade)
      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data: { statut: 'ACTIF', tentativesEchec: 0, blocageJusquA: null },
      })
      user.tentativesEchec = 0
    }

    // 4. Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    )

    if (!isValidPassword) {
      const maxAttempts = await this.params.getNumber('auth.tentatives_max')
      const nouvelleTentatives = user.tentativesEchec + 1
      const doitBloquer = nouvelleTentatives >= maxAttempts

      if (doitBloquer) {
        // Calcul dynamique de la durée de blocage (escalade ×4)
        const minutes = this.prochainBlocage(
          user.blocageMinutes,
          await this.params.getNumber('auth.duree_blocage_minutes'),
        )
        const debloquage = new Date(Date.now() + minutes * 60_000)

        await this.prisma.utilisateur.update({
          where: { id: user.id },
          data: {
            tentativesEchec: nouvelleTentatives,
            statut: 'BLOQUE',
            blocageJusquA: debloquage,
            blocageMinutes: minutes,
          },
        })
        await this.journaliser(
          user.id,
          dto.login,
          'ECHEC_MOT_DE_PASSE',
          ipAdresse,
          userAgent,
        )

        const heures =
          minutes >= 60 ? ` (${Math.round((minutes / 60) * 10) / 10} h)` : ''
        throw new UnauthorizedException(
          `Trop de tentatives. Compte bloqué pour ${minutes} minute${minutes > 1 ? 's' : ''}${heures}`,
        )
      }

      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data: { tentativesEchec: nouvelleTentatives },
      })
      await this.journaliser(
        user.id,
        dto.login,
        'ECHEC_MOT_DE_PASSE',
        ipAdresse,
        userAgent,
      )

      const restantes = maxAttempts - nouvelleTentatives
      throw new UnauthorizedException(
        `Identifiant ou mot de passe incorrect. ${restantes} tentative(s) restante(s)`,
      )
    }

    // 5. Succès → réinitialiser compteur + escalade (login réussi = ardoise propre)
    if (user.tentativesEchec > 0 || user.blocageMinutes > 0) {
      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data: { tentativesEchec: 0, blocageMinutes: 0 },
      })
    }

    const roles = user.roles.map((ur) => ur.role.code) as Role[]
    // Le site de travail est celui du POSTE, pas celui du compte : un infirmier
    // intervient là où il se trouve, et ses actes doivent porter ce lieu-là.
    // Sans poste déclaré (navigateur), on retombe sur le site du compte.
    const siteId = await this.resoudreSiteDeTravail(
      user.siteId,
      dto.posteLocalId,
    )
    const permissions = await chargerPermissions(this.prisma, user.id)
    const personnelMedicalId = user.personnelMedicalId

    // 6. TOTP activé → retourner un token temporaire (step 2 du flow)
    if (user.configTotp?.actif) {
      const tempToken = await this.signTempToken(user.id, siteId, roles)
      await this.journaliser(
        user.id,
        dto.login,
        'SUCCES_LOGIN_TOTP_REQUIS',
        ipAdresse,
        userAgent,
      )
      return { requireTotp: true, tempToken }
    }

    // 7. Une session tourne-t-elle déjà sur un AUTRE appareil ? On ne crée alors RIEN :
    //    fermer la session de quelqu'un d'autre sans le lui dire n'est pas une décision
    //    qui revient au serveur. Les sessions de synchro sont exemptées (cf. la méthode).
    if (!dto.posteLocalId) {
      const concurrente = await this.detecterSessionConcurrente(
        user.id,
        dto.appareilId,
      )
      if (concurrente) {
        const tempToken = await this.signSessionToken(
          user.id,
          siteId,
          roles,
          dto.posteLocalId,
          dto.appareilId,
        )
        await this.journaliser(
          user.id,
          dto.login,
          'SUCCES_LOGIN_SESSION_ACTIVE',
          ipAdresse,
          userAgent,
        )
        return { sessionActive: true, tempToken, session: concurrente }
      }
    }

    // 8. Aucun conflit → créer la session finale
    const tokens = await this.creerSession(
      user.id,
      siteId,
      roles,
      permissions,
      personnelMedicalId,
      ipAdresse,
      userAgent,
      dto.posteLocalId,
      dto.appareilId,
    )
    await this.journaliser(
      user.id,
      dto.login,
      'SUCCES_LOGIN',
      ipAdresse,
      userAgent,
    )

    return {
      requireTotp: false,
      ...tokens,
      user: {
        id: user.id,
        login: user.login,
        siteId,
        roles,
        permissions,
        personnelMedicalId,
        photoUrl: user.photoUrl,
      },
    }
  }

  // ── POST /auth/totp/verify ────────────────────────────────────────────────

  async verifyTotp(
    dto: TotpVerifyDto,
    ipAdresse?: string,
    userAgent?: string,
  ): Promise<
    | { sessionActive: true; tempToken: string; session: SessionConcurrente }
    | {
        accessToken: string
        refreshToken: string
        user: Omit<UserSession, 'token'>
      }
  > {
    // 1. Vérifier le token temporaire
    let payload: TempTokenPayload

    try {
      payload = await this.jwt.verifyAsync<TempTokenPayload>(dto.tempToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Token temporaire invalide ou expiré')
    }

    if (payload.step !== 'totp') {
      throw new UnauthorizedException('Token invalide')
    }

    // 2. Récupérer l'utilisateur et sa config TOTP
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: true } },
        configTotp: true,
      },
    })

    if (!user || !user.configTotp?.actif) {
      throw new UnauthorizedException('Configuration TOTP introuvable')
    }

    // 3. Vérifier le code : soit un code TOTP à 6 chiffres, soit un CODE DE SECOURS.
    //    - TOTP : verifySync sur le secret DÉCHIFFRÉ (epochTolerance ±30 s pour
    //      absorber le décalage d'horloge client/serveur).
    //    - Code de secours : comparaison bcrypt contre les codes non utilisés,
    //      puis marquage à usage unique (récupération si authenticator perdu).
    const estTotp = /^\d{6}$/.test(dto.code)
    let authentifie = false
    let viaCodeSecours = false

    if (estTotp) {
      const { valid } = verifySync({
        token: dto.code,
        secret: decryptSecret(user.configTotp.secretChiffre),
        strategy: 'totp',
        epochTolerance: 30,
      })
      authentifie = valid
    } else {
      // Normalisation : majuscules, sans espaces, tiret ré-inséré → « XXXX-XXXX »
      const brut = dto.code.trim().toUpperCase().replace(/\s+/g, '')
      const candidat = brut.includes('-')
        ? brut
        : brut.replace(/^(.{4})(.{4})$/, '$1-$2')
      const codes = await this.prisma.codeSecoursTotp.findMany({
        where: { configId: user.configTotp.id, utilise: false },
      })
      for (const c of codes) {
        if (await bcrypt.compare(candidat, c.codeHash)) {
          await this.prisma.codeSecoursTotp.update({
            where: { id: c.id },
            data: { utilise: true, utilisedAt: new Date() },
          })
          authentifie = true
          viaCodeSecours = true
          break
        }
      }
    }

    if (!authentifie) {
      await this.journaliser(
        user.id,
        user.login,
        'ECHEC_CODE_TOTP',
        ipAdresse,
        userAgent,
      )
      throw new UnauthorizedException('Code TOTP invalide ou expiré')
    }

    // 4. Créer la session finale
    const roles = user.roles.map((ur) => ur.role.code) as Role[]
    const permissions = await chargerPermissions(this.prisma, user.id)
    const personnelMedicalId = user.personnelMedicalId
    // Même règle qu'à la connexion simple : le site de travail vient du poste.
    const siteId = await this.resoudreSiteDeTravail(
      user.siteId,
      dto.posteLocalId,
    )
    // Même contrôle qu'à la connexion simple, mais APRÈS le second facteur : c'est
    // seulement ici que l'identité est pleinement établie.
    if (!dto.posteLocalId) {
      const concurrente = await this.detecterSessionConcurrente(
        user.id,
        dto.appareilId,
      )
      if (concurrente) {
        const tempToken = await this.signSessionToken(
          user.id,
          siteId,
          roles,
          dto.posteLocalId,
          dto.appareilId,
        )
        await this.journaliser(
          user.id,
          user.login,
          'SUCCES_LOGIN_SESSION_ACTIVE',
          ipAdresse,
          userAgent,
        )
        return { sessionActive: true, tempToken, session: concurrente }
      }
    }

    const tokens = await this.creerSession(
      user.id,
      siteId,
      roles,
      permissions,
      personnelMedicalId,
      ipAdresse,
      userAgent,
      dto.posteLocalId,
      dto.appareilId,
    )
    await this.journaliser(
      user.id,
      user.login,
      viaCodeSecours ? 'SUCCES_LOGIN_CODE_SECOURS' : 'SUCCES_LOGIN_TOTP',
      ipAdresse,
      userAgent,
    )

    return {
      ...tokens,
      user: {
        id: user.id,
        login: user.login,
        siteId,
        roles,
        permissions,
        personnelMedicalId,
        photoUrl: user.photoUrl,
      },
    }
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  /**
   * Échange un refresh token valide contre un nouveau couple access/refresh token.
   * Rotation : l'ancienne session est révoquée, une nouvelle est créée.
   */
  async refresh(
    dto: RefreshDto,
    /** Site EXPLICITEMENT choisi (confirmation à la connexion). Ignoré sur un poste de
     *  bureau, où c'est la machine qui décide — cf. `confirmerSite`. */
    siteForce?: string,
  ): Promise<{
    accessToken: string
    refreshToken: string
    user: Omit<UserSession, 'token'>
  }> {
    // 1. Décoder + vérifier la signature du refresh token
    let sub: string
    let sid: string | undefined
    let siteDuJeton: string | undefined
    try {
      const payload = await this.jwt.verifyAsync<{
        sub: string
        type: string
        sid?: string
        siteId?: string
      }>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      })
      if (payload.type !== 'refresh') throw new Error('mauvais type')
      sub = payload.sub
      sid = payload.sid
      siteDuJeton = payload.siteId
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré')
    }

    // 2-3. Retrouver LA session liée à ce token et vérifier SON état.
    // ⚠️ On NE PEUT PAS boucler sur les sessions avec `bcrypt.compare` : bcrypt ne hache que
    // les 72 PREMIERS octets, IDENTIQUES pour tous les refresh tokens d'un même utilisateur
    // (en-tête JWT + début du payload `sub`) → tous les hash collisionnent, et révoquer UNE
    // session ne « libère » pas le token (il matche les autres). On retrouve donc la session
    // par son `sid` (unique, signé dans le token) et on contrôle SON `revokedAt`.
    type SessionLite = {
      id: string
      utilisateurId: string
      revokedAt: Date | null
      expiresAt: Date
      refreshTokenHash: string
      posteLocalId: string | null
      appareilId: string | null
    }
    let matchingSession: SessionLite | null = null
    if (sid) {
      const s = await this.prisma.sessionUtilisateur.findUnique({
        where: { id: sid },
      })
      if (
        s &&
        s.utilisateurId === sub &&
        !s.revokedAt &&
        s.expiresAt > new Date() &&
        (await bcrypt.compare(dto.refreshToken, s.refreshTokenHash))
      ) {
        matchingSession = s
      }
    } else {
      // Rétro-compat : anciens tokens SANS `sid` (boucle imparfaite mais inoffensive le temps
      // que les sessions historiques expirent ; tous les nouveaux tokens portent un `sid`).
      const sessions = await this.prisma.sessionUtilisateur.findMany({
        where: {
          utilisateurId: sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      })
      for (const session of sessions) {
        if (await bcrypt.compare(dto.refreshToken, session.refreshTokenHash)) {
          matchingSession = session
          break
        }
      }
    }

    if (!matchingSession) {
      throw new UnauthorizedException(
        'Session invalide ou expirée. Veuillez vous reconnecter',
      )
    }

    // 4. Récupérer l'utilisateur + rôles
    const user = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: sub },
      include: { roles: { include: { role: true } } },
    })

    // 5. Révoquer l'ancienne session
    await this.prisma.sessionUtilisateur.update({
      where: { id: matchingSession.id },
      data: { revokedAt: new Date() },
    })

    // 6. Créer une nouvelle session (rotation du refresh token)
    const roles = user.roles.map((ur) => ur.role.code) as Role[]
    const permissions = await chargerPermissions(this.prisma, user.id)
    const personnelMedicalId = user.personnelMedicalId
    // Préserve le type de session (synchro vs app) : on conserve le posteLocalId d'origine.
    // `appareilId` est repris pour la même raison : la rotation crée une session NEUVE, et
    // sans lui l'appareil deviendrait inconnu — l'utilisateur serait averti d'une « autre
    // session » à chaque renouvellement de jeton, sur son propre poste.
    // SITE DE LA SESSION — il doit survivre à la rotation, sinon le choix fait à la
    // connexion serait perdu au premier renouvellement de jeton, sans que personne ne
    // comprenne pourquoi les actes changent de site en cours de journée.
    const siteSession = matchingSession.posteLocalId
      // Poste de bureau : la MACHINE décide, toujours. On re-résout depuis le poste, ce qui
      // corrige au passage un défaut latent — la rotation retombait sur le site du compte.
      ? await this.resoudreSiteDeTravail(
          user.siteId,
          matchingSession.posteLocalId,
        )
      // Web : le site confirmé à la connexion, transporté par le refresh token.
      : (siteForce ?? siteDuJeton ?? user.siteId)

    const tokens = await this.creerSession(
      user.id,
      siteSession,
      roles,
      permissions,
      personnelMedicalId,
      undefined,
      undefined,
      matchingSession.posteLocalId,
      matchingSession.appareilId,
    )

    return {
      ...tokens,
      user: {
        id: user.id,
        login: user.login,
        // Le site de la SESSION, pas celui du compte : c'est lui qui sera recopié sur
        // chaque acte, et c'est donc lui que l'écran doit afficher.
        siteId: siteSession,
        roles,
        permissions,
        personnelMedicalId,
        photoUrl: user.photoUrl,
      },
    }
  }

  // ── POST /auth/change-password ────────────────────────────────────────────

  /**
   * Modifie le mot de passe d'un utilisateur authentifié.
   * Vérifie le mot de passe actuel avant d'appliquer le changement.
   */
  async changePassword(
    utilisateurId: string,
    dto: ChangePasswordDto,
  ): Promise<void> {
    const user = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
    })

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(
      dto.motDePasseActuel,
      user.passwordHash,
    )
    if (!isValid) {
      throw new UnauthorizedException('Mot de passe actuel incorrect')
    }

    // Appliquer la politique de mot de passe en vigueur (paramètres système live)
    await this.params.assertPasswordValid(dto.nouveauMotDePasse)

    // Hacher et sauvegarder le nouveau mot de passe.
    // L'utilisateur a défini son propre mot de passe (après vérification de
    // l'actuel) → ce n'est plus un mot de passe temporaire : on lève le flag.
    const newHash = await bcrypt.hash(dto.nouveauMotDePasse, 12)
    await this.prisma.utilisateur.update({
      where: { id: utilisateurId },
      data: { passwordHash: newHash, motDePasseTemp: false },
    })

    await this.journaliser(utilisateurId, user.login, 'SUCCES_CHANGEMENT_MDP')
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  /**
   * Site sur lequel la personne travaille pendant cette session.
   *
   * Une personne n'appartient pas à un site : elle intervient là où elle se
   * trouve. C'est le POSTE — déclaré une fois à son installation — qui porte le
   * lieu, et c'est lui qui doit se retrouver sur les actes (visites, dossiers
   * ouverts). Résoudre le site ICI plutôt que sur chaque acte évite d'avoir à
   * modifier tous les points d'écriture : `siteId` du jeton signifie désormais
   * « là où je travaille », et non plus « ce à quoi j'appartiens ».
   *
   * Repli sur le site du compte quand aucun poste n'est déclaré (navigateur
   * classique) ou que le poste est inconnu : l'application reste utilisable sans
   * installation préalable.
   */
  /**
   * CONFIRMATION DU SITE DE TRAVAIL, juste après la connexion (web).
   *
   * Le site n'appartient pas au compte : il appartient à l'ACTE. Chaque visite, chaque
   * consultation recopie le site porté par la session au moment où elle est enregistrée.
   * On demande donc à la personne de confirmer, une fois, sur quel site elle travaille —
   * et ce choix ne vit que le temps de la session.
   *
   * Sur un POSTE DE BUREAU, le choix est REFUSÉ : le site y est fixé à l'installation et
   * identifie la machine. Accepter un choix ici permettrait de contourner cette
   * configuration depuis l'écran, ce qui viderait de son sens la configuration du poste.
   *
   * Techniquement, on réutilise la rotation de `refresh` plutôt que d'écrire un second
   * chemin d'émission de jetons : un seul chemin, donc un seul endroit où se tromper.
   */
  async confirmerSite(dto: ConfirmerSiteDto): Promise<{
    accessToken: string
    refreshToken: string
    user: Omit<UserSession, 'token'>
  }> {
    // `findFirst` et non `findUnique` : l'extension soft-delete y injecte `deletedAt: null`,
    // donc un site supprimé est introuvable sans qu'on ait à y penser.
    const site = await this.prisma.site.findFirst({
      where: { id: dto.siteId },
      select: { id: true },
    })
    if (!site) throw new BadRequestException('Site introuvable')
    return this.refresh({ refreshToken: dto.refreshToken }, site.id)
  }

  private async resoudreSiteDeTravail(
    siteDuCompte: string,
    posteLocalId?: string | null,
  ): Promise<string> {
    if (!posteLocalId) return siteDuCompte
    try {
      const poste = await this.prisma.posteLocal.findUnique({
        where: { id: posteLocalId },
        select: { siteId: true },
      })
      return poste?.siteId ?? siteDuCompte
    } catch {
      // Un poste illisible ne doit jamais empêcher de se connecter.
      return siteDuCompte
    }
  }

  /**
   * Crée une SessionUtilisateur en DB et retourne les deux tokens JWT.
   */
  private async creerSession(
    utilisateurId: string,
    siteId: string,
    roles: Role[],
    permissions: PermissionCode[],
    personnelMedicalId: string | null,
    ipAdresse?: string,
    userAgent?: string,
    /** Si rempli → session de SYNCHRO (backend embarqué d'un poste) : EXEMPTÉE de la
     *  « session unique » (sinon le login app casserait la synchro du poste). */
    posteLocalId?: string | null,
    /** Appareil d'origine — sert à ne pas avertir lors d'une reconnexion depuis le même poste. */
    appareilId?: string | null,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Identifiant de session pré-généré → embarqué dans le JWT (sid) ET utilisé
    // comme clé primaire de la SessionUtilisateur, pour la gestion des sessions.
    const sid = randomUUID()
    // TTL du token d'accès = paramètre système `auth.session_timeout_minutes` (live).
    const ttlMinutes = await this.params.getNumber(
      'auth.session_timeout_minutes',
    )
    const accessTtlSec = Math.max(ttlMinutes, 1) * 60

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: utilisateurId,
      siteId,
      roles,
      permissions,
      personnelMedicalId,
      sid,
    }

    // Générer access token + refresh token en parallèle
    // On passe l'expiry en secondes (number) pour éviter la dépendance sur StringValue (ms)
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(jwtPayload, { expiresIn: accessTtlSec }),
      // `sid` rend CHAQUE refresh token UNIQUE (sinon deux tokens du même user signés dans
      // la même seconde sont identiques → même hash sur plusieurs sessions → la rotation ne
      // révoque pas réellement l'ancien token). Lié à sa session par construction.
      // `siteId` est embarqué ICI, et c'est le coeur du mécanisme : le site de travail
      // appartient à la SESSION, pas au compte. Le porter dans le refresh token le fait
      // survivre à chaque rotation, et disparaître de lui-même quand la session expire —
      // sans colonne en base, donc sans rien à nettoyer ni à oublier.
      this.jwt.signAsync(
        { sub: utilisateurId, type: 'refresh', sid, siteId },
        { expiresIn: this.REFRESH_TOKEN_TTL },
      ),
    ])

    // Stocker uniquement le hash du refresh token (jamais le token brut)
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
    const expiresAt = new Date(Date.now() + this.REFRESH_TOKEN_TTL * 1000) // 7 jours

    await this.prisma.sessionUtilisateur.create({
      data: {
        id: sid,
        utilisateurId,
        refreshTokenHash,
        ipAdresse,
        userAgent,
        expiresAt,
        posteLocalId: posteLocalId ?? null,
        appareilId: appareilId ?? null,
        derniereActiviteAt: new Date(),
      },
    })

    // SESSION UNIQUE par utilisateur — UNIQUEMENT pour les postes APP INTERACTIFS (sans
    // posteLocalId). On révoque les AUTRES sessions APP du même utilisateur (l'ancien poste
    // sera refusé au prochain appel CÔTÉ CENTRAL via jwt.strategy) et on les déconnecte
    // INSTANTANÉMENT via SSE. Les sessions de SYNCHRO (posteLocalId rempli) sont EXEMPTÉES :
    // chaque poste garde sa synchro en arrière-plan.
    if (!posteLocalId) {
      const autres = await this.prisma.sessionUtilisateur.findMany({
        where: {
          utilisateurId,
          revokedAt: null,
          posteLocalId: null,
          NOT: { id: sid },
        },
        select: { id: true },
      })
      if (autres.length) {
        const ids = autres.map((s) => s.id)
        await this.prisma.sessionUtilisateur.updateMany({
          where: { id: { in: ids } },
          data: { revokedAt: new Date() },
        })
        try {
          this.moduleRef
            .get(NotificationService, { strict: false })
            .pushSessionRevoked(utilisateurId, ids)
        } catch {
          /* notification best-effort : ne casse jamais le login */
        }
      }
    }

    return { accessToken, refreshToken }
  }

  /**
   * Génère un token temporaire (5 min) utilisé pendant le step TOTP.
   */
  private signTempToken(
    sub: string,
    siteId: string,
    roles: Role[],
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub, siteId, roles, step: 'totp' },
      { expiresIn: this.TEMP_TOKEN_TTL },
    )
  }

  // ── Double connexion ──────────────────────────────────────────────────────

  /**
   * Une session applicative tourne-t-elle déjà sur un AUTRE appareil ?
   *
   * Appelée UNIQUEMENT après validation du mot de passe (et du code TOTP le cas
   * échéant). Répondre plus tôt renseignerait n'importe qui sur l'activité d'un compte
   * à partir du seul identifiant.
   *
   * Deux exclusions volontaires :
   *  - les sessions de SYNCHRO (`posteLocalId` rempli) — un poste desktop synchronise en
   *    permanence en arrière-plan, ce n'est pas quelqu'un devant un écran ;
   *  - le MÊME appareil — application relancée ou page rechargée : c'est manifestement
   *    la même personne, l'avertir serait du bruit, et un avertissement routinier qu'on
   *    clique sans lire ne protège plus.
   */
  private async detecterSessionConcurrente(
    utilisateurId: string,
    appareilId?: string | null,
  ): Promise<SessionConcurrente | null> {
    const sessions = await this.prisma.sessionUtilisateur.findMany({
      where: {
        utilisateurId,
        revokedAt: null,
        posteLocalId: null,
        expiresAt: { gt: new Date() },
        ...(appareilId ? { NOT: { appareilId } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 1,
      select: {
        createdAt: true,
        derniereActiviteAt: true,
        userAgent: true,
        ipAdresse: true,
      },
    })
    const s = sessions[0]
    if (!s) return null

    // La géolocalisation ne doit jamais bloquer une connexion : sans lieu, l'écran
    // affiche simplement l'appareil et l'heure.
    let lieu: string | null = null
    try {
      const geo = await resolveGeo(s.ipAdresse)
      lieu = geo.label && geo.label !== 'Localisation inconnue' ? geo.label : null
    } catch {
      /* best-effort */
    }

    return {
      ouverteA: s.createdAt,
      derniereActiviteA: s.derniereActiviteAt,
      userAgent: s.userAgent,
      lieu,
    }
  }

  /**
   * 2e temps : l'utilisateur a tranché sur la session déjà ouverte ailleurs.
   *
   * `REMPLACER` — « c'était moi » : la session est créée, et `creerSession` révoque les
   *               autres au passage (session unique inchangée).
   * `SIGNALER`  — « ce n'est pas moi » : on ne connecte PAS. Toutes les sessions
   *               applicatives sont fermées, l'événement est journalisé et les
   *               administrateurs sont alertés. Entrer dans un compte que l'on croit
   *               compromis reviendrait à cohabiter avec l'intrus ; le refermer coupe
   *               son accès immédiatement, en attendant un changement de mot de passe.
   */
  async confirmerSession(
    dto: ConfirmerSessionDto,
    ipAdresse?: string,
    userAgent?: string,
  ): Promise<
    | { signale: true }
    | {
        accessToken: string
        refreshToken: string
        user: Omit<UserSession, 'token'>
      }
  > {
    let payload: TempTokenPayload
    try {
      payload = await this.jwt.verifyAsync<TempTokenPayload>(dto.tempToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      })
    } catch {
      throw new UnauthorizedException('Token temporaire invalide ou expiré')
    }
    // `step` distinct de 'totp' : un token de double authentification ne doit pas
    // pouvoir ouvrir une session en sautant la vérification du code.
    if (payload.step !== 'session') {
      throw new UnauthorizedException('Token invalide')
    }

    const user = await this.prisma.utilisateur.findUnique({
      where: { id: payload.sub },
      include: { roles: { include: { role: true } } },
    })
    // Mêmes garde-fous qu'au login : le compte a pu être désactivé, bloqué ou supprimé
    // entre le mot de passe et cette confirmation (5 min de fenêtre).
    if (!user || user.deletedAt || user.statut !== 'ACTIF') {
      throw new UnauthorizedException('Compte introuvable ou désactivé')
    }

    // ── « Ce n'est pas moi » ────────────────────────────────────────────────
    if (dto.action === 'SIGNALER') {
      const sessions = await this.prisma.sessionUtilisateur.findMany({
        where: { utilisateurId: user.id, revokedAt: null, posteLocalId: null },
        select: { id: true },
      })
      if (sessions.length) {
        await this.prisma.sessionUtilisateur.updateMany({
          where: { id: { in: sessions.map((s) => s.id) } },
          data: { revokedAt: new Date() },
        })
        try {
          this.moduleRef
            .get(NotificationService, { strict: false })
            .pushSessionRevoked(
              user.id,
              sessions.map((s) => s.id),
              {
                titre: 'Session fermée par sécurité',
                message:
                  'Une connexion non reconnue a été signalée sur ce compte. Toutes les sessions ont été fermées.',
              },
            )
        } catch {
          /* best-effort : la révocation en base fait foi */
        }
      }
      await this.journaliser(
        user.id,
        user.login,
        'ALERTE_SESSION_NON_RECONNUE',
        ipAdresse,
        userAgent,
      )
      this.logger.warn(
        `Session non reconnue signalée par « ${user.login} » — ${sessions.length} session(s) fermée(s).`,
      )
      // L'écran de connexion PROMET qu'un administrateur sera alerté : un log serveur
      // que personne ne lit ne tient pas cette promesse. `requiredPermission` restreint
      // la notification à ceux qui peuvent agir ; `siteId: null` la rend globale, car un
      // compte compromis n'est pas l'affaire d'un seul site.
      try {
        await this.moduleRef
          .get(NotificationService, { strict: false })
          .emit({
            type: 'SECURITE_SESSION_NON_RECONNUE',
            niveau: 'CRITIQUE',
            category: 'systeme',
            titre: 'Session non reconnue signalée',
            message:
              `« ${user.login} » déclare ne pas être à l'origine d'une session ouverte sur son compte. ` +
              `${sessions.length} session(s) ont été fermées. Le compte doit changer de mot de passe.`,
            siteId: null,
            requiredPermission: 'utilisateur.read',
            entiteType: 'Utilisateur',
            entiteId: user.id,
          })
      } catch {
        /* la révocation et le journal font foi ; l'alerte est best-effort */
      }
      return { signale: true }
    }

    // ── « C'était moi » ─────────────────────────────────────────────────────
    const roles = user.roles.map((ur) => ur.role.code) as Role[]
    const permissions = await chargerPermissions(this.prisma, user.id)
    const tokens = await this.creerSession(
      user.id,
      payload.siteId,
      roles,
      permissions,
      user.personnelMedicalId,
      ipAdresse,
      userAgent,
      payload.posteLocalId,
      payload.appareilId,
    )
    await this.journaliser(
      user.id,
      user.login,
      'SUCCES_LOGIN_SESSION_REMPLACEE',
      ipAdresse,
      userAgent,
    )
    return {
      ...tokens,
      user: {
        id: user.id,
        login: user.login,
        siteId: payload.siteId,
        roles,
        permissions,
        personnelMedicalId: user.personnelMedicalId,
        photoUrl: user.photoUrl,
      },
    }
  }

  /** Token du 2e temps : le mot de passe est déjà validé, on ne fait que trancher. */
  private signSessionToken(
    sub: string,
    siteId: string,
    roles: Role[],
    posteLocalId?: string | null,
    appareilId?: string | null,
  ): Promise<string> {
    return this.jwt.signAsync(
      { sub, siteId, roles, step: 'session', posteLocalId, appareilId },
      { expiresIn: this.TEMP_TOKEN_TTL },
    )
  }

  // ── POST /auth/logout ────────────────────────────────────────────────────

  /**
   * Révoque les sessions APP actives de l'utilisateur (déconnexion explicite).
   *
   * `posteLocalId: null` — MÊME exemption que dans `creerSession()` : une session de
   * SYNCHRO (backend embarqué d'un poste local, `posteLocalId` rempli) n'est JAMAIS
   * révoquée par un logout applicatif, sinon un utilisateur qui a servi à la fois à
   * lier le poste (sync-setup) et à se connecter au quotidien casserait la synchro de
   * son propre poste en se déconnectant (l'app rebascule alors sur l'écran de 1er
   * lancement au prochain démarrage, au lieu de l'écran de connexion).
   */
  async logout(
    utilisateurId: string,
    ipAdresse?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.prisma.sessionUtilisateur.updateMany({
      where: { utilisateurId, revokedAt: null, posteLocalId: null },
      data: { revokedAt: new Date() },
    })
    // Le LOGIN, pas l'identifiant technique : la colonne « Login » du journal
    // affichait un UUID pour chaque déconnexion, illisible et impossible à
    // rapprocher de la ligne de connexion correspondante.
    const compte = await this.prisma.utilisateur.findUnique({
      where: { id: utilisateurId },
      select: { login: true },
    })
    await this.journaliser(
      utilisateurId,
      compte?.login ?? utilisateurId,
      'SUCCES_LOGOUT',
      ipAdresse,
      userAgent,
    )
  }

  // ── GET /auth/me ─────────────────────────────────────────────────────────

  /**
   * Retourne le profil complet de l'utilisateur connecté (données fraîches de la DB).
   */
  async getCurrentUser(
    utilisateurId: string,
  ): Promise<Omit<UserSession, 'token'>> {
    const user = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
      include: { roles: { include: { role: true } } },
    })

    const roles = user.roles.map((ur) => ur.role.code) as Role[]
    const permissions = await chargerPermissions(this.prisma, user.id)

    return {
      id: user.id,
      login: user.login,
      siteId: user.siteId,
      roles,
      permissions,
      personnelMedicalId: user.personnelMedicalId,
      photoUrl: user.photoUrl,
    }
  }

  /**
   * Enregistre chaque tentative d'authentification dans le journal.
   * Silencieux en cas d'erreur pour ne pas masquer l'erreur principale.
   */
  private async journaliser(
    utilisateurId: string | null,
    login: string,
    resultat: string,
    ipAdresse?: string,
    userAgent?: string,
  ): Promise<void> {
    try {
      await this.prisma.journalAuthentification.create({
        data: { utilisateurId, login, resultat, ipAdresse, userAgent },
      })
    } catch (error) {
      this.logger.error('Erreur lors de la journalisation auth', error)
    }
  }
}
