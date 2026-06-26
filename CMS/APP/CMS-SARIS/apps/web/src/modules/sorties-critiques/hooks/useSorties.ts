/**
 * Hooks TanStack Query — Évacuations.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { evacuationsApi } from '../api/sorties.api'
import type { CreateEvacuationPayload, AddSuiviEvacuationPayload } from '../api/sorties.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'

function toastErr(err: unknown) {
  if (isOfflineQueued(err)) return
  toast.error(err instanceof ApiError ? err.serverMessage : i18n.t('sorties.toastErreur'))
}

// ── Évacuation ────────────────────────────────────────────────────────────────

export const EVACUATIONS_KEY = ['evacuations'] as const

export function useEvacuations(params?: { consultationId?: string; patientId?: string; statut?: string }, enabled = true) {
  return useQuery({
    queryKey: [...EVACUATIONS_KEY, params],
    queryFn:  () => evacuationsApi.list(params),
    staleTime: 30_000,
    enabled,
  })
}

export function useCreateEvacuation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateEvacuationPayload) => evacuationsApi.create(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: EVACUATIONS_KEY })
      if (vars.consultationId) qc.invalidateQueries({ queryKey: ['consultations', vars.consultationId] })
      toast.success(i18n.t('sorties.toastEvacuationInitiee'))
    },
    onError: toastErr,
  })
}

export function useAddSuiviEvacuation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddSuiviEvacuationPayload) => evacuationsApi.addSuivi(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVACUATIONS_KEY })
      toast.success(i18n.t('sorties.toastSuiviAjoute'))
    },
    onError: toastErr,
  })
}

export function useAnnulerEvacuation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motif: string) => evacuationsApi.annuler(id, motif),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVACUATIONS_KEY })
      toast.success(i18n.t('sorties.toastEvacuationAnnulee'))
    },
    onError: toastErr,
  })
}

export function useCloturerEvacuation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => evacuationsApi.cloturer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVACUATIONS_KEY })
      toast.success(i18n.t('sorties.toastEvacuationCloturee'))
    },
    onError: toastErr,
  })
}

export function useDeleteEvacuation(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => evacuationsApi.supprimer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EVACUATIONS_KEY })
      toast.success(i18n.t('sorties.toastEvacSupprimee'))
    },
    onError: toastErr,
  })
}
