/**
 * useSousTraitants.ts
 * Hooks TanStack Query — sociétés sous-traitantes (donnée de référence des patients).
 * Déplacé du module Acteurs vers Référentiels (le sous-traitant est une catégorie de
 * patient, pas un « acteur »). L'endpoint backend reste /sous-traitants.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { sousTraitantsApi } from '../api/referentiels.api'
import type { CreateSousTraitantPayload, UpdateSousTraitantPayload } from '../api/referentiels.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import type { SocieteSousTraitante } from '@cms-saris/types'
import { usePermissions } from '@/hooks/usePermissions'
import i18n from '@/i18n/config'

export const SOUS_TRAITANTS_KEY = ['sous-traitants'] as const

function toastError(err: unknown) {
  if (isOfflineQueued(err)) return
  const msg = err instanceof ApiError ? err.serverMessage : i18n.t('acteurs.errorGeneric')
  toast.error(msg)
}

export function useSousTraitants() {
  const { has } = usePermissions()
  return useQuery({
    queryKey: SOUS_TRAITANTS_KEY,
    queryFn:  sousTraitantsApi.list,
    staleTime: 30_000,
    enabled:  has('sous_traitant.read'),
  })
}

export function useCreateSousTraitant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSousTraitantPayload) => sousTraitantsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SOUS_TRAITANTS_KEY })
      toast.success(i18n.t('acteurs.toastSocieteCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateSousTraitant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSousTraitantPayload }) =>
      sousTraitantsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SOUS_TRAITANTS_KEY })
      toast.success(i18n.t('acteurs.toastSocieteUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleSousTraitantStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (s: SocieteSousTraitante) =>
      sousTraitantsApi.setStatut(s.id, s.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: (_, s) => {
      qc.invalidateQueries({ queryKey: SOUS_TRAITANTS_KEY })
      toast.success(s.statut === 'ACTIVE' ? i18n.t('acteurs.toastSocieteDeactivated') : i18n.t('acteurs.toastSocieteActivated'))
    },
    onError: toastError,
  })
}

export function useDeleteSousTraitant() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => sousTraitantsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SOUS_TRAITANTS_KEY })
      toast.success(i18n.t('acteurs.toastSocieteDeleted'))
    },
    onError: toastError,
  })
}
