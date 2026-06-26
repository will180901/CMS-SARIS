/**
 * referentiels.api.ts
 * Couche d'accès aux données — Module Référentiels
 * Toutes les fonctions retournent des Promise typées.
 *
 * SÉCURITÉ : le toggle de statut (activer/désactiver) passe par un endpoint
 * dédié `PATCH /:type/:id/statut` qui exige côté backend la permission
 * `referentiel.delete`. Le `update()` général n'inclut PAS le statut — sinon
 * un utilisateur ayant seulement `referentiel.update` pourrait désactiver
 * un référentiel en glissant {statut:'INACTIF'} dans le PATCH classique.
 */

import { api } from '@/lib/api'
import type {
  Site,
  MotifConsultation,
  PathologieReference,
  MedicamentReference,
  CategoriePatient,
  TypeExamen,
  TypeConsultation,
  SocieteSousTraitante,
} from '@cms-saris/types'

// ── Sociétés sous-traitantes ──────────────────────────────────────────────────
// Donnée de référence des PATIENTS (catégorie « sous-traitant ») — gérée ici, dans
// les référentiels, et non comme un « acteur ». L'endpoint backend reste /sous-traitants.
export interface CreateSousTraitantPayload { nom: string }
export interface UpdateSousTraitantPayload { nom?: string }

export const sousTraitantsApi = {
  list:      ()                                            => api.get<SocieteSousTraitante[]>('/sous-traitants'),
  create:    (data: CreateSousTraitantPayload)             => api.post<SocieteSousTraitante>('/sous-traitants', data),
  update:    (id: string, data: UpdateSousTraitantPayload) => api.patch<SocieteSousTraitante>(`/sous-traitants/${id}`, data),
  setStatut: (id: string, statut: 'ACTIVE' | 'INACTIVE')  => api.patch<SocieteSousTraitante>(`/sous-traitants/${id}/statut`, { statut }),
  remove:    (id: string)                                  => api.delete<{ id: string; deleted: true }>(`/sous-traitants/${id}`),
}

// ── Payload types (ce qu'on envoie au backend) ────────────────────────────────

export interface CreateSitePayload    { code: string; libelle: string; localisation?: string }
export interface UpdateSitePayload    { code?: string; libelle?: string; localisation?: string }

export interface CreateMotifPayload   { code: string; libelle: string }
export interface UpdateMotifPayload   { code?: string; libelle?: string }

export interface CreatePathologiePayload { code: string; libelle: string; chronique?: boolean }
export interface UpdatePathologiePayload { code?: string; libelle?: string; chronique?: boolean }

export interface CreateMedicamentPayload { nomGenerique: string; nomCommercial?: string; familleThera?: string }
export interface UpdateMedicamentPayload { nomGenerique?: string; nomCommercial?: string; familleThera?: string }

export interface CreateCategoriePayload  { code: string; libelle: string }
export interface UpdateCategoriePayload  { code?: string; libelle?: string }

export interface CreateTypeExamenPayload { code: string; libelle: string; domaine: TypeExamen['domaine'] }
export interface UpdateTypeExamenPayload { code?: string; libelle?: string; domaine?: TypeExamen['domaine'] }

export interface CreateTypeConsultationPayload { code: string; libelle: string }
export interface UpdateTypeConsultationPayload { code?: string; libelle?: string }

// ── API object ────────────────────────────────────────────────────────────────

export const referentielsApi = {

  // ── Sites ──────────────────────────────────────────────────────────────────
  sites: {
    list:      ()                                  => api.get<Site[]>('/referentiels/sites'),
    create:    (data: CreateSitePayload)           => api.post<Site>('/referentiels/sites', data),
    update:    (id: string, data: UpdateSitePayload) => api.patch<Site>(`/referentiels/sites/${id}`, data),
    setStatut: (id: string, statut: Site['statut']) => api.patch<Site>(`/referentiels/sites/${id}/statut`, { statut }),
    remove:    (id: string)                        => api.delete<{ id: string; deleted: true }>(`/referentiels/sites/${id}`),
  },

  // ── Motifs de consultation ─────────────────────────────────────────────────
  motifs: {
    list:      ()                                  => api.get<MotifConsultation[]>('/referentiels/motifs'),
    create:    (data: CreateMotifPayload)          => api.post<MotifConsultation>('/referentiels/motifs', data),
    update:    (id: string, data: UpdateMotifPayload) => api.patch<MotifConsultation>(`/referentiels/motifs/${id}`, data),
    setStatut: (id: string, statut: MotifConsultation['statut']) => api.patch<MotifConsultation>(`/referentiels/motifs/${id}/statut`, { statut }),
    remove:    (id: string)                        => api.delete<{ id: string; deleted: true }>(`/referentiels/motifs/${id}`),
  },

  // ── Pathologies ────────────────────────────────────────────────────────────
  pathologies: {
    list:      ()                                  => api.get<PathologieReference[]>('/referentiels/pathologies'),
    create:    (data: CreatePathologiePayload)     => api.post<PathologieReference>('/referentiels/pathologies', data),
    update:    (id: string, data: UpdatePathologiePayload) => api.patch<PathologieReference>(`/referentiels/pathologies/${id}`, data),
    setStatut: (id: string, statut: PathologieReference['statut']) => api.patch<PathologieReference>(`/referentiels/pathologies/${id}/statut`, { statut }),
    remove:    (id: string)                        => api.delete<{ id: string; deleted: true }>(`/referentiels/pathologies/${id}`),
  },

  // ── Médicaments ────────────────────────────────────────────────────────────
  medicaments: {
    list:      ()                                  => api.get<MedicamentReference[]>('/referentiels/medicaments'),
    create:    (data: CreateMedicamentPayload)     => api.post<MedicamentReference>('/referentiels/medicaments', data),
    update:    (id: string, data: UpdateMedicamentPayload) => api.patch<MedicamentReference>(`/referentiels/medicaments/${id}`, data),
    setStatut: (id: string, statut: MedicamentReference['statut']) => api.patch<MedicamentReference>(`/referentiels/medicaments/${id}/statut`, { statut }),
    remove:    (id: string)                        => api.delete<{ id: string; deleted: true }>(`/referentiels/medicaments/${id}`),
  },

  // ── Catégories de patients ─────────────────────────────────────────────────
  categories: {
    list:      ()                                  => api.get<CategoriePatient[]>('/referentiels/categories-patient'),
    create:    (data: CreateCategoriePayload)      => api.post<CategoriePatient>('/referentiels/categories-patient', data),
    update:    (id: string, data: UpdateCategoriePayload) => api.patch<CategoriePatient>(`/referentiels/categories-patient/${id}`, data),
    setStatut: (id: string, statut: CategoriePatient['statut']) => api.patch<CategoriePatient>(`/referentiels/categories-patient/${id}/statut`, { statut }),
    remove:    (id: string)                        => api.delete<{ id: string; deleted: true }>(`/referentiels/categories-patient/${id}`),
  },

  // ── Types d'examen ─────────────────────────────────────────────────────────
  examens: {
    list:      ()                                  => api.get<TypeExamen[]>('/referentiels/types-examen'),
    create:    (data: CreateTypeExamenPayload)     => api.post<TypeExamen>('/referentiels/types-examen', data),
    update:    (id: string, data: UpdateTypeExamenPayload) => api.patch<TypeExamen>(`/referentiels/types-examen/${id}`, data),
    setStatut: (id: string, statut: TypeExamen['statut']) => api.patch<TypeExamen>(`/referentiels/types-examen/${id}/statut`, { statut }),
    remove:    (id: string)                        => api.delete<{ id: string; deleted: true }>(`/referentiels/types-examen/${id}`),
  },

  // ── Types de consultation ──────────────────────────────────────────────────
  typesConsultation: {
    list:      ()                                  => api.get<TypeConsultation[]>('/referentiels/types-consultation'),
    create:    (data: CreateTypeConsultationPayload) => api.post<TypeConsultation>('/referentiels/types-consultation', data),
    update:    (id: string, data: UpdateTypeConsultationPayload) => api.patch<TypeConsultation>(`/referentiels/types-consultation/${id}`, data),
    setStatut: (id: string, statut: TypeConsultation['statut']) => api.patch<TypeConsultation>(`/referentiels/types-consultation/${id}/statut`, { statut }),
    remove:    (id: string)                        => api.delete<{ id: string; deleted: true }>(`/referentiels/types-consultation/${id}`),
  },
}

// Helper : inverse le statut d'une entité
export function toggleStatut(statut: string): string {
  if (statut === 'ACTIF')     return 'INACTIF'
  if (statut === 'INACTIF')   return 'ACTIF'
  if (statut === 'ACTIVE')    return 'INACTIVE'
  if (statut === 'INACTIVE')  return 'ACTIVE'
  return statut
}

export function isActif(statut: string): boolean {
  return statut === 'ACTIF' || statut === 'ACTIVE'
}
