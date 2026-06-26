import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { triageApi } from '../api/triage.api'
import type {
  CreateVisitePayload, ConstanteVitalePayload, VisiteQueryParams, UpdateStatutPayload,
} from '../api/triage.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'

// ── Keys ──────────────────────────────────────────────────────────────────────

export const VISITES_KEY  = ['visites'] as const
export const visiteKey    = (id: string) => ['visites', id] as const

// ── Error helper ──────────────────────────────────────────────────────────────

function toastError(err: unknown) {
  if (isOfflineQueued(err)) return
  const msg = err instanceof ApiError ? err.serverMessage : i18n.t('triage.toastErreurGenerique')
  toast.error(msg)
}

// ── Liste ─────────────────────────────────────────────────────────────────────

export function useVisites(params?: VisiteQueryParams) {
  return useQuery({
    queryKey: [...VISITES_KEY, params],
    queryFn:  () => triageApi.list(params),
    refetchInterval: 30_000,   // Refresh auto toutes les 30s
    staleTime:       15_000,
  })
}

// ── Détail ────────────────────────────────────────────────────────────────────

export function useVisite(id: string) {
  return useQuery({
    queryKey: visiteKey(id),
    queryFn:  () => triageApi.findById(id),
    staleTime: 15_000,
    enabled:   !!id,
  })
}

// ── Visites d'un patient (dossier) ──────────────────────────────────────────────

export function usePatientVisites(patientId: string) {
  return useQuery({
    queryKey: ['visites', 'patient', patientId] as const,
    queryFn:  () => triageApi.visitesByPatient(patientId),
    staleTime: 15_000,
    enabled:   !!patientId,
  })
}

// ── Ouverture visite ──────────────────────────────────────────────────────────

export function useCreateVisite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateVisitePayload) => triageApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VISITES_KEY })
      toast.success(i18n.t('triage.toastVisiteOuverte'))
    },
    onError: toastError,
  })
}

// ── Statut ────────────────────────────────────────────────────────────────────

export function useUpdateStatutVisite(visiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (payload: UpdateStatutPayload) => triageApi.updateStatut(visiteId, payload),
    onSuccess: (_, payload) => {
      qc.invalidateQueries({ queryKey: VISITES_KEY })
      qc.invalidateQueries({ queryKey: visiteKey(visiteId) })
      const msgs: Record<string, string> = {
        EN_COURS:  i18n.t('triage.toastVisitePriseEnCharge'),
        CLOTUREE:  i18n.t('triage.toastVisiteCloturee'),
        ANNULEE:   i18n.t('triage.toastVisiteAnnulee'),
        EN_ATTENTE:i18n.t('triage.toastVisiteRemiseEnAttente'),
      }
      toast.success(msgs[payload.statut] ?? i18n.t('triage.toastStatutMisAJour'))
    },
    onError: toastError,
  })
}

// ── Suppression définitive ──────────────────────────────────────────────────────

export function useDeleteVisite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => triageApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VISITES_KEY })
      toast.success(i18n.t('triage.toastVisiteSupprimee'))
    },
    onError: toastError,
  })
}

// ── Soignant ──────────────────────────────────────────────────────────────────

export function useUpdateSoignantVisite(visiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (soignantId: string | null) => triageApi.updateSoignant(visiteId, soignantId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VISITES_KEY })
      qc.invalidateQueries({ queryKey: visiteKey(visiteId) })
      toast.success(i18n.t('triage.toastSoignantAssigne'))
    },
    onError: toastError,
  })
}

// ── Notes d'accueil ───────────────────────────────────────────────────────────

export function useUpdateNotesVisite(visiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (notes: string | null) => triageApi.updateNotes(visiteId, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: VISITES_KEY })
      qc.invalidateQueries({ queryKey: visiteKey(visiteId) })
      // Auto-save silencieux : le StatusPill de la carte affiche déjà l'état (pas de toast répété).
    },
    onError: toastError,
  })
}

// ── Constantes vitales ────────────────────────────────────────────────────────

export function useCreateConstantes(visiteId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ConstanteVitalePayload) => triageApi.createConstantes(visiteId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: visiteKey(visiteId) })
      toast.success(i18n.t('triage.toastConstantesEnregistrees'))
    },
    onError: toastError,
  })
}
