/**
 * MeService — « Mon compte » : réglages propres à l'utilisateur connecté.
 *
 *   - Préférences d'affichage (thème, densité, langue, page d'accueil…)
 *   - Sessions actives (liste / révocation)
 *   - Double authentification TOTP individuelle (auto-hébergée, otplib)
 *
 * Aucune permission spéciale : chaque utilisateur gère SON propre compte.
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common'
import { randomBytes } from 'crypto'
import * as bcrypt from 'bcrypt'
import { generateSecret, generateURI, verifySync } from 'otplib'
import { PrismaService } from '../../prisma/prisma.service'
import { ParametresService } from '../parametres/parametres.service'
import { UpdatePreferencesDto } from './dto/me.dto'
import { encryptSecret, decryptSecret } from '../../common/crypto/totp-secret'
import { resolveGeo } from '../../common/geo/geo.util'

const PREF_DEFAULTS = {
  theme: 'auto', densite: 'confort', langue: 'fr',
  pageAccueil: 'dashboard', lignesParPage: 25, notifEmail: true,
}

// Version courante des Conditions d'utilisation. Bumper cette valeur (ex. 'v2')
// re-demande l'acceptation à TOUS les utilisateurs. Doit rester alignée avec le
// frontend (ConditionsModal CGU_VERSION).
export const CGU_VERSION = 'v1-2026.06'

@Injectable()
export class MeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly params: ParametresService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════
  //  PRÉFÉRENCES
  // ════════════════════════════════════════════════════════════════════════

  async getPreferences(userId: string) {
    const p = await this.prisma.preferenceUtilisateur.findUnique({ where: { utilisateurId: userId } })
    if (p) return { ...p, cguAJour: p.cguVersion === CGU_VERSION, cguVersionRequise: CGU_VERSION }
    // Valeurs par défaut (langue = défaut établissement) sans créer de ligne
    const langue = (await this.params.getValue('etab.langue_defaut')) || PREF_DEFAULTS.langue
    return {
      utilisateurId: userId, ...PREF_DEFAULTS, langue, updatedAt: null,
      cguAccepteeLe: null, cguVersion: null, cguAJour: false, cguVersionRequise: CGU_VERSION,
    }
  }

  /** Enregistre l'acceptation des CGU (version serveur courante) par l'utilisateur. */
  async accepterCgu(userId: string) {
    await this.prisma.preferenceUtilisateur.upsert({
      where:  { utilisateurId: userId },
      update: { cguAccepteeLe: new Date(), cguVersion: CGU_VERSION },
      create: { utilisateurId: userId, ...PREF_DEFAULTS, cguAccepteeLe: new Date(), cguVersion: CGU_VERSION },
    })
    return { ok: true, cguVersion: CGU_VERSION }
  }

  async updatePreferences(userId: string, dto: UpdatePreferencesDto) {
    const data: Record<string, unknown> = {}
    if (dto.theme        !== undefined) data.theme        = dto.theme
    if (dto.densite      !== undefined) data.densite      = dto.densite
    if (dto.langue       !== undefined) data.langue       = dto.langue
    if (dto.pageAccueil  !== undefined) data.pageAccueil  = dto.pageAccueil
    if (dto.lignesParPage !== undefined) data.lignesParPage = dto.lignesParPage
    if (dto.notifEmail   !== undefined) data.notifEmail   = dto.notifEmail

    return this.prisma.preferenceUtilisateur.upsert({
      where:  { utilisateurId: userId },
      update: data,
      create: { utilisateurId: userId, ...PREF_DEFAULTS, ...data },
    })
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SESSIONS
  // ════════════════════════════════════════════════════════════════════════

  async listSessions(userId: string, currentSid: string | null) {
    const sessions = await this.prisma.sessionUtilisateur.findMany({
      where:   { utilisateurId: userId, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
      select:  { id: true, ipAdresse: true, userAgent: true, createdAt: true, expiresAt: true },
    })
    // Localisation (ville + coordonnées) dérivée de l'IP — ajoutée à la lecture.
    return Promise.all(sessions.map(async s => ({
      ...s,
      current:      s.id === currentSid,
      localisation: await resolveGeo(s.ipAdresse),
    })))
  }

  async revokeSession(userId: string, sessionId: string, currentSid: string | null) {
    const s = await this.prisma.sessionUtilisateur.findFirst({
      where: { id: sessionId, utilisateurId: userId },
    })
    if (!s) throw new NotFoundException('Session introuvable')
    await this.prisma.sessionUtilisateur.update({
      where: { id: sessionId }, data: { revokedAt: new Date() },
    })
    return { success: true, wasCurrent: sessionId === currentSid }
  }

  async revokeOtherSessions(userId: string, currentSid: string | null) {
    const res = await this.prisma.sessionUtilisateur.updateMany({
      where: {
        utilisateurId: userId, revokedAt: null,
        ...(currentSid ? { id: { not: currentSid } } : {}),
      },
      data: { revokedAt: new Date() },
    })
    return { success: true, count: res.count }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  2FA — TOTP individuel (auto-hébergé)
  // ════════════════════════════════════════════════════════════════════════

  async totpStatus(userId: string) {
    const cfg = await this.prisma.configurationTotp.findUnique({ where: { utilisateurId: userId } })
    return { actif: !!cfg?.actif, enAttente: !!cfg && !cfg.actif }
  }

  /** Étape 1 : génère un secret + l'URI otpauth (à scanner). N'active pas encore. */
  async totpSetup(userId: string) {
    const user = await this.prisma.utilisateur.findUniqueOrThrow({ where: { id: userId } })
    const cfg  = await this.prisma.configurationTotp.findUnique({ where: { utilisateurId: userId } })
    if (cfg?.actif) throw new BadRequestException('La double authentification est déjà activée.')

    const secret = generateSecret()
    // Le secret est chiffré AVANT stockage (AES-256-GCM) ; seule la version en
    // clair sert à construire l'URI otpauth scannée par l'utilisateur.
    const secretChiffre = encryptSecret(secret)
    await this.prisma.configurationTotp.upsert({
      where:  { utilisateurId: userId },
      update: { secretChiffre, actif: false, activatedAt: null },
      create: { utilisateurId: userId, secretChiffre, actif: false },
    })

    const issuer     = (await this.params.getValue('etab.nom')) || 'CMS SARIS'
    const otpauthUrl = generateURI({ secret, issuer, label: user.login, strategy: 'totp' })
    return { secret, otpauthUrl, issuer }
  }

  /** Étape 2 : vérifie un code, active la 2FA, renvoie les codes de secours (une seule fois). */
  async totpActivate(userId: string, code: string) {
    const cfg = await this.prisma.configurationTotp.findUnique({ where: { utilisateurId: userId } })
    if (!cfg) throw new BadRequestException('Aucune configuration en attente. Lancez d\'abord la configuration.')
    if (cfg.actif) throw new BadRequestException('La double authentification est déjà activée.')

    const { valid } = verifySync({ token: code, secret: decryptSecret(cfg.secretChiffre), strategy: 'totp', epochTolerance: 30 })
    if (!valid) throw new BadRequestException('Code invalide. Vérifiez votre application d\'authentification.')

    // Codes de secours (8 codes lisibles type XXXX-XXXX), hachés en base.
    const codes = Array.from({ length: 8 }, () => {
      const h = randomBytes(4).toString('hex').toUpperCase()
      return `${h.slice(0, 4)}-${h.slice(4, 8)}`
    })

    await this.prisma.$transaction(async tx => {
      await tx.configurationTotp.update({
        where: { utilisateurId: userId }, data: { actif: true, activatedAt: new Date() },
      })
      await tx.codeSecoursTotp.deleteMany({ where: { configId: cfg.id } })
      for (const c of codes) {
        await tx.codeSecoursTotp.create({ data: { configId: cfg.id, codeHash: await bcrypt.hash(c, 10) } })
      }
    })

    await this.audit(userId, 'TOTP_ACTIVE')
    return { success: true, backupCodes: codes }
  }

  /** Désactive la 2FA après vérification d'un code TOTP valide. */
  async totpDisable(userId: string, code: string) {
    const cfg = await this.prisma.configurationTotp.findUnique({ where: { utilisateurId: userId } })
    if (!cfg || !cfg.actif) throw new BadRequestException('La double authentification n\'est pas activée.')

    const { valid } = verifySync({ token: code, secret: decryptSecret(cfg.secretChiffre), strategy: 'totp', epochTolerance: 30 })
    if (!valid) throw new BadRequestException('Code invalide.')

    await this.prisma.$transaction(async tx => {
      await tx.codeSecoursTotp.deleteMany({ where: { configId: cfg.id } })
      await tx.configurationTotp.delete({ where: { utilisateurId: userId } })
    })

    await this.audit(userId, 'TOTP_DESACTIVE')
    return { success: true }
  }

  // ── Helper audit ────────────────────────────────────────────────────────────
  private async audit(userId: string, action: string) {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId: userId, action, module: 'utilisateur',
          entiteType: 'Utilisateur', entiteId: userId, statut: 'SUCCES',
        },
      })
    } catch { /* l'audit ne bloque jamais */ }
  }
}
