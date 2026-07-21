/**
 * calculerDateReprise — source unique de vérité pour le calcul de la date de reprise de
 * service à partir du nombre de jours de repos (même logique de centralisation que
 * apps/web/src/lib/age.ts pour le calcul d'âge).
 *
 * `reposInclutJour` : le jour de consultation compte-t-il comme le 1er jour de repos ?
 *  - coché   → reprise = dateReference + reposJours
 *  - décoché → reprise = dateReference + reposJours + 1 (le repos démarre le lendemain)
 */
export function calculerDateReprise(
  dateReference: Date,
  reposJours: number,
  reposInclutJour: boolean,
): Date {
  const n = reposInclutJour ? reposJours : reposJours + 1
  const d = new Date(dateReference)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
