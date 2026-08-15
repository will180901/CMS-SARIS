import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rapportsApi, type TypeRapport } from '../api/rapports.api'

export function useRapports(type?: TypeRapport) {
  return useQuery({
    queryKey: ['rapports', 'list', type ?? ''],
    queryFn:  () => rapportsApi.list(type),
    staleTime: 60_000,
  })
}

export function useRapport(id: string | null) {
  return useQuery({
    queryKey: ['rapports', 'detail', id],
    queryFn:  () => rapportsApi.findOne(id as string),
    enabled:  !!id,
  })
}

/**
 * Génère un rapport MAINTENANT, sur la période demandée.
 *
 * Sans cela, un centre qui vient d'installer le système attend le prochain passage de
 * l'horloge — jusqu'au 1er du mois pour un mensuel — avant de voir quoi que ce soit, et
 * il est impossible de produire un bilan avant une réunion. Idempotent côté serveur :
 * relancer sur la même période met le rapport à jour au lieu d'en empiler un second.
 */
export function useGenererRapport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ type, debut, fin }: { type: TypeRapport; debut: string; fin: string }) =>
      rapportsApi.generer(type, debut, fin),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['rapports'] })
    },
  })
}
