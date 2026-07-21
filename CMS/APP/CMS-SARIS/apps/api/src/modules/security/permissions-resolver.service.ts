/**
 * PermissionsResolverService — SOURCE DE VÉRITÉ des permissions effectives.
 *
 * Historiquement, les permissions étaient figées dans le JWT à la connexion et le
 * garde d'autorisation se contentait de lire ce payload. Conséquence : retirer un
 * droit à un rôle ne prenait effet qu'à l'expiration du jeton (jusqu'à 8 h), au
 * rechargement de la page ou à la reconnexion — pour TOUS les autres utilisateurs.
 * C'était un vrai trou : un REVOKE restait sans effet pendant des heures.
 *
 * Désormais les permissions sont relues EN BASE à chaque requête (via un cache court),
 * ce qui rend tout changement effectif au prochain appel, même si l'utilisateur n'a
 * aucune connexion temps réel active.
 *
 * Formule (inchangée) : (permissions des rôles ∪ GRANTs) − REVOKEs
 *   Le REVOKE est appliqué EN DERNIER : il l'emporte toujours.
 */

import { Injectable, Logger } from '@nestjs/common'
import { PrismaService } from '../../prisma/prisma.service'
import type { PermissionCode } from '@cms-saris/types'

/** Durée de vie d'une entrée de cache. Volontairement courte : c'est le délai MAXIMAL
 *  entre un changement de droits non notifié et sa prise en compte. Les changements
 *  passant par l'interface d'administration invalident le cache explicitement, donc
 *  l'effet y est immédiat — ce TTL ne couvre que les écritures directes en base. */
const TTL_MS = 20_000

interface Entree {
  permissions: PermissionCode[]
  expireA: number
}

@Injectable()
export class PermissionsResolverService {
  private readonly logger = new Logger(PermissionsResolverService.name)
  private readonly cache = new Map<string, Entree>()

  /** Backend EMBARQUÉ (poste local SQLite) : les comptes/rôles/permissions y sont
   *  répliqués (cf. sync-models : Role, Permission, RolePermission, UtilisateurRole
   *  et UtilisateurPermission sont GLOBAL). Tant que la 1re synchronisation n'a pas
   *  eu lieu, ces tables sont vides — on retombe alors sur le jeton pour ne pas
   *  priver le poste de tous ses droits hors-ligne. */
  private readonly estEmbarque = process.env['DATABASE_PROVIDER'] === 'sqlite'

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Permissions effectives d'un utilisateur, lues en base (avec cache court).
   *
   * @param secours permissions portées par le jeton — utilisées UNIQUEMENT en mode
   *                embarqué si le compte n'est pas encore répliqué localement.
   */
  async resoudre(
    utilisateurId: string,
    secours?: PermissionCode[],
  ): Promise<PermissionCode[]> {
    const enCache = this.cache.get(utilisateurId)
    if (enCache && enCache.expireA > Date.now()) return enCache.permissions

    const permissions = await this.calculer(utilisateurId, secours)
    this.cache.set(utilisateurId, { permissions, expireA: Date.now() + TTL_MS })
    return permissions
  }

  /** Invalide le cache d'un utilisateur — à appeler dès que ses droits changent. */
  invalider(utilisateurId: string): void {
    this.cache.delete(utilisateurId)
  }

  /** Invalide plusieurs utilisateurs d'un coup (ex. tous les porteurs d'un rôle modifié). */
  invaliderPlusieurs(utilisateurIds: readonly string[]): void {
    for (const id of utilisateurIds) this.cache.delete(id)
  }

  /** Vide entièrement le cache (changement global, ex. resynchronisation complète). */
  invaliderTout(): void {
    this.cache.clear()
  }

  // ── Calcul réel ─────────────────────────────────────────────────────────────

  private async calculer(
    utilisateurId: string,
    secours?: PermissionCode[],
  ): Promise<PermissionCode[]> {
    const [roles, overrides] = await Promise.all([
      this.prisma.utilisateurRole.findMany({
        where: { utilisateurId },
        include: {
          role: { include: { permissions: { include: { permission: true } } } },
        },
      }),
      this.prisma.utilisateurPermission.findMany({
        where: { utilisateurId },
        include: { permission: true },
      }),
    ])

    // Repli hors-ligne : aucun rôle NI aucune dérogation en local = compte pas encore
    // répliqué (et non « compte réellement sans droit »). Sur le central, en revanche,
    // un utilisateur sans rôle a légitimement zéro permission — pas de repli.
    if (
      this.estEmbarque &&
      roles.length === 0 &&
      overrides.length === 0 &&
      secours?.length
    ) {
      this.logger.warn(
        `Compte ${utilisateurId} absent de la base locale — repli sur les permissions du jeton ` +
          `(synchronisation initiale probablement incomplète).`,
      )
      return secours
    }

    const codes = new Set<string>()
    for (const ur of roles) {
      for (const rp of ur.role.permissions) codes.add(rp.permission.code)
    }
    for (const o of overrides)
      if (o.mode === 'GRANT') codes.add(o.permission.code)
    for (const o of overrides)
      if (o.mode === 'REVOKE') codes.delete(o.permission.code)

    return [...codes] as PermissionCode[]
  }
}
