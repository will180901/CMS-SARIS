/**
 * Hooks de synchronisation offline-first (mode local) : état + déclenchement manuel.
 * En mode distant (web/desktop remote), /sync/status renvoie client.enabled = false.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { syncApi } from '../api/sync.api'

export function useSyncStatus(enabled = true) {
  return useQuery({
    queryKey: ['sync', 'status'],
    queryFn: () => syncApi.status(),
    enabled,
    staleTime: 10_000,
    refetchInterval: 30_000,
  })
}

export function useSyncRun() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => syncApi.run(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync'] }),
  })
}

/** Supervision temps réel (serveur central) : postes, activité, conflits.
 *  La clé ['admin','sync',...] est invalidée en direct par l'événement SSE SYNC_ACTIVITY. */
export function useSyncSupervision(enabled = true) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision'],
    queryFn: () => syncApi.supervision(),
    enabled,
    staleTime: 5_000,
    refetchInterval: 60_000,
  })
}
