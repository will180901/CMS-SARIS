/**
 * useServerHealth — pilote l'indicateur « En ligne / Hors ligne ».
 *
 * Contrairement à `navigator.onLine` (qui dit seulement si le navigateur a un
 * réseau), ce hook vérifie la VRAIE joignabilité du serveur API en interrogeant
 * périodiquement l'endpoint public `/health`.
 *
 * Règles :
 *   - navigateur hors-ligne → Hors ligne immédiatement (inutile de pinger).
 *   - sinon → ping `/health` : 2xx = En ligne, échec/timeout = Hors ligne.
 *   - re-vérifie au montage, toutes les 8 s, au retour réseau (instantané), et au focus.
 *
 * À monter UNE fois (ex. dans la sidebar persistante).
 */
import { useEffect } from 'react'
import { useNetworkStore } from '@/stores/network.store'
import { BASE_URL } from '@/lib/api'

const INTERVAL_MS = 10_000
const TIMEOUT_MS  = 8_000   // tolérant : un hébergement gratuit (Render) peut être lent à répondre / au réveil
const MAX_FAILS   = 2       // anti-clignotement : 2 échecs consécutifs avant de basculer « Hors ligne »
const MIN_GAP_MS  = 4_000   // anti-rafale : ignore un déclenchement trop proche du précédent (ex. l'événement
                             // `focus` du navigateur qui suit quasi instantanément le check de montage) — sans
                             // cela, 2 checks quasi simultanés peuvent tomber TOUS LES DEUX sur un même blip
                             // transitoire du serveur (503 pendant un réveil/une rafale Render) et atteindre le
                             // seuil MAX_FAILS en une fraction de seconde au lieu des ~20 s prévues.

export function useServerHealth() {
  const setOnline = useNetworkStore(s => s.setOnline)

  useEffect(() => {
    let cancelled = false
    let fails = 0        // compteur d'échecs consécutifs
    let lastCheckAt = 0  // horodatage du dernier check RÉELLEMENT exécuté

    async function check() {
      const now = Date.now()
      if (now - lastCheckAt < MIN_GAP_MS) return   // trop proche du précédent → ignoré
      lastCheckAt = now

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        fails = MAX_FAILS
        if (!cancelled) setOnline(false)
        return
      }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      try {
        const res = await fetch(`${BASE_URL}/health`, { signal: ctrl.signal, cache: 'no-store' })
        if (cancelled) return
        if (res.ok) { fails = 0; setOnline(true) }                 // succès → En ligne immédiat
        else        { fails++; if (fails >= MAX_FAILS) setOnline(false) }
      } catch {
        if (cancelled) return
        fails++                                                     // échec/timeout → on attend 2 fois avant d'afficher Hors ligne
        if (fails >= MAX_FAILS) setOnline(false)
      } finally {
        clearTimeout(timer)
      }
    }

    check()
    const id = setInterval(check, INTERVAL_MS)

    const onOnline  = () => { fails = 0; lastCheckAt = 0; check() } // retour réseau confirmé → check immédiat forcé
    const onOffline = () => { fails = MAX_FAILS; setOnline(false) }
    const onFocus   = () => check()
    window.addEventListener('online',  onOnline)
    window.addEventListener('offline', onOffline)
    window.addEventListener('focus',   onFocus)

    return () => {
      cancelled = true
      clearInterval(id)
      window.removeEventListener('online',  onOnline)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('focus',   onFocus)
    }
  }, [setOnline])
}
