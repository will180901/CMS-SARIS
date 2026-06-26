/**
 * Hooks TanStack Query — Bons d'examen complémentaires.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { bonExamenApi } from '../api/bon-examen.api'
import type {
  CreateBonExamenPayload, UpdateBonExamenPayload,
  ValiderBonExamenPayload, SaisirResultatPayload, BonExamenQueryParams,
} from '../api/bon-examen.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'

export const BONS_EXAMEN_KEY = ['bons-examen'] as const
export const bonExamenKey = (id: string) => ['bons-examen', id] as const

function toastErr(err: unknown) {
  if (isOfflineQueued(err)) return
  toast.error(err instanceof ApiError ? err.serverMessage : i18n.t('bonExamen.toastErrorGeneric'))
}

export function useBonsExamen(params?: BonExamenQueryParams) {
  return useQuery({
    queryKey: [...BONS_EXAMEN_KEY, params],
    queryFn:  () => bonExamenApi.list(params),
    staleTime: 15_000,
  })
}

export function useBonExamen(id: string) {
  return useQuery({
    queryKey: bonExamenKey(id),
    queryFn:  () => bonExamenApi.findById(id),
    enabled:  !!id,
  })
}

export function useCreateBonExamen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateBonExamenPayload) => bonExamenApi.create(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: BONS_EXAMEN_KEY })
      qc.invalidateQueries({ queryKey: ['consultations', vars.consultationId] })
      toast.success(i18n.t('bonExamen.toastCreated'))
    },
    onError: toastErr,
  })
}

export function useUpdateBonExamen(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateBonExamenPayload) => bonExamenApi.update(id, data),
    onSuccess: (bon) => {
      qc.invalidateQueries({ queryKey: BONS_EXAMEN_KEY })
      qc.invalidateQueries({ queryKey: bonExamenKey(id) })
      qc.invalidateQueries({ queryKey: ['consultations', bon.consultationId] })
    },
    onError: toastErr,
  })
}

export function useValiderBonExamen(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ValiderBonExamenPayload) => bonExamenApi.validerOuAnnuler(id, data),
    onSuccess: (bon, data) => {
      qc.invalidateQueries({ queryKey: BONS_EXAMEN_KEY })
      qc.invalidateQueries({ queryKey: bonExamenKey(id) })
      qc.invalidateQueries({ queryKey: ['consultations', bon.consultationId] })
      toast.success(data.statut === 'VALIDE' ? i18n.t('bonExamen.toastValidated') : i18n.t('bonExamen.toastCancelledStatus'))
    },
    onError: toastErr,
  })
}

export function useAnnulerBonExamen(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motifAnnulation: string) => bonExamenApi.annuler(id, motifAnnulation),
    onSuccess: (bon) => {
      qc.invalidateQueries({ queryKey: BONS_EXAMEN_KEY })
      qc.invalidateQueries({ queryKey: bonExamenKey(id) })
      qc.invalidateQueries({ queryKey: ['consultations', bon.consultationId] })
      toast.success(i18n.t('bonExamen.toastBonCancelled'))
    },
    onError: toastErr,
  })
}

export function useSaisirResultat(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SaisirResultatPayload) => bonExamenApi.saisirResultat(id, data),
    onSuccess: (bon) => {
      qc.invalidateQueries({ queryKey: BONS_EXAMEN_KEY })
      qc.invalidateQueries({ queryKey: bonExamenKey(id) })
      qc.invalidateQueries({ queryKey: ['consultations', bon.consultationId] })
      toast.success(i18n.t('bonExamen.toastResultSaved'))
    },
    onError: toastErr,
  })
}
