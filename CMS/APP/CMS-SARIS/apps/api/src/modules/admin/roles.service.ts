/**
 * RolesService — Administration des rôles et de leur matrice de permissions.
 *
 * Rôles "système" (code parmi SYSTEM_ROLES) : protégés contre la suppression.
 * Leurs permissions peuvent toutefois être ajustées.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto'
import { NotificationService } from '../notification/notification.service'
import { PermissionsResolverService } from '../security/permissions-resolver.service'
import { VITAL_GOVERNANCE_PERMISSIONS } from '../../common/governance'
import { completerLectures } from '../../common/permission-coherence'

const SYSTEM_ROLES = ['ADMIN_SYSTEME', 'MEDECIN_CHEF', 'INFIRMIER']

const logger = new Logger('RolesService')

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
    private readonly permsResolver: PermissionsResolverService,
  ) {}

  // ── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Rend un changement de droits EFFECTIF IMMÉDIATEMENT pour les porteurs d'un rôle :
   *   1. purge du cache serveur → le prochain appel de CHAQUE porteur est réévalué ;
   *   2. signal temps réel ciblé → leur interface se réaligne sans rechargement.
   *
   * Le point 1 suffit à la sécurité (un droit retiré est refusé même si l'utilisateur
   * n'a aucune connexion temps réel) ; le point 2 n'est que du confort d'affichage.
   * Best-effort : ne doit jamais faire échouer la modification du rôle elle-même.
   */
  private async propagerChangementDeRole(roleId: string): Promise<void> {
    try {
      const porteurs = await this.prisma.utilisateurRole.findMany({
        where: { roleId },
        select: { utilisateurId: true },
      })
      const ids = porteurs.map((p) => p.utilisateurId)
      this.permsResolver.invaliderPlusieurs(ids)
      for (const id of ids) this.notif.pushLive(id, 'PERMISSIONS_CHANGED')
    } catch (e) {
      // Un échec de propagation ne doit pas annuler une modification déjà validée :
      // le cache expire de lui-même (TTL court), donc le pire cas reste borné.
      logger.warn(
        `Propagation du changement de rôle ${roleId} échouée (ignorée) : ${(e as Error).message}`,
      )
    }
  }

  /**
   * Valide les codes reçus contre le catalogue en base, puis COMPLÈTE l'ensemble
   * avec les lectures impliquées (« écrire implique consulter »).
   * Renvoie la liste finale + les identifiants correspondants.
   */
  private async resoudreMatrice(codes: readonly string[]) {
    const catalogue = await this.prisma.permission.findMany({
      select: { id: true, code: true },
    })
    const parCode = new Map(catalogue.map((p) => [p.code, p.id]))

    const inconnus = codes.filter((c) => !parCode.has(c))
    if (inconnus.length > 0) {
      throw new BadRequestException(
        `Une ou plusieurs permissions sont inconnues : ${inconnus.join(', ')}`,
      )
    }

    const complet = completerLectures(codes, new Set(parCode.keys()))
    const ajoutees = complet.filter((c) => !codes.includes(c))
    if (ajoutees.length > 0) {
      logger.log(
        `Cohérence des permissions : lecture(s) ajoutée(s) automatiquement — ${ajoutees.join(', ')}`,
      )
    }
    return { codes: complet, ids: complet.map((c) => parCode.get(c)!) }
  }

  private async getOrThrow(id: string) {
    const r = await this.prisma.role.findUnique({
      where: { id },
      include: ROLE_INCLUDE,
    })
    if (!r) throw new NotFoundException('Rôle introuvable')
    return r
  }

  private sanitize(r: Awaited<ReturnType<typeof this.getOrThrow>>) {
    return {
      id: r.id,
      code: r.code,
      libelle: r.libelle,
      isSystem: SYSTEM_ROLES.includes(r.code),
      permissions: r.permissions.map((rp) => rp.permission.code),
      nbUtilisateurs: r._count.utilisateurs,
    }
  }

  private async audit(
    utilisateurId: string | null,
    action: string,
    entiteId: string | null,
    avant: any,
    apres: any,
  ) {
    try {
      await this.prisma.journalAudit.create({
        data: {
          utilisateurId,
          action,
          module: 'role',
          entiteType: 'Role',
          entiteId,
          avantJson: avant ?? undefined,
          apresJson: apres ?? undefined,
          statut: 'SUCCES',
        },
      })
    } catch {
      /* silent */
    }
  }

  // ── Liste tous les rôles ──────────────────────────────────────────────────

  async findAll() {
    const roles = await this.prisma.role.findMany({
      include: ROLE_INCLUDE,
      orderBy: { code: 'asc' },
    })
    return roles.map((r) => this.sanitize(r))
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
      where: { roleId: id },
      select: {
        utilisateur: {
          select: {
            id: true,
            login: true,
            statut: true,
            personnelMedical: { select: { nom: true, prenom: true } },
            site: { select: { code: true, libelle: true } },
          },
        },
      },
    })
    return rows
      .map(({ utilisateur: u }) => ({
        id: u.id,
        login: u.login,
        nom: u.personnelMedical?.nom ?? null,
        prenom: u.personnelMedical?.prenom ?? null,
        statut: u.statut,
        site: u.site?.libelle ?? u.site?.code ?? null,
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
    const exists = await this.prisma.role.findUnique({
      where: { code: dto.code },
    })
    if (exists) throw new ConflictException('Ce code de rôle est déjà utilisé')

    // Valider les permissions fournies + compléter les lectures impliquées
    const matrice = await this.resoudreMatrice(dto.permissions)

    const created = await this.prisma.$transaction(async (tx) => {
      const r = await tx.role.create({
        data: { code: dto.code, libelle: dto.libelle },
      })
      if (matrice.ids.length > 0) {
        await tx.rolePermission.createMany({
          data: matrice.ids.map((permissionId) => ({
            roleId: r.id,
            permissionId,
          })),
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

    // Validation + cohérence « écrire implique consulter ». Le garde-fou de
    // gouvernance ci-dessous raisonne sur la matrice RÉELLEMENT appliquée.
    const matrice = await this.resoudreMatrice(dto.permissions)

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
      const acteurDansCeRole = acteurRoles.some((r) => r.roleId === id)
      if (acteurDansCeRole) {
        // Charger les permissions des AUTRES rôles de l'acteur
        const autresRoles = acteurRoles
          .filter((r) => r.roleId !== id)
          .map((r) => r.roleId)
        const permsAutres =
          autresRoles.length > 0
            ? await this.prisma.rolePermission.findMany({
                where: { roleId: { in: autresRoles } },
                include: { permission: true },
              })
            : []
        const permsCumulees = new Set<string>([
          ...matrice.codes,
          ...permsAutres.map((rp) => rp.permission.code),
        ])

        // Avant : on protège les permissions vitales que l'acteur possédait
        // déjà (via avant.permissions ou via ses autres rôles). On ne lui
        // interdit pas d'en perdre s'il ne les avait pas au départ.
        const permsAvant = new Set<string>([
          ...avant.permissions.map((rp) => rp.permission.code),
          ...permsAutres.map((rp) => rp.permission.code),
        ])

        const perdues = PERMS_VITALES.filter(
          (p) => permsAvant.has(p) && !permsCumulees.has(p),
        )
        if (perdues.length > 0) {
          throw new ConflictException(
            `Ce changement vous retirerait des permissions vitales (${perdues.join(', ')}). ` +
              'Vous ne pourriez plus administrer le système. Action bloquée — demandez à un autre administrateur.',
          )
        }
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role.update({ where: { id }, data: { libelle: dto.libelle } })
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      if (matrice.ids.length > 0) {
        await tx.rolePermission.createMany({
          data: matrice.ids.map((permissionId) => ({
            roleId: id,
            permissionId,
          })),
        })
      }
    })

    const after = await this.getOrThrow(id)

    // Prise d'effet IMMÉDIATE pour tous les porteurs de ce rôle (cache + temps réel).
    await this.propagerChangementDeRole(id)

    await this.audit(
      acteurId,
      'UPDATE',
      id,
      this.sanitize(avant),
      this.sanitize(after),
    )

    await this.notif.emit({
      type: 'ROLE_MODIFIE',
      niveau: 'AVERTISSEMENT',
      category: 'administratif',
      titre: 'Rôle modifié',
      message: `Les permissions du rôle « ${after.libelle} » ont été mises à jour.`,
      siteId: null, // gouvernance globale (tous sites)
      requiredPermission: 'role.read',
      entiteType: 'role',
      entiteId: id,
      lien: '/admin/roles',
      createdById: acteurId ?? undefined,
    })

    return this.sanitize(after)
  }

  // ── Supprimer (interdit pour les rôles système ou rôles utilisés) ─────────

  async remove(id: string, acteurId: string | null) {
    const role = await this.getOrThrow(id)
    if (SYSTEM_ROLES.includes(role.code)) {
      throw new ConflictException(
        'Ce rôle est protégé et ne peut être supprimé',
      )
    }
    if (role._count.utilisateurs > 0) {
      throw new ConflictException(
        `Ce rôle est attribué à ${role._count.utilisateurs} utilisateur(s). Retirez-le d'abord.`,
      )
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.rolePermission.deleteMany({ where: { roleId: id } })
      await tx.role.delete({ where: { id } })
    })

    await this.audit(acteurId, 'DELETE', id, this.sanitize(role), null)
    return { success: true }
  }
}
