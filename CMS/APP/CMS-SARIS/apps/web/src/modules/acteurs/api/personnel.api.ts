/**
 * personnel.api.ts — Personnel soignant (PersonnelMedical) : agents cliniques du
 * centre, assignables au triage / consultation. Géré par le médecin-chef / admin.
 */
import { api } from '@/lib/api'
import type { PersonnelMedical, RolePersonnel, TypeContratPersonnel } from '@cms-saris/types'

export type { PersonnelMedical, RolePersonnel, TypeContratPersonnel }

export interface PersonnelPayload {
  matricule: string
  nom:       string
  prenom:    string
  role:      RolePersonnel
  siteId?:   string
  // Données d'employé de la SARIS — null (ou texte vide) = effacer
  dateNaissance?: string | null
  sexe?:          'M' | 'F' | null
  typeContrat?:   TypeContratPersonnel
  sectionPaie?:   string
  service?:       string
  departement?:   string
}

export interface PersonnelQueryParams {
  search?: string
  role?:   string
  statut?: string
}

export const personnelApi = {
  list:      (params?: PersonnelQueryParams) => api.get<PersonnelMedical[]>('/personnel', params as Record<string, string>),
  create:    (data: PersonnelPayload)        => api.post<PersonnelMedical>('/personnel', data),
  update:    (id: string, data: Partial<PersonnelPayload>) => api.patch<PersonnelMedical>(`/personnel/${id}`, data),
  setStatut: (id: string, statut: 'ACTIF' | 'INACTIF')     => api.patch<PersonnelMedical>(`/personnel/${id}/statut`, { statut }),
  remove:    (id: string)                    => api.delete<{ id: string; deleted: true }>(`/personnel/${id}`),
}
