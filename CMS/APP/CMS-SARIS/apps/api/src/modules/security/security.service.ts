import { Injectable, UnauthorizedException, Logger } from '@nestjs/common'
import { ModuleRef } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { ConfigService } from '@nestjs/config'
import { NotificationService } from '../notification/notification.service'
import { randomUUID } from 'crypto'
import * as bcrypt from 'bcrypt'
import { verifySync } from 'otplib'
import { PrismaService } from '../../prisma/prisma.service'
import { decryptSecret } from '../../common/crypto/totp-secret'
import { ParametresService } from '../parametres/parametres.service'
import type { Role, JwtPayload, UserSession, PermissionCode } from '@cms-saris/types'
import { LoginDto } from './dto/login.dto'
import { TotpVerifyDto } from './dto/totp-verify.dto'
import { RefreshDto } from './dto/refresh.dto'
import { ChangePasswordDto } from './dto/change-password.dto'

// ── Types internes ────────────────────────────────────────────────────────────

interface TempTokenPayload {
  sub:    string
  siteId: string
  roles:  Role[]
  step:   'totp'
  iat:    number
  exp:    number
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
      where:   { utilisateurId },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
      },
    }),
    prisma.utilisateurPermission.findMany({
      where:   { utilisateurId },
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
  | { requireTotp: true;  tempToken: string }
  | {
      requireTotp:   false
      accessToken:   string
      refreshToken:  string
      user:          Omit<UserSession, 'token'>
    }

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable()
export class SecurityService {
  private readonly logger             = new Logger(SecurityService.name)
  private readonly REFRESH_TOKEN_TTL  = 7 * 24 * 60 * 60  // 7 j en secondes
  private readonly TEMP_TOKEN_TTL     = 5 * 60             // 5 min en secondes

  /**
   * Calcule la durée du prochain blocage selon l'escalade dynamique.
   * Formule : 1er blocage = paramètre `auth.duree_blocage_minutes`, puis ×4.
   */
  private prochainBlocage(blocageMinutesCourant: number, init: number): number {
    if (blocageMinutesCourant === 0) return init
    return blocageMinutesCourant + blocageMinutesCourant * 3  // ×4
  }

  constructor(
    private readonly prisma:  PrismaService,
    private readonly jwt:     JwtService,
    private readonly config:  ConfigService,
    private readonly params:  ParametresService,
    // Résolu à l'exécution (évite la dépendance circulaire SecurityModule ⇄ NotificationModule).
    private readonly moduleRef: ModuleRef,
  ) {}

  // ── POST /auth/login ──────────────────────────────────────────────────────

  async login(
    dto:        LoginDto,
    ipAdresse?: string,
    userAgent?: string,
  ): Promise<LoginResult> {
    // 1. Chercher l'utilisateur (avec ses rôles et sa config TOTP)
    const user = await this.prisma.utilisateur.findUnique({
      where:   { login: dto.login },
      include: {
        roles:     { include: { role: true } },
        configTotp: true,
      },
    })

    // Login inconnu OU compte soft-supprimé (tombstone) → réponse générique : un compte
    // supprimé ne doit plus pouvoir s'authentifier, et on évite l'énumération d'utilisateurs.
    if (!user || user.deletedAt) {
      await this.journaliser(user?.id ?? null, dto.login, 'ECHEC_LOGIN_INCONNU', ipAdresse, userAgent)
      throw new UnauthorizedException('Identifiant ou mot de passe incorrect')
    }

    // 2. Compte désactivé par l'administrateur
    if (user.statut === 'DESACTIVE') {
      await this.journaliser(user.id, dto.login, 'ECHEC_COMPTE_DESACTIVE', ipAdresse, userAgent)
      throw new UnauthorizedException('Compte désactivé. Contactez votre administrateur')
    }

    // 3. Compte bloqué (trop de tentatives)
    if (user.statut === 'BLOQUE') {
      if (user.blocageJusquA && user.blocageJusquA > new Date()) {
        const minutes = Math.ceil((user.blocageJusquA.getTime() - Date.now()) / 60_000)
        await this.journaliser(user.id, dto.login, 'ECHEC_COMPTE_BLOQUE', ipAdresse, userAgent)
        throw new UnauthorizedException(
          `Compte temporairement bloqué. Réessayez dans ${minutes} minute(s)`,
        )
      }
      // Blocage expiré → réinitialiser (on conserve blocageMinutes pour l'escalade)
      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data:  { statut: 'ACTIF', tentativesEchec: 0, blocageJusquA: null },
      })
      user.tentativesEchec = 0
    }

    // 4. Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash)

    if (!isValidPassword) {
      const maxAttempts        = await this.params.getNumber('auth.tentatives_max')
      const nouvelleTentatives = user.tentativesEchec + 1
      const doitBloquer        = nouvelleTentatives >= maxAttempts

      if (doitBloquer) {
        // Calcul dynamique de la durée de blocage (escalade ×4)
        const minutes    = this.prochainBlocage(user.blocageMinutes, await this.params.getNumber('auth.duree_blocage_minutes'))
        const debloquage = new Date(Date.now() + minutes * 60_000)

        await this.prisma.utilisateur.update({
          where: { id: user.id },
          data: {
            tentativesEchec: nouvelleTentatives,
            statut:          'BLOQUE',
            blocageJusquA:   debloquage,
            blocageMinutes:  minutes,
          },
        })
        await this.journaliser(user.id, dto.login, 'ECHEC_MOT_DE_PASSE', ipAdresse, userAgent)

        const heures = minutes >= 60 ? ` (${Math.round(minutes / 60 * 10) / 10} h)` : ''
        throw new UnauthorizedException(
          `Trop de tentatives. Compte bloqué pour ${minutes} minute${minutes > 1 ? 's' : ''}${heures}`,
        )
      }

      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data:  { tentativesEchec: nouvelleTentatives },
      })
      await this.journaliser(user.id, dto.login, 'ECHEC_MOT_DE_PASSE', ipAdresse, userAgent)

      const restantes = maxAttempts - nouvelleTentatives
      throw new UnauthorizedException(
        `Identifiant ou mot de passe incorrect. ${restantes} tentative(s) restante(s)`,
      )
    }

    // 5. Succès → réinitialiser compteur + escalade (login réussi = ardoise propre)
    if (user.tentativesEchec > 0 || user.blocageMinutes > 0) {
      await this.prisma.utilisateur.update({
        where: { id: user.id },
        data:  { tentativesEchec: 0, blocageMinutes: 0 },
      })
    }

    const roles       = user.roles.map(ur => ur.role.code) as Role[]
    const siteId      = user.siteId
    const permissions = await chargerPermissions(this.prisma, user.id)
    const personnelMedicalId = user.personnelMedicalId

    // 6. TOTP activé → retourner un token temporaire (step 2 du flow)
    if (user.configTotp?.actif) {
      const tempToken = await this.signTempToken(user.id, siteId, roles)
      await this.journaliser(user.id, dto.login, 'SUCCES_LOGIN_TOTP_REQUIS', ipAdresse, userAgent)
      return { requireTotp: true, tempToken }
    }

    // 7. Pas de TOTP → créer la session finale
    const tokens = await this.creerSession(user.id, siteId, roles, permissions, personnelMedicalId, ipAdresse, userAgent, dto.posteLocalId)
    await this.journaliser(user.id, dto.login, 'SUCCES_LOGIN', ipAdresse, userAgent)

    return {
      requireTotp:  false,
      ...tokens,
      user: { id: user.id, login: user.login, siteId, roles, permissions, personnelMedicalId },
    }
  }

  // ── POST /auth/totp/verify ────────────────────────────────────────────────

  async verifyTotp(
    dto:        TotpVerifyDto,
    ipAdresse?: string,
    userAgent?: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Omit<UserSession, 'token'> }> {
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
      where:   { id: payload.sub },
      include: {
        roles:      { include: { role: true } },
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
    let authentifie    = false
    let viaCodeSecours = false

    if (estTotp) {
      const { valid } = verifySync({
        token:          dto.code,
        secret:         decryptSecret(user.configTotp.secretChiffre),
        strategy:       'totp',
        epochTolerance: 30,
      })
      authentifie = valid
    } else {
      // Normalisation : majuscules, sans espaces, tiret ré-inséré → « XXXX-XXXX »
      const brut     = dto.code.trim().toUpperCase().replace(/\s+/g, '')
      const candidat = brut.includes('-') ? brut : brut.replace(/^(.{4})(.{4})$/, '$1-$2')
      const codes = await this.prisma.codeSecoursTotp.findMany({
        where: { configId: user.configTotp.id, utilise: false },
      })
      for (const c of codes) {
        if (await bcrypt.compare(candidat, c.codeHash)) {
          await this.prisma.codeSecoursTotp.update({
            where: { id: c.id }, data: { utilise: true, utilisedAt: new Date() },
          })
          authentifie    = true
          viaCodeSecours = true
          break
        }
      }
    }

    if (!authentifie) {
      await this.journaliser(user.id, user.login, 'ECHEC_CODE_TOTP', ipAdresse, userAgent)
      throw new UnauthorizedException('Code TOTP invalide ou expiré')
    }

    // 4. Créer la session finale
    const roles       = user.roles.map(ur => ur.role.code) as Role[]
    const permissions = await chargerPermissions(this.prisma, user.id)
    const personnelMedicalId = user.personnelMedicalId
    const tokens = await this.creerSession(user.id, user.siteId, roles, permissions, personnelMedicalId, ipAdresse, userAgent, dto.posteLocalId)
    await this.journaliser(
      user.id, user.login,
      viaCodeSecours ? 'SUCCES_LOGIN_CODE_SECOURS' : 'SUCCES_LOGIN_TOTP',
      ipAdresse, userAgent,
    )

    return {
      ...tokens,
      user: { id: user.id, login: user.login, siteId: user.siteId, roles, permissions, personnelMedicalId },
    }
  }

  // ── POST /auth/refresh ────────────────────────────────────────────────────

  /**
   * Échange un refresh token valide contre un nouveau couple access/refresh token.
   * Rotation : l'ancienne session est révoquée, une nouvelle est créée.
   */
  async refresh(
    dto: RefreshDto,
  ): Promise<{ accessToken: string; refreshToken: string; user: Omit<UserSession, 'token'> }> {
    // 1. Décoder + vérifier la signature du refresh token
    let sub: string
    let sid: string | undefined
    try {
      const payload = await this.jwt.verifyAsync<{ sub: string; type: string; sid?: string }>(dto.refreshToken, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
      })
      if (payload.type !== 'refresh') throw new Error('mauvais type')
      sub = payload.sub
      sid = payload.sid
    } catch {
      throw new UnauthorizedException('Refresh token invalide ou expiré')
    }

    // 2-3. Retrouver LA session liée à ce token et vérifier SON état.
    // ⚠️ On NE PEUT PAS boucler sur les sessions avec `bcrypt.compare` : bcrypt ne hache que
    // les 72 PREMIERS octets, IDENTIQUES pour tous les refresh tokens d'un même utilisateur
    // (en-tête JWT + début du payload `sub`) → tous les hash collisionnent, et révoquer UNE
    // session ne « libère » pas le token (il matche les autres). On retrouve donc la session
    // par son `sid` (unique, signé dans le token) et on contrôle SON `revokedAt`.
    type SessionLite = { id: string; utilisateurId: string; revokedAt: Date | null; expiresAt: Date; refreshTokenHash: string; posteLocalId: string | null }
    let matchingSession: SessionLite | null = null
    if (sid) {
      const s = await this.prisma.sessionUtilisateur.findUnique({ where: { id: sid } })
      if (
        s && s.utilisateurId === sub && !s.revokedAt && s.expiresAt > new Date() &&
        (await bcrypt.compare(dto.refreshToken, s.refreshTokenHash))
      ) {
        matchingSession = s
      }
    } else {
      // Rétro-compat : anciens tokens SANS `sid` (boucle imparfaite mais inoffensive le temps
      // que les sessions historiques expirent ; tous les nouveaux tokens portent un `sid`).
      const sessions = await this.prisma.sessionUtilisateur.findMany({
        where: { utilisateurId: sub, revokedAt: null, expiresAt: { gt: new Date() } },
      })
      for (const session of sessions) {
        if (await bcrypt.compare(dto.refreshToken, session.refreshTokenHash)) { matchingSession = session; break }
      }
    }

    if (!matchingSession) {
      throw new UnauthorizedException('Session invalide ou expirée. Veuillez vous reconnecter')
    }

    // 4. Récupérer l'utilisateur + rôles
    const user = await this.prisma.utilisateur.findUniqueOrThrow({
      where:   { id: sub },
      include: { roles: { include: { role: true } } },
    })

    // 5. Révoquer l'ancienne session
    await this.prisma.sessionUtilisateur.update({
      where: { id: matchingSession.id },
      data:  { revokedAt: new Date() },
    })

    // 6. Créer une nouvelle session (rotation du refresh token)
    const roles       = user.roles.map(ur => ur.role.code) as Role[]
    const permissions = await chargerPermissions(this.prisma, user.id)
    const personnelMedicalId = user.personnelMedicalId
    // Préserve le type de session (synchro vs app) : on conserve le posteLocalId d'origine.
    const tokens = await this.creerSession(user.id, user.siteId, roles, permissions, personnelMedicalId, undefined, undefined, matchingSession.posteLocalId)

    return {
      ...tokens,
      user: { id: user.id, login: user.login, siteId: user.siteId, roles, permissions, personnelMedicalId },
    }
  }

  // ── POST /auth/change-password ────────────────────────────────────────────

  /**
   * Modifie le mot de passe d'un utilisateur authentifié.
   * Vérifie le mot de passe actuel avant d'appliquer le changement.
   */
  async changePassword(utilisateurId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.utilisateur.findUniqueOrThrow({
      where: { id: utilisateurId },
    })

    // Vérifier le mot de passe actuel
    const isValid = await bcrypt.compare(dto.motDePasseActuel, user.passwordHash)
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
      data:  { passwordHash: newHash, motDePasseTemp: false },
    })

    await this.journaliser(utilisateurId, user.login, 'SUCCES_CHANGEMENT_MDP')
  }

  // ── Helpers privés ────────────────────────────────────────────────────────

  /**
   * Crée une SessionUtilisateur en DB et retourne les deux tokens JWT.
   */
  private async creerSession(
    utilisateurId:      string,
    siteId:             string,
    roles:              Role[],
    permissions:        PermissionCode[],
    personnelMedicalId: string | null,
    ipAdresse?:         string,
    userAgent?:         string,
    /** Si rempli → session de SYNCHRO (backend embarqué d'un poste) : EXEMPTÉE de la
     *  « session unique » (sinon le login app casserait la synchro du poste). */
    posteLocalId?:      string | null,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    // Identifiant de session pré-généré → embarqué dans le JWT (sid) ET utilisé
    // comme clé primaire de la SessionUtilisateur, pour la gestion des sessions.
    const sid = randomUUID()
    // TTL du token d'accès = paramètre système `auth.session_timeout_minutes` (live).
    const ttlMinutes   = await this.params.getNumber('auth.session_timeout_minutes')
    const accessTtlSec = Math.max(ttlMinutes, 1) * 60

    const jwtPayload: Omit<JwtPayload, 'iat' | 'exp'> = {
      sub: utilisateurId, siteId, roles, permissions, personnelMedicalId, sid,
    }

    // Générer access token + refresh token en parallèle
    // On passe l'expiry en secondes (number) pour éviter la dépendance sur StringValue (ms)
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(jwtPayload,                                    { expiresIn: accessTtlSec }),
      // `sid` rend CHAQUE refresh token UNIQUE (sinon deux tokens du même user signés dans
      // la même seconde sont identiques → même hash sur plusieurs sessions → la rotation ne
      // révoque pas réellement l'ancien token). Lié à sa session par construction.
      this.jwt.signAsync({ sub: utilisateurId, type: 'refresh', sid }, { expiresIn: this.REFRESH_TOKEN_TTL }),
    ])

    // Stocker uniquement le hash du refresh token (jamais le token brut)
    const refreshTokenHash = await bcrypt.hash(refreshToken, 10)
    const expiresAt        = new Date(Date.now() + this.REFRESH_TOKEN_TTL * 1000) // 7 jours

    await this.prisma.sessionUtilisateur.create({
      data: { id: sid, utilisateurId, refreshTokenHash, ipAdresse, userAgent, expiresAt, posteLocalId: posteLocalId ?? null },
    })

    // SESSION UNIQUE par utilisateur — UNIQUEMENT pour les postes APP INTERACTIFS (sans
    // posteLocalId). On révoque les AUTRES sessions APP du même utilisateur (l'ancien poste
    // sera refusé au prochain appel CÔTÉ CENTRAL via jwt.strategy) et on les déconnecte
    // INSTANTANÉMENT via SSE. Les sessions de SYNCHRO (posteLocalId rempli) sont EXEMPTÉES :
    // chaque poste garde sa synchro en arrière-plan.
    if (!posteLocalId) {
      const autres = await this.prisma.sessionUtilisateur.findMany({
        where:  { utilisateurId, revokedAt: null, posteLocalId: null, NOT: { id: sid } },
        select: { id: true },
      })
      if (autres.length) {
        const ids = autres.map((s) => s.id)
        await this.prisma.sessionUtilisateur.updateMany({
          where: { id: { in: ids } },
          data:  { revokedAt: new Date() },
        })
        try {
          this.moduleRef.get(NotificationService, { strict: false }).pushSessionRevoked(utilisateurId, ids)
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
  private signTempToken(sub: string, siteId: string, roles: Role[]): Promise<string> {
    return this.jwt.signAsync(
      { sub, siteId, roles, step: 'totp' },
      { expiresIn: this.TEMP_TOKEN_TTL },
    )
  }

  // ── POST /auth/logout ────────────────────────────────────────────────────

  /**
   * Révoque toutes les sessions actives de l'utilisateur.
   */
  async logout(utilisateurId: string): Promise<void> {
    await this.prisma.sessionUtilisateur.updateMany({
      where: { utilisateurId, revokedAt: null },
      data:  { revokedAt: new Date() },
    })
    await this.journaliser(utilisateurId, utilisateurId, 'SUCCES_LOGOUT')
  }

  // ── GET /auth/me ─────────────────────────────────────────────────────────

  /**
   * Retourne le profil complet de l'utilisateur connecté (données fraîches de la DB).
   */
  async getCurrentUser(utilisateurId: string): Promise<Omit<UserSession, 'token'>> {
    const user = await this.prisma.utilisateur.findUniqueOrThrow({
      where:   { id: utilisateurId },
      include: { roles: { include: { role: true } } },
    })

    const roles       = user.roles.map(ur => ur.role.code) as Role[]
    const permissions = await chargerPermissions(this.prisma, user.id)

    return {
      id:                 user.id,
      login:              user.login,
      siteId:             user.siteId,
      roles,
      permissions,
      personnelMedicalId: user.personnelMedicalId,
    }
  }

  /**
   * Enregistre chaque tentative d'authentification dans le journal.
   * Silencieux en cas d'erreur pour ne pas masquer l'erreur principale.
   */
  private async journaliser(
    utilisateurId: string | null,
    login:         string,
    resultat:      string,
    ipAdresse?:    string,
    userAgent?:    string,
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
