/**
 * Hooks TanStack Query — Suivi de traitement.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { suiviTraitementApi } from '../api/suivi-traitement.api'
import type { CreateSuiviTraitementPayload, AddFicheSuiviPayload } from '../api/suivi-traitement.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'

function toastErr(err: unknown) {
  if (isOfflineQueued(err)) return
  toast.error(err instanceof ApiError ? err.serverMessage : i18n.t('suiviTraitement.toastErreur'))
}

// ── Suivi de traitement ──────────────────────────────────────────────────────

export const SUIVI_TRAITEMENT_KEY = ['suivi-traitement'] as const

export function useSuivisTraitement(params?: { consultationId?: string; patientId?: string; statut?: string }, enabled = true) {
  return useQuery({
    queryKey: [...SUIVI_TRAITEMENT_KEY, params],
    queryFn:  () => suiviTraitementApi.list(params),
    staleTime: 30_000,
    enabled,
  })
}

export function useCreateSuiviTraitement() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSuiviTraitementPayload) => suiviTraitementApi.create(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: SUIVI_TRAITEMENT_KEY })
      if (vars.consultationId) qc.invalidateQueries({ queryKey: ['consultations', vars.consultationId] })
      toast.success(i18n.t('suiviTraitement.toastOuvert'))
    },
    onError: toastErr,
  })
}

export function useAddFicheSuivi(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddFicheSuiviPayload) => suiviTraitementApi.addFiche(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUIVI_TRAITEMENT_KEY })
      toast.success(i18n.t('suiviTraitement.toastFicheAjoutee'))
    },
    onError: toastErr,
  })
}

export function useCloturerSuiviTraitement(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motifCloture?: string) => suiviTraitementApi.cloturer(id, motifCloture),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUIVI_TRAITEMENT_KEY })
      toast.success(i18n.t('suiviTraitement.toastCloture'))
    },
    onError: toastErr,
  })
}

export function useAnnulerSuiviTraitement(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motif: string) => suiviTraitementApi.annuler(id, motif),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUIVI_TRAITEMENT_KEY })
      toast.success(i18n.t('suiviTraitement.toastAnnule'))
    },
    onError: toastErr,
  })
}

export function useDeleteSuiviTraitement(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => suiviTraitementApi.supprimer(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SUIVI_TRAITEMENT_KEY })
      toast.success(i18n.t('suiviTraitement.toastSupprime'))
    },
    onError: toastErr,
  })
}
