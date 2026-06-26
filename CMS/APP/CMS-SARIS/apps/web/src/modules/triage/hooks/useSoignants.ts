/**
 * useSoignants.ts — liste des soignants sélectionnables au triage.
 *
 * Les soignants DÉCOULENT des comptes utilisateurs de rôle clinique (MEDECIN_CHEF /
 * INFIRMIER) — on ne gère plus de répertoire de personnel séparé (recueil). Endpoint
 * `GET /personnel/soignants`, gardé par `visite.read` (accessible à tout le triage).
 */
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PersonnelMedical } from '@cms-saris/types'
import { usePermissions } from '@/hooks/usePermissions'

export const SOIGNANTS_KEY = ['soignants'] as const

export function useSoignants() {
  const { has } = usePermissions()
  return useQuery({
    queryKey:  SOIGNANTS_KEY,
    queryFn:   () => api.get<PersonnelMedical[]>('/personnel/soignants'),
    staleTime: 60_000,
    enabled:   has('visite.read'),
  })
}
