/**
 * Âge en années révolues à partir d'une date de naissance (ISO).
 *
 * Source UNIQUE de vérité. Auparavant ré-implémenté ≥5 fois avec des algorithmes
 * DIVERGENTS : certaines copies en diff/365.25 (approximatives — fausses d'un an
 * autour des anniversaires), d'autres en getFullYear. On retient l'algo EXACT,
 * tenant compte du mois ET du jour, pour que la file, le triage, la consultation,
 * le dossier patient et les documents imprimés affichent TOUS le même âge.
 */
export function calcAge(dateNaissance: string): number {
  const d   = new Date(dateNaissance)
  const now = new Date()
  let a = now.getFullYear() - d.getFullYear()
  if (now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate())) a--
  return a
}
