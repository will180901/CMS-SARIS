/**
 * useDelegations.ts
 * Hooks TanStack Query — lecture + mutations pour les délégations de prescription.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { acteursApi } from '../api/acteurs.api'
import type { CreateDelegationPayload, UpdateDelegationPayload } from '../api/acteurs.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import type { DelegationPrescription } from '@cms-saris/types'
import { usePermissions } from '@/hooks/usePermissions'
import i18n from '@/i18n/config'

// ── Clé de cache ───────────────────────────────────────────────────────────────

export const DELEGATIONS_KEY = ['acteurs', 'delegations'] as const

// ── Helper erreur ──────────────────────────────────────────────────────────────

function toastError(err: unknown) {
  if (isOfflineQueued(err)) return
  const msg = err instanceof ApiError ? err.serverMessage : i18n.t('acteurs.errorGeneric')
  toast.error(msg)
}

// ── Hooks ──────────────────────────────────────────────────────────────────────

export function useDelegations() {
  const { has } = usePermissions()
  return useQuery({
    queryKey: DELEGATIONS_KEY,
    queryFn:  acteursApi.delegations.list,
    staleTime: 30_000,
    // Ne pas tenter le call si l'utilisateur n'a pas la permission
    // (sinon 403 et bruit dans la console)
    enabled:  has('delegation.read'),
  })
}

export function useCreateDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateDelegationPayload) => acteursApi.delegations.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DELEGATIONS_KEY })
      toast.success(i18n.t('acteurs.toastDelegationCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDelegationPayload }) =>
      acteursApi.delegations.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DELEGATIONS_KEY })
      toast.success(i18n.t('acteurs.toastDelegationUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleDelegationStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (d: DelegationPrescription) =>
      acteursApi.delegations.toggleStatut(d.id, d.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'),
    onSuccess: (_, d) => {
      qc.invalidateQueries({ queryKey: DELEGATIONS_KEY })
      toast.success(d.statut === 'ACTIVE' ? i18n.t('acteurs.toastDelegationSuspended') : i18n.t('acteurs.toastDelegationReactivated'))
    },
    onError: toastError,
  })
}

export function useDeleteDelegation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => acteursApi.delegations.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: DELEGATIONS_KEY })
      toast.success(i18n.t('acteurs.toastDelegationDeleted'))
    },
    onError: toastError,
  })
}
