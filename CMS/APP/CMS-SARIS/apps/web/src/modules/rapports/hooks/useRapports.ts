import { useQuery } from '@tanstack/react-query'
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
