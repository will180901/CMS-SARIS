/**
 * Droits par catégorie de patient — règle centrale du recueil de l'existant.
 *
 * Certaines prestations ne sont couvertes que pour certaines catégories :
 *  - CONSULTATION + PREMIERS_SOINS : TOUTES les catégories.
 *  - MEDICAMENT (bon de pharmacie) + EXAMEN (bon d'examens) : UNIQUEMENT le personnel
 *    CDI et ses ayants droit (prise en charge complète).
 *
 * La matrice est portée par la table `DroitCategoriePatient` (peuplée par le seed).
 * Convention : autorisé s'il existe une ligne (catégorie, prestation) avec couvert=true.
 */
import { ForbiddenException } from '@nestjs/common'
import type { PrismaService } from '../prisma/prisma.service'

export type TypePrestation = 'CONSULTATION' | 'PREMIERS_SOINS' | 'MEDICAMENT' | 'EXAMEN'

export async function assertPrestationCouverte(
  prisma: PrismaService,
  categorieId: string,
  typePrestation: TypePrestation,
): Promise<void> {
  const droit = await prisma.droitCategoriePatient.findFirst({
    where:  { categorieId, typePrestation, couvert: true },
    select: { id: true },
  })
  if (droit) return

  const cat = await prisma.categoriePatient.findUnique({
    where: { id: categorieId }, select: { libelle: true },
  })
  const libelle = cat?.libelle ?? 'cette catégorie'
  const quoi =
      typePrestation === 'EXAMEN'     ? "aux bons d'examens"
    : typePrestation === 'MEDICAMENT' ? 'à la prise en charge des médicaments (bon de pharmacie)'
    : 'à cette prestation'
  throw new ForbiddenException(
    `La catégorie « ${libelle} » n'ouvre pas droit ${quoi} — réservé au personnel CDI et à leurs ayants droit.`,
  )
}
