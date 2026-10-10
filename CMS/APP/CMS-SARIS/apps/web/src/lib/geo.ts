/** Helpers d'affichage de la géolocalisation (côté frontend). */
import type { GeoLocalisation, PositionConnexion } from '@/modules/admin/api/admin.api'

/** « -4.2634, 15.2429 » ou null si coordonnées absentes. */
export function formatCoords(geo?: GeoLocalisation | null): string | null {
  if (!geo || geo.latitude == null || geo.longitude == null) return null
  return `${geo.latitude.toFixed(4)}, ${geo.longitude.toFixed(4)}`
}

/** Libellé principal (« Ville, Pays ») avec repli. */
export function geoLabel(geo?: GeoLocalisation | null): string {
  return geo?.label ?? 'Localisation inconnue'
}

/** Lien Google Maps vers les coordonnées (ou null). */
export function mapsUrl(geo?: GeoLocalisation | null): string | null {
  if (!geo || geo.latitude == null || geo.longitude == null) return null
  return `https://www.google.com/maps?q=${geo.latitude},${geo.longitude}`
}

/** « -4.26340, 15.24290 » — 5 décimales, soit environ 1 m. */
export function formatCoordonnees(latitude: number, longitude: number): string {
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`
}

/** Marge d'erreur lisible : « 35 m », « 2,1 km ». */
export function formatPrecision(metres: number): string {
  return metres < 1000 ? `${Math.round(metres)} m` : `${(metres / 1000).toFixed(1).replace('.', ',')} km`
}

export function urlCarte(latitude: number, longitude: number): string {
  return `https://www.google.com/maps?q=${latitude},${longitude}`
}

/** La position en texte (exports Excel / PDF) : les coordonnées, ou pourquoi elles manquent. */
export function textePosition(
  p: PositionConnexion | null | undefined,
  t: (cle: string, options?: Record<string, unknown>) => string,
): string {
  if (!p || p.etat === 'NON_APPLICABLE') return '—'
  if (p.etat === 'OK' && p.latitude != null && p.longitude != null)
    return `${formatCoordonnees(p.latitude, p.longitude)}${p.precisionM != null ? ` (${t('position.marge', { marge: formatPrecision(p.precisionM) })})` : ''}`
  return t(`position.etat.${p.etat}`)
}
