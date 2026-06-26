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

const INTERVAL_MS = 8_000
const TIMEOUT_MS  = 4_000

export function useServerHealth() {
  const setOnline = useNetworkStore(s => s.setOnline)

  useEffect(() => {
    let cancelled = false

    async function check() {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!cancelled) setOnline(false)
        return
      }
      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
      try {
        const res = await fetch(`${BASE_URL}/health`, { signal: ctrl.signal, cache: 'no-store' })
        if (!cancelled) setOnline(res.ok)
      } catch {
        if (!cancelled) setOnline(false)
      } finally {
        clearTimeout(timer)
      }
    }

    check()
    const id = setInterval(check, INTERVAL_MS)

    const onOnline  = () => check()
    const onOffline = () => setOnline(false)
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
