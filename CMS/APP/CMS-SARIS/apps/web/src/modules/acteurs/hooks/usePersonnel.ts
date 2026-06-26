/**
 * Hooks — Personnel soignant (PersonnelMedical). Gestion par le médecin-chef / admin.
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { personnelApi, type PersonnelPayload, type PersonnelQueryParams } from '../api/personnel.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import { usePermissions } from '@/hooks/usePermissions'
import i18n from '@/i18n/config'

export const PERSONNEL_KEY = ['personnel'] as const

function toastErr(err: unknown) {
  if (isOfflineQueued(err)) return
  toast.error(err instanceof ApiError ? err.serverMessage : i18n.t('personnelSoignant.toastError', { defaultValue: 'Erreur sur le personnel' }))
}

export function usePersonnel(params?: PersonnelQueryParams) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: [...PERSONNEL_KEY, params],
    queryFn:  () => personnelApi.list(params),
    enabled:  has('personnel.read'),
    staleTime: 30_000,
  })
}

export function useCreatePersonnel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: PersonnelPayload) => personnelApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERSONNEL_KEY }); qc.invalidateQueries({ queryKey: ['soignants'] }); toast.success(i18n.t('personnelSoignant.toastCreated', { defaultValue: 'Agent enregistré' })) },
    onError: toastErr,
  })
}

export function useUpdatePersonnel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PersonnelPayload> }) => personnelApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERSONNEL_KEY }); qc.invalidateQueries({ queryKey: ['soignants'] }); toast.success(i18n.t('personnelSoignant.toastUpdated', { defaultValue: 'Agent mis à jour' })) },
    onError: toastErr,
  })
}

export function useSetStatutPersonnel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, statut }: { id: string; statut: 'ACTIF' | 'INACTIF' }) => personnelApi.setStatut(id, statut),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERSONNEL_KEY }); qc.invalidateQueries({ queryKey: ['soignants'] }) },
    onError: toastErr,
  })
}

export function useDeletePersonnel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => personnelApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PERSONNEL_KEY }); qc.invalidateQueries({ queryKey: ['soignants'] }); toast.success(i18n.t('personnelSoignant.toastDeleted', { defaultValue: 'Agent supprimé' })) },
    onError: toastErr,
  })
}
