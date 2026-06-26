/**
 * useSyncEngine — orchestre la synchronisation offline-first.
 *
 *   - Au montage : recalcule le nombre de mutations en attente.
 *   - À la reconnexion (hors-ligne → en ligne) : rejoue la file puis invalide
 *     les caches React Query pour rafraîchir l'affichage.
 *   - Périodiquement (en ligne) : tente un cycle de rejeu différé.
 *
 * À monter UNE seule fois (dans l'AppShell, à côté de useServerHealth).
 */
import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNetworkStore } from '@/stores/network.store'
import { syncCycle, refreshPendingCount } from '@/lib/sync'

const CYCLE_INTERVAL_MS = 30_000

export function useSyncEngine() {
  const isOnline = useNetworkStore(s => s.isOnline)
  const qc = useQueryClient()
  const prevOnline = useRef(isOnline)

  // Compteur initial des mutations en attente.
  useEffect(() => { void refreshPendingCount() }, [])

  // Transition hors-ligne → en ligne : rejeu puis rafraîchissement.
  useEffect(() => {
    const was = prevOnline.current
    prevOnline.current = isOnline
    if (!was && isOnline) {
      void (async () => {
        await syncCycle()
        await qc.invalidateQueries()
      })()
    }
  }, [isOnline, qc])

  // Filet de sécurité : rejeu périodique tant qu'on est en ligne.
  useEffect(() => {
    if (!isOnline) return
    const id = setInterval(() => { void syncCycle() }, CYCLE_INTERVAL_MS)
    return () => clearInterval(id)
  }, [isOnline])
}
