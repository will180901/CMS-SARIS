/**
 * useReferentiels.ts
 * Hooks TanStack Query — lecture + mutations pour les 6 entités référentiels.
 *
 * Convention :
 *  - useXxx()        → useQuery (liste complète, non filtrée, cache partagé)
 *  - useCreateXxx()  → useMutation (POST)
 *  - useUpdateXxx()  → useMutation (PATCH — édition + toggle statut)
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from '@workspace/ui/components/sonner'
import { referentielsApi, toggleStatut, isActif } from '../api/referentiels.api'
import { ApiError, isOfflineQueued } from '@/lib/api'
import i18n from '@/i18n/config'
import type {
  CreateSitePayload, UpdateSitePayload,
  CreateMotifPayload, UpdateMotifPayload,
  CreatePathologiePayload, UpdatePathologiePayload,
  CreateMedicamentPayload, UpdateMedicamentPayload,
  CreateCategoriePayload, UpdateCategoriePayload,
  CreateTypeExamenPayload, UpdateTypeExamenPayload,
  CreateTypeConsultationPayload, UpdateTypeConsultationPayload,
} from '../api/referentiels.api'
import type {
  Site, MotifConsultation, PathologieReference,
  MedicamentReference, CategoriePatient, TypeExamen,
  TypeConsultation,
} from '@cms-saris/types'

// ── Clés de cache ─────────────────────────────────────────────────────────────

export const QUERY_KEYS = {
  sites:        ['referentiels', 'sites']        as const,
  motifs:       ['referentiels', 'motifs']       as const,
  pathologies:  ['referentiels', 'pathologies']  as const,
  medicaments:  ['referentiels', 'medicaments']  as const,
  categories:   ['referentiels', 'categories']   as const,
  examens:      ['referentiels', 'examens']      as const,
  typesConsultation: ['referentiels', 'types-consultation'] as const,
}

// ── Helper erreur ──────────────────────────────────────────────────────────────

function toastError(err: unknown) {
  if (isOfflineQueued(err)) return
  const msg = err instanceof ApiError ? err.serverMessage : i18n.t('referentiels.errorGeneric')
  toast.error(msg)
}

// ══════════════════════════════════════════════════════════════════════════════
//  SITES
// ══════════════════════════════════════════════════════════════════════════════

export function useSites() {
  return useQuery({
    queryKey: QUERY_KEYS.sites,
    queryFn:  referentielsApi.sites.list,
    staleTime: 30_000,
  })
}

export function useCreateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateSitePayload) => referentielsApi.sites.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sites })
      toast.success(i18n.t('referentiels.siteCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateSite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSitePayload }) =>
      referentielsApi.sites.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sites })
      toast.success(i18n.t('referentiels.siteUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleSiteStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (site: Site) =>
      referentielsApi.sites.setStatut(site.id, toggleStatut(site.statut) as Site['statut']),
    onSuccess: (_, site) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.sites })
      toast.success(isActif(site.statut) ? i18n.t('referentiels.siteDeactivated') : i18n.t('referentiels.siteActivated'))
    },
    onError: toastError,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  MOTIFS DE CONSULTATION
// ══════════════════════════════════════════════════════════════════════════════

export function useMotifs() {
  return useQuery({
    queryKey: QUERY_KEYS.motifs,
    queryFn:  referentielsApi.motifs.list,
    staleTime: 30_000,
  })
}

export function useCreateMotif() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMotifPayload) => referentielsApi.motifs.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.motifs })
      toast.success(i18n.t('referentiels.motifCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateMotif() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMotifPayload }) =>
      referentielsApi.motifs.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.motifs })
      toast.success(i18n.t('referentiels.motifUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleMotifStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (motif: MotifConsultation) =>
      referentielsApi.motifs.setStatut(motif.id, toggleStatut(motif.statut) as MotifConsultation['statut']),
    onSuccess: (_, motif) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.motifs })
      toast.success(isActif(motif.statut) ? i18n.t('referentiels.motifDeactivated') : i18n.t('referentiels.motifActivated'))
    },
    onError: toastError,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  PATHOLOGIES
// ══════════════════════════════════════════════════════════════════════════════

export function usePathologies() {
  return useQuery({
    queryKey: QUERY_KEYS.pathologies,
    queryFn:  referentielsApi.pathologies.list,
    staleTime: 30_000,
  })
}

export function useCreatePathologie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreatePathologiePayload) => referentielsApi.pathologies.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pathologies })
      toast.success(i18n.t('referentiels.pathoCreated'))
    },
    onError: toastError,
  })
}

export function useUpdatePathologie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePathologiePayload }) =>
      referentielsApi.pathologies.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pathologies })
      toast.success(i18n.t('referentiels.pathoUpdated'))
    },
    onError: toastError,
  })
}

export function useTogglePathologieStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: PathologieReference) =>
      referentielsApi.pathologies.setStatut(p.id, toggleStatut(p.statut) as PathologieReference['statut']),
    onSuccess: (_, p) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.pathologies })
      toast.success(isActif(p.statut) ? i18n.t('referentiels.pathoDeactivated') : i18n.t('referentiels.pathoActivated'))
    },
    onError: toastError,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  MÉDICAMENTS
// ══════════════════════════════════════════════════════════════════════════════

export function useMedicaments() {
  return useQuery({
    queryKey: QUERY_KEYS.medicaments,
    queryFn:  referentielsApi.medicaments.list,
    staleTime: 30_000,
  })
}

export function useCreateMedicament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateMedicamentPayload) => referentielsApi.medicaments.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.medicaments })
      toast.success(i18n.t('referentiels.medCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateMedicament() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMedicamentPayload }) =>
      referentielsApi.medicaments.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.medicaments })
      toast.success(i18n.t('referentiels.medUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleMedicamentStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (m: MedicamentReference) =>
      referentielsApi.medicaments.setStatut(m.id, toggleStatut(m.statut) as MedicamentReference['statut']),
    onSuccess: (_, m) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.medicaments })
      toast.success(isActif(m.statut) ? i18n.t('referentiels.medDeactivated') : i18n.t('referentiels.medActivated'))
    },
    onError: toastError,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  CATÉGORIES DE PATIENTS
// ══════════════════════════════════════════════════════════════════════════════

export function useCategoriesPatient() {
  return useQuery({
    queryKey: QUERY_KEYS.categories,
    queryFn:  referentielsApi.categories.list,
    staleTime: 30_000,
  })
}

export function useCreateCategorie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateCategoriePayload) => referentielsApi.categories.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories })
      toast.success(i18n.t('referentiels.catCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateCategorie() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCategoriePayload }) =>
      referentielsApi.categories.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories })
      toast.success(i18n.t('referentiels.catUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleCategorieStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (c: CategoriePatient) =>
      referentielsApi.categories.setStatut(c.id, toggleStatut(c.statut) as CategoriePatient['statut']),
    onSuccess: (_, c) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.categories })
      toast.success(isActif(c.statut) ? i18n.t('referentiels.catDeactivated') : i18n.t('referentiels.catActivated'))
    },
    onError: toastError,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  TYPES D'EXAMEN
// ══════════════════════════════════════════════════════════════════════════════

export function useTypesExamen() {
  return useQuery({
    queryKey: QUERY_KEYS.examens,
    queryFn:  referentielsApi.examens.list,
    staleTime: 30_000,
  })
}

export function useCreateTypeExamen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTypeExamenPayload) => referentielsApi.examens.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.examens })
      toast.success(i18n.t('referentiels.examCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateTypeExamen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTypeExamenPayload }) =>
      referentielsApi.examens.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.examens })
      toast.success(i18n.t('referentiels.examUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleTypeExamenStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (t: TypeExamen) =>
      referentielsApi.examens.setStatut(t.id, toggleStatut(t.statut) as TypeExamen['statut']),
    onSuccess: (_, t) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.examens })
      toast.success(isActif(t.statut) ? i18n.t('referentiels.examDeactivated') : i18n.t('referentiels.examActivated'))
    },
    onError: toastError,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  TYPES DE CONSULTATION
// ══════════════════════════════════════════════════════════════════════════════

export function useTypesConsultation() {
  return useQuery({
    queryKey: QUERY_KEYS.typesConsultation,
    queryFn:  referentielsApi.typesConsultation.list,
    staleTime: 30_000,
  })
}

export function useCreateTypeConsultation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: CreateTypeConsultationPayload) => referentielsApi.typesConsultation.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.typesConsultation })
      toast.success(i18n.t('referentiels.typeConsultationCreated'))
    },
    onError: toastError,
  })
}

export function useUpdateTypeConsultation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTypeConsultationPayload }) =>
      referentielsApi.typesConsultation.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.typesConsultation })
      toast.success(i18n.t('referentiels.typeConsultationUpdated'))
    },
    onError: toastError,
  })
}

export function useToggleTypeConsultationStatut() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (t: TypeConsultation) =>
      referentielsApi.typesConsultation.setStatut(t.id, toggleStatut(t.statut) as TypeConsultation['statut']),
    onSuccess: (_, t) => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.typesConsultation })
      toast.success(isActif(t.statut) ? i18n.t('referentiels.typeConsultationDeactivated') : i18n.t('referentiels.typeConsultationActivated'))
    },
    onError: toastError,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
//  SUPPRESSION DÉFINITIVE (perm referentiel.<service>.delete) — 409 si référencé
// ══════════════════════════════════════════════════════════════════════════════

function makeDeleteHook(
  qk: readonly unknown[],
  fn: (id: string) => Promise<unknown>,
  okMsgKey: string,
) {
  return function useDelete() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (id: string) => fn(id),
      onSuccess: () => { qc.invalidateQueries({ queryKey: qk }); toast.success(i18n.t(okMsgKey)) },
      onError: toastError,
    })
  }
}

export const useDeleteSite        = makeDeleteHook(QUERY_KEYS.sites,       referentielsApi.sites.remove,        'referentiels.siteDeleted')
export const useDeleteMotif       = makeDeleteHook(QUERY_KEYS.motifs,      referentielsApi.motifs.remove,       'referentiels.motifDeleted')
export const useDeletePathologie  = makeDeleteHook(QUERY_KEYS.pathologies, referentielsApi.pathologies.remove,  'referentiels.pathoDeleted')
export const useDeleteMedicament  = makeDeleteHook(QUERY_KEYS.medicaments, referentielsApi.medicaments.remove,  'referentiels.medDeleted')
export const useDeleteCategorie   = makeDeleteHook(QUERY_KEYS.categories,  referentielsApi.categories.remove,   'referentiels.catDeleted')
export const useDeleteTypeExamen  = makeDeleteHook(QUERY_KEYS.examens,     referentielsApi.examens.remove,      'referentiels.examDeleted')
export const useDeleteTypeConsultation = makeDeleteHook(QUERY_KEYS.typesConsultation, referentielsApi.typesConsultation.remove, 'referentiels.typeConsultationDeleted')
