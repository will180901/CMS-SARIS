/**
 * Hooks TanStack Query — Bons de pharmacie (recueil).
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { bonPharmacieApi } from '../api/bon-pharmacie.api'
import type { CreateBonPharmaciePayload, BonPharmacieQueryParams } from '../api/bon-pharmacie.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'

export const BONS_PHARMACIE_KEY = ['bons-pharmacie'] as const

function toastErr(err: unknown) {
  if (isOfflineQueued(err)) return
  toast.error(err instanceof ApiError ? err.serverMessage : i18n.t('bonPharmacie.toastErrorGeneric', { defaultValue: 'Erreur sur le bon de pharmacie' }))
}

export function useBonsPharmacie(params?: BonPharmacieQueryParams) {
  return useQuery({
    queryKey: [...BONS_PHARMACIE_KEY, params],
    queryFn:  () => bonPharmacieApi.list(params),
    staleTime: 15_000,
  })
}

export function useCreateBonPharmacie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBonPharmaciePayload) => bonPharmacieApi.create(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: BONS_PHARMACIE_KEY })
      qc.invalidateQueries({ queryKey: ['consultations', vars.consultationId] })
      toast.success(i18n.t('bonPharmacie.toastCreated', { defaultValue: 'Bon de pharmacie créé' }))
    },
    onError: toastErr,
  })
}

export function useDelivrerBonPharmacie(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bonPharmacieApi.deliver(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BONS_PHARMACIE_KEY })
      qc.invalidateQueries({ queryKey: ['consultations', consultationId] })
      toast.success(i18n.t('bonPharmacie.toastDelivered', { defaultValue: 'Bon marqué délivré' }))
    },
    onError: toastErr,
  })
}

export function useAnnulerBonPharmacie(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, motif }: { id: string; motif: string }) => bonPharmacieApi.annuler(id, motif),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BONS_PHARMACIE_KEY })
      qc.invalidateQueries({ queryKey: ['consultations', consultationId] })
      toast.success(i18n.t('bonPharmacie.toastCancelled', { defaultValue: 'Bon annulé' }))
    },
    onError: toastErr,
  })
}

export function useDeleteBonPharmacie(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => bonPharmacieApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: BONS_PHARMACIE_KEY })
      qc.invalidateQueries({ queryKey: ['consultations', consultationId] })
      toast.success(i18n.t('bonPharmacie.toastDeleted', { defaultValue: 'Bon supprimé' }))
    },
    onError: toastErr,
  })
}
