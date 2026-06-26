/**
 * personnel.api.ts — Personnel soignant (PersonnelMedical) : agents cliniques du
 * centre, assignables au triage / consultation. Géré par le médecin-chef / admin.
 */
import { api } from '@/lib/api'

export type RolePersonnel = 'MEDECIN' | 'INFIRMIER' | 'SAGE_FEMME' | 'TECHNICIEN_LAB' | 'ADMINISTRATIF'

export interface PersonnelMedical {
  id:        string
  nom:       string
  prenom:    string
  matricule: string
  role:      string
  siteId:    string | null
  statut:    string
  createdAt: string
}

export interface PersonnelPayload {
  matricule: string
  nom:       string
  prenom:    string
  role:      string
  siteId?:   string
}

export interface PersonnelQueryParams {
  search?: string
  role?:   string
  statut?: string
  siteId?: string
}

export const personnelApi = {
  list:      (params?: PersonnelQueryParams) => api.get<PersonnelMedical[]>('/personnel', params as Record<string, string>),
  create:    (data: PersonnelPayload)        => api.post<PersonnelMedical>('/personnel', data),
  update:    (id: string, data: Partial<PersonnelPayload>) => api.patch<PersonnelMedical>(`/personnel/${id}`, data),
  setStatut: (id: string, statut: 'ACTIF' | 'INACTIF')     => api.patch<PersonnelMedical>(`/personnel/${id}/statut`, { statut }),
  remove:    (id: string)                    => api.delete<{ id: string; deleted: true }>(`/personnel/${id}`),
}
