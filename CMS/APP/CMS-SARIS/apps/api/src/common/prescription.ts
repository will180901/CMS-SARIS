/**
 * Garde de prescription — règle du recueil de l'existant.
 *
 *  - MEDECIN_CHEF / ADMIN_SYSTEME : prescrivent librement (le médecin chef est la
 *    référence clinique du CMS).
 *  - INFIRMIER : autorisé à prescrire (ordonnance + bon d'examen) UNIQUEMENT s'il
 *    dispose d'une DÉLÉGATION de prescription ACTIVE, accordée par un médecin chef
 *    et couvrant la date du jour (« cas simples délégués » du recueil).
 *
 * Retourne l'id de la délégation active utilisée (pour tracer Ordonnance.delegationId),
 * ou null pour les prescripteurs non délégués (médecin chef / admin). Lève
 * ForbiddenException si l'appelant n'a pas le droit de prescrire.
 */
import { ForbiddenException } from '@nestjs/common'
import type { PrismaService } from '../prisma/prisma.service'

export interface PrescriptionScope {
  roles: string[]
  personnelMedicalId: string | null
}

export async function assertPeutPrescrire(
  prisma: PrismaService,
  scope: PrescriptionScope,
): Promise<string | null> {
  const roles = scope.roles ?? []

  // Médecin chef / admin système : prescription libre.
  if (roles.includes('MEDECIN_CHEF') || roles.includes('ADMIN_SYSTEME')) return null

  // Infirmier : autorisé seulement avec une délégation active.
  if (roles.includes('INFIRMIER')) {
    if (!scope.personnelMedicalId) {
      throw new ForbiddenException('Prescription réservée au médecin chef ou à un infirmier délégué.')
    }
    const now = new Date()
    const deleg = await prisma.delegationPrescription.findFirst({
      where: {
        infirmierId: scope.personnelMedicalId,
        statut:      'ACTIVE',
        dateDebut:   { lte: now },
        dateFin:     { gte: now },
        deletedAt:   null,
      },
      select: { id: true },
    })
    if (!deleg) {
      throw new ForbiddenException(
        'Vous devez disposer d\'une délégation de prescription active (accordée par le médecin chef) pour prescrire.',
      )
    }
    return deleg.id
  }

  throw new ForbiddenException('Vous n\'êtes pas autorisé à prescrire.')
}
