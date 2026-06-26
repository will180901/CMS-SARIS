/**
 * bon-pharmacie.api.ts — Bon de pharmacie (recueil) : voucher de retrait de médicaments,
 * réservé au personnel CDI + ayants droit.
 */
import { api } from '@/lib/api'

export interface LigneBonPharmacie {
  id:           string
  medicamentId: string | null
  libelle:      string
  posologie:    string | null
  quantite:     string | null
  medicament?:  { id: string; nomGenerique: string; nomCommercial: string | null } | null
}

export interface BonPharmacie {
  id:              string
  consultationId:  string
  prescripteurId:  string
  statut:          'EN_ATTENTE' | 'DELIVRE' | 'ANNULE'
  observations:    string | null
  delivreLe:       string | null
  delivrePar:      string | null
  motifAnnulation: string | null
  createdAt:       string
  lignes:          LigneBonPharmacie[]
  consultation: {
    id: string
    visite: { patient: { id: string; numeroPatient: string; identite: { nom: string; prenom: string; dateNaissance: string; sexe: string } | null } }
  }
}

export interface LigneBonPharmaciePayload {
  medicamentId?: string | null
  libelle:       string
  posologie?:    string
  quantite?:     string
}

export interface CreateBonPharmaciePayload {
  consultationId: string
  observations?:  string
  lignes:         LigneBonPharmaciePayload[]
}

export interface BonPharmacieQueryParams {
  consultationId?: string
  patientId?:      string
  statut?:         string
}

export const bonPharmacieApi = {
  list:     (params?: BonPharmacieQueryParams) => api.get<BonPharmacie[]>('/bons-pharmacie', params as Record<string, string>),
  findById: (id: string)                        => api.get<BonPharmacie>(`/bons-pharmacie/${id}`),
  create:   (data: CreateBonPharmaciePayload)   => api.post<BonPharmacie>('/bons-pharmacie', data),
  deliver:  (id: string, delivrePar?: string)   => api.patch<BonPharmacie>(`/bons-pharmacie/${id}/delivrer`, { delivrePar }),
  annuler:  (id: string, motifAnnulation: string) => api.patch<BonPharmacie>(`/bons-pharmacie/${id}/annuler`, { motifAnnulation }),
  remove:   (id: string)                        => api.delete<{ id: string; deleted: true }>(`/bons-pharmacie/${id}`),
}
