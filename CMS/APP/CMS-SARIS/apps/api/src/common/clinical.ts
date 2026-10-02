/**
 * Calculs cliniques partagés — SOURCE UNIQUE de la formule, pour qu'un même
 * concept ne soit jamais recalculé de deux façons (risque de divergence).
 */
import type { Prisma } from '@prisma/client'

/**
 * PARCOURS EN COURS — une visite en fait partie si elle est encore ouverte, OU si la
 * consultation qui en est issue est encore OUVERTE.
 *
 * Le second cas n'est pas un detail : une visite passe en CLOTUREE des qu'on ouvre sa
 * consultation (cf. ConsultationService.create). Ne regarder que le statut de la visite
 * fait sortir du parcours en cours un patient qui est precisement en consultation —
 * c'est ce qui privait l'infirmier de tout ce qui se passait pendant la consultation.
 *
 * Partagee ici parce que le dossier (PatientService) et la liste des visites
 * (TriageService) doivent dire exactement la meme chose.
 */
export const PARCOURS_EN_COURS: Prisma.VisiteWhereInput = {
  OR: [
    { statut: { in: ['EN_ATTENTE', 'EN_COURS'] } },
    { consultations: { some: { statut: 'OUVERTE', deletedAt: null } } },
  ],
}

/**
 * IMC (indice de masse corporelle) = poids(kg) / taille(m)², arrondi à 0,1.
 * Renvoie `null` si le poids ou la taille est manquant / invalide (≤ 0).
 */
export function computeImc(
  poids?: number | null,
  taille?: number | null,
): number | null {
  if (!poids || !taille || taille <= 0) return null
  const tailleM = taille / 100
  return Math.round((poids / (tailleM * tailleM)) * 10) / 10
}
