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

/** Détail d'un poste (modale) — chargé à la demande (id = null tant que la modale est fermée). */
export function usePosteDetail(id: string | null) {
  return useQuery({
    queryKey: ['admin', 'sync', 'supervision', 'poste', id],
    queryFn: () => syncApi.posteDetail(id as string),
    enabled: !!id,
  })
}

/** Retire un poste de la liste de supervision (dismiss) — réapparaît à sa prochaine synchro. */
export function useMasquerPoste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => syncApi.masquerPoste(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sync', 'supervision'] }),
  })
}

/** Renomme un poste (nom unique par site) — supervision admin. */
export function useRenamePoste() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, libelle }: { id: string; libelle: string }) => syncApi.renamePoste(id, libelle),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'sync', 'supervision'] }),
  })
}
