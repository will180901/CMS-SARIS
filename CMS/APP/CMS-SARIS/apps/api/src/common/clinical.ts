/**
 * Calculs cliniques partagés — SOURCE UNIQUE de la formule, pour qu'un même
 * concept ne soit jamais recalculé de deux façons (risque de divergence).
 */

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
