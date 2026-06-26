/**
 * employes.api.ts — Registre des employés SARIS (main-d'œuvre patiente : CDI/CDD).
 * Reconnaissance dynamique par matricule à l'accueil + gestion dans Référentiels.
 */
import { api } from '@/lib/api'

export interface EmployeSaris {
  id:            string
  matricule:     string
  nom:           string
  prenom:        string
  dateNaissance: string | null
  sexe:          string | null
  fonction:      string | null
  sectionPaie:   string | null
  service:       string | null
  departement:   string | null
  categorie:     string
  statut:        string
  createdAt:     string
}

export interface EmployePayload {
  matricule:     string
  nom:           string
  prenom:        string
  dateNaissance?: string
  sexe?:         string
  fonction?:     string
  sectionPaie?:  string
  service?:      string
  departement?:  string
  categorie:     string
}

export interface EmployeQueryParams {
  search?:    string
  categorie?: string
  statut?:    string
}

export const employesApi = {
  list:   (params?: EmployeQueryParams) => api.get<EmployeSaris[]>('/employes', params as Record<string, string>),
  lookup: (matricule: string)           => api.get<EmployeSaris | null>(`/employes/lookup/${encodeURIComponent(matricule)}`),
  create: (data: EmployePayload)        => api.post<EmployeSaris>('/employes', data),
  update: (id: string, data: Partial<EmployePayload> & { statut?: string }) => api.patch<EmployeSaris>(`/employes/${id}`, data),
  remove: (id: string)                  => api.delete<{ id: string; deleted: true }>(`/employes/${id}`),
}
