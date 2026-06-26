/** Helpers d'affichage de la géolocalisation (côté frontend). */
import type { GeoLocalisation } from '@/modules/admin/api/admin.api'

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
