/**
 * intl.ts — Formatage internationalisé des dates, heures et nombres.
 *
 * Le locale BCP-47 est dérivé de la langue active d'i18next :
 *   fr → 'fr-FR'   ·   en → 'en-GB'
 * (même règle que NotificationDrawer.tsx). Utiliser ces helpers à la place
 * des appels `toLocaleDateString('fr-FR', …)` codés en dur.
 */
import i18n from '@/i18n/config'

/** Locale BCP-47 courante, dérivée de la langue i18next. */
export function currentLocale(): string {
  return i18n.language === 'en' ? 'en-GB' : 'fr-FR'
}

/** Normalise l'entrée en `Date` (accepte ISO string, Date ou timestamp). */
function toDate(iso: string | number | Date): Date {
  return iso instanceof Date ? iso : new Date(iso)
}

/**
 * Formate une date (sans l'heure). Par défaut : jour/mois/année numériques.
 * @example formatDate('2026-06-07') → '07/06/2026' (fr) · '07/06/2026' (en-GB)
 */
export function formatDate(
  iso: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' },
): string {
  return toDate(iso).toLocaleDateString(currentLocale(), opts)
}

/**
 * Formate uniquement l'heure (heures:minutes par défaut).
 * @example formatTime('2026-06-07T14:30:00Z') → '14:30'
 */
export function formatTime(
  iso: string | number | Date,
  opts: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' },
): string {
  return toDate(iso).toLocaleTimeString(currentLocale(), opts)
}

/**
 * Formate date + heure.
 * @example formatDateTime('2026-06-07T14:30:00Z') → '07/06/2026 14:30'
 */
export function formatDateTime(
  iso: string | number | Date,
  opts: Intl.DateTimeFormatOptions = {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  },
): string {
  return toDate(iso).toLocaleString(currentLocale(), opts)
}

/**
 * Formate un nombre selon le locale (séparateurs de milliers/décimales).
 * @example formatNumber(1234.5) → '1 234,5' (fr) · '1,234.5' (en-GB)
 */
export function formatNumber(n: number, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(currentLocale(), opts)
}
