/**
 * Formatage intelligent des durées écoulées (français).
 *
 * Traduit un écart de temps en une expression lisible et auto-adaptée à
 * l'échelle : « à l'instant », « 5 min », « 2 h 13 », « 3 j », « 2 sem »,
 * « 4 mois », « 1 an ». Remplace les anciens calculs « 296h13 » (qui ne
 * géraient pas les jours).
 */

const MIN  = 60_000
const HOUR = 60 * MIN
const DAY  = 24 * HOUR
const WEEK = 7 * DAY
const MONTH = 30 * DAY
const YEAR = 365 * DAY

/**
 * Durée écoulée depuis `from` (ISO ou Date) jusqu'à `to` (défaut : maintenant).
 *
 * @param opts.court   forme abrégée (« 2 h 13 » → « 2h13 », « 3 jours » → « 3 j »)
 * @param opts.precis  ajoute la sous-unité (« 2 h 13 », « 3 j 4 h ») jusqu'au jour
 */
export function formatDuree(
  from: string | number | Date,
  to: string | number | Date = Date.now(),
  opts: { court?: boolean; precis?: boolean } = {},
): string {
  const t0 = new Date(from).getTime()
  const t1 = new Date(to).getTime()
  if (Number.isNaN(t0) || Number.isNaN(t1)) return '—'

  const ms = Math.max(0, t1 - t0)
  const court = opts.court ?? false
  const precis = opts.precis ?? false

  // < 1 minute
  if (ms < MIN) return 'à l\'instant'

  // < 1 heure → minutes
  if (ms < HOUR) {
    const m = Math.floor(ms / MIN)
    return `${m} min`
  }

  // < 1 jour → heures (+ minutes si précis)
  if (ms < DAY) {
    const h = Math.floor(ms / HOUR)
    const m = Math.floor((ms % HOUR) / MIN)
    if (precis && m > 0) return court ? `${h}h${String(m).padStart(2, '0')}` : `${h} h ${m} min`
    return court ? `${h} h` : `${h} heure${h > 1 ? 's' : ''}`
  }

  // < 1 semaine → jours (+ heures si précis)
  if (ms < WEEK) {
    const j = Math.floor(ms / DAY)
    const h = Math.floor((ms % DAY) / HOUR)
    if (precis && h > 0) return court ? `${j}j ${h}h` : `${j} jour${j > 1 ? 's' : ''} ${h} h`
    return court ? `${j} j` : `${j} jour${j > 1 ? 's' : ''}`
  }

  // < 1 mois → semaines
  if (ms < MONTH) {
    const s = Math.floor(ms / WEEK)
    return court ? `${s} sem` : `${s} semaine${s > 1 ? 's' : ''}`
  }

  // < 1 an → mois
  if (ms < YEAR) {
    const mo = Math.floor(ms / MONTH)
    return court ? `${mo} mois` : `${mo} mois`
  }

  // ≥ 1 an → années
  const a = Math.floor(ms / YEAR)
  return court ? `${a} an${a > 1 ? 's' : ''}` : `${a} an${a > 1 ? 's' : ''}`
}

/**
 * Durée écoulée en minutes (pour comparaisons / seuils de couleur).
 */
export function elapsedMinutes(from: string | number | Date, to: string | number | Date = Date.now()): number {
  const t0 = new Date(from).getTime()
  const t1 = new Date(to).getTime()
  if (Number.isNaN(t0) || Number.isNaN(t1)) return 0
  return Math.floor(Math.max(0, t1 - t0) / MIN)
}
