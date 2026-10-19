/**
 * Fin estimée d'un traitement à partir de sa durée écrite (« 30 jours », « 2 semaines »,
 * « 1 mois ») — même règle que le serveur (patient.service.ts, finDeTraitement).
 */
export function finDeTraitement(debut: string | Date, duree: string | null | undefined): Date | null {
  const m = duree?.toLowerCase().match(/(\d+)\s*(jours?|j\b|semaines?|sem\b|mois)/)
  if (!m) return null
  const n = parseInt(m[1]!, 10)
  if (!n) return null
  const fin = new Date(debut)
  if (m[2]!.startsWith('sem')) fin.setDate(fin.getDate() + n * 7)
  else if (m[2]!.startsWith('mois')) fin.setMonth(fin.getMonth() + n)
  else fin.setDate(fin.getDate() + n)
  return fin
}

/**
 * Le DERNIER JOUR du traitement, tel qu'on l'écrit : « 5 jours » prescrits le 16 se terminent le 20 (16, 17, 18, 19,
 * 20), pas le 21. `finDeTraitement` rend l'instant où la durée est écoulée (le 21, même heure) — le bon repère pour
 * savoir si un traitement court encore, mais pas la date à afficher, qui annonçait un jour de trop.
 */
export function dernierJourDeTraitement(fin: Date | string): Date {
  const jour = new Date(fin)
  jour.setDate(jour.getDate() - 1)
  return jour
}

export type EtatTraitement = 'EN_COURS' | 'TERMINE' | 'ARRETE' | 'REMPLACE' | 'INDETERMINE'

/** État d'une ligne de traitement à un instant donné. */
export function etatTraitement(
  ligne: { arreteLe?: string | null; duree?: string | null; remplaceParId?: string | null },
  prescritLe: string,
  maintenant: number,
): { etat: EtatTraitement; fin: Date | null } {
  if (ligne.arreteLe) return { etat: ligne.remplaceParId ? 'REMPLACE' : 'ARRETE', fin: new Date(ligne.arreteLe) }
  const fin = finDeTraitement(prescritLe, ligne.duree)
  if (!fin) return { etat: 'INDETERMINE', fin: null }
  return { etat: fin.getTime() < maintenant ? 'TERMINE' : 'EN_COURS', fin }
}
