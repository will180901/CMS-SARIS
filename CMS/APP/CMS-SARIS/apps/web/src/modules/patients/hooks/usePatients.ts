import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { patientsApi } from '../api/patients.api'
import type {
  CreatePatientPayload, PatientQueryParams,
  AllergiePayload, AntecedentPayload, AlertePayload,
  UpdateRattachementADPayload,
  UpdateIdentitePayload, ChangerCategoriePayload, ModeViePayload,
  SimilarPatientQuery,
  CreateSuiviChroniquePayload, UpdateSuiviChroniquePayload,
} from '../api/patients.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'
import { usePermissions } from '@/hooks/usePermissions'

// ── Keys ──────────────────────────────────────────────────────────────────────

export const PATIENTS_KEY  = ['patients'] as const
export const dossierKey    = (id: string) => ['patients', id] as const

// ── Error helper ──────────────────────────────────────────────────────────────

function toastError(err: unknown) {
  if (isOfflineQueued(err)) return
  const msg = err instanceof ApiError ? err.serverMessage : i18n.t('patients.toastGenericError')
  toast.error(msg)
}

// ── Liste ─────────────────────────────────────────────────────────────────────

export function usePatients(params?: PatientQueryParams) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: [...PATIENTS_KEY, params],
    queryFn:  () => patientsApi.list(params),
    staleTime: 30_000,
    enabled:  has('patient.read'),
  })
}

// ── Dossier complet ───────────────────────────────────────────────────────────

export function usePatientDossier(id: string) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: dossierKey(id),
    queryFn:  () => patientsApi.findById(id),
    staleTime: 20_000,
    enabled:  !!id && has('patient.read'),
  })
}

// ── Historique des constantes vitales ───────────────────────────────────────────

export function usePatientConstantes(id: string) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: ['patients', id, 'constantes'],
    queryFn:  () => patientsApi.constantes(id),
    staleTime: 20_000,
    enabled:  !!id && has('patient.read'),
  })
}

// ── Alertes cliniques calculées ──────────────────────────────────────────────────

export function usePatientAlertesCliniques(id: string, enabled = true) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: ['patients', id, 'alertes-cliniques'],
    queryFn:  () => patientsApi.alertesCliniques(id),
    staleTime: 20_000,
    enabled:  !!id && enabled && has('patient.read'),
  })
}

// Suivi du dossier (traitement, évolution des pathologies chroniques, résultats d'examens) —
// calculé sur l'historique complet du patient, tous sites (dossier centralisé).
export function usePatientSuivi(id: string, enabled = true) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: ['patients', id, 'suivi'],
    queryFn:  () => patientsApi.suivi(id),
    staleTime: 20_000,
    enabled:  !!id && enabled && has('patient.read'),
  })
}

// ── Mutations suivi chronique (définir / modifier / clôturer) ────────────────────

const suiviKey = (id: string) => ['patients', id, 'suivi'] as const

export function useCreateSuiviChronique(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSuiviChroniquePayload) => patientsApi.createSuiviChronique(patientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: suiviKey(patientId) }); toast.success(i18n.t('patients.toastSuiviCreated')) },
    onError: toastError,
  })
}

export function useUpdateSuiviChronique(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ sId, data }: { sId: string; data: UpdateSuiviChroniquePayload }) =>
      patientsApi.updateSuiviChronique(patientId, sId, data),
    onSuccess: (_res, vars) => { qc.invalidateQueries({ queryKey: suiviKey(patientId) }); toast.success(i18n.t(vars.data.statut === 'CLOTURE' ? 'patients.toastSuiviClosed' : 'patients.toastSuiviUpdated')) },
    onError: toastError,
  })
}

// Ayants droit (dépendants) d'un travailleur CDI + leur activité récente (traçabilité dossier).
export function usePatientAyantsDroits(id: string, enabled = true) {
  const { has } = usePermissions()
  return useQuery({
    queryKey: ['patients', id, 'ayants-droits'],
    queryFn:  () => patientsApi.ayantsDroits(id),
    staleTime: 20_000,
    enabled:  !!id && enabled && has('patient.read'),
  })
}

// ── Détection de doublons (triage) ──────────────────────────────────────────────

/** Recherche de patients ressemblants. Activée seulement si nom+prénom ≥ 2 car. */
export function useFindSimilarPatients(q: SimilarPatientQuery) {
  const { has } = usePermissions()
  const enabled = (q.nom?.trim().length ?? 0) >= 2 && (q.prenom?.trim().length ?? 0) >= 2
  return useQuery({
    queryKey: ['patients', 'similar', q],
    queryFn:  () => patientsApi.findSimilar(q),
    enabled:  enabled && has('patient.read'),
    staleTime: 10_000,
  })
}

// ── Mutations patient ─────────────────────────────────────────────────────────

export function useCreatePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePatientPayload) => patientsApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PATIENTS_KEY }); toast.success(i18n.t('patients.toastPatientCreated')) },
    onError: toastError,
  })
}

export function useUpdateIdentite(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: UpdateIdentitePayload) => patientsApi.updateIdentite(patientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastIdentityUpdated')) },
    onError: toastError,
  })
}

export function useUpdateModeVie(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ModeViePayload) => patientsApi.updateModeVie(patientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastModeVieUpdated', { defaultValue: 'Mode de vie mis à jour' })) },
    onError: toastError,
  })
}

/** Verrou de confidentialité du dossier (médecin-chef). */
export function useSetVerrouPatient(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ verrouille, motif }: { verrouille: boolean; motif?: string }) => patientsApi.setVerrou(patientId, verrouille, motif),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: dossierKey(patientId) })
      qc.invalidateQueries({ queryKey: PATIENTS_KEY })
      qc.invalidateQueries({ queryKey: ['patients', patientId, 'constantes'] })
      qc.invalidateQueries({ queryKey: ['patients', patientId, 'alertes-cliniques'] })
      qc.invalidateQueries({ queryKey: ['consultations', 'patient', patientId, 'documents'] })
      toast.success(res.verrouille ? i18n.t('patients.toastLocked', { defaultValue: 'Dossier verrouillé' }) : i18n.t('patients.toastUnlocked', { defaultValue: 'Dossier déverrouillé' }))
    },
    onError: toastError,
  })
}

export function useUploadPatientPhoto(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => patientsApi.uploadPhoto(patientId, file),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PATIENTS_KEY })
      qc.invalidateQueries({ queryKey: dossierKey(patientId) })
      toast.success(i18n.t('patients.toastPhotoUpdated'))
    },
    onError: toastError,
  })
}

export function useRemovePatientPhoto(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => patientsApi.removePhoto(patientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PATIENTS_KEY })
      qc.invalidateQueries({ queryKey: dossierKey(patientId) })
      toast.success(i18n.t('patients.toastPhotoRemoved'))
    },
    onError: toastError,
  })
}

export function useChangerCategorie(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: ChangerCategoriePayload) => patientsApi.changerCategorie(patientId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: PATIENTS_KEY })
      qc.invalidateQueries({ queryKey: dossierKey(patientId) })
      toast.success(i18n.t('patients.toastCategoryChanged'))
    },
    onError: toastError,
  })
}

export function useUpdateStatutPatient(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (statut: string) => patientsApi.updateStatut(patientId, statut),
    onSuccess: (_, statut) => {
      qc.invalidateQueries({ queryKey: PATIENTS_KEY })
      qc.invalidateQueries({ queryKey: dossierKey(patientId) })
      toast.success(statut === 'ACTIF' ? i18n.t('patients.toastRecordReactivated') : statut === 'ARCHIVE' ? i18n.t('patients.toastRecordArchived') : i18n.t('patients.toastStatusUpdated'))
    },
    onError: toastError,
  })
}

// ── Mutations allergies ───────────────────────────────────────────────────────

export function useCreateAllergie(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AllergiePayload) => patientsApi.createAllergie(patientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAllergyCreated')) },
    onError: toastError,
  })
}

export function useUpdateAllergie(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ aId, data }: { aId: string; data: Partial<AllergiePayload> }) =>
      patientsApi.updateAllergie(patientId, aId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAllergyUpdated')) },
    onError: toastError,
  })
}

// ── Mutations antécédents ─────────────────────────────────────────────────────

export function useCreateAntecedent(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AntecedentPayload) => patientsApi.createAntecedent(patientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAntecedentCreated')) },
    onError: toastError,
  })
}

export function useUpdateAntecedent(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ aId, data }: { aId: string; data: Partial<AntecedentPayload> }) =>
      patientsApi.updateAntecedent(patientId, aId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAntecedentUpdated')) },
    onError: toastError,
  })
}

// ── Mutations alertes médicales ───────────────────────────────────────────────

export function useCreateAlerte(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: AlertePayload) => patientsApi.createAlerte(patientId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAlertCreated')) },
    onError: toastError,
  })
}

export function useUpdateAlerte(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ aId, data }: { aId: string; data: Partial<AlertePayload> }) =>
      patientsApi.updateAlerte(patientId, aId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAlertUpdated')) },
    onError: toastError,
  })
}

// ── Mutations rattachements ───────────────────────────────────────────────────
// Création retirée : le rattachement (ayant droit CDI ou sous-traitant) se crée
// automatiquement à la visite. Seule l'édition d'un rattachement AD existant
// reste possible depuis le dossier (type de lien, dates, clôture).

export function useUpdateRattachementAD(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ rId, data }: { rId: string; data: UpdateRattachementADPayload }) =>
      patientsApi.updateRattachementAD(patientId, rId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAttachmentAdUpdated')) },
    onError: toastError,
  })
}

// ── Suppressions (sous-entités sous patient.update / rattachement.manage) ────

export function useDeleteAllergie(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (aId: string) => patientsApi.deleteAllergie(patientId, aId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAllergyDeleted')) },
    onError: toastError,
  })
}

export function useDeleteAntecedent(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (aId: string) => patientsApi.deleteAntecedent(patientId, aId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAntecedentDeleted')) },
    onError: toastError,
  })
}

export function useDeleteAlerte(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (aId: string) => patientsApi.deleteAlerte(patientId, aId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAlertDeleted')) },
    onError: toastError,
  })
}

export function useDeleteRattachementAD(patientId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (rId: string) => patientsApi.deleteRattachementAD(patientId, rId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: dossierKey(patientId) }); toast.success(i18n.t('patients.toastAttachmentAdDeleted')) },
    onError: toastError,
  })
}

/** Suppression définitive du dossier (perm patient.delete) — 409 si historique clinique. */
export function useDeletePatient() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => patientsApi.remove(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: PATIENTS_KEY }); toast.success(i18n.t('patients.toastRecordDeleted')) },
    onError: toastError,
  })
}
