/**
 * employes.api.ts — Registre des employés SARIS (main-d'œuvre patiente : CDI/CDD).
 * Reconnaissance dynamique par matricule à l'accueil.
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

export const employesApi = {
  lookup: (matricule: string) => api.get<EmployeSaris | null>(`/employes/lookup/${encodeURIComponent(matricule)}`),
}
