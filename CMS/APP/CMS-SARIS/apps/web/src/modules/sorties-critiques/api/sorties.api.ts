/**
 * sorties.api.ts — API pour Évacuation.
 */

import { api } from '@/lib/api'

// ── Évacuation ────────────────────────────────────────────────────────────────

export interface SuiviEvacuation {
  id:           string
  evacuationId: string
  notes:        string
  statut:       string
  createdAt:    string
  createdBy:    string | null
}

export interface Evacuation {
  id:               string
  consultationId:   string
  niveauUrgence:    'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE'
  motifId:          string | null
  etablissementId:  string | null
  infosCliniques:   string
  statut:           'EN_COURS' | 'CLOTURE' | 'ANNULE'
  motifAnnulation:  string | null
  createdAt:        string
  consultation: {
    id: string; createdAt: string
    visite: { patient: { id: string; numeroPatient: string; identite: { nom: string; prenom: string; dateNaissance: string; sexe: string } | null } }
  }
  etablissement: { id: string; nom: string; type: string } | null
  suivi:        SuiviEvacuation[]
}

export interface CreateEvacuationPayload {
  consultationId:   string
  niveauUrgence:    'BASSE' | 'MOYENNE' | 'HAUTE' | 'CRITIQUE'
  motifId?:         string
  etablissementId?: string
  infosCliniques:   string
}

export interface AddSuiviEvacuationPayload {
  notes:  string
  statut: 'EN_COURS' | 'EN_TRANSPORT' | 'ADMIS' | 'CLOTURE'
}

// ── API ───────────────────────────────────────────────────────────────────────

export const evacuationsApi = {
  list:     (params?: { consultationId?: string; patientId?: string; statut?: string }) =>
    api.get<Evacuation[]>('/evacuations', params as Record<string, string>),
  findById: (id: string) => api.get<Evacuation>(`/evacuations/${id}`),
  create:   (data: CreateEvacuationPayload) => api.post<Evacuation>('/evacuations', data),
  addSuivi: (id: string, data: AddSuiviEvacuationPayload) => api.post<Evacuation>(`/evacuations/${id}/suivi`, data),
  annuler:  (id: string, motif: string) => api.patch<Evacuation>(`/evacuations/${id}/annuler`, { motifAnnulation: motif }),
  cloturer: (id: string) => api.patch<Evacuation>(`/evacuations/${id}/cloturer`),
  supprimer: (id: string) => api.delete<{ id: string; deleted: boolean }>(`/evacuations/${id}`),
}
