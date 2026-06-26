import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { consultationApi } from '../api/consultation.api'
import type {
  CreateConsultationPayload, AddDiagnosticPayload,
  CloturerPayload, AddLignePayload, ConsultationQueryParams,
  SetReposPayload,
} from '../api/consultation.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'

// ── Keys ──────────────────────────────────────────────────────────────────────

export const CONSULTATIONS_KEY      = ['consultations'] as const
export const consultationKey        = (id: string) => ['consultations', id] as const

// ── Error helper ──────────────────────────────────────────────────────────────

function toastError(err: unknown) {
  if (isOfflineQueued(err)) return
  const msg = err instanceof ApiError ? err.serverMessage : i18n.t('consultation.toastGenericError')
  toast.error(msg)
}

/** Contre-indication médicamenteuse bloquante (409) : interceptée par le composant
 *  (modale « prescrire malgré tout »), pas par un toast brut. */
function isContreIndication(err: unknown): boolean {
  return err instanceof ApiError && (err.body as { code?: string } | null)?.code === 'CONTRE_INDICATION_BLOCKING'
}
function toastErrorUnlessCI(err: unknown) {
  if (!isContreIndication(err)) toastError(err)
}

// ── Liste ─────────────────────────────────────────────────────────────────────

export function useConsultations(params?: ConsultationQueryParams, opts?: { enabled?: boolean }) {
  return useQuery({
    queryKey: [...CONSULTATIONS_KEY, params],
    queryFn:  () => consultationApi.list(params),
    enabled:  opts?.enabled ?? true,   // requêtes annexes (clôturées/annulées) chargées à la demande
    refetchInterval: 30_000,           // ignoré tant que enabled=false (pas de polling inutile)
    staleTime:       15_000,
  })
}

// ── Consultations d'un patient (dossier) ─────────────────────────────────────

export function usePatientConsultations(patientId: string) {
  return useQuery({
    queryKey: [...CONSULTATIONS_KEY, 'patient', patientId],
    queryFn:  () => consultationApi.list({ patientId, statut: 'TOUTES' }),
    staleTime: 30_000,
    enabled:   !!patientId,
  })
}

// ── Documents générés d'un patient (dossier → onglet Documents) ──────────────

export function usePatientDocuments(patientId: string) {
  return useQuery({
    queryKey: [...CONSULTATIONS_KEY, 'patient', patientId, 'documents'],
    queryFn:  () => consultationApi.patientDocuments(patientId),
    staleTime: 30_000,
    enabled:   !!patientId,
  })
}

// ── Détail ────────────────────────────────────────────────────────────────────

export function useConsultation(id: string) {
  return useQuery({
    queryKey: consultationKey(id),
    queryFn:  () => consultationApi.findById(id),
    staleTime: 15_000,
    enabled:   !!id,
  })
}

// ── Créer consultation ────────────────────────────────────────────────────────

export function useCreateConsultation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateConsultationPayload) => consultationApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONSULTATIONS_KEY })
      // Invalider aussi la file de triage : la visite a maintenant une consultation,
      // elle quitte donc la file active (filtrée côté serveur).
      qc.invalidateQueries({ queryKey: ['visites'] })
      toast.success(i18n.t('consultation.toastConsultationOpened'))
    },
    onError: (err: unknown) => {
      // Retourner l'ID existant si doublon
      if (err instanceof ApiError && err.status === 409) {
        const body = err.body as { existingConsultationId?: string }
        if (body?.existingConsultationId) {
          // Le composant peut intercepter ce cas via onError de la mutation
        }
      }
      toastError(err)
    },
  })
}

// ── Examen clinique ───────────────────────────────────────────────────────────

export function useUpdateExamen(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (examen: string | null) => consultationApi.updateExamen(consultationId, examen),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
    },
    onError: toastError,
  })
}

// ── Conclusion ────────────────────────────────────────────────────────────────

export function useUpdateConclusion(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (conclusion: string | null) => consultationApi.updateConclusion(consultationId, conclusion),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
    },
    onError: toastError,
  })
}

// ── Type de consultation ────────────────────────────────────────────────────

export function useSetTypeConsultation(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (typeConsultationId: string | null) => consultationApi.setType(consultationId, typeConsultationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
    },
    onError: toastError,
  })
}

// ── Repos maladie ────────────────────────────────────────────────────────────

export function useSetRepos(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SetReposPayload) => consultationApi.setRepos(consultationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
    },
    onError: toastError,
  })
}

// ── Diagnostics ───────────────────────────────────────────────────────────────

export function useAddDiagnostic(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddDiagnosticPayload) => consultationApi.addDiagnostic(consultationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastDiagnosticAdded'))
    },
    onError: toastError,
  })
}

export function useRemoveDiagnostic(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (diagId: string) => consultationApi.removeDiagnostic(consultationId, diagId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastDiagnosticRemoved'))
    },
    onError: toastError,
  })
}

// ── Clôturer ──────────────────────────────────────────────────────────────────

export function useCloturer(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CloturerPayload) => consultationApi.cloturer(consultationId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONSULTATIONS_KEY })
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastConsultationClosed'))
    },
    onError: toastError,
  })
}

// ── Annuler ───────────────────────────────────────────────────────────────────

export function useAnnulerConsultation(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motif: string) => consultationApi.annuler(consultationId, motif),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONSULTATIONS_KEY })
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastConsultationCancelled'))
    },
    onError: toastError,
  })
}

export function useDeleteConsultation(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => consultationApi.remove(consultationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CONSULTATIONS_KEY })
      toast.success(i18n.t('consultation.toastConsultationDeleted'))
    },
    onError: toastError,
  })
}

/** Verrou souple : prendre la consultation en main (silencieux). */
export function usePrendreEnCharge(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => consultationApi.prendreEnCharge(consultationId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
    },
    // Pas de toast : action implicite à l'ouverture.
  })
}

// ── Ordonnances ───────────────────────────────────────────────────────────────

export function useAddLigne(consultationId: string, ordonnanceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AddLignePayload) => consultationApi.addLigne(consultationId, ordonnanceId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
    },
    onError: toastErrorUnlessCI,
  })
}

export function useRemoveLigne(consultationId: string, ordonnanceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ligneId: string) => consultationApi.removeLigne(consultationId, ordonnanceId, ligneId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
    },
    onError: toastError,
  })
}

export function useValiderOrdonnance(consultationId: string, ordonnanceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => consultationApi.validerOrdonnance(consultationId, ordonnanceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastPrescriptionValidated'))
    },
    onError: toastError,
  })
}

export function useAnnulerOrdonnance(consultationId: string, ordonnanceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => consultationApi.annulerOrdonnance(consultationId, ordonnanceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastPrescriptionCancelled'))
    },
    onError: toastError,
  })
}

export function useDeleteOrdonnance(consultationId: string, ordonnanceId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => consultationApi.deleteOrdonnance(consultationId, ordonnanceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastPrescriptionDeleted'))
    },
    onError: toastError,
  })
}

/**
 * Création PARESSEUSE d'ordonnance : crée l'ordonnance ET ajoute sa première ligne
 * en une seule action. Évite de persister une ordonnance vide (qu'il faudrait
 * ensuite annuler).
 */
export function useCreateOrdonnanceAvecLigne(consultationId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ligne: AddLignePayload) => {
      const ord = await consultationApi.createOrdonnance(consultationId)
      try {
        return await consultationApi.addLigne(consultationId, ord.id, ligne)
      } catch (err) {
        // Atomicité : l'ajout de la 1re ligne a échoué → on supprime l'ordonnance
        // brouillon pour ne jamais laisser d'ordonnance vide orpheline (y compris sur
        // contre-indication : le retry « malgré tout » recréera une ordonnance propre).
        await consultationApi.deleteOrdonnance(consultationId, ord.id).catch(() => {})
        throw err
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: consultationKey(consultationId) })
      toast.success(i18n.t('consultation.toastPrescriptionCreated'))
    },
    onError: toastErrorUnlessCI,
  })
}
