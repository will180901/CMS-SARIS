/**
 * Hooks — Registre des employés SARIS.
 *  - useEmployeLookup : reconnaissance dynamique par matricule (debounce côté appelant).
 *  - useEmployes / mutations : gestion dans l'onglet Référentiels.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { employesApi, type EmployePayload, type EmployeQueryParams } from '../api/employes.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import i18n from '@/i18n/config'

export const EMPLOYES_KEY = ['employes'] as const

function toastErr(err: unknown) {
  if (isOfflineQueued(err)) return
  toast.error(err instanceof ApiError ? err.serverMessage : i18n.t('employes.toastError', { defaultValue: 'Erreur sur le registre employé' }))
}

export function useEmployes(params?: EmployeQueryParams) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: [...EMPLOYES_KEY, params],
    queryFn:  () => employesApi.list(params),
    enabled:  has('employe.read'),
    staleTime: 30_000,
  })
}

/** Reconnaissance par matricule. `matricule` doit déjà être « débouncé » par l'appelant. */
export function useEmployeLookup(matricule: string) {
  const { has } = usePermissions()
  const m = matricule.trim()
  return useQuery({
    queryKey: ['employes', 'lookup', m],
    queryFn:  () => employesApi.lookup(m),
    enabled:  has('employe.read') && m.length >= 3,
    staleTime: 10_000,
  })
}

export function useCreateEmploye() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: EmployePayload) => employesApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: EMPLOYES_KEY }); toast.success(i18n.t('employes.toastCreated', { defaultValue: 'Employé enregistré' })) },
    onError: toastErr,
  })
}

export function useUpdateEmploye() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<EmployePayload> & { statut?: string } }) => employesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: EMPLOYES_KEY }); toast.success(i18n.t('employes.toastUpdated', { defaultValue: 'Employé mis à jour' })) },
    onError: toastErr,
  })
}

export function useDeleteEmploye() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => employesApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: EMPLOYES_KEY }); toast.success(i18n.t('employes.toastDeleted', { defaultValue: 'Employé supprimé' })) },
    onError: toastErr,
  })
}
