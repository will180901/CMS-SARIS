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
  /** Ordonnance PHARMACEUTIQUE dont ce bon a été généré (null pour un bon historique). */
  ordonnanceId?:   string | null
  /** Statut actuel de cette ordonnance — signale un bon dont l'ordonnance a été annulée après coup. */
  ordonnance?:     { id: string; statut: string } | null
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
    visite: { patient: { id: string; numeroPatient: string; identite: { nom: string; prenom: string; dateNaissance: string | null; sexe: string | null } | null } }
  }
}

// Pas de payload de création ici : un bon de pharmacie naît exclusivement de « Générer un
// bon » sur une ordonnance PHARMACEUTIQUE validée (consultationApi.genererBon).

export interface BonPharmacieQueryParams {
  consultationId?: string
  patientId?:      string
  statut?:         string
}

export const bonPharmacieApi = {
  list:     (params?: BonPharmacieQueryParams) => api.get<BonPharmacie[]>('/bons-pharmacie', params as Record<string, string>),
  findById: (id: string)                        => api.get<BonPharmacie>(`/bons-pharmacie/${id}`),
  deliver:  (id: string, delivrePar?: string)   => api.patch<BonPharmacie>(`/bons-pharmacie/${id}/delivrer`, { delivrePar }),
  annuler:  (id: string, motifAnnulation: string) => api.patch<BonPharmacie>(`/bons-pharmacie/${id}/annuler`, { motifAnnulation }),
  remove:   (id: string)                        => api.delete<{ id: string; deleted: true }>(`/bons-pharmacie/${id}`),
}
