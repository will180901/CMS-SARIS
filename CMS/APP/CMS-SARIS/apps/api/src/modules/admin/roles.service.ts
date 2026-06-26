/**
 * RolesService — Administration des rôles et de leur matrice de permissions.
 *
 * Rôles "système" (code parmi SYSTEM_ROLES) : protégés contre la suppression.
 * Leurs permissions peuvent toutefois être ajustées.
 */

import {
  Injectable, NotFoundException, ConflictException, BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto'
import { NotificationService } from '../notification/notification.service'
import { VITAL_GOVERNANCE_PERMISSIONS } from '../../common/governance'

const SYSTEM_ROLES = [
  'ADMIN_SYSTEME', 'MEDECIN_CHEF', 'INFIRMIER',
]

const ROLE_INCLUDE = {
  permissions: {
    include: { permission: true },
  },
  _count: { select: { utilisateurs: true } },
} as const

@Injectable()
export class RolesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notif: NotificationService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async getOrThrow(id: string) {
    const r = await this.prisma.role.findUnique({ where: { id }, include: ROLE_INCLUDE })
    if (!r) throw new NotFoundException('Rôle introuvable')
    return r
  }

  private sanitize(r: Awaited<ReturnType<typeof this.getOrThrow>>) {
    return {
      id:           r.id,
      code:         r.code,
      libelle:      r.libelle,
      isSystem:     SYSTEM_ROLES.includes(r.code),
      permissions:  r.permissions.map(rp => rp.permission.code),
      nbUtilisateurs: r._count.utilisateurs,
    }
  }

  private async audit(
    utilisateurId: string | null,
    action:        string,
    entiteId:      string | null,
    avant:         any,
    apres:         any,
  ) {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId, action, module: 'role',
          entiteType: 'Role', entiteId,
          avantJson: avant ?? undefined,
          apresJson: apres ?? undefined,
          statut: 'SUCCES',
        },
      })
    } catch { /* silent */ }
  }

  // ── Liste tous les rôles ──────────────────────────────────────────────────

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { code: 'asc' },
    })
    return roles.map(r => this.sanitize(r))
  }

  // ── Détail ────────────────────────────────────────────────────────────────

  async findById(id: string) {
    const r = await this.getOrThrow(id)
    return this.sanitize(r)
  }

  /**
   * Détenteurs d'un rôle — vue de GOUVERNANCE (rôle système global). Liste TOUS les
   * utilisateurs portant le rôle, TOUS SITES confondus (cohérent avec le compteur
   * `nbUtilisateurs`, qui est global). Réservé role.read (= ADMIN_SYSTEME). Le site
   * de chaque compte est indiqué pour la lisibilité multi-site.
   */
  async getUtilisateurs(id: string) {
    await this.getOrThrow(id)
    const rows = await this.prisma.utilisateurRole.findMany({
      where:  { roleId: id },
      select: {
        utilisateur: {
          select: {
            id: true, login: true, statut: true,
            personnelMedical: { select: { nom: true, prenom: true } },
            site:             { select: { code: true, libelle: true } },
          },
        },
      },
    })
    return rows
      .map(({ utilisateur: u }) => ({
        id:     u.id,
        login:  u.login,
        nom:    u.personnelMedical?.nom ?? null,
        prenom: u.personnelMedical?.prenom ?? null,
        statut: u.statut,
        site:   u.site?.libelle ?? u.site?.code ?? null,
      }))
      .sort((a, b) => (a.nom ?? a.login).localeCompare(b.nom ?? b.login))
  }

  // ── Liste de toutes les permissions (catalogue) ───────────────────────────

  async findAllPermissions() {
    const perms = await this.prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { code: 'asc' }],
    })
    return perms
  }

  // ── Créer ─────────────────────────────────────────────────────────────────

  async create(dto: CreateRoleDto, acteurId: string | null) {
    const exists = await this.prisma.role.findUnique({ where: { code: dto.code } })
    if (exists) throw new ConflictException('Ce code de rôle est déjà utilisé')

    // Valider les permissions fournies
    if (dto.permissions.length > 0) {
      const found = await this.prisma.permission.findMany({
        where: { code: { in: dto.permissions } },
      })
      if (found.length !== dto.permissions.length) {
        throw new BadRequestException('Une ou plusieurs permissions sont inconnues')
      }
    }

    const created = await this.prisma.$transaction(async tx => {
      const r = await tx.role.create({
        data: { code: dto.code, libelle: dto.libelle },
      })
      if (dto.permissions.length > 0) {
        const perms = await tx.permission.findMany({ where: { code: { in: dto.permissions } } })
        await tx.rolePermission.createMany({
          data: perms.map(p => ({ roleId: r.id, permissionId: p.id })),
        })
      }
      return r
    })

    const after = await this.getOrThrow(created.id)
    await this.audit(acteurId, 'CREATE', created.id, null, this.sanitize(after))
    return this.sanitize(after)
  }

  // ── Modifier (libellé + matrice de permissions) ───────────────────────────

  async update(id: string, dto: UpdateRoleDto, acteurId: string | null) {
    const avant = await this.getOrThrow(id)

    if (dto.permissions.length > 0) {
      const found = await this.prisma.permission.findMany({
        where: { code: { in: dto.permissions } },
      })
      if (found.length !== dto.permissions.length) {
        throw new BadRequestException('Une ou plusieurs permissions sont inconnues')
      }
    }

    // Garde-fou : si l'acteur courant possède ce rôle, il doit conserver
    // toutes les permissions VITALES de gouvernance dans le cumul de ses rôles
    // après modification. Sinon il se castrerait — et la seule sortie serait
    // une intervention SQL hors UI.
    //
    // Permissions protégées :
    //   - role.read / role.create / role.update / role.delete
    //     → gérer les rôles
    //   - utilisateur.read / utilisateur.create / utilisateur.update
    //     / utilisateur.assign_role / utilisateur.reset_password
    //     → gérer les comptes (et débloquer les autres admins en cas de souci)
    const PERMS_VITALES = VITAL_GOVERNANCE_PERMISSIONS

    if (acteurId) {
      const acteurRoles = await this.prisma.utilisateurRole.findMany({
        where: { utilisateurId: acteurId },
        select: { roleId: true },
      })
      const acteurDansCeRole = acteurRoles.some(r => r.roleId === id)
      if (acteurDansCeRole) {
        // Charger les permissions des AUTRES rôles de l'acteur
        const autresRoles = acteurRoles.filter(r => r.roleId !== id).map(r => r.roleId)
        const permsAutres = autresRoles.length > 0
          ? await this.prisma.rolePermission.findMany({
              where: { roleId: { in: autresRoles } },
              include: { permission: true },
            })
          : []
        const permsCumulees = new Set<string>([
          ...dto.permissions,
          ...permsAutres.map(rp => rp.permission.code),
        ])

        // Avant : on protège les permissions vitales que l'acteur possédait
        // déjà (via avant.permissions ou via ses autres rôles). On ne lui
        // interdit pas d'en perdre s'il ne les avait pas au départ.
        const permsAvant = new Set<string>([
          ...avant.permissions.map(rp => rp.permission.code),
          ...permsAutres.map(rp => rp.permission.code),
        ])

        const perdues = PERMS_VITALES.filter(p => permsAvant.has(p) && !permsCumulees.has(p))
        if (perdues.length > 0) {
          throw new ConflictException(
            `Ce changement vous retirerait des permissions vitales (${perdues.join(', ')}). ` +
            'Vous ne pourriez plus administrer le système. Action bloquée — demandez à un autre administrateur.',
          )
        }
      }
    }

    await this.prisma.$transaction(async tx => {
      await tx.role.update({ where: { id }, data: { libelle: dto.libelle } })
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      if (dto.permissions.length > 0) {
        const perms = await tx.permission.findMany({ where: { code: { in: dto.permissions } } })
        await tx.rolePermission.createMany({
          data: perms.map(p => ({ roleId: id, permissionId: p.id })),
        })
      }
    })

    const after = await this.getOrThrow(id)
    await this.audit(acteurId, 'UPDATE', id, this.sanitize(avant), this.sanitize(after))

    await this.notif.emit({
      type:               'ROLE_MODIFIE',
      niveau:             'AVERTISSEMENT',
      category:           'administratif',
      titre:              'Rôle modifié',
      message:            `Les permissions du rôle « ${after.libelle} » ont été mises à jour.`,
      siteId:             null,                 // gouvernance globale (tous sites)
      requiredPermission: 'role.read',
      entiteType:         'role',
      entiteId:           id,
      lien:               '/admin/roles',
      createdById:        acteurId ?? undefined,
    })

    return this.sanitize(after)
  }

  // ── Supprimer (interdit pour les rôles système ou rôles utilisés) ─────────

  async remove(id: string, acteurId: string | null) {
    const role = await this.getOrThrow(id)
    if (SYSTEM_ROLES.includes(role.code)) {
      throw new ConflictException('Ce rôle est protégé et ne peut être supprimé')
    }
    if (role._count.utilisateurs > 0) {
      throw new ConflictException(
        `Ce rôle est attribué à ${role._count.utilisateurs} utilisateur(s). Retirez-le d'abord.`,
      )
    }

    await this.prisma.$transaction(async tx => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      await tx.role.delete({ where: { id } })
    })

    await this.audit(acteurId, 'DELETE', id, this.sanitize(role), null)
    return { success: true }
  }
}
