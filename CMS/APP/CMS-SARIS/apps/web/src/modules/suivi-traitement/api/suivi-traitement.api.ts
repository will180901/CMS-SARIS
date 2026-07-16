/**
 * suivi-traitement.api.ts — API pour Suivi de traitement.
 */

import { api } from '@/lib/api'

// ── Suivi de traitement ─────────────────────────────────────────────────────────

export interface FicheSuiviTraitement {
  id:                     string
  suiviTraitementId:      string
  temperature:            number | null
  tensionSystolique:      number | null
  tensionDiastolique:     number | null
  frequenceCardiaque:     number | null
  frequenceRespiratoire:  number | null
  saturationO2:           number | null
  poids:                  number | null
  noteEvolution:          string | null
  medicamentsAdministres: string | null
  resultatExamen:         string | null
  createdAt:              string
  createdBy:              string | null
}

export interface SuiviTraitement {
  id:              string
  consultationId:  string
  motif:           string
  statut:          'EN_COURS' | 'CLOTURE' | 'ANNULE'
  motifCloture:    string | null
  motifAnnulation: string | null
  createdAt:       string
  closedAt:        string | null
  consultation: {
    id: string; createdAt: string
    visite: { patient: { id: string; numeroPatient: string; identite: { nom: string; prenom: string; dateNaissance: string | null; sexe: string | null } | null } }
  }
  fiches: FicheSuiviTraitement[]
}

export interface CreateSuiviTraitementPayload {
  consultationId: string
  motif:          string
}

export interface AddFicheSuiviPayload {
  temperature?:            number
  tensionSystolique?:      number
  tensionDiastolique?:     number
  frequenceCardiaque?:     number
  frequenceRespiratoire?:  number
  saturationO2?:           number
  poids?:                  number
  noteEvolution?:          string
  medicamentsAdministres?: string
  resultatExamen?:         string
}

// ── API ───────────────────────────────────────────────────────────────────────

export const suiviTraitementApi = {
  list:     (params?: { consultationId?: string; patientId?: string; statut?: string }) =>
    api.get<SuiviTraitement[]>('/suivi-traitement', params as Record<string, string>),
  findById: (id: string) => api.get<SuiviTraitement>(`/suivi-traitement/${id}`),
  create:   (data: CreateSuiviTraitementPayload) => api.post<SuiviTraitement>('/suivi-traitement', data),
  addFiche: (id: string, data: AddFicheSuiviPayload) => api.post<SuiviTraitement>(`/suivi-traitement/${id}/fiches`, data),
  updateFiche: (id: string, ficheId: string, data: AddFicheSuiviPayload) => api.patch<SuiviTraitement>(`/suivi-traitement/${id}/fiches/${ficheId}`, data),
  cloturer: (id: string, motifCloture?: string) => api.patch<SuiviTraitement>(`/suivi-traitement/${id}/cloturer`, { motifCloture }),
  annuler:  (id: string, motif: string) => api.patch<SuiviTraitement>(`/suivi-traitement/${id}/annuler`, { motifAnnulation: motif }),
  supprimer: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/suivi-traitement/${id}`),
}
