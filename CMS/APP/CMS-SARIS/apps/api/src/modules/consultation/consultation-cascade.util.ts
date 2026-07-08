import type { PrismaClient, Prisma } from '@prisma/client'

/**
 * Construit la liste des opérations de suppression en cascade d'UNE consultation
 * (lignes → documents → diagnostics), dans l'ordre de dépendance des clés
 * étrangères (aucune des relations documentaires n'a de `onDelete: Cascade` en
 * base — la cascade doit être faite explicitement, dans la même transaction que
 * la suppression de la consultation elle-même).
 *
 * Partagé entre `ConsultationService.delete` (suppression directe) et
 * `TriageService.deleteVisite` (suppression d'une visite dont les consultations
 * rattachées doivent être purgées à leur tour) — pour ne jamais faire diverger
 * cette logique destructrice entre deux copies.
 */
export function consultationCascadeDeleteOps(
  prisma: PrismaClient,
  consultationId: string,
): Prisma.PrismaPromise<unknown>[] {
  const where = { consultationId }
  return [
    prisma.ligneOrdonnance.deleteMany({ where: { ordonnance: where } }),
    prisma.ordonnance.deleteMany({ where }),
    prisma.ligneExamen.deleteMany({ where: { bon: where } }),
    prisma.resultatExamen.deleteMany({ where: { bon: where } }),
    prisma.bonExamen.deleteMany({ where }),
    prisma.ligneBonPharmacie.deleteMany({ where: { bon: where } }),
    prisma.bonPharmacie.deleteMany({ where }),
    prisma.suiviEvacuation.deleteMany({ where: { evacuation: where } }),
    prisma.evacuation.deleteMany({ where }),
    prisma.suiviAccidentTravail.deleteMany({ where: { accident: where } }),
    prisma.accidentTravail.deleteMany({ where }),
    prisma.suiviChronique.deleteMany({ where }),
    prisma.consultationPrenatale.deleteMany({ where }),
    prisma.certificatMedical.deleteMany({ where }),
    prisma.diagnosticConsultation.deleteMany({ where }),
  ]
}
