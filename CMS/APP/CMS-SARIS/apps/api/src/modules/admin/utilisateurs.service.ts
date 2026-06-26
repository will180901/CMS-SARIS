/**
 * UtilisateursService — Administration des comptes utilisateur.
 *
 * Couvre :
 *   - CRUD comptes (avec hash mot de passe initial)
 *   - Attribution / révocation de rôles
 *   - Réinitialisation de mot de passe par un administrateur
 *   - Désactivation / réactivation
 *   - Lien avec PersonnelMedical
 *   - Audit complet (JournalAudit)
 */

import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common'
import * as bcrypt from 'bcrypt'
import { randomBytes } from 'crypto'
import { PrismaService } from '../../prisma/prisma.service'
import { CI } from '../../common/prisma/search'
import {
  CreateUtilisateurDto, UpdateUtilisateurDto,
  SetRolesDto, SetStatutDto, ResetPasswordDto, UtilisateurQueryDto,
} from './dto/utilisateur.dto'
import { SetPermissionOverridesDto, BulkPermissionDto } from './dto/permission-override.dto'
import { ParametresService } from '../parametres/parametres.service'
import { NotificationService } from '../notification/notification.service'
import { VITAL_GOVERNANCE_PERMISSIONS } from '../../common/governance'

// ── Permissions vitales de gouvernance (source unique partagée) ───────────────
// On interdit de les RÉVOQUER à soi-même ou au dernier administrateur système actif.
const PERMS_VITALES_OVERRIDE = VITAL_GOVERNANCE_PERMISSIONS

// ── Includes Prisma standardisés ──────────────────────────────────────────────

const UTILISATEUR_INCLUDE = {
  site: { select: { id: true, code: true, libelle: true } },
  roles: { include: { role: { select: { id: true, code: true, libelle: true } } } },
  personnelMedical: {
    select: { id: true, nom: true, prenom: true, matricule: true, role: true, statut: true },
  },
} as const

@Injectable()
export class UtilisateursService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly params: ParametresService,
    private readonly notif: NotificationService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  // Cloisonnement multi-site : `siteId` (issu du JWT) restreint l'accès aux
  // seuls comptes du site de l'administrateur. Un compte d'un autre site est
  // traité comme inexistant (404) — pas de fuite inter-sites ni d'IDOR.
  private async getOrThrow(id: string, siteId?: string) {
    const u = await this.prisma.utilisateur.findFirst({
      where:   siteId ? { id, siteId } : { id },
      include: UTILISATEUR_INCLUDE,
    })
    if (!u) throw new NotFoundException('Utilisateur introuvable')
    return u
  }

  /** Convertit un objet Utilisateur DB en objet API (sans hash) */
  private sanitize(u: Awaited<ReturnType<typeof this.getOrThrow>>) {
    const { passwordHash, ...rest } = u
    return {
      ...rest,
      roles: u.roles.map(ur => ur.role),
    }
  }

  /** Nombre d'administrateurs système ACTIFS (garde-fou « dernier admin ») */
  private async countActiveAdmins(): Promise<number> {
    return this.prisma.utilisateur.count({
      where: { statut: 'ACTIF', roles: { some: { role: { code: 'ADMIN_SYSTEME' } } } },
    })
  }

  /** Enregistre une trace d'audit */
  private async audit(
    utilisateurId: string | null,
    action:        string,
    entiteId:      string | null,
    avant:         any,
    apres:         any,
    statut:        'SUCCES' | 'ECHEC' = 'SUCCES',
  ) {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId,
          action,
          module:     'utilisateur',
          entiteType: 'Utilisateur',
          entiteId,
          avantJson:  avant ?? undefined,
          apresJson:  apres ?? undefined,
          statut,
        },
      })
    } catch {
      // L'audit ne doit jamais bloquer l'opération métier.
    }
  }

  // ── Liste ─────────────────────────────────────────────────────────────────

  async findAll(query: UtilisateurQueryDto, siteId: string) {
    // Cloisonnement : on force toujours le site du JWT. Le `query.siteId`
    // éventuel est ignoré (un admin ne liste que les comptes de son site).
    const where: any = { siteId }

    if (query.statut) where.statut = query.statut
    if (query.roleId) where.roles  = { some: { roleId: query.roleId } }

    if (query.search?.trim()) {
      const q = query.search.trim()
      where.OR = [
        { login: { contains: q, ...CI } },
        { email: { contains: q, ...CI } },
        { personnelMedical: { nom:    { contains: q, ...CI } } },
        { personnelMedical: { prenom: { contains: q, ...CI } } },
      ]
    }

    const users = await this.prisma.utilisateur.findMany({
      where,
      include: UTILISATEUR_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    return users.map(u => this.sanitize(u))
  }

  // ── Détail ────────────────────────────────────────────────────────────────

  async findById(id: string, siteId: string) {
    const u = await this.getOrThrow(id, siteId)
    const totp = await this.prisma.configurationTotp.findUnique({
      where: { utilisateurId: id }, select: { actif: true },
    })
    return { ...this.sanitize(u), aDeuxFacteurs: !!totp?.actif }
  }

  // Plusieurs médecins-chefs sont autorisés : depuis la réduction à 3 rôles, MEDECIN_CHEF
  // EST le rôle « médecin » (le rôle MEDECIN générique a été retiré) — un CMS a en général
  // plus d'un médecin. L'ancienne contrainte « un seul médecin-chef » a donc été retirée.

  // ── Créer ─────────────────────────────────────────────────────────────────

  async create(dto: CreateUtilisateurDto, acteurId: string | null, siteId: string) {
    // Vérifications préalables — sur le client BRUT (`raw`) car les contraintes
    // @unique (login / email / personnelMedicalId) restent occupées par les
    // comptes SOFT-supprimés (tombstones), invisibles du client filtré.
    const [loginTaken, emailTaken] = await Promise.all([
      this.prisma.raw.utilisateur.findUnique({ where: { login: dto.login }, select: { id: true, deletedAt: true } }),
      this.prisma.raw.utilisateur.findUnique({ where: { email: dto.email }, select: { id: true, deletedAt: true } }),
    ])
    if (loginTaken) throw new ConflictException(loginTaken.deletedAt ? 'Ce login appartient à un compte supprimé' : 'Ce login est déjà utilisé')
    if (emailTaken) throw new ConflictException(emailTaken.deletedAt ? 'Cet email appartient à un compte supprimé' : 'Cet email est déjà utilisé')

    // Le personnel ne doit pas déjà être lié à un autre compte
    if (dto.personnelMedicalId) {
      const personnelLink = await this.prisma.raw.utilisateur.findUnique({
        where: { personnelMedicalId: dto.personnelMedicalId },
        select: { id: true, deletedAt: true },
      })
      if (personnelLink) throw new ConflictException(
        personnelLink.deletedAt
          ? 'Ce personnel médical est lié à un compte utilisateur supprimé'
          : 'Ce personnel médical est déjà lié à un autre compte utilisateur',
      )
      const personnelExists = await this.prisma.personnelMedical.findUnique({
        where: { id: dto.personnelMedicalId },
      })
      if (!personnelExists) throw new NotFoundException('Personnel médical introuvable')
    }

    // Vérifier les rôles
    const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } })
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('Un ou plusieurs rôles sont invalides')
    }

    // Fusion compte ↔ fiche clinique (recueil) : un compte de rôle clinique
    // (MEDECIN_CHEF / INFIRMIER) sans personnel lié EXIGE une identité (nom/prénom/
    // matricule) — le backend crée alors la fiche PersonnelMedical et la lie.
    const codes = roles.map(r => r.code)
    const isClinical = codes.includes('MEDECIN_CHEF') || codes.includes('INFIRMIER')
    if (!dto.personnelMedicalId && isClinical) {
      if (!dto.nom || !dto.prenom || !dto.matricule) {
        throw new BadRequestException('Un compte soignant nécessite un nom, un prénom et un matricule.')
      }
      const dupMat = await this.prisma.raw.personnelMedical.findUnique({
        where: { matricule: dto.matricule }, select: { id: true, deletedAt: true },
      })
      if (dupMat) throw new ConflictException(
        dupMat.deletedAt ? `Le matricule "${dto.matricule}" appartient à un agent supprimé` : `Le matricule "${dto.matricule}" est déjà utilisé`,
      )
    }

    // Cloisonnement : un compte est toujours créé sur le site de l'admin (JWT).
    // Toute valeur `dto.siteId` divergente est refusée (pas de création
    // inter-sites).
    if (dto.siteId && dto.siteId !== siteId) {
      throw new BadRequestException('Création d’un compte sur un autre site non autorisée')
    }
    const site = await this.prisma.site.findUnique({ where: { id: siteId } })
    if (!site) throw new NotFoundException('Site introuvable')

    // Politique de mot de passe en vigueur (paramètres système live)
    await this.params.assertPasswordValid(dto.motDePasseInitial)

    const passwordHash = await bcrypt.hash(dto.motDePasseInitial, 12)

    const created = await this.prisma.$transaction(async tx => {
      // Fiche clinique créée AVEC le compte (soignant sans personnel existant).
      let personnelMedicalId = dto.personnelMedicalId ?? null
      if (!personnelMedicalId && isClinical) {
        const metier = codes.includes('MEDECIN_CHEF') ? 'MEDECIN' : 'INFIRMIER'
        const p = await tx.personnelMedical.create({
          data: { nom: dto.nom!, prenom: dto.prenom!, matricule: dto.matricule!, role: metier, siteId, statut: 'ACTIF' },
        })
        personnelMedicalId = p.id
      }
      const u = await tx.utilisateur.create({
        data: {
          login:              dto.login,
          email:              dto.email,
          passwordHash,
          statut:             'ACTIF',
          motDePasseTemp:     true,                  // l'utilisateur devra le changer
          siteId,                                    // toujours le site du JWT (cloisonnement)
          personnelMedicalId,
          createdBy:          acteurId ?? null,
        },
      })
      await tx.utilisateurRole.createMany({
        data: dto.roleIds.map(roleId => ({ utilisateurId: u.id, roleId })),
      })
      return u
    })

    const full = await this.getOrThrow(created.id)
    await this.audit(acteurId, 'CREATE', created.id, null, this.sanitize(full))

    await this.notif.emit({
      type:               'UTILISATEUR_CREE',
      niveau:             'INFO',
      category:           'administratif',
      titre:              'Nouveau compte utilisateur',
      message:            `Le compte « ${dto.login} » a été créé.`,
      siteId,
      requiredPermission: 'utilisateur.read',
      entiteType:         'utilisateur',
      entiteId:           created.id,
      lien:               '/admin/utilisateurs',
      createdById:        acteurId ?? undefined,
    })

    return this.sanitize(full)
  }

  // ── Modifier ──────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateUtilisateurDto, acteurId: string | null, siteId: string) {
    const avant = await this.getOrThrow(id, siteId)

    // Cloisonnement : interdit de déplacer un compte vers un autre site.
    if (dto.siteId !== undefined && dto.siteId !== siteId) {
      throw new BadRequestException('Déplacement du compte vers un autre site non autorisé')
    }

    // Si on change l'email, vérifier qu'il n'est pas pris — client BRUT (`raw`)
    // pour aussi détecter les tombstones occupant la contrainte @unique.
    if (dto.email && dto.email !== avant.email) {
      const taken = await this.prisma.raw.utilisateur.findUnique({ where: { email: dto.email }, select: { id: true, deletedAt: true } })
      if (taken && taken.id !== id) {
        throw new ConflictException(taken.deletedAt ? 'Cet email appartient à un compte supprimé' : 'Cet email est déjà utilisé')
      }
    }

    // Lien personnel : pas de doublon — client BRUT (`raw`) pour voir les tombstones.
    if (dto.personnelMedicalId && dto.personnelMedicalId !== avant.personnelMedicalId) {
      const link = await this.prisma.raw.utilisateur.findUnique({
        where: { personnelMedicalId: dto.personnelMedicalId },
        select: { id: true, deletedAt: true },
      })
      if (link && link.id !== id) {
        throw new ConflictException(
          link.deletedAt
            ? 'Ce personnel médical est lié à un compte utilisateur supprimé'
            : 'Ce personnel médical est déjà lié à un autre compte',
        )
      }
    }

    const data: any = {}
    if (dto.email !== undefined)              data.email              = dto.email
    if (dto.siteId !== undefined)             data.siteId             = dto.siteId
    if (dto.personnelMedicalId !== undefined) data.personnelMedicalId = dto.personnelMedicalId
    data.updatedBy = acteurId ?? null

    await this.prisma.utilisateur.update({ where: { id }, data })
    const after = await this.getOrThrow(id)

    await this.audit(acteurId, 'UPDATE', id, this.sanitize(avant), this.sanitize(after))
    return this.sanitize(after)
  }

  // ── Attribuer / changer les rôles ─────────────────────────────────────────

  async setRoles(id: string, dto: SetRolesDto, acteurId: string | null, siteId: string) {
    const avant = await this.getOrThrow(id, siteId)

    const roles = await this.prisma.role.findMany({ where: { id: { in: dto.roleIds } } })
    if (roles.length !== dto.roleIds.length) {
      throw new BadRequestException('Un ou plusieurs rôles sont invalides')
    }

    // Garde-fou : si l'utilisateur se modifie lui-même, il doit garder un rôle
    // qui contient la permission `utilisateur.assign_role` ou `role.update` pour
    // éviter de se castrer.
    if (acteurId && acteurId === id) {
      const codesApres = roles.map(r => r.code)
      const permsApres = new Set<string>()
      for (const role of roles) {
        const rp = await this.prisma.rolePermission.findMany({
          where:   { roleId: role.id },
          include: { permission: true },
        })
        for (const x of rp) permsApres.add(x.permission.code)
      }
      if (!permsApres.has('utilisateur.assign_role') && !codesApres.includes('ADMIN_SYSTEME')) {
        throw new ConflictException(
          'Vous ne pouvez pas vous retirer la capacité d\'attribuer des rôles. Demandez à un autre administrateur.',
        )
      }
    }

    // Garde-fou : ne jamais retirer le rôle ADMIN_SYSTEME au DERNIER administrateur
    // système actif (sinon plus personne ne peut gouverner la plateforme).
    const etaitAdmin = avant.roles.some(r => r.role.code === 'ADMIN_SYSTEME')
    const seraAdmin  = roles.some(r => r.code === 'ADMIN_SYSTEME')
    if (etaitAdmin && !seraAdmin) {
      const nbAdmins = await this.countActiveAdmins()
      if (nbAdmins <= 1) {
        throw new ConflictException(
          'Impossible de retirer le rôle « Administrateur Système » au dernier administrateur actif.',
        )
      }
    }

    await this.prisma.$transaction(async tx => {
      await tx.utilisateurRole.deleteMany({ where: { utilisateurId: id } })
      await tx.utilisateurRole.createMany({
        data: dto.roleIds.map(roleId => ({ utilisateurId: id, roleId })),
      })
      await tx.utilisateur.update({ where: { id }, data: { updatedBy: acteurId ?? null } })
    })

    const after = await this.getOrThrow(id)
    await this.audit(acteurId, 'SET_ROLES', id,
      { roles: avant.roles.map(r => r.role.code) },
      { roles: after.roles.map(r => r.role.code) },
    )
    return this.sanitize(after)
  }

  // ── Changer le statut (activer/désactiver/débloquer) ──────────────────────

  async setStatut(id: string, dto: SetStatutDto, acteurId: string | null, siteId: string) {
    const avant = await this.getOrThrow(id, siteId)

    // Garde-fou : on ne peut pas se désactiver soi-même.
    // Un autre administrateur doit s'en charger pour éviter le risque de
    // se priver d'accès au système.
    if (acteurId && acteurId === id && dto.statut === 'DESACTIVE') {
      throw new ConflictException(
        'Vous ne pouvez pas désactiver votre propre compte. Demandez à un autre administrateur.',
      )
    }

    // Garde-fou : ne jamais désactiver le DERNIER administrateur système actif
    // (couvre le cas d'un autre opérateur qui tenterait de le désactiver).
    if (dto.statut === 'DESACTIVE' && avant.statut === 'ACTIF'
        && avant.roles.some(r => r.role.code === 'ADMIN_SYSTEME')) {
      const nbAdmins = await this.countActiveAdmins()
      if (nbAdmins <= 1) {
        throw new ConflictException(
          'Impossible de désactiver le dernier administrateur système actif.',
        )
      }
    }

    const data: any = { statut: dto.statut, updatedBy: acteurId ?? null }
    // Si on débloque ou réactive, on réinitialise les compteurs
    if (dto.statut === 'ACTIF') {
      data.tentativesEchec = 0
      data.blocageJusquA   = null
      data.blocageMinutes  = 0
    }

    await this.prisma.utilisateur.update({ where: { id }, data })
    // Si désactivation → révoquer toutes les sessions actives
    if (dto.statut === 'DESACTIVE') {
      await this.prisma.sessionUtilisateur.updateMany({
        where: { utilisateurId: id, revokedAt: null },
        data:  { revokedAt: new Date() },
      })
    }

    const after = await this.getOrThrow(id)
    await this.audit(acteurId, 'SET_STATUT', id,
      { statut: avant.statut },
      { statut: after.statut, motif: dto.motif ?? null },
    )

    if (after.statut !== avant.statut) {
      const desactive = after.statut === 'DESACTIVE'
      await this.notif.emit({
        type:               desactive ? 'UTILISATEUR_DESACTIVE' : 'UTILISATEUR_REACTIVE',
        niveau:             desactive ? 'AVERTISSEMENT' : 'INFO',
        category:           'administratif',
        titre:              desactive ? 'Compte désactivé' : 'Compte réactivé',
        message:            `Le compte « ${after.login} » a été ${desactive ? 'désactivé' : 'réactivé'}.`,
        siteId,
        requiredPermission: 'utilisateur.read',
        entiteType:         'utilisateur',
        entiteId:           id,
        lien:               '/admin/utilisateurs',
        createdById:        acteurId ?? undefined,
      })
    }

    return this.sanitize(after)
  }

  // ── Réinitialiser le mot de passe (par un admin) ──────────────────────────

  async resetPassword(id: string, dto: ResetPasswordDto, acteurId: string | null, siteId: string) {
    await this.getOrThrow(id, siteId)
    await this.params.assertPasswordValid(dto.nouveauMotDePasse)
    const hash = await bcrypt.hash(dto.nouveauMotDePasse, 12)

    await this.prisma.utilisateur.update({
      where: { id },
      data:  {
        passwordHash:   hash,
        motDePasseTemp: dto.forcerChangement ?? true,
        tentativesEchec: 0,
        blocageJusquA:  null,
        updatedBy:      acteurId ?? null,
      },
    })

    // Révoquer toutes les sessions (sécurité)
    await this.prisma.sessionUtilisateur.updateMany({
      where: { utilisateurId: id, revokedAt: null },
      data:  { revokedAt: new Date() },
    })

    await this.audit(acteurId, 'RESET_PASSWORD', id, null,
      { forcerChangement: dto.forcerChangement ?? true })
    return { success: true }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  RÉCUPÉRATION DE COMPTE (l'admin reprend la main si un agent perd l'accès)
  // ════════════════════════════════════════════════════════════════════════

  /** Retire la double authentification d'un utilisateur qui a perdu son téléphone :
   *  il pourra se reconnecter sans 2FA puis la reconfigurer. */
  async resetTotp(id: string, acteurId: string | null, siteId: string) {
    await this.getOrThrow(id, siteId)
    const cfg = await this.prisma.configurationTotp.findUnique({ where: { utilisateurId: id } })
    if (!cfg) throw new BadRequestException("Cet utilisateur n'a pas de double authentification configurée.")
    await this.prisma.$transaction(async tx => {
      await tx.codeSecoursTotp.deleteMany({ where: { configId: cfg.id } })
      await tx.configurationTotp.delete({ where: { utilisateurId: id } })
    })
    await this.audit(acteurId, 'RESET_TOTP', id, { aDeuxFacteurs: true }, { aDeuxFacteurs: false })
    return { ok: true }
  }

  /** Régénère les codes de secours (2FA active requise). Les codes en clair ne sont
   *  renvoyés QU'UNE fois, à remettre à l'utilisateur. */
  async regenerateBackupCodes(id: string, acteurId: string | null, siteId: string) {
    await this.getOrThrow(id, siteId)
    const cfg = await this.prisma.configurationTotp.findUnique({ where: { utilisateurId: id } })
    if (!cfg || !cfg.actif) throw new BadRequestException("Cet utilisateur n'a pas de double authentification active.")
    const codes = Array.from({ length: 8 }, () => {
      const h = randomBytes(4).toString('hex').toUpperCase()
      return `${h.slice(0, 4)}-${h.slice(4, 8)}`
    })
    await this.prisma.$transaction(async tx => {
      await tx.codeSecoursTotp.deleteMany({ where: { configId: cfg.id } })
      for (const c of codes) {
        await tx.codeSecoursTotp.create({ data: { configId: cfg.id, codeHash: await bcrypt.hash(c, 10) } })
      }
    })
    await this.audit(acteurId, 'REGEN_CODES_SECOURS', id, null, { nbCodes: codes.length })
    return { backupCodes: codes }
  }

  /** Force la déconnexion : révoque toutes les sessions actives de l'utilisateur. */
  async revokeAllSessions(id: string, acteurId: string | null, siteId: string) {
    await this.getOrThrow(id, siteId)
    const res = await this.prisma.sessionUtilisateur.updateMany({
      where: { utilisateurId: id, revokedAt: null },
      data:  { revokedAt: new Date() },
    })
    await this.audit(acteurId, 'FORCE_DECONNEXION', id, null, { sessionsRevoquees: res.count })
    return { count: res.count }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  DÉROGATIONS DE PERMISSIONS PAR UTILISATEUR (GRANT / REVOKE)
  // ════════════════════════════════════════════════════════════════════════

  /**
   * Ventilation des permissions effectives d'un utilisateur :
   *   - fromRoles : héritées de ses rôles
   *   - grants    : accordées individuellement (en plus des rôles)
   *   - revokes   : retirées individuellement
   *   - effective : résultat final = (fromRoles ∪ grants) − revokes
   */
  async getPermissions(id: string, siteId?: string) {
    const u = await this.prisma.utilisateur.findFirst({
      where:   siteId ? { id, siteId } : { id },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
        permissionsOverrides: { include: { permission: true } },
      },
    })
    if (!u) throw new NotFoundException('Utilisateur introuvable')

    const fromRoles = new Set<string>()
    for (const ur of u.roles) {
      for (const rp of ur.role.permissions) fromRoles.add(rp.permission.code)
    }

    const grants  = u.permissionsOverrides.filter(o => o.mode === 'GRANT')
    const revokes = u.permissionsOverrides.filter(o => o.mode === 'REVOKE')

    const effective = new Set<string>(fromRoles)
    for (const g of grants)  effective.add(g.permission.code)
    for (const r of revokes) effective.delete(r.permission.code)

    return {
      utilisateurId: id,
      roles:     u.roles.map(ur => ({ code: ur.role.code, libelle: ur.role.libelle })),
      fromRoles: [...fromRoles],
      grants:    grants.map(o  => ({ code: o.permission.code, motif: o.motif, creeLe: o.createdAt, accordePar: o.accordePar })),
      revokes:   revokes.map(o => ({ code: o.permission.code, motif: o.motif, creeLe: o.createdAt, accordePar: o.accordePar })),
      effective: [...effective],
    }
  }

  /**
   * Remplace l'ENSEMBLE des dérogations d'un utilisateur (PUT idempotent).
   * Le front envoie l'état complet souhaité (grants + revokes).
   */
  async setPermissions(id: string, dto: SetPermissionOverridesDto, acteurId: string | null, siteId: string) {
    await this.getOrThrow(id, siteId)
    const avant = await this.getPermissions(id)

    const grants  = [...new Set(dto.grants  ?? [])]
    const revokes = [...new Set(dto.revokes ?? [])]

    // 1. Une permission ne peut être à la fois accordée ET révoquée
    const conflits = grants.filter(c => revokes.includes(c))
    if (conflits.length) {
      throw new BadRequestException(
        `Permission(s) à la fois accordée(s) et révoquée(s) : ${conflits.join(', ')}`,
      )
    }

    // 2. Tous les codes doivent exister dans le catalogue
    const allCodes = [...new Set([...grants, ...revokes])]
    const perms = allCodes.length
      ? await this.prisma.permission.findMany({ where: { code: { in: allCodes } } })
      : []
    if (perms.length !== allCodes.length) {
      throw new BadRequestException('Une ou plusieurs permissions sont inconnues')
    }

    // 3. Garde-fous sécurité (auto-castration / dernier admin)
    await this.assertOverridesSafe(id, acteurId, revokes)

    // 4. Application transactionnelle (reset + recréation)
    const byCode = new Map(perms.map(p => [p.code, p.id]))
    await this.prisma.$transaction(async tx => {
      await tx.utilisateurPermission.deleteMany({ where: { utilisateurId: id } })
      const rows = [
        ...grants.map(c  => ({ utilisateurId: id, permissionId: byCode.get(c)!, mode: 'GRANT'  as const, motif: dto.motif ?? null, accordePar: acteurId })),
        ...revokes.map(c => ({ utilisateurId: id, permissionId: byCode.get(c)!, mode: 'REVOKE' as const, motif: dto.motif ?? null, accordePar: acteurId })),
      ]
      if (rows.length) await tx.utilisateurPermission.createMany({ data: rows })
      await tx.utilisateur.update({ where: { id }, data: { updatedBy: acteurId ?? null } })
    })

    const after = await this.getPermissions(id)
    await this.audit(acteurId, 'SET_PERMISSIONS', id,
      { grants: avant.grants.map(g => g.code), revokes: avant.revokes.map(r => r.code) },
      { grants: after.grants.map(g => g.code), revokes: after.revokes.map(r => r.code) },
    )
    return after
  }

  /**
   * Applique UNE dérogation à PLUSIEURS utilisateurs en une fois.
   * Répond au besoin « accorder / révoquer un droit pour un ou plusieurs
   * utilisateurs ». RESET supprime toute dérogation (retour au rôle).
   */
  async bulkSetPermission(dto: BulkPermissionDto, acteurId: string | null, siteId: string) {
    const perm = await this.prisma.permission.findUnique({ where: { code: dto.code } })
    if (!perm) throw new BadRequestException('Permission inconnue')

    // Cloisonnement : toutes les cibles doivent appartenir au site du JWT.
    const ids   = [...new Set(dto.utilisateurIds)]
    const users = await this.prisma.utilisateur.findMany({ where: { id: { in: ids }, siteId }, select: { id: true } })
    if (users.length !== ids.length) {
      throw new BadRequestException('Un ou plusieurs utilisateurs sont introuvables')
    }

    // Garde-fou sécurité sur chaque cible avant toute écriture (REVOKE seulement)
    if (dto.mode === 'REVOKE') {
      for (const uid of ids) await this.assertOverridesSafe(uid, acteurId, [dto.code])
    }

    for (const uid of ids) {
      if (dto.mode === 'RESET') {
        await this.prisma.utilisateurPermission.deleteMany({
          where: { utilisateurId: uid, permissionId: perm.id },
        })
      } else {
        await this.prisma.utilisateurPermission.upsert({
          where:  { utilisateurId_permissionId: { utilisateurId: uid, permissionId: perm.id } },
          update: { mode: dto.mode, motif: dto.motif ?? null, accordePar: acteurId },
          create: { utilisateurId: uid, permissionId: perm.id, mode: dto.mode, motif: dto.motif ?? null, accordePar: acteurId },
        })
      }
    }

    await this.audit(acteurId, 'BULK_PERMISSION', null, null,
      { code: dto.code, mode: dto.mode, utilisateurIds: ids })
    return { success: true, count: ids.length, code: dto.code, mode: dto.mode }
  }

  /**
   * Empêche de révoquer une permission vitale :
   *   a) à soi-même (auto-castration)
   *   b) au dernier administrateur système actif (blocage total de la plateforme)
   */
  private async assertOverridesSafe(targetId: string, acteurId: string | null, revokes: string[]) {
    const vitales = revokes.filter(c => PERMS_VITALES_OVERRIDE.includes(c))
    if (vitales.length === 0) return

    if (acteurId && acteurId === targetId) {
      throw new ConflictException(
        `Vous ne pouvez pas vous retirer des permissions vitales (${vitales.join(', ')}). ` +
        'Demandez à un autre administrateur.',
      )
    }

    const target = await this.prisma.utilisateur.findUnique({
      where:   { id: targetId },
      include: { roles: { include: { role: true } } },
    })
    const estAdmin = target?.roles.some(r => r.role.code === 'ADMIN_SYSTEME') ?? false
    if (estAdmin) {
      const nbAdminsActifs = await this.prisma.utilisateur.count({
        where: { statut: 'ACTIF', roles: { some: { role: { code: 'ADMIN_SYSTEME' } } } },
      })
      if (nbAdminsActifs <= 1) {
        throw new ConflictException(
          `Impossible de retirer des permissions vitales (${vitales.join(', ')}) ` +
          'au dernier administrateur système actif.',
        )
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  SUPPRESSION DÉFINITIVE D'UN COMPTE
  // ════════════════════════════════════════════════════════════════════════

  async delete(id: string, acteurId: string | null, siteId: string) {
    const target = await this.getOrThrow(id, siteId)

    // Garde-fou : pas d'auto-suppression.
    if (acteurId && acteurId === id) {
      throw new ConflictException(
        'Vous ne pouvez pas supprimer votre propre compte. Demandez à un autre administrateur.',
      )
    }
    // Garde-fou : jamais le dernier administrateur système actif.
    if (target.roles.some(r => r.role.code === 'ADMIN_SYSTEME')) {
      const nbAdmins = await this.countActiveAdmins()
      if (nbAdmins <= 1) {
        throw new ConflictException('Impossible de supprimer le dernier administrateur système actif.')
      }
    }

    // On retire les enfants sûrs (rôles, dérogations, sessions) puis le compte.
    // Si l'historique (audit, notifications) y réfère encore → 409 : on désactive.
    try {
      await this.prisma.$transaction([
        this.prisma.utilisateurRole.deleteMany({ where: { utilisateurId: id } }),
        this.prisma.utilisateurPermission.deleteMany({ where: { utilisateurId: id } }),
        this.prisma.sessionUtilisateur.deleteMany({ where: { utilisateurId: id } }),
        this.prisma.utilisateur.delete({ where: { id } }),
      ])
    } catch (e: any) {
      if (e?.code === 'P2003' || e?.code === 'P2014') {
        throw new ConflictException(
          'Ce compte est référencé par l\'historique (journaux d\'audit, notifications). ' +
          'Désactivez-le plutôt que de le supprimer.',
        )
      }
      throw e
    }

    await this.audit(acteurId, 'DELETE', id, this.sanitize(target), null)

    await this.notif.emit({
      type:               'UTILISATEUR_SUPPRIME',
      niveau:             'AVERTISSEMENT',
      category:           'administratif',
      titre:              'Compte supprimé',
      message:            `Le compte « ${target.login} » a été supprimé définitivement.`,
      siteId,
      requiredPermission: 'utilisateur.read',
      entiteType:         'utilisateur',
      entiteId:           id,
      lien:               '/admin/utilisateurs',
      createdById:        acteurId ?? undefined,
    })

    return { id, deleted: true }
  }
}
