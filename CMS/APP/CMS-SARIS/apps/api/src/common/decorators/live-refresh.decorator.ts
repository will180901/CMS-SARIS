import { SetMetadata } from '@nestjs/common'

/**
 * @LiveRefresh('LIVE_X', { siteScoped }) — marque un controller (ou une route)
 * dont les mutations réussies (POST/PATCH/PUT/DELETE) diffusent un événement
 * TEMPS RÉEL SILENCIEUX pour rafraîchir les listes des clients (sans cloche/son).
 *
 * `siteScoped: true`  → l'événement n'est diffusé qu'aux clients du MÊME site
 *                       (données cloisonnées : triage, consultations).
 * `siteScoped: false` (défaut) → diffusion GLOBALE (catalogues partagés :
 *                       référentiels, acteurs, bons d'examen…).
 *
 * Le `type` est consommé par le frontend (map LIVE_INVALIDATIONS dans
 * useNotifications.ts).
 */
export const LIVE_REFRESH_KEY = 'live_refresh_type'

export interface LiveRefreshMeta {
  type:       string
  siteScoped: boolean
}

export const LiveRefresh = (type: string, opts?: { siteScoped?: boolean }) =>
  SetMetadata(LIVE_REFRESH_KEY, { type, siteScoped: opts?.siteScoped ?? false })
