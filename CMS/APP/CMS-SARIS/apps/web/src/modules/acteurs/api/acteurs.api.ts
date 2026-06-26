/**
 * acteurs.api.ts
 * Couche d'accès aux données — Délégations de prescription.
 * (Le personnel est désormais géré via les comptes utilisateurs ; les sous-traitants
 *  vivent dans le module Référentiels. Ne reste ici que la délégation.)
 */

import { api } from '@/lib/api'
import type { DelegationPrescription } from '@cms-saris/types'

// ── Délégations — Payload types ───────────────────────────────────────────────

export interface CreateDelegationPayload {
  medecinChefId:  string
  infirmierId:    string
  dateDebut:      string
  dateFin:        string
  perimetre?:     string
}

export interface UpdateDelegationPayload {
  medecinChefId?: string
  infirmierId?:   string
  dateDebut?:     string
  dateFin?:       string
  perimetre?:     string
}

// ── API object ─────────────────────────────────────────────────────────────────

export const acteursApi = {
  delegations: {
    list:         ()                                           => api.get<DelegationPrescription[]>('/delegations'),
    create:       (data: CreateDelegationPayload)              => api.post<DelegationPrescription>('/delegations', data),
    update:       (id: string, data: UpdateDelegationPayload)  => api.patch<DelegationPrescription>(`/delegations/${id}`, data),
    toggleStatut: (id: string, statut: 'ACTIVE' | 'INACTIVE')  => api.patch<DelegationPrescription>(`/delegations/${id}/statut`, { statut }),
    remove:       (id: string)                                 => api.delete<{ id: string; deleted: true }>(`/delegations/${id}`),
  },
}
