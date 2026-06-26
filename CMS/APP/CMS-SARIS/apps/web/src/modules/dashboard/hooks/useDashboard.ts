import { useQuery } from '@tanstack/react-query'
import { dashboardApi } from '../api/dashboard.api'

export function useOverview() {
  return useQuery({
    queryKey: ['dashboard', 'overview'],
    queryFn:  dashboardApi.overview,
    refetchInterval: 30_000,   // rafraîchit toutes les 30s
    staleTime: 15_000,
  })
}

export function useMotifsJour() {
  return useQuery({
    queryKey: ['dashboard', 'motifs-jour'],
    queryFn:  dashboardApi.motifsJour,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

export function useUrgences() {
  return useQuery({
    queryKey: ['dashboard', 'urgences'],
    queryFn:  dashboardApi.urgences,
    refetchInterval: 15_000,
    staleTime: 8_000,
  })
}

export function useTendance() {
  return useQuery({
    queryKey: ['dashboard', 'tendance'],
    queryFn:  dashboardApi.tendance,
    refetchInterval: 120_000,
    staleTime: 60_000,
  })
}

export function useAffluence() {
  return useQuery({
    queryKey: ['dashboard', 'affluence'],
    queryFn:  dashboardApi.affluence,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

/** Stats gouvernance système — n'est appelé que pour les personas qui les voient. */
export function useAdminSystemStats(enabled: boolean) {
  return useQuery({
    queryKey: ['dashboard', 'admin-systeme'],
    queryFn:  dashboardApi.adminSysteme,
    enabled,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })
}

/** Statistiques d'activité (type × pathologie × catégorie + repos) — personas cliniques. */
export function useStatistiques(enabled: boolean, params?: { from?: string; to?: string }) {
  return useQuery({
    queryKey: ['dashboard', 'statistiques', params?.from ?? '', params?.to ?? ''],
    queryFn:  () => dashboardApi.statistiques(params),
    enabled,
    refetchInterval: 120_000,
    staleTime: 60_000,
  })
}
